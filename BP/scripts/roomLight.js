import { world } from "@minecraft/server";
import {
  listRoomLights,
  isRoomPowered, getPanelSnapshot,
} from "./state.js";
import { pointInRoom } from "./blueprint.js";

const PANEL_ENTITY_ID = "fnaf:breaker_panel";
const SEARCH_RADIUS = 128;

// For a given light location, find the nearest breaker panel entity in the
// same dimension whose applied snapshot contains this point in a room.
function findControllingPanel(dimensionId, x, y, z) {
  const dim = world.getDimension(dimensionId);
  let panels = [];
  try {
    panels = dim.getEntities({
      type: PANEL_ENTITY_ID,
      location: { x, y, z },
      maxDistance: SEARCH_RADIUS,
    });
  } catch (_) { return null; }

  let best = null;
  let bestD = Infinity;
  for (const p of panels) {
    const snap = getPanelSnapshot(p);
    if (!snap || !snap.rooms) continue;
    let room = null;
    for (const r of snap.rooms) {
      if (pointInRoom(dimensionId, x, y, z, r)) { room = r; break; }
    }
    if (!room) continue;
    const dx = p.location.x - x, dy = p.location.y - y, dz = p.location.z - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = { panel: p, room }; }
  }
  return best;
}

export function syncAllRoomLights() {
  for (const rl of listRoomLights()) {
    const dim = world.getDimension(rl.dimensionId);
    let block;
    try { block = dim.getBlock({ x: rl.x, y: rl.y, z: rl.z }); }
    catch { continue; }
    if (!block || block.typeId !== "fnaf:room_light") continue;

    const ctl = findControllingPanel(rl.dimensionId, rl.x, rl.y, rl.z);
    let powered = false;
    if (ctl) powered = isRoomPowered(ctl.panel, ctl.room.id);

    const current = block.permutation.getState("fnaf:powered");
    if (current === powered) continue;
    try {
      block.setPermutation(block.permutation.withState("fnaf:powered", powered));
    } catch (_) {}
  }
}
