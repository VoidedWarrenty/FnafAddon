import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  getBreakerBoxState, setRoomPowered,
  getBreakerBoxSnapshot, setBreakerBoxSnapshot,
} from "./state.js";
import { renderMap, renderRoomLegend } from "./mapRender.js";
import {
  buildTileGrid, TILE_PATH, GRID_TOTAL,
} from "./breakerTileGrid.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

function unconfiguredHeader() {
  return [
    "§7┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓",
    "§7┃ §f§lELECTRICAL PANEL §8· §cUNCONFIGURED       §7┃",
    "§7┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛",
  ].join("\n");
}

// The custom server_form.json layout renders when the form title
// equals this exact string. Change the string here AND in the
// JSON-UI file if you want to change the trigger.
const TILE_UI_TITLE = "§lPanel";

// Open the tile-grid UI. Emits GRID_TOTAL buttons (one per cell), each
// with a tile PNG as its icon. Clicks are routed via cellToRoom.
function openTilePanel(player, block, snapshot, state) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const { tiles, cellToRoom } = buildTileGrid(dim, snapshot.rooms, state);

  const form = new ActionFormData()
    .title(TILE_UI_TITLE)
    .body(snapshot.sourceName || "Panel");

  for (let i = 0; i < GRID_TOTAL; i++) {
    // Empty label + icon per cell. Empty text is rendered as blank by
    // the custom JSON-UI layout; only the icon matters.
    form.button(" ", `${TILE_PATH}${tiles[i]}`);
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection === undefined) return;
    const roomId = cellToRoom.get(res.selection);
    if (!roomId) {
      // Silent no-op: user tapped a wall/floor/blank cell.
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
    const body = [
      unconfiguredHeader(),
      "",
      "§7This panel has no §fblueprint§7 applied yet.",
      "§7Sneak-tap the panel while holding a §fBlueprint§7 to stamp its",
      "§7room layout onto this box.",
    ].join("\n");
    new ActionFormData()
      .title("§lBreaker Panel")
      .body(body)
      .button("§7Close")
      .show(player)
      .catch(() => {});
    return;
  }

  // Tile-grid UI when a blueprint is applied. Falls back to the text
  // form only if the classifier ends up unable to place any tiles.
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
