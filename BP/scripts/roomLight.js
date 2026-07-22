import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { FNAF1_ROOMS, roomName } from "./rooms.js";
import {
  listBreakerBoxes,
  isRoomPowered,
  listRoomLights,
} from "./state.js";

const SEARCH_RADIUS_SQ = 96 * 96;

// Ask the player which FNAF 1 room a room_light belongs to.
export function openRoomLightPicker(player, block) {
  const currentRoom = Number(block.permutation.getState("fnaf:room") ?? 0);
  const form = new ActionFormData()
    .title("§lRoom Light")
    .body(
      `§7Assign this light to a FNAF 1 room.\n§8Current: §f${roomName(currentRoom)}`
    );
  form.button("§7Unassigned");
  for (const r of FNAF1_ROOMS) form.button(r.name);

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const newRoom = res.selection === 0 ? 0 : FNAF1_ROOMS[res.selection - 1].id;
    system.run(() => {
      try {
        const perm = block.permutation
          .withState("fnaf:room", newRoom)
          .withState("fnaf:powered", block.permutation.getState("fnaf:powered") ?? false);
        block.setPermutation(perm);
        player.onScreenDisplay.setActionBar(`§7Room set to §f${roomName(newRoom)}`);
      } catch (_) { /* block may have been broken */ }
    });
  }).catch(() => {});
}

// Find the closest breaker box to (x,y,z) within the same dimension.
function nearestBreakerBox(dimensionId, x, y, z) {
  let best = null;
  let bestD = Infinity;
  for (const b of listBreakerBoxes()) {
    if (b.dimensionId !== dimensionId) continue;
    const dx = b.x - x, dy = b.y - y, dz = b.z - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD && d <= SEARCH_RADIUS_SQ) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

// Sync all room_light blocks to their nearest breaker box's state.
export function syncAllRoomLights() {
  for (const rl of listRoomLights()) {
    const dim = world.getDimension(rl.dimensionId);
    let block;
    try { block = dim.getBlock({ x: rl.x, y: rl.y, z: rl.z }); }
    catch { continue; } // chunk unloaded
    if (!block || block.typeId !== "fnaf:room_light") continue;

    const room = Number(block.permutation.getState("fnaf:room") ?? 0);
    let powered = false;
    if (room !== 0) {
      const bb = nearestBreakerBox(rl.dimensionId, rl.x, rl.y, rl.z);
      if (bb) powered = isRoomPowered(bb.dimensionId, bb.x, bb.y, bb.z, room);
    }
    const current = block.permutation.getState("fnaf:powered");
    if (current === powered) continue;
    try {
      block.setPermutation(
        block.permutation.withState("fnaf:powered", powered)
      );
    } catch (_) { /* ignore */ }
  }
}
