import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getBreakerBoxState, setRoomPowered,
  getBreakerBoxSnapshot, setBreakerBoxSnapshot,
} from "./state.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";
import {
  buildTileGrid, TILE_PATH, TILES, GRID_TOTAL,
} from "./breakerTileGrid.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

// The JSON-UI override in RP/ui/server_form.json swaps the vanilla button
// stack for a tile grid when the form title starts with this exact prefix.
const TILE_UI_PREFIX = "FNAFTILE:";

function panelHeader(title, subtitle) {
  const bar = "§7━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  return `${bar}\n§8┃ §f§l${title.toUpperCase()}§r §7- §7${subtitle}\n${bar}`;
}

function powerGauge(on, total) {
  const width = 18;
  const filled = total === 0 ? 0 : Math.round((on / total) * width);
  const bar = "§a" + "▰".repeat(filled) + "§8" + "▱".repeat(width - filled);
  const pct = total === 0 ? 0 : Math.round((on / total) * 100);
  return `§7Load §8│${bar}§7│ §f${pct}%§7 §8(§a${on}§7/§f${total}§8)`;
}

// Tile-grid UI: emits GRID_TOTAL buttons (one per cell) with tile PNGs
// as their icons. Title prefix triggers the JSON-UI custom layout.
function openTilePanel(player, block, snapshot, state) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const { tiles, cellToRoom } = buildTileGrid(dim, snapshot.rooms, state);

  const bpName = snapshot.sourceName || "Panel";
  const powered = snapshot.rooms.filter(r => state[r.id] === true).length;
  const form = new ActionFormData()
    .title(`${TILE_UI_PREFIX} ${bpName}`)
    .body(`§7${powered}/${snapshot.rooms.length} ON`);

  for (let i = 0; i < GRID_TOTAL; i++) {
    form.button(" ", `${TILE_PATH}${tiles[i]}`);
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const roomId = cellToRoom.get(res.selection);
    if (!roomId) {
      // Silent no-op for wall/floor/blank cells — reopen so player can retry.
      system.run(() => {
        try {
          if (block.typeId === BREAKER_BOX_ID) openBreakerBox(player, block);
        } catch (_) {}
      });
      return;
    }
    const nowOn = state[roomId] === true;
    setRoomPowered(dim, x, y, z, roomId, !nowOn);
    const room = snapshot.rooms.find(r => r.id === roomId);
    player.onScreenDisplay.setActionBar(
      `${!nowOn ? "§a▲ Breaker ON" : "§c▼ Breaker OFF"} §7· §f${room?.name ?? roomId}`
    );
    system.run(() => {
      try {
        if (block.typeId === BREAKER_BOX_ID) openBreakerBox(player, block);
      } catch (_) {}
    });
  }).catch(() => {});
}

export function openBreakerBox(player, block) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const snapshot = getBreakerBoxSnapshot(dim, x, y, z);
  const state = getBreakerBoxState(dim, x, y, z);

  if (!snapshot || !snapshot.rooms || snapshot.rooms.length === 0) {
    new ActionFormData()
      .title("§lBreaker Panel")
      .body(
        panelHeader("MAIN PANEL", "unconfigured") + "\n\n" +
        "§7This panel has no §fblueprint§7 applied yet.\n" +
        "§7Sneak-tap the panel while holding a §fBlueprint§7 to stamp it.\n\n" +
        "§8§oTip: right-click a blueprint in the world to open its editor."
      )
      .button("§7Close")
      .show(player)
      .catch(() => {});
    return;
  }

  openTilePanel(player, block, snapshot, state);
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
