import { world, system } from "@minecraft/server";
import {
  openBreakerBox, applyBlueprintToBreakerBox, togglePanelDoor,
  BREAKER_BOX_ID,
} from "./breakerBox.js";
import { syncAllRoomLights } from "./roomLight.js";
import {
  registerBreakerBox, unregisterBreakerBox,
  registerRoomLight, unregisterRoomLight,
} from "./state.js";
import {
  BLUEPRINT_ID, ensureBlueprint, handleBlueprintUseOn, handleBlueprintUseAir,
} from "./blueprintItem.js";
import { startVisualization } from "./blueprintViz.js";

const LIGHT_ID = "fnaf:room_light";

const lastInteract = new Map();
function throttle(player) {
  const now = system.currentTick;
  const prev = lastInteract.get(player.id) ?? -100;
  if (now - prev < 5) return false;
  lastInteract.set(player.id, now);
  return true;
}

// --- Item interactions (blueprint + breaker box holding blueprint) ---

world.beforeEvents.itemUseOn.subscribe(ev => {
  const { itemStack, source: player, block } = ev;
  if (!itemStack || itemStack.typeId !== BLUEPRINT_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;

  // Sneak + blueprint on breaker box → apply snapshot
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

// --- Block interactions (breaker box) --------------------------------

world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
  const { block, player, itemStack } = ev;
  if (!block) return;
  // Blueprints handled in itemUseOn above.
  if (itemStack?.typeId === BLUEPRINT_ID) return;
  if (block.typeId !== BREAKER_BOX_ID) return;

  ev.cancel = true;
  if (!throttle(player)) return;

  system.run(() => {
    // Sneak-tap always toggles the door.
    if (player.isSneaking) {
      const nowOpen = togglePanelDoor(block);
      player.onScreenDisplay.setActionBar(
        nowOpen ? "§7Panel door opened" : "§7Panel door closed"
      );
      return;
    }
    // Normal tap opens the UI only if the door is already open.
    const isOpen = block.permutation.getState("fnaf:is_open") === true;
    if (!isOpen) {
      player.onScreenDisplay.setActionBar("§7Panel is closed — sneak-tap to open it first.");
      return;
    }
    openBreakerBox(player, block);
  });
});

// --- Placement / break registry sync ---------------------------------

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

// --- Ticking ---------------------------------------------------------

system.runInterval(() => {
  try { syncAllRoomLights(); } catch (_) {}
}, 20);

startVisualization();
