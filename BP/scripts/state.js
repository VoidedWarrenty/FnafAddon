import { world } from "@minecraft/server";

// Per-breaker-box power map, stored in world dynamic properties.
// Key layout: "fnaf:bb:<dim>:<x>,<y>,<z>" -> JSON string { "1": true, "2": false, ... }
// Room ids match rooms.js. Missing => breaker is OFF.

const BB_PREFIX = "fnaf:bb:";
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
