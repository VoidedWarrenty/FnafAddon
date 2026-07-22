import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getPanelState, getPanelSnapshot, setPanelSnapshot, setRoomPowered,
} from "./state.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";

export const PANEL_ENTITY_ID = "fnaf:breaker_panel";
export const PANEL_ITEM_ID = "fnaf:breaker_box_1";
export const PANEL_OPEN_PROP = "fnaf:is_open";

function panelHeader(title, subtitle) {
  const bar = "§7━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  return `${bar}\n§8┃ §f§l${title}§r §7- §7${subtitle}\n${bar}`;
}

export function openBreakerPanelForm(player, entity) {
  const snapshot = getPanelSnapshot(entity);
  const state = getPanelState(entity);

  if (!snapshot || !snapshot.rooms || snapshot.rooms.length === 0) {
    const form = new ActionFormData()
      .title("§lBreaker Panel §7- Unconfigured")
      .body(
        panelHeader("MAIN PANEL", "unconfigured") + "\n\n" +
        "§7No blueprint has been applied to this panel yet.\n\n" +
        "§8• Hold a §fBlueprint§8, sneak, and interact with this panel.\n" +
        "§8• Right-click a blueprint anywhere to open its editor."
      )
      .button("§7OK");
    form.show(player).catch(() => {});
    return;
  }

  const powered = snapshot.rooms.filter(r => state[r.id] === true).length;
  const total = snapshot.rooms.length;
  const bpName = snapshot.sourceName || "Unnamed";

  const map = renderMap(entity.dimension.id, snapshot.rooms, { maxCols: 46, maxRows: 18 });
  const legend = renderRoomLegend(snapshot.rooms);
  const body =
    panelHeader(bpName.toUpperCase(), `${powered}/${total} ON`) +
    "\n" + map + "\n" + legend;

  const form = new ActionFormData()
    .title("§l§8[ §fBREAKER PANEL §8]")
    .body(body);

  const buttons = [];
  for (let i = 0; i < snapshot.rooms.length; i++) {
    const r = snapshot.rooms[i];
    const on = state[r.id] === true;
    form.button(`${on ? "§a[I]" : "§c[O]"}§r §7#${i + 1}  §f${r.name}`);
    buttons.push({ kind: "toggle", room: r });
  }
  form.button("§a▲ MAIN BREAKER ON");  buttons.push({ kind: "all_on" });
  form.button("§c▼ MAIN BREAKER OFF"); buttons.push({ kind: "all_off" });

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const choice = buttons[res.selection];
    if (!choice) return;

    if (choice.kind === "toggle") {
      const nowOn = state[choice.room.id] === true;
      setRoomPowered(entity, choice.room.id, !nowOn);
      player.onScreenDisplay.setActionBar(
        `${!nowOn ? "§aBreaker flipped ON" : "§cBreaker flipped OFF"} §7- §f${choice.room.name}`
      );
    } else if (choice.kind === "all_on") {
      for (const r of snapshot.rooms) setRoomPowered(entity, r.id, true);
      player.onScreenDisplay.setActionBar("§aMain breaker ON — all rooms powered");
    } else if (choice.kind === "all_off") {
      for (const r of snapshot.rooms) setRoomPowered(entity, r.id, false);
      player.onScreenDisplay.setActionBar("§cMain breaker OFF — power cut to all rooms");
    }

    system.run(() => {
      try {
        if (entity.typeId === PANEL_ENTITY_ID) openBreakerPanelForm(player, entity);
      } catch (_) {}
    });
  }).catch(() => {});
}

// Sneak + interact with blueprint on the panel = stamp its snapshot.
export function applyBlueprintToPanel(player, entity, blueprint) {
  const snapshot = {
    sourceBpId: blueprint.id,
    sourceName: blueprint.name,
    appliedAtTick: system.currentTick,
    rooms: blueprint.rooms.map(r => ({
      id: r.id,
      name: r.name,
      boxes: r.boxes.map(b => ({ ...b })),
    })),
  };
  setPanelSnapshot(entity, snapshot);
  player.onScreenDisplay.setActionBar(
    `§aApplied §f${blueprint.name}§a to panel §7(${snapshot.rooms.length} room${snapshot.rooms.length === 1 ? "" : "s"})`
  );
}

// Spawn a panel entity in front of the block the item was used on.
export function spawnPanelAtHit(player, block, faceLocation, blockFace) {
  const dim = player.dimension;
  // Offset the entity slightly out of the block face so it doesn't clip.
  const loc = { x: faceLocation.x, y: faceLocation.y, z: faceLocation.z };
  const entity = dim.spawnEntity(PANEL_ENTITY_ID, loc);
  // Face the entity toward the player (away from the wall it's mounted on).
  try {
    const rot = player.getRotation();
    entity.setRotation({ x: 0, y: rot.y + 180 });
  } catch (_) {}
  player.onScreenDisplay.setActionBar("§aBreaker panel installed. Interact to open.");
  return entity;
}

// Toggle the door open/closed animation property on the entity.
export function togglePanelDoor(entity) {
  const wasOpen = entity.getProperty(PANEL_OPEN_PROP) === true;
  try {
    entity.setProperty(PANEL_OPEN_PROP, !wasOpen);
  } catch (_) {}
  return !wasOpen;
}
