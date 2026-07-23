import { world } from "@minecraft/server";
import { MAP_VERSION, GRID_W, GRID_H } from "./blueprintTypes.js";

// Persist / restore a raster map snapshot on a breaker box.
//
// Storage layout (world dynamic property, one JSON blob per box):
//   fnaf:bb_map:<dim>:<x>,<y>,<z> -> JSON {
//     v,                    // map version
//     w, h,                 // grid dims
//     t,                    // transform (worldToGrid params)
//     tiles,                // RLE string, ~ "3x256 1x8 3x2..."
//     rooms,                // RLE string of roomIdGrid (0-255)
//     meta: [{
//       id, name, breakerIdx, powered,
//       cellCount, cellBbox, worldBbox,
//       lights: [{x,y,z}], doors: [idx,...]
//     }],
//   }
//
// RLE format: base36 count 'x' base36 value, whitespace-joined. That's
// compact enough for 768 cells within the ~32 KB dynamic property limit
// while staying trivially parseable.

const MAP_PREFIX = "fnaf:bb_map:";

function locKey(dimensionId, x, y, z) {
  const dim = dimensionId.replace("minecraft:", "");
  return `${dim}:${x},${y},${z}`;
}

// --- RLE ---------------------------------------------------------------

export function encodeRLE(arr) {
  if (arr.length === 0) return "";
  const parts = [];
  let run = 1;
  let val = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === val) { run++; continue; }
    parts.push(`${run.toString(36)}x${val.toString(36)}`);
    val = arr[i];
    run = 1;
  }
  parts.push(`${run.toString(36)}x${val.toString(36)}`);
  return parts.join(" ");
}

export function decodeRLE(str, length) {
  const out = new Uint8Array(length);
  if (!str) return out;
  let write = 0;
  const parts = str.split(" ");
  for (const p of parts) {
    const sep = p.indexOf("x");
    if (sep < 0) continue;
    const run = parseInt(p.slice(0, sep), 36);
    const val = parseInt(p.slice(sep + 1), 36);
    for (let i = 0; i < run && write < length; i++) out[write++] = val;
  }
  return out;
}

// --- Snapshot shape ----------------------------------------------------

// buildSnapshot: pack in-memory raster + rooms into a serializable object.
export function buildSnapshot({
  sourceBpId, sourceName,
  transform, grid, roomIdGrid,
  rooms, breakerIdx, doorLinks,
  roomNames,           // parallel array to `rooms`: bp-side name for each detected room
  roomBpIds,           // parallel: bp room id
  worldBboxes,         // parallel: per-room world bbox in blocks
}) {
  const meta = rooms.map((r, i) => ({
    id: r.id,
    name: roomNames[i] ?? `Room ${r.id}`,
    bpRoomId: roomBpIds[i] ?? null,
    breakerIdx: breakerIdx[i],
    powered: false,
    cellCount: r.cells.length,
    cellBbox: r.bboxCell,
    worldBbox: worldBboxes[i] ?? null,
    lights: [],
    doors: [],
  }));

  // Cross-reference doors → per-room door lists.
  const roomIdToMetaIdx = new Map();
  rooms.forEach((r, i) => roomIdToMetaIdx.set(r.id, i));
  for (const [cellIdx, roomIds] of doorLinks.entries()) {
    for (const rid of roomIds) {
      const mi = roomIdToMetaIdx.get(rid);
      if (mi != null) meta[mi].doors.push(cellIdx);
    }
  }

  return {
    v: MAP_VERSION,
    w: GRID_W,
    h: GRID_H,
    t: transform,
    sourceBpId, sourceName,
    tiles: encodeRLE(grid),
    rooms: encodeRLE(roomIdGrid),
    meta,
  };
}

// Reconstitute the two Uint8Arrays from an on-disk snapshot.
export function inflateSnapshot(snap) {
  const tiles = decodeRLE(snap.tiles, snap.w * snap.h);
  const roomIdGrid = decodeRLE(snap.rooms, snap.w * snap.h);
  return { tiles, roomIdGrid };
}

// --- Persistence via world dynamic properties --------------------------

export function saveMapSnapshot(dimensionId, x, y, z, snap) {
  world.setDynamicProperty(
    MAP_PREFIX + locKey(dimensionId, x, y, z),
    JSON.stringify(snap)
  );
}

export function loadMapSnapshot(dimensionId, x, y, z) {
  const raw = world.getDynamicProperty(MAP_PREFIX + locKey(dimensionId, x, y, z));
  if (typeof raw !== "string") return null;
  try {
    const snap = JSON.parse(raw);
    if (snap.v !== MAP_VERSION) return null;   // schema mismatch; force re-apply
    return snap;
  } catch { return null; }
}

export function clearMapSnapshot(dimensionId, x, y, z) {
  world.setDynamicProperty(MAP_PREFIX + locKey(dimensionId, x, y, z), undefined);
}

// --- Room power mutation (in-place) -----------------------------------

export function setRoomPowered(snap, roomId, powered) {
  const room = snap.meta.find(m => m.id === roomId);
  if (!room) return false;
  room.powered = !!powered;
  return true;
}

export function getRoomPowered(snap, roomId) {
  const room = snap.meta.find(m => m.id === roomId);
  return room ? room.powered === true : false;
}
