import { world, system } from "@minecraft/server";
import {
  newBlueprintId, createBlueprint, getBlueprint, addFloorToRoom, findRoom,
  closestEdgeToPoint,
} from "./blueprint.js";
import {
  isPicking, getPickerState,
  recordTap, recordSneakTap, pushOpeningTap, finalize,
} from "./blueprintPicker.js";
import { openBlueprintEditor } from "./blueprintUi.js";

export const BLUEPRINT_ID = "fnaf:blueprint";
const LORE_PREFIX = "§8bp:";

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
  for (const l of lore) if (l.startsWith(LORE_PREFIX)) return l.slice(LORE_PREFIX.length);
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

export function ensureBlueprint(player, itemStack) {
  let id = readBlueprintId(itemStack);
  if (id) {
    const bp = getBlueprint(id);
    if (bp) return { bp, stack: itemStack };
  }
  id = newBlueprintId();
  const bp = createBlueprint(id, "Untitled");
  const stack = stampStack(itemStack, id, bp.name);
  writeMainHand(player, stack);
  return { bp, stack };
}

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

// Finalize an active pick if we're in openings phase. Called by "finish"
// events from the picker.
function saveActivePick(player) {
  const ps = getPickerState(player.id);
  if (!ps) return;
  const result = finalize(player.id);
  if (!result) return;
  const bp = getBlueprint(result.bpId);
  if (!bp) return;
  const room = findRoom(bp, result.roomId);
  if (!room) return;
  addFloorToRoom(bp, result.roomId, result.floor);
  player.onScreenDisplay.setActionBar(
    `§a✔ Floor saved §7- §f${room.name} §8(${result.floor.polygon.length} verts, Y ${result.floor.floorY}..${result.floor.ceilingY}, ${result.floor.openings.length} openings)`
  );
  system.run(() => openBlueprintEditor(player, result.bpId));
}

// Blueprint used on a block (normal or sneak). The caller has already
// pulled ev.isSneaking; we branch on it here.
export function handleBlueprintUseOn(player, itemStack, block, isSneaking) {
  const { bp } = ensureBlueprint(player, itemStack);
  const { x, y, z } = block.location;

  if (!isPicking(player.id)) {
    // Not picking: normal tap on a block opens the editor.
    // Sneak tap without an active pick: also opens the editor (safe).
    system.run(() => openBlueprintEditor(player, bp.id));
    return;
  }

  const ps = getPickerState(player.id);

  if (isSneaking) {
    const r = recordSneakTap(player.id, x, y, z);
    if (!r) return;

    switch (r.kind) {
      case "too_few_vertices":
        player.onScreenDisplay.setActionBar(
          `§cNeed at least 3 vertices to close (${r.count} placed).`
        );
        return;
      case "closed":
        player.onScreenDisplay.setActionBar(
          `§a✔ Polygon closed. §fTap a ceiling block to set room height.`
        );
        return;
      case "ceiling_set":
        player.onScreenDisplay.setActionBar(
          `§7Ceiling Y = §f${r.y}§7. §eSneak-tap pairs of wall blocks to mark openings, or tap anywhere to finish.`
        );
        return;
      case "opening_tap": {
        // Resolve the wall segment the sneak-tap is closest to.
        const psNow = getPickerState(player.id);
        if (!psNow) return;
        // Build a temp polygon from the placed vertices to find the edge.
        const polygon = psNow.vertices.map(v => ({ x: v.x, z: v.z }));
        const edge = closestEdgeToPoint(polygon, x, z);
        if (!edge) return;
        const push = pushOpeningTap(player.id, edge.segIdx, edge.blockIdx);
        if (!push) return;
        if (push.kind === "opening_start") {
          player.onScreenDisplay.setActionBar(
            `§e▶ Opening start marked on edge #${edge.segIdx + 1}. Sneak-tap the other flanking block.`
          );
        } else if (push.kind === "opening_moved_segment") {
          player.onScreenDisplay.setActionBar(
            `§eStart moved to edge #${edge.segIdx + 1}. Sneak-tap the other flanking block on this edge.`
          );
        } else if (push.kind === "opening_done") {
          player.onScreenDisplay.setActionBar(
            `§a✔ Opening on edge #${push.segIdx + 1}, blocks ${push.startBlock}..${push.endBlock}. Add more or tap anywhere to finish.`
          );
        } else if (push.kind === "opening_too_small") {
          player.onScreenDisplay.setActionBar(
            `§cThose blocks are adjacent — no interior to open.`
          );
        }
        return;
      }
    }
    return;
  }

  // Non-sneak tap
  const r = recordTap(player.id, x, y, z);
  if (!r) return;

  switch (r.kind) {
    case "vertex":
      player.onScreenDisplay.setActionBar(
        r.first
          ? `§e▶ Vertex 1 at §f(${x},${y},${z})§e. Origin marked — tap more corners.`
          : `§e▶ Vertex ${r.count} at §f(${x},${y},${z})§e. Tap next or sneak-tap to close.`
      );
      return;
    case "closed":
      player.onScreenDisplay.setActionBar(
        `§a✔ Polygon closed. §fTap a ceiling block to set room height.`
      );
      return;
    case "ceiling_set":
      player.onScreenDisplay.setActionBar(
        `§7Ceiling Y = §f${r.y}§7. §eSneak-tap pairs of wall blocks for openings, or tap anywhere to finish.`
      );
      return;
    case "finish_request":
      saveActivePick(player);
      return;
  }
}

export function handleBlueprintUseAir(player, itemStack) {
  const { bp } = ensureBlueprint(player, itemStack);
  system.run(() => openBlueprintEditor(player, bp.id));
}
