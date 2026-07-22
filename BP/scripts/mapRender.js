import { world } from "@minecraft/server";
import { pointInPolygon, floorsBounds } from "./blueprint.js";

// Top-down map. Uses proper single-line box-drawing characters —
// horizontals, verticals, corners — chosen per cell based on where the
// interior is relative to it. Doorways render as dashed chars; interior
// cells stay as spaces so walls read clearly against them. Room numbers
// get overlaid at each room's centroid cell.

const DEFAULT_MAX_COLS = 28;
const DEFAULT_MAX_ROWS = 14;

// Character set
const CH = {
  H:     "─",  // horizontal wall
  V:     "│",  // vertical wall
  NE:    "└",  // corner: interior to N + E
  NW:    "┘",  // corner: interior to N + W
  SE:    "┌",  // corner: interior to S + E
  SW:    "┐",  // corner: interior to S + W
  CROSS: "┼",  // wall passing through (T-junction fallback)
  DOOR_H: "╌", // dashed horizontal (doorway on horizontal wall)
  DOOR_V: "╎", // dashed vertical
  INTERIOR: " ",
  EXTERIOR: " ",
};

// Circled digits 1-9, then plain digits with brackets for 10+.
const ROOM_LABEL_CHARS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const ROOM_LABEL_COLORS = ["§b", "§e", "§d", "§a", "§6", "§5", "§3", "§2", "§4"];

function collectFloors(rooms, dimensionId) {
  const out = [];
  for (let ri = 0; ri < rooms.length; ri++) {
    const r = rooms[ri];
    for (const f of r.floors ?? []) {
      if (f.dim === dimensionId) out.push({ roomIndex: ri, room: r, floor: f });
    }
  }
  return out;
}

function edgeBlocks(a, b) {
  const out = [];
  let x0 = Math.round(a.x), z0 = Math.round(a.z);
  const x1 = Math.round(b.x), z1 = Math.round(b.z);
  const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  while (true) {
    out.push({ x: x0, z: z0 });
    if (x0 === x1 && z0 === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x0 += sx; }
    if (e2 < dx) { err += dx; z0 += sz; }
  }
  return out;
}

function precomputeFloorEdges(floors) {
  return floors.map(({ roomIndex, room, floor }) => {
    const edgeSet = new Set();
    const openingSet = new Set();
    const n = floor.polygon.length;
    for (let i = 0; i < n; i++) {
      const a = floor.polygon[i];
      const b = floor.polygon[(i + 1) % n];
      const blocks = edgeBlocks(a, b);
      for (const p of blocks) edgeSet.add(`${p.x},${p.z}`);
      const opens = (floor.openings ?? []).filter(o => o.segIdx === i);
      for (const o of opens) {
        for (let k = o.startBlock; k <= o.endBlock && k < blocks.length; k++) {
          const p = blocks[k];
          openingSet.add(`${p.x},${p.z}`);
        }
      }
    }
    return { roomIndex, room, floor, edgeSet, openingSet };
  });
}

// Classify a single world point against all floor infos.
// Returns { cls, roomIndex } — roomIndex points at whichever floor
// claimed this point (for coloring by room later; MVP just uses it for
// interior identity).
function classifyPoint(dim, x, sy, z, floorInfos) {
  let inRoom = false, onEdge = false, isExplicitOpening = false, roomIndex = -1;
  for (const fi of floorInfos) {
    if (sy < fi.floor.floorY || sy > fi.floor.ceilingY) continue;
    const key = `${x},${z}`;
    if (fi.edgeSet.has(key)) {
      onEdge = true;
      if (fi.openingSet.has(key)) isExplicitOpening = true;
    }
    if (pointInPolygon(x, z, fi.floor.polygon)) {
      inRoom = true;
      if (roomIndex < 0) roomIndex = fi.roomIndex;
    }
  }
  if (!inRoom && !onEdge) return { cls: "exterior" };
  if (onEdge) {
    if (isExplicitOpening) return { cls: "doorway", roomIndex };
    let solid = false;
    try {
      const b = dim.getBlock({ x, y: sy, z });
      if (b && b.typeId !== "minecraft:air") solid = true;
    } catch (_) {}
    return { cls: solid ? "wall" : "doorway", roomIndex };
  }
  return { cls: "interior", roomIndex };
}

const PRIORITY = { wall: 4, doorway: 3, interior: 2, exterior: 1 };

// Classify a downsampled cell (may span cellW × cellD blocks).
function classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, floorInfos) {
  let best = { cls: "exterior", roomIndex: -1 };
  for (const sy of scanYs) {
    for (let sx = wx1; sx <= wx2; sx++) {
      for (let sz = wz1; sz <= wz2; sz++) {
        const cur = classifyPoint(dim, sx, sy, sz, floorInfos);
        if (PRIORITY[cur.cls] > PRIORITY[best.cls]) best = cur;
        if (best.cls === "wall") return best;
      }
    }
  }
  return best;
}

// Given a wall cell and its 4 neighbors' classifications, pick the box-
// drawing character that best represents the wall's direction. Interior
// neighbors reveal which side the room is on.
function wallChar(n, s, e, w) {
  const intN = n === "interior";
  const intS = s === "interior";
  const intE = e === "interior";
  const intW = w === "interior";

  // Corners take priority (two adjacent interiors).
  if (intN && intE) return CH.NE;
  if (intN && intW) return CH.NW;
  if (intS && intE) return CH.SE;
  if (intS && intW) return CH.SW;
  // Straight walls: horizontal if interior is above or below.
  if (intN || intS) return CH.H;
  if (intE || intW) return CH.V;
  // Wall with no interior neighbor — probably an external corner or
  // an isolated wall bit. Use horizontal as a fallback.
  return CH.H;
}

function doorwayChar(n, s, e, w) {
  const horiz = (n === "interior" || s === "interior");
  return horiz ? CH.DOOR_H : CH.DOOR_V;
}

// Compute each room's centroid cell so we can overlay a room label.
function computeRoomLabels(rooms, dimensionId, minX, minZ, cellW, cellD, cols, rows) {
  const labels = new Map(); // "col,row" -> { text, colorCode }
  for (let ri = 0; ri < rooms.length; ri++) {
    const r = rooms[ri];
    const floors = (r.floors ?? []).filter(f => f.dim === dimensionId);
    if (floors.length === 0) continue;
    let sumX = 0, sumZ = 0, n = 0;
    for (const f of floors) {
      for (const p of f.polygon) { sumX += p.x; sumZ += p.z; n++; }
    }
    if (n === 0) continue;
    const cx = sumX / n, cz = sumZ / n;
    const col = Math.floor((cx - minX) / cellW);
    const row = Math.floor((cz - minZ) / cellD);
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
    labels.set(`${col},${row}`, {
      text: ROOM_LABEL_CHARS[ri] ?? `${ri + 1}`,
      color: ROOM_LABEL_COLORS[ri % ROOM_LABEL_COLORS.length],
    });
  }
  return labels;
}

function renderGrid(dimensionId, rooms, options = {}) {
  const maxCols = options.maxCols ?? DEFAULT_MAX_COLS;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const floors = collectFloors(rooms, dimensionId);
  if (floors.length === 0) return null;

  const bb = floorsBounds(rooms, dimensionId);
  const padX = 1, padZ = 1;
  const minX = bb.minX - padX, maxX = bb.maxX + padX;
  const minZ = bb.minZ - padZ, maxZ = bb.maxZ + padZ;
  const worldW = maxX - minX + 1;
  const worldD = maxZ - minZ + 1;

  const cellW = Math.max(1, Math.ceil(worldW / maxCols));
  const cellD = Math.max(1, Math.ceil(worldD / maxRows));
  const cols = Math.ceil(worldW / cellW);
  const rows = Math.ceil(worldD / cellD);

  const scanYs = [];
  for (const fi of floors) {
    for (let k = 1; k <= 3; k++) {
      const y = fi.floor.floorY + k;
      if (y < fi.floor.ceilingY && !scanYs.includes(y)) scanYs.push(y);
    }
  }
  if (scanYs.length === 0) scanYs.push(Math.floor((bb.minY + bb.maxY) / 2));

  const dim = world.getDimension(dimensionId);
  const floorInfos = precomputeFloorEdges(floors);

  // First pass: classify every cell so we can inspect neighbors.
  const cellClass = new Array(cols * rows);
  for (let ry = 0; ry < rows; ry++) {
    const wz1 = minZ + ry * cellD;
    const wz2 = Math.min(wz1 + cellD - 1, maxZ);
    for (let cx = 0; cx < cols; cx++) {
      const wx1 = minX + cx * cellW;
      const wx2 = Math.min(wx1 + cellW - 1, maxX);
      cellClass[ry * cols + cx] = classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, floorInfos);
    }
  }

  const labels = computeRoomLabels(rooms, dimensionId, minX, minZ, cellW, cellD, cols, rows);

  return {
    cellClass, labels,
    cols, rows,
    minX, minZ,
    cellW, cellD,
  };
}

function styleFor(name) {
  if (name === "panel") {
    return { wall: "§f", doorway: "§e", interior: "§0", exterior: "§0", frame: "§8" };
  }
  return { wall: "§f", doorway: "§e", interior: "§9", exterior: "§0", frame: "§9" };
}

export function renderMap(dimensionId, rooms, options = {}) {
  const grid = renderGrid(dimensionId, rooms, options);
  if (!grid) return "§8§o(no floors defined for this dimension)";
  const { cellClass, labels, cols, rows, minX, minZ, cellW, cellD } = grid;
  const style = styleFor(options.style);

  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    let currentColor = "";
    for (let cx = 0; cx < cols; cx++) {
      const key = `${cx},${ry}`;
      const label = labels.get(key);
      const cell = cellClass[ry * cols + cx];

      // Room label overrides cell content when placed on interior/wall
      // (not exterior). This makes each room's number visible at its
      // centroid.
      if (label && cell.cls !== "exterior") {
        if (label.color !== currentColor) { line += label.color; currentColor = label.color; }
        line += label.text;
        continue;
      }

      let ch, color;
      if (cell.cls === "wall") {
        const n = ry > 0 ? cellClass[(ry - 1) * cols + cx].cls : "exterior";
        const s = ry < rows - 1 ? cellClass[(ry + 1) * cols + cx].cls : "exterior";
        const w = cx > 0 ? cellClass[ry * cols + (cx - 1)].cls : "exterior";
        const e = cx < cols - 1 ? cellClass[ry * cols + (cx + 1)].cls : "exterior";
        ch = wallChar(n, s, e, w);
        color = style.wall;
      } else if (cell.cls === "doorway") {
        const n = ry > 0 ? cellClass[(ry - 1) * cols + cx].cls : "exterior";
        const s = ry < rows - 1 ? cellClass[(ry + 1) * cols + cx].cls : "exterior";
        const w = cx > 0 ? cellClass[ry * cols + (cx - 1)].cls : "exterior";
        const e = cx < cols - 1 ? cellClass[ry * cols + (cx + 1)].cls : "exterior";
        ch = doorwayChar(n, s, e, w);
        color = style.doorway;
      } else if (cell.cls === "interior") {
        ch = CH.INTERIOR;
        color = style.interior;
      } else {
        ch = CH.EXTERIOR;
        color = style.exterior;
      }
      if (color !== currentColor) { line += color; currentColor = color; }
      line += ch;
    }
    lines.push(line);
  }

  const w = cols;
  const compass = "§b   N §7▲";
  const top    = `${style.frame}┌` + "─".repeat(w) + "┐";
  const bottom = `${style.frame}└` + "─".repeat(w) + "┘";
  const framed = lines.map(l => `${style.frame}│${l}${style.frame}│`);
  const scale = `§8§oscale §7≈ §f${cellW}§7×§f${cellD}§7 b/cell   §8origin §7X§f${minX} §7Z§f${minZ}`;
  return [compass, top, ...framed, bottom, scale].join("\n");
}

// A compact numbered legend below the map. Rooms in 2 columns.
export function renderRoomLegend(rooms) {
  if (!rooms || rooms.length === 0) return "";
  const numbered = rooms.map((r, i) => {
    const glyph = ROOM_LABEL_CHARS[i] ?? `[${i + 1}]`;
    const color = ROOM_LABEL_COLORS[i % ROOM_LABEL_COLORS.length];
    return `${color}${glyph}§r §f${r.name}`;
  });
  const lines = [];
  for (let i = 0; i < numbered.length; i += 2) {
    const left = (numbered[i] || "").padEnd(26, " ");
    const right = numbered[i + 1] || "";
    lines.push(left + right);
  }
  return lines.join("\n");
}
