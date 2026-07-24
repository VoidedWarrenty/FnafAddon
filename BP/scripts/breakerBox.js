import { openBreakerForm } from "./breakerForm.js";
import { generateMapSnapshot } from "./mapPipeline.js";
import { saveMapSnapshot } from "./mapSerializer.js";
import { bindLightsToSnapshot } from "./electricalRoomManager.js";
import { debugEnabled, debugDumpSnapshot } from "./mapDebug.js";
import { begin, end } from "./metrics.js";
import { GRID_W, GRID_H } from "./blueprintTypes.js";

export const BREAKER_BOX_ID = "fnaf:breaker_box_1";

// Public entry — the rest of the addon calls into these three functions.

export function openBreakerBox(player, block) {
  begin("ui.open");
  openBreakerForm(player, block);
  end("ui.open", {
    cells: GRID_W * GRID_H,
    gridW: GRID_W,
    gridH: GRID_H,
  });
}

export function applyBlueprintToBreakerBox(player, block, blueprint) {
  const { x, y, z } = block.location;
  const dim = block.dimension.id;

  begin("device.applyBlueprint");
  begin("pipeline.buildSnapshot");
  const snap = generateMapSnapshot(blueprint, dim);
  end("pipeline.buildSnapshot", {
    cells: GRID_W * GRID_H,
    rooms: snap?.meta?.length ?? 0,
    buildingCellsX: snap?.t
      ? Math.round(snap.t.maxX - snap.t.minX + 1)
      : 0,
    buildingCellsZ: snap?.t
      ? Math.round(snap.t.maxZ - snap.t.minZ + 1)
      : 0,
  });

  if (!snap) {
    end("device.applyBlueprint", { ok: 0 });
    player.onScreenDisplay.setActionBar(
      "§cCouldn't build map — blueprint has no floors in this dimension."
    );
    return;
  }
  saveMapSnapshot(dim, x, y, z, snap);
  bindLightsToSnapshot(dim, x, y, z);
  end("device.applyBlueprint", { ok: 1, rooms: snap.meta.length });

  player.onScreenDisplay.setActionBar(
    `§a✔ Stamped §f${blueprint.name} §a→ panel §7(${snap.meta.length} room${snap.meta.length === 1 ? "" : "s"})`
  );

  if (debugEnabled()) {
    player.sendMessage(debugDumpSnapshot(snap));
  }
}

export function togglePanelDoor(block) {
  const isOpen = block.permutation.getState("fnaf:is_open") === true;
  try {
    block.setPermutation(block.permutation.withState("fnaf:is_open", !isOpen));
  } catch (_) {}
  return !isOpen;
}
