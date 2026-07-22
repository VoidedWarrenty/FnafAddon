import { world, system } from "@minecraft/server";
import { openBreakerBox } from "./breakerBox.js";
import { openRoomLightPicker, syncAllRoomLights } from "./roomLight.js";
import {
  registerBreakerBox,
  unregisterBreakerBox,
  registerRoomLight,
  unregisterRoomLight,
} from "./state.js";

const BREAKER_ID = "fnaf:breaker_box_1";
const LIGHT_ID = "fnaf:room_light";

// Dedup: playerInteractWithBlock can fire once per hand on some platforms.
const lastInteract = new Map(); // playerId -> tick
function throttle(player) {
  const now = system.currentTick;
  const prev = lastInteract.get(player.id) ?? -100;
  if (now - prev < 5) return false;
  lastInteract.set(player.id, now);
  return true;
}

// Interact -> open the matching UI. Use beforeEvents so we can cancel the
// vanilla place-on-block behavior when the player is holding a stackable block.
world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
  const { block, player } = ev;
  if (!block) return;
  if (block.typeId === BREAKER_ID) {
    ev.cancel = true;
    if (!throttle(player)) return;
    system.run(() => openBreakerBox(player, block));
  } else if (block.typeId === LIGHT_ID && player.isSneaking) {
    ev.cancel = true;
    if (!throttle(player)) return;
    system.run(() => openRoomLightPicker(player, block));
  }
});

// Keep registries in sync so we can locate blocks without scanning the world.
world.afterEvents.playerPlaceBlock.subscribe(ev => {
  const b = ev.block;
  if (b.typeId === BREAKER_ID) {
    registerBreakerBox(b.dimension.id, b.location.x, b.location.y, b.location.z);
  } else if (b.typeId === LIGHT_ID) {
    registerRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

world.afterEvents.playerBreakBlock.subscribe(ev => {
  const b = ev.block;
  const type = ev.brokenBlockPermutation?.type?.id;
  if (type === BREAKER_ID) {
    unregisterBreakerBox(b.dimension.id, b.location.x, b.location.y, b.location.z);
  } else if (type === LIGHT_ID) {
    unregisterRoomLight(b.dimension.id, b.location.x, b.location.y, b.location.z);
  }
});

// Periodic re-sync so lights inside newly loaded chunks catch up.
system.runInterval(() => {
  try { syncAllRoomLights(); } catch (_) {}
}, 20);
