import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getBreakerBoxState, setRoomPowered,
  getBreakerBoxSnapshot, setBreakerBoxSnapshot,
} from "./state.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

function panelHeader(title, subtitle) {
  // A "brand plate" strip that reads like the label glued on an American
  // breaker panel door.
  const bar = "§7━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  return (
    `${bar}\n` +
    `§8┃ §f§l${title}§r §7- §7${subtitle}\n` +
    `${bar}`
  );
}

export function openBreakerBox(player, block) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const snapshot = getBreakerBoxSnapshot(dim, x, y, z);
  const state = getBreakerBoxState(dim, x, y, z);

  if (!snapshot || !snapshot.rooms || snapshot.rooms.length === 0) {
    const form = new ActionFormData()
      .title("§lBreaker Panel §7- Unconfigured")
      .body(
        panelHeader("MAIN PANEL", "unconfigured") +
        "\n\n" +
        "§7No blueprint has been applied to this panel yet.\n\n" +
        "§8• Hold a §fBlueprint§8, sneak, and tap this panel to stamp it.\n" +
        "§8• Right-click a blueprint in the world to open its editor."
      )
      .button("§7OK");
    form.show(player).catch(() => {});
    return;
  }

  const powered = snapshot.rooms.filter(r => state[r.id] === true).length;
  const total = snapshot.rooms.length;
  const bpName = snapshot.sourceName || "Unnamed";

  const map = renderMap(dim, snapshot.rooms, { maxCols: 46, maxRows: 18 });
  const legend = renderRoomLegend(snapshot.rooms);

  const body =
    panelHeader(bpName.toUpperCase(), `${powered}/${total} ON`) +
    "\n" + map +
    "\n" + legend;

  const form = new ActionFormData()
    .title("§l§8[ §fBREAKER PANEL §8]")
    .body(body);

  const buttons = [];
  for (let i = 0; i < snapshot.rooms.length; i++) {
    const r = snapshot.rooms[i];
    const on = state[r.id] === true;
    // Physical-switch styling: [I] up = on (green), [O] down = off (red)
    const switchGlyph = on ? "§a[I]" : "§c[O]";
    form.button(`${switchGlyph}§r §7#${i + 1}  §f${r.name}`);
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
      setRoomPowered(dim, x, y, z, choice.room.id, !nowOn);
      player.onScreenDisplay.setActionBar(
        `${!nowOn ? "§aBreaker flipped ON" : "§cBreaker flipped OFF"} §7- §f${choice.room.name}`
      );
    } else if (choice.kind === "all_on") {
      for (const r of snapshot.rooms) setRoomPowered(dim, x, y, z, r.id, true);
      player.onScreenDisplay.setActionBar("§aMain breaker ON — all rooms powered");
    } else if (choice.kind === "all_off") {
      for (const r of snapshot.rooms) setRoomPowered(dim, x, y, z, r.id, false);
      player.onScreenDisplay.setActionBar("§cMain breaker OFF — power cut to all rooms");
    }

    system.run(() => {
      try {
        if (block.typeId === BREAKER_BOX_ID) openBreakerBox(player, block);
      } catch (_) {}
    });
  }).catch(() => {});
}

export function applyBlueprintToBreakerBox(player, block, blueprint) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;

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
  setBreakerBoxSnapshot(dim, x, y, z, snapshot);
  player.onScreenDisplay.setActionBar(
    `§aApplied §f${blueprint.name}§a to panel §7(${snapshot.rooms.length} room${snapshot.rooms.length === 1 ? "" : "s"})`
  );
}
