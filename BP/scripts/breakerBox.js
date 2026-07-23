import { enterCameraMode } from "./breakerCamera.js";
import { generateMapSnapshot } from "./mapPipeline.js";
import { saveMapSnapshot } from "./mapSerializer.js";
import { bindLightsToSnapshot } from "./electricalRoomManager.js";
import { debugEnabled, debugDumpSnapshot } from "./mapDebug.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

// Public entry — the rest of the addon calls into these three functions.

export function openBreakerBox(player, block) {
  enterCameraMode(player, block);
}

export function applyBlueprintToBreakerBox(player, block, blueprint) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;

  const snap = generateMapSnapshot(blueprint, dim);
  if (!snap) {
    player.onScreenDisplay.setActionBar(
      "§cCouldn't build map — blueprint has no floors in this dimension."
    );
    return;
  }
  saveMapSnapshot(dim, x, y, z, snap);
  bindLightsToSnapshot(dim, x, y, z);

  player.onScreenDisplay.setActionBar(
    `§a✔ Stamped §f${blueprint.name} §a→ panel §7(${snap.meta.length} room${snap.meta.length === 1 ? "" : "s"})`
  );

  if (debugEnabled()) {
    player.sendMessage(debugDumpSnapshot(snap));
  }
}

export function togglePanelDoor(block) {
  const isOpen = block.permutation.getState("fnaf:is_open") === true;
  try {
    block.setPermutation(block.permutation.withState("fnaf:is_open", !isOpen));
  } catch (_) {}
  return !isOpen;
}
