import { world } from "@minecraft/server";

// Per-entity storage on breaker panel entities. The entity is the identity;
// its dynamic properties hold both the applied blueprint snapshot and the
// current on/off state of each breaker.
//
// Room lights still need a lightweight registry so the sync tick doesn't
// scan chunks — that stays in world dynamic properties keyed by block loc.

const SNAP_KEY = "fnaf:snap";
const STATE_KEY = "fnaf:state";
const RL_INDEX_KEY = "fnaf:rl_index";

// --- Panel entity storage ------------------------------------------------

export function getPanelSnapshot(entity) {
  try {
    const raw = entity.getDynamicProperty(SNAP_KEY);
    if (typeof raw !== "string") return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function setPanelSnapshot(entity, snapshot) {
  entity.setDynamicProperty(SNAP_KEY, JSON.stringify(snapshot));
}

export function clearPanelSnapshot(entity) {
  entity.setDynamicProperty(SNAP_KEY, undefined);
}

export function getPanelState(entity) {
  try {
    const raw = entity.getDynamicProperty(STATE_KEY);
    if (typeof raw !== "string") return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export function setPanelState(entity, state) {
  entity.setDynamicProperty(STATE_KEY, JSON.stringify(state));
}

export function isRoomPowered(entity, roomId) {
  return getPanelState(entity)[String(roomId)] === true;
}

export function setRoomPowered(entity, roomId, powered) {
  const s = getPanelState(entity);
  s[String(roomId)] = !!powered;
  setPanelState(entity, s);
}

// --- Room light registry -------------------------------------------------

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
