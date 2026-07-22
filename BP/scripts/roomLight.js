import { world } from "@minecraft/server";
import {
  listBreakerBoxes, listRoomLights,
  isRoomPowered, getBreakerBoxSnapshot,
} from "./state.js";
import { pointInRoom } from "./blueprint.js";

// Precompute per-box "does its snapshot contain this light location?" so a
// room_light only follows a box that actually claims it.
function findControllingBox(lightLoc) {
  const { dimensionId, x, y, z } = lightLoc;
  let best = null;
  let bestD = Infinity;
  for (const bb of listBreakerBoxes()) {
    if (bb.dimensionId !== dimensionId) continue;
    const snap = getBreakerBoxSnapshot(bb.dimensionId, bb.x, bb.y, bb.z);
    if (!snap || !snap.rooms) continue;
    let containingRoom = null;
    for (const r of snap.rooms) {
      if (pointInRoom(dimensionId, x, y, z, r)) { containingRoom = r; break; }
    }
    if (!containingRoom) continue;
    const dx = bb.x - x, dy = bb.y - y, dz = bb.z - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = { bb, room: containingRoom }; }
  }
  return best;
}

export function syncAllRoomLights() {
  for (const rl of listRoomLights()) {
    const dim = world.getDimension(rl.dimensionId);
    let block;
    try { block = dim.getBlock({ x: rl.x, y: rl.y, z: rl.z }); }
    catch { continue; } // chunk unloaded
    if (!block || block.typeId !== "fnaf:room_light") continue;

    const controlling = findControllingBox(rl);
    let powered = false;
    if (controlling) {
      powered = isRoomPowered(
        controlling.bb.dimensionId, controlling.bb.x, controlling.bb.y, controlling.bb.z,
        controlling.room.id
      );
    }

    const current = block.permutation.getState("fnaf:powered");
    if (current === powered) continue;
    try {
      block.setPermutation(block.permutation.withState("fnaf:powered", powered));
    } catch (_) {}
  }
}
