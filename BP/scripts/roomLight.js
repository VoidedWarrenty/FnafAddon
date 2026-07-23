import { world } from "@minecraft/server";
import { listRoomLights } from "./state.js";
import { resolveLightState } from "./electricalRoomManager.js";

export function syncAllRoomLights() {
  for (const rl of listRoomLights()) {
    const dim = world.getDimension(rl.dimensionId);
    let block;
    try { block = dim.getBlock({ x: rl.x, y: rl.y, z: rl.z }); }
    catch { continue; }
    if (!block || block.typeId !== "fnaf:room_light") continue;

    const powered = resolveLightState(rl);
    const current = block.permutation.getState("fnaf:powered");
    if (current === powered) continue;
    try {
      block.setPermutation(block.permutation.withState("fnaf:powered", powered));
    } catch (_) {}
  }
}
