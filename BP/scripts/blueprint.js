import { world } from "@minecraft/server";

// Blueprints live in world dynamic properties, keyed by a short UUID that
// the blueprint item carries in its lore. This decouples editing from
// deployment: shift-clicking a device *snapshots* the blueprint into that
// device's own storage.
//
// Room data model (v2, polygon-based):
//   room = {
//     id, name,
//     floors: [
//       {
//         dim,
//         polygon: [{x, z}, {x, z}, ...],   // ordered vertices, implicit close
//         floorY,                            // Y of the lowest solid floor block
//         ceilingY,                          // Y of the highest ceiling block
//         openings: [
//           { segIdx, startBlock, endBlock } // gap on polygon edge segIdx,
//                                            // spanning block coords along it
//         ]
//       }
//     ]
//   }
//
// Old v1 rooms carried `boxes: [{dim, x1..z2}]`. They're auto-migrated to
// polygons on load (each box → one rectangular floor).

const BP_PREFIX = "fnaf:bp:";
const BP_INDEX = "fnaf:bp_index";

export function newBlueprintId() {
  let s = "";
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function readIndex() {
  const raw = world.getDynamicProperty(BP_INDEX);
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function writeIndex(idx) {
  world.setDynamicProperty(BP_INDEX, JSON.stringify(idx));
}

export function createBlueprint(id, name) {
  const bp = { id, name: name || "Untitled", rooms: [] };
  saveBlueprint(bp);
  const idx = readIndex();
  if (!idx.includes(id)) {
    idx.push(id);
    writeIndex(idx);
  }
  return bp;
}

// Migrate a v1 room (boxes) to v2 (floors). Idempotent: v2 rooms pass through.
export function migrateRoom(room) {
  if (Array.isArray(room.floors)) return room;
  const boxes = Array.isArray(room.boxes) ? room.boxes : [];
  const floors = boxes.map(b => ({
    dim: b.dim,
    polygon: [
      { x: b.x1, z: b.z1 },
      { x: b.x2, z: b.z1 },
      { x: b.x2, z: b.z2 },
      { x: b.x1, z: b.z2 },
    ],
    floorY: b.y1,
    ceilingY: b.y2,
    openings: [],
  }));
  return { id: room.id, name: room.name, floors };
}

export function getBlueprint(id) {
  const raw = world.getDynamicProperty(BP_PREFIX + id);
  if (typeof raw !== "string") return null;
  let bp;
  try { bp = JSON.parse(raw); } catch { return null; }
  if (!bp || !Array.isArray(bp.rooms)) return bp;
  bp.rooms = bp.rooms.map(migrateRoom);
  return bp;
}

export function saveBlueprint(bp) {
  world.setDynamicProperty(BP_PREFIX + bp.id, JSON.stringify(bp));
}

export function deleteBlueprint(id) {
  world.setDynamicProperty(BP_PREFIX + id, undefined);
  writeIndex(readIndex().filter(i => i !== id));
}

export function listBlueprints() {
  return readIndex().map(id => getBlueprint(id)).filter(Boolean);
}

// --- Rooms --------------------------------------------------------------

function nextRoomId(bp) {
  let max = 0;
  for (const r of bp.rooms) {
    const n = Number(String(r.id).replace(/^r/, "")) || 0;
    if (n > max) max = n;
  }
  return "r" + (max + 1);
}

export function addRoom(bp, name) {
  const rid = nextRoomId(bp);
  bp.rooms.push({ id: rid, name: name || `Room ${bp.rooms.length + 1}`, floors: [] });
  saveBlueprint(bp);
  return rid;
}

export function findRoom(bp, roomId) {
  return bp.rooms.find(r => r.id === roomId) || null;
}

export function renameRoom(bp, roomId, newName) {
  const r = findRoom(bp, roomId);
  if (!r) return false;
  r.name = newName || r.name;
  saveBlueprint(bp);
  return true;
}

export function removeRoom(bp, roomId) {
  bp.rooms = bp.rooms.filter(r => r.id !== roomId);
  saveBlueprint(bp);
}

// --- Floors (polygonal room regions) ------------------------------------

export function addFloorToRoom(bp, roomId, floor) {
  const r = findRoom(bp, roomId);
  if (!r) return false;
  if (!Array.isArray(r.floors)) r.floors = [];
  r.floors.push(floor);
  saveBlueprint(bp);
  return true;
}

export function removeFloorFromRoom(bp, roomId, floorIndex) {
  const r = findRoom(bp, roomId);
  if (!r || !r.floors?.[floorIndex]) return false;
  r.floors.splice(floorIndex, 1);
  saveBlueprint(bp);
  return true;
}

// --- Polygon geometry ---------------------------------------------------

// Ray-cast point-in-polygon (even-odd rule). Uses XZ plane; polygon is
// an array of {x,z}. Points exactly on the edge count as inside.
export function pointInPolygon(px, pz, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    const intersect = ((zi > pz) !== (zj > pz)) &&
      (px < (xj - xi) * (pz - zi) / ((zj - zi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// A point is inside a floor if it's inside the polygon on XZ and within
// [floorY, ceilingY] on Y.
export function pointInFloor(dimensionId, x, y, z, floor) {
  if (floor.dim !== dimensionId) return false;
  if (y < floor.floorY || y > floor.ceilingY) return false;
  return pointInPolygon(x, z, floor.polygon);
}

// A point is in a room if it's in any of the room's floors.
export function pointInRoom(dimensionId, x, y, z, room) {
  if (!room.floors) return false;
  for (const f of room.floors) {
    if (pointInFloor(dimensionId, x, y, z, f)) return true;
  }
  return false;
}

export function findContainingRoom(dimensionId, x, y, z, rooms) {
  for (const r of rooms) {
    if (pointInRoom(dimensionId, x, y, z, r)) return r;
  }
  return null;
}

// XZ bounding box of a polygon (min inclusive, max inclusive).
export function polygonBounds(polygon) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

// Collect a merged bounding box across all floors in the given dimension.
export function floorsBounds(rooms, dimensionId) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const r of rooms) {
    for (const f of r.floors ?? []) {
      if (f.dim !== dimensionId) continue;
      const b = polygonBounds(f.polygon);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
      if (f.floorY < minY) minY = f.floorY;
      if (f.ceilingY > maxY) maxY = f.ceilingY;
    }
  }
  return { minX, maxX, minZ, maxZ, minY, maxY };
}

// Squared distance from a point to a segment in XZ. Used to find which
// polygon edge a sneak-clicked block is closest to (for opening picks).
function distSqPointToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) {
    const ex = px - ax, ez = pz - az;
    return ex * ex + ez * ez;
  }
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  const ex = px - cx, ez = pz - cz;
  return ex * ex + ez * ez;
}

// Find which polygon edge index a world point is closest to. Also returns
// the projected block coordinate along that edge (integer index of the
// block along the edge from vertex[i] to vertex[i+1]).
export function closestEdgeToPoint(polygon, x, z) {
  let bestIdx = -1;
  let bestD = Infinity;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const d = distSqPointToSeg(x, z, a.x, a.z, b.x, b.z);
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  if (bestIdx < 0) return null;
  const a = polygon[bestIdx];
  const b = polygon[(bestIdx + 1) % n];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const t = ((x - a.x) * dx + (z - a.z) * dz) / (len * len);
  const clamped = Math.max(0, Math.min(1, t));
  // Return the integer block index along the edge (0..len).
  return { segIdx: bestIdx, blockIdx: Math.round(clamped * len), distSq: bestD };
}
