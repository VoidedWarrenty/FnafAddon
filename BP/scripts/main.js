import { world, system } from "@minecraft/server";
import { openBreakerBox, applyBlueprintToBreakerBox, BREAKER_BOX_ID } from "./breakerBox.js";
import { syncAllRoomLights } from "./roomLight.js";
import {
  registerBreakerBox, unregisterBreakerBox,
  registerRoomLight, unregisterRoomLight,
} from "./state.js";
import {
  BLUEPRINT_ID, ensureBlueprint, handleBlueprintUseOn, handleBlueprintUseAir,
  readBlueprintId,
} from "./blueprintItem.js";
import { getBlueprint } from "./blueprint.js";
import { startVisualization } from "./blueprintViz.js";

const LIGHT_ID = "fnaf:room_light";

// itemUseOn / playerInteractWithBlock can fire twice per tap on some
// platforms. Small tick-based cooldown per player is enough.
const lastInteract = new Map();
function throttle(player) {
  const now = system.currentTick;
  const prev = lastInteract.get(player.id) ?? -100;
  if (now - prev < 5) return false;
  lastInteract.set(player.id, now);
  return true;
}

// --- Item interactions (blueprint) -------------------------------------

world.beforeEvents.itemUseOn.subscribe(ev => {
  const { itemStack, source: player, block } = ev;
  if (!itemStack || itemStack.typeId !== BLUEPRINT_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;

  // Sneak + use on a breaker box → snapshot-apply.
  if (player.isSneaking && block?.typeId === BREAKER_BOX_ID) {
    system.run(() => {
      const { bp } = ensureBlueprint(player, itemStack);
      if (bp.rooms.length === 0) {
        player.onScreenDisplay.setActionBar("§eBlueprint has no rooms yet — add some first.");
        return;
      }
      applyBlueprintToBreakerBox(player, block, bp);
    });
    return;
  }

  system.run(() => handleBlueprintUseOn(player, itemStack, block));
});

world.beforeEvents.itemUse.subscribe(ev => {
  const { itemStack, source: player } = ev;
  if (!itemStack || itemStack.typeId !== BLUEPRINT_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;
  system.run(() => handleBlueprintUseAir(player, itemStack));
});

// --- Block interactions (breaker box) ----------------------------------

world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
  const { block, player, itemStack } = ev;
  if (!block) return;
  // If the player is holding a blueprint, let itemUseOn handle it.
  if (itemStack?.typeId === BLUEPRINT_ID) return;

  if (block.typeId === BREAKER_BOX_ID) {
    ev.cancel = true;
    if (!throttle(player)) return;
    system.run(() => openBreakerBox(player, block));
  }
});

// --- Placement / break registry sync -----------------------------------

world.afterEvents.playerPlaceBlock.subscribe(ev => {
  const b = ev.block;
  if (b.typeId === BREAKER_BOX_ID) {
    registerBreakerBox(b.dimension.id, b.location.x, b.location.y, b.location.z);
  } else if (b.typeId === LIGHT_ID) {
    registerRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

world.afterEvents.playerBreakBlock.subscribe(ev => {
  const b = ev.block;
  const type = ev.brokenBlockPermutation?.type?.id;
  if (type === BREAKER_BOX_ID) {
    unregisterBreakerBox(b.dimension.id, b.location.x, b.location.y, b.location.z);
  } else if (type === LIGHT_ID) {
    unregisterRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

// --- Ticking -----------------------------------------------------------

system.runInterval(() => {
  try { syncAllRoomLights(); } catch (_) {}
}, 20);

startVisualization();
