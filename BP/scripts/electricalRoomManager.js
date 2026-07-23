import { world } from "@minecraft/server";
import {
  loadMapSnapshot, saveMapSnapshot, inflateSnapshot,
  setRoomPowered, getRoomPowered,
} from "./mapSerializer.js";
import { worldToCell, cellIndex } from "./mapTransform.js";
import { CELL, NO_ROOM } from "./blueprintTypes.js";
import { listBreakerBoxes, listRoomLights } from "./state.js";

// One-stop shop for "given a light in the world, is it on right now?".
//
// Circuit topology we're building toward:
//   breaker (on/off)  →  circuit (== detected room)  →  switches  →  lights
//
// For MVP the "switches" layer is a pass-through: a light is on iff its
// owning breaker is on. But the shape of resolveLightState below keeps
// the switch step in place so the future light-switch block can slot in
// without a rewrite.

// Resolve a world XYZ to (breakerBox, snapshot, roomId) if any breaker's
// map claims that point. Returns null if unassigned.
export function resolveLightRoom(lightLoc) {
  const { dimensionId, x, y, z } = lightLoc;
  for (const bb of listBreakerBoxes()) {
    if (bb.dimensionId !== dimensionId) continue;
    const snap = loadMapSnapshot(dimensionId, bb.x, bb.y, bb.z);
    if (!snap) continue;

    // Y range check first: room must contain this Y within any of its
    // world bounds. Cheap early-out for lights in the wrong storey.
    let yOk = false;
    for (const m of snap.meta) {
      if (!m.worldBbox) continue;
      if (y >= m.worldBbox.minY && y <= m.worldBbox.maxY) { yOk = true; break; }
    }
    if (!yOk) continue;

    // Sample the roomIdGrid at the light's XZ.
    const { tiles, roomIdGrid } = inflateSnapshot(snap);
    const { cx, cy } = worldToCell(snap.t, x, z);
    const idx = cellIndex(snap.t, cx, cy);
    const rid = roomIdGrid[idx];
    if (rid === NO_ROOM) continue;

    // Y must also intersect this specific room's world Y range.
    const roomMeta = snap.meta.find(m => m.id === rid);
    if (!roomMeta || !roomMeta.worldBbox) continue;
    if (y < roomMeta.worldBbox.minY || y > roomMeta.worldBbox.maxY) continue;

    return { bb, snap, roomId: rid, roomMeta };
  }
  return null;
}

// True iff (a) the room's breaker is on and (b) — future — every switch
// on the path allows current through. For MVP, (b) is always true.
export function resolveLightState(lightLoc) {
  const res = resolveLightRoom(lightLoc);
  if (!res) return false;
  const breakerOn = getRoomPowered(res.snap, res.roomId);
  if (!breakerOn) return false;
  // switchOn = evaluateSwitchChain(...) — placeholder; always on for now.
  const switchOn = true;
  return breakerOn && switchOn;
}

// Toggle a breaker for a specific room on a specific box, persist and
// return the new state.
export function toggleBreaker(dimensionId, bx, by, bz, roomId) {
  const snap = loadMapSnapshot(dimensionId, bx, by, bz);
  if (!snap) return null;
  const cur = getRoomPowered(snap, roomId);
  setRoomPowered(snap, roomId, !cur);

  // Also flip the corresponding breaker cell's tile so re-opening the
  // form reflects the new state without a full recompute.
  const roomMeta = snap.meta.find(m => m.id === roomId);
  if (roomMeta) {
    const { tiles } = inflateSnapshot(snap);
    tiles[roomMeta.breakerIdx] = cur ? CELL.BREAKER_OFF : CELL.BREAKER_ON;
    snap.tiles = require_encode(tiles);
  }
  saveMapSnapshot(dimensionId, bx, by, bz, snap);
  return !cur;
}

// tiny helper: re-encode after mutation. Kept local to avoid a circular
// dep between electricalRoomManager and mapSerializer for what is a
// single-line RLE.
function require_encode(arr) {
  if (arr.length === 0) return "";
  const parts = [];
  let run = 1, val = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === val) { run++; continue; }
    parts.push(`${run.toString(36)}x${val.toString(36)}`);
    val = arr[i]; run = 1;
  }
  parts.push(`${run.toString(36)}x${val.toString(36)}`);
  return parts.join(" ");
}

// Populate the per-room lights list on every snapshot by walking all
// registered room lights. Called once at apply time; the sync tick uses
// resolveLightState directly, not this cache.
export function bindLightsToSnapshot(dimensionId, bx, by, bz) {
  const snap = loadMapSnapshot(dimensionId, bx, by, bz);
  if (!snap) return;
  // Clear existing bindings.
  for (const m of snap.meta) m.lights = [];
  const { roomIdGrid } = inflateSnapshot(snap);

  for (const rl of listRoomLights()) {
    if (rl.dimensionId !== dimensionId) continue;
    const { cx, cy } = worldToCell(snap.t, rl.x, rl.z);
    const idx = cellIndex(snap.t, cx, cy);
    const rid = roomIdGrid[idx];
    if (rid === NO_ROOM) continue;
    const roomMeta = snap.meta.find(m => m.id === rid);
    if (!roomMeta || !roomMeta.worldBbox) continue;
    if (rl.y < roomMeta.worldBbox.minY || rl.y > roomMeta.worldBbox.maxY) continue;
    roomMeta.lights.push({ x: rl.x, y: rl.y, z: rl.z });
  }
  saveMapSnapshot(dimensionId, bx, by, bz, snap);
}

// Debug helper for "which lights don't resolve?"
export function listUnassignedLights() {
  const out = [];
  for (const rl of listRoomLights()) {
    const res = resolveLightRoom(rl);
    if (!res) out.push(rl);
  }
  return out;
}
