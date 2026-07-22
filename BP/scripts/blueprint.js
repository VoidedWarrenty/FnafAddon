import { world } from "@minecraft/server";

// Blueprints live in world dynamic properties, keyed by a short UUID that
// the blueprint item carries in its lore. This decouples editing from
// deployment: shift-clicking a device *snapshots* the blueprint into that
// device's own storage. Editing the blueprint afterwards is safe.

const BP_PREFIX = "fnaf:bp:";
const BP_INDEX = "fnaf:bp_index";

export function newBlueprintId() {
  // 12 hex chars. Math.random is fine in scripts.
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

export function getBlueprint(id) {
  const raw = world.getDynamicProperty(BP_PREFIX + id);
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveBlueprint(bp) {
  world.setDynamicProperty(BP_PREFIX + bp.id, JSON.stringify(bp));
}

export function deleteBlueprint(id) {
  world.setDynamicProperty(BP_PREFIX + id, undefined);
  writeIndex(readIndex().filter(i => i !== id));
}

export function listBlueprints() {
  return readIndex()
    .map(id => getBlueprint(id))
    .filter(Boolean);
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
  bp.rooms.push({ id: rid, name: name || `Room ${bp.rooms.length + 1}`, boxes: [] });
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

// --- Boxes --------------------------------------------------------------

export function normalizeBox(a, b, dimensionId) {
  return {
    dim: dimensionId,
    x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), z1: Math.min(a.z, b.z),
    x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y), z2: Math.max(a.z, b.z),
  };
}

export function addBoxToRoom(bp, roomId, box) {
  const r = findRoom(bp, roomId);
  if (!r) return false;
  r.boxes.push(box);
  saveBlueprint(bp);
  return true;
}

export function removeBoxFromRoom(bp, roomId, boxIndex) {
  const r = findRoom(bp, roomId);
  if (!r || !r.boxes[boxIndex]) return false;
  r.boxes.splice(boxIndex, 1);
  saveBlueprint(bp);
  return true;
}

// --- Containment --------------------------------------------------------

export function pointInBox(x, y, z, box) {
  return x >= box.x1 && x <= box.x2 &&
         y >= box.y1 && y <= box.y2 &&
         z >= box.z1 && z <= box.z2;
}

export function pointInRoom(dimensionId, x, y, z, room) {
  for (const b of room.boxes) {
    if (b.dim === dimensionId && pointInBox(x, y, z, b)) return true;
  }
  return false;
}

export function findContainingRoom(dimensionId, x, y, z, rooms) {
  for (const r of rooms) {
    if (pointInRoom(dimensionId, x, y, z, r)) return r;
  }
  return null;
}
