import { world, system } from "@minecraft/server";
import {
  newBlueprintId, createBlueprint, getBlueprint, addBoxToRoom, normalizeBox, findRoom,
} from "./blueprint.js";
import { recordCorner, isPicking } from "./blueprintPicker.js";
import { openBlueprintEditor } from "./blueprintUi.js";

export const BLUEPRINT_ID = "fnaf:blueprint";
const LORE_PREFIX = "§8bp:"; // dark-gray, near-invisible tag

function selectedSlot(player) {
  return player.selectedSlotIndex ?? player.selectedSlot ?? 0;
}

function getInventoryContainer(player) {
  return player.getComponent("inventory")?.container;
}

function writeMainHand(player, stack) {
  const inv = getInventoryContainer(player);
  if (!inv) return;
  inv.setItem(selectedSlot(player), stack);
}

export function readBlueprintId(itemStack) {
  if (!itemStack) return null;
  const lore = itemStack.getLore();
  for (const l of lore) {
    if (l.startsWith(LORE_PREFIX)) return l.slice(LORE_PREFIX.length);
  }
  return null;
}

function loreWithId(itemStack, id) {
  const lore = itemStack.getLore().filter(l => !l.startsWith(LORE_PREFIX));
  lore.push(LORE_PREFIX + id);
  return lore;
}

function displayName(bpName) {
  return `§bBlueprint §7- §f${bpName}`;
}

function stampStack(itemStack, id, bpName) {
  const stack = itemStack.clone();
  stack.setLore(loreWithId(stack, id));
  stack.nameTag = displayName(bpName);
  return stack;
}

// If the currently held blueprint has no UUID yet, create one and stamp it.
// Returns the (possibly new) blueprint and the stack now in-hand.
export function ensureBlueprint(player, itemStack) {
  let id = readBlueprintId(itemStack);
  if (id) {
    const bp = getBlueprint(id);
    if (bp) return { bp, stack: itemStack };
    // ID present but registry missing (world wipe?): treat as blank.
  }
  id = newBlueprintId();
  const bp = createBlueprint(id, "Untitled");
  const stack = stampStack(itemStack, id, bp.name);
  writeMainHand(player, stack);
  return { bp, stack };
}

// After a blueprint is renamed, refresh the name shown on the item in hand.
export function rewriteHeldBlueprintName(player, bpId, newName) {
  const inv = getInventoryContainer(player);
  if (!inv) return;
  const slot = selectedSlot(player);
  const stack = inv.getItem(slot);
  if (!stack || stack.typeId !== BLUEPRINT_ID) return;
  if (readBlueprintId(stack) !== bpId) return;
  const updated = stack.clone();
  updated.nameTag = displayName(newName);
  inv.setItem(slot, updated);
}

// Called when the player uses a blueprint on a block. Returns true if
// this handler consumed the interaction and no editor should open.
export function handleBlueprintUseOn(player, itemStack, block) {
  const { bp, stack } = ensureBlueprint(player, itemStack);

  // Picker mode wins if active: plant a corner.
  if (isPicking(player.id)) {
    const { x, y, z } = block.location;
    const result = recordCorner(player.id, x, y, z);
    if (!result) return true;
    if (result.kind === "first") {
      player.onScreenDisplay.setActionBar(
        `§eFirst corner set at §f(${x},${y},${z})§e. Tap the opposite corner.`
      );
      return true;
    }
    // second corner
    const room = findRoom(bp, result.roomId);
    if (!room) {
      player.onScreenDisplay.setActionBar("§cRoom no longer exists");
      return true;
    }
    const box = normalizeBox(result.box.first, result.box.second, result.dim);
    addBoxToRoom(bp, room.id, box);
    player.onScreenDisplay.setActionBar(
      `§aBox added to §f${room.name} §7(${box.x1},${box.y1},${box.z1})→(${box.x2},${box.y2},${box.z2})`
    );
    return true;
  }

  // Otherwise: open the editor.
  system.run(() => openBlueprintEditor(player, bp.id));
  return true;
}

// Right-click in air with a blueprint (no block target) -> open editor.
export function handleBlueprintUseAir(player, itemStack) {
  const { bp } = ensureBlueprint(player, itemStack);
  system.run(() => openBlueprintEditor(player, bp.id));
}
