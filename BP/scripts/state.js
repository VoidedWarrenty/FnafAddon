import { world } from "@minecraft/server";
import { migrateRoom } from "./blueprint.js";

// Per-block storage. Two keyed world dynamic properties per box:
//   fnaf:bb:<dim>:<x>,<y>,<z>       -> JSON { <roomId>: bool, ... }  (breaker on/off state)
//   fnaf:bb_snap:<dim>:<x>,<y>,<z>  -> JSON { rooms: [...], sourceBpId, sourceName }
//
// Room lights also keep a location index so the sync tick doesn't scan chunks.

const BB_PREFIX = "fnaf:bb:";
const BB_SNAP_PREFIX = "fnaf:bb_snap:";
const BB_INDEX_KEY = "fnaf:bb_index";
const RL_INDEX_KEY = "fnaf:rl_index";

function locKey(dimensionId, x, y, z) {
  const dim = dimensionId.replace("minecraft:", "");
  return `${dim}:${x},${y},${z}`;
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

// --- Breaker box registry -----------------------------------------------

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
  writeIndex(BB_INDEX_KEY, readIndex(BB_INDEX_KEY).filter(k => k !== key));
  world.setDynamicProperty(BB_PREFIX + key, undefined);
  world.setDynamicProperty(BB_SNAP_PREFIX + key, undefined);
  world.setDynamicProperty("fnaf:bb_map:" + key, undefined);
}

export function listBreakerBoxes() {
  return readIndex(BB_INDEX_KEY).map(parseLocKey);
}

// --- Breaker on/off state -----------------------------------------------

export function getBreakerBoxState(dimensionId, x, y, z) {
  const raw = world.getDynamicProperty(BB_PREFIX + locKey(dimensionId, x, y, z));
  if (typeof raw !== "string") return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function setBreakerBoxState(dimensionId, x, y, z, state) {
  world.setDynamicProperty(BB_PREFIX + locKey(dimensionId, x, y, z), JSON.stringify(state));
}

export function isRoomPowered(dimensionId, x, y, z, roomId) {
  return getBreakerBoxState(dimensionId, x, y, z)[String(roomId)] === true;
}

export function setRoomPowered(dimensionId, x, y, z, roomId, powered) {
  const s = getBreakerBoxState(dimensionId, x, y, z);
  s[String(roomId)] = !!powered;
  setBreakerBoxState(dimensionId, x, y, z, s);
}

// --- Blueprint snapshot per box ----------------------------------------

export function getBreakerBoxSnapshot(dimensionId, x, y, z) {
  const raw = world.getDynamicProperty(BB_SNAP_PREFIX + locKey(dimensionId, x, y, z));
  if (typeof raw !== "string") return null;
  let snap;
  try { snap = JSON.parse(raw); } catch { return null; }
  if (snap && Array.isArray(snap.rooms)) snap.rooms = snap.rooms.map(migrateRoom);
  return snap;
}

export function setBreakerBoxSnapshot(dimensionId, x, y, z, snapshot) {
  world.setDynamicProperty(BB_SNAP_PREFIX + locKey(dimensionId, x, y, z), JSON.stringify(snapshot));
}

// --- Room light registry -----------------------------------------------

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
  writeIndex(RL_INDEX_KEY, readIndex(RL_INDEX_KEY).filter(k => k !== key));
}

export function listRoomLights() {
  return readIndex(RL_INDEX_KEY).map(parseLocKey);
}
