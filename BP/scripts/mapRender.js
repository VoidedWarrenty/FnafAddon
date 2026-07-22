import { world } from "@minecraft/server";

// Top-down ASCII map. Every cell is '█', color changes per classification.
//
// Cell classification (highest priority wins):
//   wall     = a block on an AABB perimeter is solid → §f white
//   doorway  = a block on an AABB perimeter is air   → §e yellow (opening)
//   interior = point inside an AABB, not on perimeter → §9 blue (floor)
//   exterior = point outside every AABB              → §0 black
//
// Furniture, decorations, checkerboard floors, etc. inside a room DON'T
// count as walls — walls are only what sits on the box perimeter the user
// painted. That's what the AABB is *for*.

const DEFAULT_MAX_COLS = 44;
const DEFAULT_MAX_ROWS = 18;

function unionBox(boxes) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    if (b.x1 < minX) minX = b.x1;
    if (b.x2 > maxX) maxX = b.x2;
    if (b.y1 < minY) minY = b.y1;
    if (b.y2 > maxY) maxY = b.y2;
    if (b.z1 < minZ) minZ = b.z1;
    if (b.z2 > maxZ) maxZ = b.z2;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function collectBoxes(rooms, dimensionId) {
  const out = [];
  for (const r of rooms) {
    for (const b of r.boxes) {
      if (b.dim === dimensionId) out.push(b);
    }
  }
  return out;
}

// Classify a single world point at (sx, sy, sz) against the box set.
// Returns "wall" | "doorway" | "interior" | "exterior".
function classifyPoint(dim, sx, sy, sz, boxes) {
  let inRoom = false, onPerim = false;
  for (const b of boxes) {
    if (sy < b.y1 || sy > b.y2) continue;
    const inX = sx >= b.x1 && sx <= b.x2;
    const inZ = sz >= b.z1 && sz <= b.z2;
    if (inX && inZ) {
      inRoom = true;
      if (sx === b.x1 || sx === b.x2 || sz === b.z1 || sz === b.z2) {
        onPerim = true;
        break;
      }
    }
  }
  if (!inRoom) return "exterior";
  if (!onPerim) return "interior";
  let solid = false;
  try {
    const block = dim.getBlock({ x: sx, y: sy, z: sz });
    if (block && block.typeId !== "minecraft:air") solid = true;
  } catch (_) {}
  return solid ? "wall" : "doorway";
}

const PRIORITY = { wall: 4, doorway: 3, interior: 2, exterior: 1 };

// A downsampled cell picks the highest-priority classification of any point
// it covers. Wall trumps doorway trumps interior trumps exterior.
function classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, boxes) {
  let best = "exterior";
  for (const sy of scanYs) {
    for (let sx = wx1; sx <= wx2; sx++) {
      for (let sz = wz1; sz <= wz2; sz++) {
        const cls = classifyPoint(dim, sx, sy, sz, boxes);
        if (PRIORITY[cls] > PRIORITY[best]) best = cls;
        if (best === "wall") return "wall";
      }
    }
  }
  return best;
}

function renderMapGrid(dimensionId, rooms, options = {}) {
  const maxCols = options.maxCols ?? DEFAULT_MAX_COLS;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const boxes = collectBoxes(rooms, dimensionId);
  if (boxes.length === 0) return null;

  const bb = unionBox(boxes);
  const padX = 1, padZ = 1;
  const minX = bb.minX - padX, maxX = bb.maxX + padX;
  const minZ = bb.minZ - padZ, maxZ = bb.maxZ + padZ;
  const worldW = maxX - minX + 1;
  const worldD = maxZ - minZ + 1;

  const cellW = Math.max(1, Math.ceil(worldW / maxCols));
  const cellD = Math.max(1, Math.ceil(worldD / maxRows));
  const cols = Math.ceil(worldW / cellW);
  const rows = Math.ceil(worldD / cellD);

  // Sample multiple Y levels above every box's floor so a wall at any
  // height counts. Skip the top of the room to avoid ceiling blocks.
  const scanYs = [];
  for (const b of boxes) {
    for (let k = 1; k <= 3; k++) {
      const y = b.y1 + k;
      if (y < b.y2 && !scanYs.includes(y)) scanYs.push(y);
    }
  }
  if (scanYs.length === 0) scanYs.push(Math.floor((bb.minY + bb.maxY) / 2));

  const dim = world.getDimension(dimensionId);
  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    let currentColor = "";
    const wz1 = minZ + ry * cellD;
    const wz2 = Math.min(wz1 + cellD - 1, maxZ);
    for (let cx = 0; cx < cols; cx++) {
      const wx1 = minX + cx * cellW;
      const wx2 = Math.min(wx1 + cellW - 1, maxX);
      const cls = classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, boxes);
      let color;
      if (cls === "wall")          color = "§f";
      else if (cls === "doorway")  color = "§e";
      else if (cls === "interior") color = "§9";
      else                          color = "§0";
      if (color !== currentColor) { line += color; currentColor = color; }
      line += "█";
    }
    lines.push(line);
  }
  return { lines, cols, rows, minX, minZ, cellW, cellD };
}

export function renderMap(dimensionId, rooms, options = {}) {
  const grid = renderMapGrid(dimensionId, rooms, options);
  if (!grid) return "§8§o(no boxes defined for this dimension)";
  const { lines, cols, minX, minZ, cellW, cellD } = grid;
  const w = cols;

  const compass = "§b   N §7▲";
  const dirBar = "§7W ◀ ─" + "─".repeat(Math.max(1, w - 12)) + "─ ▶ E";
  const top    = "§9╔" + "═".repeat(w) + "╗";
  const bottom = "§9╚" + "═".repeat(w) + "╝";
  const framed = lines.map(l => `§9║${l}§9║`);
  const scale = `§8§oscale §7≈ §f${cellW}§7×§f${cellD}§7 blocks/cell   §8origin §7X§f${minX} §7Z§f${minZ}`;
  const legendKey = "§f█§7 wall  §e█§7 doorway  §9█§7 floor";

  return [
    compass,
    top,
    ...framed,
    bottom,
    dirBar,
    legendKey,
    scale,
  ].join("\n");
}

export function renderRoomLegend(rooms) {
  if (!rooms || rooms.length === 0) return "";
  const numbered = rooms.map((r, i) => `§b[${i + 1}]§r §f${r.name}`);
  const lines = [];
  for (let i = 0; i < numbered.length; i += 2) {
    const left = (numbered[i] || "").padEnd(28, " ");
    const right = numbered[i + 1] || "";
    lines.push(left + right);
  }
  return lines.join("\n");
}
