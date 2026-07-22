import { world } from "@minecraft/server";
import { pointInPolygon, floorsBounds } from "./blueprint.js";

// Top-down ASCII map. Every cell is '█', color varies by classification.
//
// Cells classify against the applied blueprint's polygon floors:
//   wall      = cell sits ON a polygon edge AND the world block at
//               that XZ (at floor+1..3) is solid — a real wall built
//   doorway   = cell sits ON a polygon edge AND the world block is air
//               OR the edge is marked as an explicit opening in blueprint
//   interior  = cell is inside a polygon (any floor) but not on an edge
//   exterior  = outside every floor's polygon
//
// Two styles: "blueprint" (paper-blue interior + yellow doors) and
// "panel" (mono schematic: white walls only, black background).

const DEFAULT_MAX_COLS = 44;
const DEFAULT_MAX_ROWS = 18;

function collectFloors(rooms, dimensionId) {
  const out = [];
  for (const r of rooms) {
    for (const f of r.floors ?? []) {
      if (f.dim === dimensionId) out.push({ room: r, floor: f });
    }
  }
  return out;
}

// Rasterize a polygon edge into world block XZ coords using Bresenham.
// Returns array of {x, z}.
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

// For each floor, precompute:
//   edgeSet: Set<"x,z"> of world XZ points that are on ANY edge of the polygon
//   openingSet: Set<"x,z"> of world XZ points that are within an explicit opening
function precomputeFloorEdges(floors) {
  return floors.map(({ room, floor }) => {
    const edgeSet = new Set();
    const openingSet = new Set();
    const n = floor.polygon.length;
    for (let i = 0; i < n; i++) {
      const a = floor.polygon[i];
      const b = floor.polygon[(i + 1) % n];
      const blocks = edgeBlocks(a, b);
      for (const p of blocks) edgeSet.add(`${p.x},${p.z}`);
      // Explicit openings marked on this edge
      const opens = (floor.openings ?? []).filter(o => o.segIdx === i);
      for (const o of opens) {
        for (let k = o.startBlock; k <= o.endBlock && k < blocks.length; k++) {
          const p = blocks[k];
          openingSet.add(`${p.x},${p.z}`);
        }
      }
    }
    return { room, floor, edgeSet, openingSet };
  });
}

function classifyPoint(dim, x, sy, z, floorInfos) {
  let inRoom = false, onEdge = false, isExplicitOpening = false;
  for (const fi of floorInfos) {
    if (sy < fi.floor.floorY || sy > fi.floor.ceilingY) continue;
    const key = `${x},${z}`;
    if (fi.edgeSet.has(key)) {
      onEdge = true;
      if (fi.openingSet.has(key)) isExplicitOpening = true;
    }
    if (pointInPolygon(x, z, fi.floor.polygon)) inRoom = true;
  }
  if (!inRoom && !onEdge) return "exterior";
  if (onEdge) {
    if (isExplicitOpening) return "doorway";
    // Check world block for actual wall vs door
    let solid = false;
    try {
      const b = dim.getBlock({ x, y: sy, z });
      if (b && b.typeId !== "minecraft:air") solid = true;
    } catch (_) {}
    return solid ? "wall" : "doorway";
  }
  return "interior";
}

const PRIORITY = { wall: 4, doorway: 3, interior: 2, exterior: 1 };

function classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, floorInfos) {
  let best = "exterior";
  for (const sy of scanYs) {
    for (let sx = wx1; sx <= wx2; sx++) {
      for (let sz = wz1; sz <= wz2; sz++) {
        const cls = classifyPoint(dim, sx, sy, sz, floorInfos);
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
  for (const f of floors) {
    for (let k = 1; k <= 3; k++) {
      const y = f.floor.floorY + k;
      if (y < f.floor.ceilingY && !scanYs.includes(y)) scanYs.push(y);
    }
  }
  if (scanYs.length === 0) scanYs.push(Math.floor((bb.minY + bb.maxY) / 2));

  const dim = world.getDimension(dimensionId);
  const floorInfos = precomputeFloorEdges(floors);

  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    let currentColor = "";
    const wz1 = minZ + ry * cellD;
    const wz2 = Math.min(wz1 + cellD - 1, maxZ);
    for (let cx = 0; cx < cols; cx++) {
      const wx1 = minX + cx * cellW;
      const wx2 = Math.min(wx1 + cellW - 1, maxX);
      const cls = classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, floorInfos);
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

function styleFor(name) {
  if (name === "panel") {
    return {
      wall: "§f", doorway: "§e", interior: "§0", exterior: "§0",
      frame: "§7", showLegend: false,
    };
  }
  return {
    wall: "§f", doorway: "§e", interior: "§9", exterior: "§0",
    frame: "§9", showLegend: true,
  };
}

export function renderMap(dimensionId, rooms, options = {}) {
  const grid = renderMapGrid(dimensionId, rooms, options);
  if (!grid) return "§8§o(no floors defined for this dimension)";
  const { lines, cols, minX, minZ, cellW, cellD } = grid;
  const w = cols;
  const style = styleFor(options.style);

  const paletteLines = lines.map(line => {
    let out = "", current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "§") {
        const code = line[i + 1];
        i++;
        let target;
        if (code === "f")      target = style.wall;
        else if (code === "e") target = style.doorway;
        else if (code === "9") target = style.interior;
        else                    target = style.exterior;
        if (target !== current) { out += target; current = target; }
      } else {
        out += ch;
      }
    }
    return out;
  });

  const compass = "§b   N §7▲";
  const dirBar = "§7W ◀ ─" + "─".repeat(Math.max(1, w - 12)) + "─ ▶ E";
  const top    = `${style.frame}╔` + "═".repeat(w) + "╗";
  const bottom = `${style.frame}╚` + "═".repeat(w) + "╝";
  const framed = paletteLines.map(l => `${style.frame}║${l}${style.frame}║`);
  const scale = `§8§oscale §7≈ §f${cellW}§7×§f${cellD}§7 blocks/cell   §8origin §7X§f${minX} §7Z§f${minZ}`;

  const parts = [compass, top, ...framed, bottom, dirBar];
  if (style.showLegend) parts.push("§f█§7 wall  §e█§7 doorway  §9█§7 floor");
  parts.push(scale);
  return parts.join("\n");
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
