import { world, system } from "@minecraft/server";
import {
  openBreakerPanelForm, applyBlueprintToPanel, togglePanelDoor,
  spawnPanelAtHit,
  PANEL_ENTITY_ID, PANEL_ITEM_ID,
} from "./breakerBox.js";
import { syncAllRoomLights } from "./roomLight.js";
import {
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

// --- Blueprint item interactions --------------------------------------

world.beforeEvents.itemUseOn.subscribe(ev => {
  const { itemStack, source: player, block } = ev;
  if (!itemStack) return;

  // Breaker box item → spawn the entity in front of the clicked face
  if (itemStack.typeId === PANEL_ITEM_ID) {
    ev.cancel = true;
    if (!throttle(player)) return;
    system.run(() => spawnPanelAtHit(player, block, ev.faceLocation, ev.blockFace));
    return;
  }

  if (itemStack.typeId !== BLUEPRINT_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;
  system.run(() => handleBlueprintUseOn(player, itemStack, block));
});

world.beforeEvents.itemUse.subscribe(ev => {
  const { itemStack, source: player } = ev;
  if (!itemStack || itemStack.typeId !== BLUEPRINT_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;
  system.run(() => handleBlueprintUseAir(player, itemStack));
});

// --- Breaker panel entity interactions --------------------------------

world.beforeEvents.playerInteractWithEntity.subscribe(ev => {
  const { target, player, itemStack } = ev;
  if (!target || target.typeId !== PANEL_ENTITY_ID) return;
  ev.cancel = true;
  if (!throttle(player)) return;

  // Sneak + blueprint = apply snapshot
  if (player.isSneaking && itemStack?.typeId === BLUEPRINT_ID) {
    system.run(() => {
      const { bp } = ensureBlueprint(player, itemStack);
      if (bp.rooms.length === 0) {
        player.onScreenDisplay.setActionBar("§eBlueprint has no rooms yet — add some first.");
        return;
      }
      applyBlueprintToPanel(player, target, bp);
    });
    return;
  }

  // Sneak alone (no blueprint) = swing the door open/closed
  if (player.isSneaking) {
    system.run(() => {
      const nowOpen = togglePanelDoor(target);
      player.onScreenDisplay.setActionBar(
        nowOpen ? "§7Panel door opened" : "§7Panel door closed"
      );
    });
    return;
  }

  // Normal interact → open the form (also auto-opens the door visually)
  system.run(() => {
    try {
      if (target.getProperty("fnaf:is_open") !== true) {
        target.setProperty("fnaf:is_open", true);
      }
    } catch (_) {}
    openBreakerPanelForm(player, target);
  });
});

// --- Block placement / break for room_light registry ------------------

world.afterEvents.playerPlaceBlock.subscribe(ev => {
  const b = ev.block;
  if (b.typeId === LIGHT_ID) {
    registerRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

world.afterEvents.playerBreakBlock.subscribe(ev => {
  const b = ev.block;
  const type = ev.brokenBlockPermutation?.type?.id;
  if (type === LIGHT_ID) {
    unregisterRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

// --- Ticking ----------------------------------------------------------

system.runInterval(() => {
  try { syncAllRoomLights(); } catch (_) {}
}, 20);

startVisualization();
