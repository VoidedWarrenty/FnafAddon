import { world } from "@minecraft/server";
import {
  listBreakerBoxes, listRoomLights,
  isRoomPowered, getBreakerBoxSnapshot,
} from "./state.js";
import { pointInRoom } from "./blueprint.js";

const SEARCH_RADIUS_SQ = 128 * 128;

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
    if (d < bestD && d <= SEARCH_RADIUS_SQ) {
      bestD = d;
      best = { bb, room: containingRoom };
    }
  }
  return best;
}

export function syncAllRoomLights() {
  for (const rl of listRoomLights()) {
    const dim = world.getDimension(rl.dimensionId);
    let block;
    try { block = dim.getBlock({ x: rl.x, y: rl.y, z: rl.z }); }
    catch { continue; }
    if (!block || block.typeId !== "fnaf:room_light") continue;

    const ctl = findControllingBox(rl);
    let powered = false;
    if (ctl) {
      powered = isRoomPowered(
        ctl.bb.dimensionId, ctl.bb.x, ctl.bb.y, ctl.bb.z, ctl.room.id
      );
    }

    const current = block.permutation.getState("fnaf:powered");
    if (current === powered) continue;
    try {
      block.setPermutation(block.permutation.withState("fnaf:powered", powered));
    } catch (_) {}
  }
}
