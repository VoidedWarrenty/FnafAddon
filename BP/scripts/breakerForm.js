import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  CELL, GRID_W, GRID_H, ELECTRICAL_MAP_PREFIX, tileForCell,
} from "./blueprintTypes.js";
import {
  loadMapSnapshot, saveMapSnapshot, inflateSnapshot,
  setRoomPowered, getRoomPowered,
} from "./mapSerializer.js";
import { syncAllRoomLights } from "./roomLight.js";

// The ActionForm gets exactly GRID_W*GRID_H buttons in row-major order.
// Every button carries the tile texture for its cell; button text stays
// blank except on breaker cells (where it encodes the room id + name so
// the accessibility caption/tooltip is meaningful).
//
// On response we translate button index → cell index. If the cell is a
// breaker, toggle its room's power and reopen. Anything else: silently
// reopen (per spec — non-breaker cells still emit selection events
// because they're technically buttons).

function unconfiguredForm(player) {
  new ActionFormData()
    .title("§lBreaker Panel")
    .body(
      "§7This panel has no §fblueprint§7 applied yet.\n" +
      "§7Sneak-tap the panel while holding a §fBlueprint§7 to stamp it.\n\n" +
      "§8§oTip: right-click a blueprint in the world to open its editor."
    )
    .button("§7Close")
    .show(player)
    .catch(() => {});
}

// Build the map form for a specific breaker box. `block` is the world
// block so we can re-open on the same coords after a toggle.
export function openBreakerForm(player, block) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;
  const snap = loadMapSnapshot(dim, x, y, z);
  if (!snap || !snap.meta || snap.meta.length === 0) {
    unconfiguredForm(player);
    return;
  }

  const { tiles } = inflateSnapshot(snap);

  // Reflect current power state into the tile grid before rendering — the
  // stored tiles snapshot may be stale if a light was toggled elsewhere.
  for (const m of snap.meta) {
    tiles[m.breakerIdx] = m.powered ? CELL.BREAKER_ON : CELL.BREAKER_OFF;
  }

  const total = GRID_W * GRID_H;
  const title = `${ELECTRICAL_MAP_PREFIX}${snap.sourceName || "Panel"}`;

  const form = new ActionFormData().title(title).body("");

  // Emit one button per cell. Buttons that are pure map background use
  // a single space as their label so the JSON-UI grid layout has
  // uniform-sized cells (empty labels get compacted by some clients).
  for (let i = 0; i < total; i++) {
    const cell = tiles[i];
    if (cell === CELL.BREAKER_ON || cell === CELL.BREAKER_OFF) {
      const m = snap.meta.find(mm => mm.breakerIdx === i);
      const name = m ? m.name : "Breaker";
      form.button(name, tileForCell(cell));
    } else {
      form.button(" ", tileForCell(cell));
    }
  }

  form.show(player).then(res => {
    if (res.canceled || res.selection == null) return;
    const idx = res.selection;
    if (idx < 0 || idx >= total) return;
    const cell = tiles[idx];

    // Ignore non-breaker taps entirely (per spec).
    if (cell !== CELL.BREAKER_ON && cell !== CELL.BREAKER_OFF) {
      system.run(() => openBreakerForm(player, block));
      return;
    }

    // Locate the room this breaker cell belongs to and flip it.
    const meta = snap.meta.find(mm => mm.breakerIdx === idx);
    if (!meta) {
      system.run(() => openBreakerForm(player, block));
      return;
    }
    const nowOn = !getRoomPowered(snap, meta.id);
    setRoomPowered(snap, meta.id, nowOn);
    saveMapSnapshot(dim, x, y, z, snap);

    player.onScreenDisplay.setActionBar(
      `${nowOn ? "§a▲ Breaker ON" : "§c▼ Breaker OFF"} §7· §f${meta.name}`
    );

    // Push the new state to any lights bound to this room immediately.
    system.run(() => {
      try { syncAllRoomLights(); } catch (_) {}
      try { openBreakerForm(player, block); } catch (_) {}
    });
  }).catch(() => {});
}
