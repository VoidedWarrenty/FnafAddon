import { world, system, GameMode } from "@minecraft/server";
import { loadMapSnapshot, saveMapSnapshot, setRoomPowered, getRoomPowered } from "./mapSerializer.js";
import { syncAllRoomLights } from "./roomLight.js";

// Camera-cutscene UI for the breaker box.
//
// Interact with a breaker box → lock the player's camera to a bird's-eye
// view above the building, spawn one floating marker entity per detected
// room at its world centroid (elevated above the roof). Player taps a
// marker to toggle its breaker; sneak to exit. Marker rendering is
// per-player (we track which entities we spawned so we can despawn only
// those on exit).

export const MARKER_ID = "fnaf:breaker_marker";
const CAMERA_HEIGHT_ABOVE_ROOF = 20;
const MARKER_HEIGHT_ABOVE_ROOF = 3;
const CAMERA_PRESET = "minecraft:free";

// playerId -> {
//   boxKey: "dim:x,y,z",
//   markerIds: string[],
//   returnedTick,          // for debounce
// }
const sessions = new Map();

function locKey(dimensionId, x, y, z) {
  const dim = dimensionId.replace("minecraft:", "");
  return `${dim}:${x},${y},${z}`;
}

// Union of all room world bboxes to find the building's centre + top.
function buildingBounds(snap) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxY = -Infinity;
  for (const m of snap.meta) {
    if (!m.worldBbox) continue;
    if (m.worldBbox.minX < minX) minX = m.worldBbox.minX;
    if (m.worldBbox.maxX > maxX) maxX = m.worldBbox.maxX;
    if (m.worldBbox.minZ < minZ) minZ = m.worldBbox.minZ;
    if (m.worldBbox.maxZ > maxZ) maxZ = m.worldBbox.maxZ;
    if (m.worldBbox.maxY > maxY) maxY = m.worldBbox.maxY;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minZ, maxZ, maxY };
}

function roomCentroidWorldXZ(m) {
  if (!m.worldBbox) return null;
  return {
    x: (m.worldBbox.minX + m.worldBbox.maxX) / 2,
    z: (m.worldBbox.minZ + m.worldBbox.maxZ) / 2,
  };
}

function markerNameTag(m) {
  const state = m.powered ? "§a▲ ON" : "§c▼ OFF";
  return `${state} §7· §f${m.name}`;
}

// Enter camera mode for `player` viewing the panel at `block`.
export function enterCameraMode(player, block) {
  const dim = block.dimension;
  const { x: bx, y: by, z: bz } = block.location;

  const snap = loadMapSnapshot(dim.id, bx, by, bz);
  if (!snap) {
    player.onScreenDisplay.setActionBar("§cNo blueprint applied to this panel yet.");
    return;
  }

  const bb = buildingBounds(snap);
  if (!bb) {
    player.onScreenDisplay.setActionBar("§cThis blueprint has no floors in your dimension.");
    return;
  }

  const cx = (bb.minX + bb.maxX) / 2;
  const cz = (bb.minZ + bb.maxZ) / 2;
  const cy = bb.maxY + CAMERA_HEIGHT_ABOVE_ROOF;

  // Bird's-eye — pitch 89 to avoid gimbal lock at exactly straight down.
  try {
    player.camera.setCamera(CAMERA_PRESET, {
      location: { x: cx, y: cy, z: cz },
      rotation: { x: 89, y: 0 },
    });
  } catch (e) {
    player.sendMessage(`§cCamera lock failed: ${e?.message ?? e}`);
    return;
  }

  const markerIds = [];
  for (const m of snap.meta) {
    const ctr = roomCentroidWorldXZ(m);
    if (!ctr) continue;
    const y = (m.worldBbox?.maxY ?? cy - CAMERA_HEIGHT_ABOVE_ROOF) + MARKER_HEIGHT_ABOVE_ROOF;
    let entity;
    try {
      entity = dim.spawnEntity(MARKER_ID, { x: ctr.x, y, z: ctr.z });
    } catch (e) {
      continue;
    }
    entity.setDynamicProperty("fnaf:box_key", locKey(dim.id, bx, by, bz));
    entity.setDynamicProperty("fnaf:room_id", m.id);
    entity.setDynamicProperty("fnaf:owner", player.id);
    entity.nameTag = markerNameTag(m);
    entity.triggerEvent(m.powered ? "fnaf:turn_on" : "fnaf:turn_off");
    markerIds.push(entity.id);
  }

  sessions.set(player.id, {
    boxKey: locKey(dim.id, bx, by, bz),
    markerIds,
    dimId: dim.id,
    enteredTick: system.currentTick,
  });

  player.onScreenDisplay.setActionBar("§eSneak to close panel view §7· §7tap a breaker to toggle");
}

// Look up the session's dimension, drop all markers, clear the camera.
export function exitCameraMode(player) {
  const sess = sessions.get(player.id);
  if (!sess) return;
  sessions.delete(player.id);

  try { player.camera.clear(); } catch (_) {}

  const dim = world.getDimension(sess.dimId);
  for (const id of sess.markerIds) {
    let ent;
    try { ent = world.getEntity(id); } catch (_) { continue; }
    if (ent) {
      try { ent.remove(); } catch (_) {}
    }
  }
  player.onScreenDisplay.setActionBar("§7Panel view closed");
}

export function isInCameraMode(playerId) {
  return sessions.has(playerId);
}

// Handle a tap on a breaker marker. Toggles the room's power in the
// snapshot, flips the marker's variant + nameTag, and pushes the new
// state to lights immediately.
export function handleMarkerTap(player, marker) {
  const boxKey = marker.getDynamicProperty("fnaf:box_key");
  const roomId = marker.getDynamicProperty("fnaf:room_id");
  if (typeof boxKey !== "string" || typeof roomId !== "number") return;

  const [dimShort, coords] = boxKey.split(":");
  const [bx, by, bz] = coords.split(",").map(Number);
  const dimId = `minecraft:${dimShort}`;

  const snap = loadMapSnapshot(dimId, bx, by, bz);
  if (!snap) return;

  const meta = snap.meta.find(m => m.id === roomId);
  if (!meta) return;

  const nowOn = !getRoomPowered(snap, roomId);
  setRoomPowered(snap, roomId, nowOn);
  meta.powered = nowOn;
  saveMapSnapshot(dimId, bx, by, bz, snap);

  try {
    marker.triggerEvent(nowOn ? "fnaf:turn_on" : "fnaf:turn_off");
    marker.nameTag = markerNameTag(meta);
  } catch (_) {}

  player.onScreenDisplay.setActionBar(
    `${nowOn ? "§a▲ Breaker ON" : "§c▼ Breaker OFF"} §7· §f${meta.name}`
  );
  system.run(() => { try { syncAllRoomLights(); } catch (_) {} });
}

// Called from a per-tick loop: any player currently in camera mode who
// sneaks exits. Debounced so the initial interact-with-sneak doesn't
// immediately exit again.
export function tickSneakExitCheck() {
  for (const [pid, sess] of sessions.entries()) {
    if (system.currentTick - sess.enteredTick < 8) continue;
    let player;
    try {
      for (const p of world.getPlayers()) {
        if (p.id === pid) { player = p; break; }
      }
    } catch (_) {}
    if (!player) { sessions.delete(pid); continue; }
    if (player.isSneaking) exitCameraMode(player);
  }
}

// Called when the marker's owner disconnects — clean orphaned markers.
export function cleanupOrphanedMarkers() {
  const alive = new Set();
  for (const p of world.getPlayers()) alive.add(p.id);

  for (const [pid, sess] of sessions.entries()) {
    if (alive.has(pid)) continue;
    const dim = world.getDimension(sess.dimId);
    for (const id of sess.markerIds) {
      let ent;
      try { ent = world.getEntity(id); } catch (_) { continue; }
      if (ent) { try { ent.remove(); } catch (_) {} }
    }
    sessions.delete(pid);
  }
}
