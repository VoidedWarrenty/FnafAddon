import { world } from "@minecraft/server";
import { pointInRoom } from "./blueprint.js";

// Fixed grid size — must match the JSON-UI grid_dimensions in
// RP/ui/server_form.json. 16 wide × 10 tall = 160 buttons.
// (Down from 24×14=336 for open-time performance on mobile.)
export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const GRID_TOTAL = GRID_COLS * GRID_ROWS;

// The set of tile names must match PNG files at
// RP/textures/ui/breaker_tiles/<name>.png.
export const TILE_PATH = "textures/ui/breaker_tiles/";
export const TILES = {
  BLANK: "blank",
  FLOOR: "floor",
  WALL_N: "wall_n", WALL_S: "wall_s", WALL_E: "wall_e", WALL_W: "wall_w",
  CORNER_NE: "corner_ne", CORNER_NW: "corner_nw",
  CORNER_SE: "corner_se", CORNER_SW: "corner_sw",
  DOOR_H: "door_h", DOOR_V: "door_v",
  BREAKER_ON: "breaker_on", BREAKER_OFF: "breaker_off",
};

// Compute the union XZ bounding box of all boxes in the given dimension.
function unionXZ(boxes) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const b of boxes) {
    if (b.x1 < minX) minX = b.x1;
    if (b.x2 > maxX) maxX = b.x2;
    if (b.z1 < minZ) minZ = b.z1;
    if (b.z2 > maxZ) maxZ = b.z2;
    if (b.y1 < minY) minY = b.y1;
    if (b.y2 > maxY) maxY = b.y2;
  }
  return { minX, maxX, minZ, maxZ, minY, maxY };
}

function collectBoxes(rooms, dimensionId) {
  const out = [];
  for (const r of rooms) {
    for (const b of r.boxes) if (b.dim === dimensionId) out.push(b);
  }
  return out;
}

// For a single world (sx, sz) point, determine which room's perimeter it
// sits on (returns the box or null) and whether it's air/solid at scan Ys.
function scanPoint(dim, sx, sz, scanYs, boxes) {
  let onPerim = null;
  let inRoomOnly = false;
  for (const b of boxes) {
    const inX = sx >= b.x1 && sx <= b.x2;
    const inZ = sz >= b.z1 && sz <= b.z2;
    if (!inX || !inZ) continue;
    const perimX = sx === b.x1 || sx === b.x2;
    const perimZ = sz === b.z1 || sz === b.z2;
    if (perimX || perimZ) { onPerim = { b, perimX, perimZ }; break; }
    inRoomOnly = true;
  }
  if (!onPerim && !inRoomOnly) return { cls: "exterior" };
  if (!onPerim) return { cls: "interior" };
  // Perimeter: check solidity at any scan Y in the box's Y range
  let solid = false;
  for (const sy of scanYs) {
    if (sy < onPerim.b.y1 || sy > onPerim.b.y2) continue;
    try {
      const block = dim.getBlock({ x: sx, y: sy, z: sz });
      if (block && block.typeId !== "minecraft:air") { solid = true; break; }
    } catch (_) {}
  }
  return { cls: solid ? "wall" : "doorway", perimX: onPerim.perimX, perimZ: onPerim.perimZ };
}

// Classify a downsampled cell that covers world XZ [wx1..wx2, wz1..wz2].
// Returns { cls, perimX, perimZ } where perimX/Z reflect the majority
// perimeter direction of the sampled points, used to pick corner tiles.
function classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, boxes) {
  let bestCls = "exterior";
  let bestPerimX = false, bestPerimZ = false;
  const priority = { wall: 4, doorway: 3, interior: 2, exterior: 1 };
  for (let sx = wx1; sx <= wx2; sx++) {
    for (let sz = wz1; sz <= wz2; sz++) {
      const r = scanPoint(dim, sx, sz, scanYs, boxes);
      if (priority[r.cls] > priority[bestCls]) {
        bestCls = r.cls;
        bestPerimX = !!r.perimX;
        bestPerimZ = !!r.perimZ;
      } else if (priority[r.cls] === priority[bestCls] && (r.perimX || r.perimZ)) {
        bestPerimX = bestPerimX || !!r.perimX;
        bestPerimZ = bestPerimZ || !!r.perimZ;
      }
    }
  }
  return { cls: bestCls, perimX: bestPerimX, perimZ: bestPerimZ };
}

// Pick the tile name given the cell classification + neighbor context.
// Corner tiles are chosen when a cell has walls in two perpendicular
// directions (both perimX and perimZ set).
function pickTile(cell, north, south, east, west) {
  if (cell.cls === "exterior") return TILES.BLANK;
  if (cell.cls === "interior") return TILES.FLOOR;
  if (cell.cls === "doorway") {
    return cell.perimZ ? TILES.DOOR_H : TILES.DOOR_V;
  }
  // Wall. Decide direction from which neighbor is interior.
  // If interior is south, wall is on the north edge of the cell → wall_n
  const iN = north === "interior";
  const iS = south === "interior";
  const iE = east === "interior";
  const iW = west === "interior";
  // Corners take priority
  if (iS && iE) return TILES.CORNER_NW; // wall runs along top and left
  if (iS && iW) return TILES.CORNER_NE;
  if (iN && iE) return TILES.CORNER_SW;
  if (iN && iW) return TILES.CORNER_SE;
  if (iS) return TILES.WALL_N;
  if (iN) return TILES.WALL_S;
  if (iE) return TILES.WALL_W;
  if (iW) return TILES.WALL_E;
  // Ambiguous — pick something reasonable based on cell.perim flags
  if (cell.perimZ && !cell.perimX) return TILES.WALL_N;
  if (cell.perimX && !cell.perimZ) return TILES.WALL_W;
  return TILES.CORNER_NW;
}

// Map a world XZ to grid column/row (returns null if outside grid).
function worldToCell(sx, sz, minX, minZ, cellW, cellD) {
  const cx = Math.floor((sx - minX) / cellW);
  const cy = Math.floor((sz - minZ) / cellD);
  if (cx < 0 || cx >= GRID_COLS || cy < 0 || cy >= GRID_ROWS) return null;
  return { cx, cy };
}

// Compute XZ centroid of a room's union AABB.
function roomCentroid(room, dimensionId) {
  let sumX = 0, sumZ = 0, count = 0;
  for (const b of room.boxes) {
    if (b.dim !== dimensionId) continue;
    sumX += (b.x1 + b.x2) / 2;
    sumZ += (b.z1 + b.z2) / 2;
    count++;
  }
  if (count === 0) return null;
  return { x: sumX / count, z: sumZ / count };
}

// Classify the whole grid and place breakers.
// Returns { tiles: string[336], cellToRoom: Map<number, roomId> }.
export function buildTileGrid(dimensionId, rooms, breakerState) {
  const boxes = collectBoxes(rooms, dimensionId);
  const tiles = new Array(GRID_TOTAL).fill(TILES.BLANK);
  const cellToRoom = new Map();
  if (boxes.length === 0) return { tiles, cellToRoom };

  const bb = unionXZ(boxes);
  // Pad by 1 block on each side
  const minX = bb.minX - 1, maxX = bb.maxX + 1;
  const minZ = bb.minZ - 1, maxZ = bb.maxZ + 1;
  const worldW = maxX - minX + 1;
  const worldD = maxZ - minZ + 1;
  const cellW = Math.max(1, Math.ceil(worldW / GRID_COLS));
  const cellD = Math.max(1, Math.ceil(worldD / GRID_ROWS));

  const scanYs = [];
  for (const b of boxes) {
    for (let k = 1; k <= 3; k++) {
      const y = b.y1 + k;
      if (y < b.y2 && !scanYs.includes(y)) scanYs.push(y);
    }
  }
  if (scanYs.length === 0) scanYs.push(Math.floor((bb.minY + bb.maxY) / 2));

  const dim = world.getDimension(dimensionId);

  // First pass: classify each cell into cls (wall/doorway/interior/exterior)
  const cellData = new Array(GRID_TOTAL);
  for (let cy = 0; cy < GRID_ROWS; cy++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const wx1 = minX + cx * cellW;
      const wx2 = Math.min(wx1 + cellW - 1, maxX);
      const wz1 = minZ + cy * cellD;
      const wz2 = Math.min(wz1 + cellD - 1, maxZ);
      cellData[cy * GRID_COLS + cx] = classifyCell(dim, wx1, wx2, wz1, wz2, scanYs, boxes);
    }
  }

  // Second pass: pick tile names, using neighbors for corner/wall direction
  for (let cy = 0; cy < GRID_ROWS; cy++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      const idx = cy * GRID_COLS + cx;
      const cell = cellData[idx];
      const n = cy > 0 ? cellData[idx - GRID_COLS].cls : "exterior";
      const s = cy < GRID_ROWS - 1 ? cellData[idx + GRID_COLS].cls : "exterior";
      const w = cx > 0 ? cellData[idx - 1].cls : "exterior";
      const e = cx < GRID_COLS - 1 ? cellData[idx + 1].cls : "exterior";
      tiles[idx] = pickTile(cell, n, s, e, w);
    }
  }

  // Third pass: place breaker tiles at each room's centroid cell
  for (const room of rooms) {
    const c = roomCentroid(room, dimensionId);
    if (!c) continue;
    const cell = worldToCell(Math.round(c.x), Math.round(c.z), minX, minZ, cellW, cellD);
    if (!cell) continue;

    // If the centroid cell is a wall or exterior, walk outward looking for
    // the nearest interior cell (max 3 steps in each direction).
    let placeCx = cell.cx, placeCy = cell.cy;
    let placed = false;
    for (let radius = 0; radius <= 3 && !placed; radius++) {
      for (let dy = -radius; dy <= radius && !placed; dy++) {
        for (let dx = -radius; dx <= radius && !placed; dx++) {
          const nx = cell.cx + dx, ny = cell.cy + dy;
          if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
          const nidx = ny * GRID_COLS + nx;
          if (cellData[nidx].cls === "interior" && !cellToRoom.has(nidx)) {
            placeCx = nx; placeCy = ny; placed = true;
          }
        }
      }
    }
    if (!placed) continue;

    const idx = placeCy * GRID_COLS + placeCx;
    const on = breakerState[room.id] === true;
    tiles[idx] = on ? TILES.BREAKER_ON : TILES.BREAKER_OFF;
    cellToRoom.set(idx, room.id);
  }

  return { tiles, cellToRoom };
}
