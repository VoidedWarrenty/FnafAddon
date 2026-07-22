import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getBreakerBoxState, setRoomPowered,
  getBreakerBoxSnapshot, setBreakerBoxSnapshot,
} from "./state.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

// Metal-panel framing built out of unicode box + fill characters.
function panelHeader(bpName, statusRight) {
  return [
    "§7┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    `§7┃ §f§lELECTRICAL PANEL §8· §7${bpName.toUpperCase().padEnd(20, " ")} §7┃`,
    `§7┃ §8· MAIN 200A §7────────────────── §f${statusRight.padStart(9, " ")} §7┃`,
    "§7┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
  ].join("\n");
}

function unconfiguredHeader() {
  return [
    "§7┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    "§7┃ §f§lELECTRICAL PANEL §8· §cUNCONFIGURED       §7┃",
    "§7┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
  ].join("\n");
}

// A little text-gauge for how many breakers are ON.
function powerGauge(on, total) {
  const width = 20;
  const filled = total === 0 ? 0 : Math.round((on / total) * width);
  const bar = "§a" + "▰".repeat(filled) + "§8" + "▱".repeat(width - filled);
  const pct = total === 0 ? 0 : Math.round((on / total) * 100);
  return `§7Load §8│${bar}§7│ §f${pct}%§7 (§a${on}§7/§f${total}§7)`;
}

export function openBreakerBox(player, block) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const snapshot = getBreakerBoxSnapshot(dim, x, y, z);
  const state = getBreakerBoxState(dim, x, y, z);

  if (!snapshot || !snapshot.rooms || snapshot.rooms.length === 0) {
    const body = [
      unconfiguredHeader(),
      "",
      "§7This panel has no §fblueprint§7 applied yet.",
      "§7Sneak-tap the panel while holding a §fBlueprint§7 to stamp its",
      "§7room layout onto this box.",
      "",
      "§8§oTip: right-click a blueprint in the world to open its editor",
      "§8§oand paint room boxes first.",
    ].join("\n");
    new ActionFormData()
      .title("§lBreaker Panel")
      .body(body)
      .button("§7Close")
      .show(player)
      .catch(() => {});
    return;
  }

  const powered = snapshot.rooms.filter(r => state[r.id] === true).length;
  const total = snapshot.rooms.length;
  const bpName = snapshot.sourceName || "Unnamed";

  const map = renderMap(dim, snapshot.rooms, { maxCols: 44, maxRows: 16 });
  const legend = renderRoomLegend(snapshot.rooms);
  const body = [
    panelHeader(bpName, `${powered}/${total} ON`),
    powerGauge(powered, total),
    "",
    map,
    "",
    "§8§lROOM DIRECTORY",
    legend,
  ].join("\n");

  const form = new ActionFormData()
    .title("§l§8[ §fBREAKER PANEL §8]")
    .body(body);

  const buttons = [];
  for (let i = 0; i < snapshot.rooms.length; i++) {
    const r = snapshot.rooms[i];
    const on = state[r.id] === true;
    const glyph = on ? "§a▲ ON " : "§c▼ OFF";
    const num = String(i + 1).padStart(2, " ");
    form.button(`${glyph}§r §8│ §7#${num}  §f${r.name}`);
    buttons.push({ kind: "toggle", room: r });
  }
  form.button("§a▲▲ MAIN BREAKER ▸ ALL ON");   buttons.push({ kind: "all_on" });
  form.button("§c▼▼ MAIN BREAKER ▸ ALL OFF"); buttons.push({ kind: "all_off" });
  form.button("§8✖ Close");                     buttons.push({ kind: "close" });

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const choice = buttons[res.selection];
    if (!choice || choice.kind === "close") return;

    if (choice.kind === "toggle") {
      const nowOn = state[choice.room.id] === true;
      setRoomPowered(dim, x, y, z, choice.room.id, !nowOn);
      player.onScreenDisplay.setActionBar(
        `${!nowOn ? "§a▲ Breaker ON" : "§c▼ Breaker OFF"} §7· §f${choice.room.name}`
      );
    } else if (choice.kind === "all_on") {
      for (const r of snapshot.rooms) setRoomPowered(dim, x, y, z, r.id, true);
      player.onScreenDisplay.setActionBar("§a▲▲ Main breaker ON — all rooms powered");
    } else if (choice.kind === "all_off") {
      for (const r of snapshot.rooms) setRoomPowered(dim, x, y, z, r.id, false);
      player.onScreenDisplay.setActionBar("§c▼▼ Main breaker OFF — power cut");
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
    `§a✔ Stamped §f${blueprint.name} §a→ panel §7(${snapshot.rooms.length} room${snapshot.rooms.length === 1 ? "" : "s"})`
  );
}

export function togglePanelDoor(block) {
  const isOpen = block.permutation.getState("fnaf:is_open") === true;
  try {
    block.setPermutation(block.permutation.withState("fnaf:is_open", !isOpen));
  } catch (_) {}
  return !isOpen;
}
