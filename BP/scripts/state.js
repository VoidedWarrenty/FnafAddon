import { world } from "@minecraft/server";

// Per-breaker-box storage. Two keyed properties per box:
//   fnaf:bb:<dim>:<x>,<y>,<z>       -> JSON { <roomId>: bool, ... }  (breaker power state)
//   fnaf:bb_snap:<dim>:<x>,<y>,<z>  -> JSON { rooms: [ {id,name,boxes:[...]}, ... ], sourceBpId, sourceName }
//
// The snapshot is the immutable copy taken when a blueprint is stamped onto
// the box. Editing the blueprint later does not touch this snapshot.

const BB_PREFIX = "fnaf:bb:";
const BB_SNAP_PREFIX = "fnaf:bb_snap:";
const BB_INDEX_KEY = "fnaf:bb_index"; // JSON array of location keys
const RL_INDEX_KEY = "fnaf:rl_index"; // JSON array of room_light location keys

function locKey(dimensionId, x, y, z) {
  // Strip "minecraft:" prefix from dim id for compactness
  const dim = dimensionId.replace("minecraft:", "");
  return `${dim}:${x},${y},${z}`;
}

export function bbKey(dimensionId, x, y, z) {
  return BB_PREFIX + locKey(dimensionId, x, y, z);
}

export function bbSnapKey(dimensionId, x, y, z) {
  return BB_SNAP_PREFIX + locKey(dimensionId, x, y, z);
}

export function parseLocKey(key) {
  const [dim, coords] = key.split(":");
  const [x, y, z] = coords.split(",").map(Number);
  return { dimensionId: `minecraft:${dim}`, x, y, z };
}

function readIndex(key) {
  const raw = world.getDynamicProperty(key);
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function writeIndex(key, arr) {
  world.setDynamicProperty(key, JSON.stringify(arr));
}

// Breaker box registry
export function registerBreakerBox(dimensionId, x, y, z) {
  const key = locKey(dimensionId, x, y, z);
  const idx = readIndex(BB_INDEX_KEY);
  if (!idx.includes(key)) {
    idx.push(key);
    writeIndex(BB_INDEX_KEY, idx);
  }
}

export function unregisterBreakerBox(dimensionId, x, y, z) {
  const key = locKey(dimensionId, x, y, z);
  const idx = readIndex(BB_INDEX_KEY).filter(k => k !== key);
  writeIndex(BB_INDEX_KEY, idx);
  world.setDynamicProperty(BB_PREFIX + key, undefined);
  world.setDynamicProperty(BB_SNAP_PREFIX + key, undefined);
}

// Snapshot: the frozen copy of a blueprint stamped onto this box.
export function getBreakerBoxSnapshot(dimensionId, x, y, z) {
  const raw = world.getDynamicProperty(bbSnapKey(dimensionId, x, y, z));
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setBreakerBoxSnapshot(dimensionId, x, y, z, snapshot) {
  world.setDynamicProperty(bbSnapKey(dimensionId, x, y, z), JSON.stringify(snapshot));
}

export function clearBreakerBoxSnapshot(dimensionId, x, y, z) {
  world.setDynamicProperty(bbSnapKey(dimensionId, x, y, z), undefined);
}

export function listBreakerBoxes() {
  return readIndex(BB_INDEX_KEY).map(parseLocKey);
}

// Room light registry
export function registerRoomLight(dimensionId, x, y, z) {
  const key = locKey(dimensionId, x, y, z);
  const idx = readIndex(RL_INDEX_KEY);
  if (!idx.includes(key)) {
    idx.push(key);
    writeIndex(RL_INDEX_KEY, idx);
  }
}

export function unregisterRoomLight(dimensionId, x, y, z) {
  const key = locKey(dimensionId, x, y, z);
  const idx = readIndex(RL_INDEX_KEY).filter(k => k !== key);
  writeIndex(RL_INDEX_KEY, idx);
}

export function listRoomLights() {
  return readIndex(RL_INDEX_KEY).map(parseLocKey);
}

// Per-breaker-box breaker states
export function getBreakerBoxState(dimensionId, x, y, z) {
  const raw = world.getDynamicProperty(bbKey(dimensionId, x, y, z));
  if (typeof raw !== "string") return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function setBreakerBoxState(dimensionId, x, y, z, state) {
  world.setDynamicProperty(bbKey(dimensionId, x, y, z), JSON.stringify(state));
}

export function isRoomPowered(dimensionId, x, y, z, roomId) {
  const s = getBreakerBoxState(dimensionId, x, y, z);
  return s[String(roomId)] === true;
}

export function setRoomPowered(dimensionId, x, y, z, roomId, powered) {
  const s = getBreakerBoxState(dimensionId, x, y, z);
  s[String(roomId)] = !!powered;
  setBreakerBoxState(dimensionId, x, y, z, s);
}
