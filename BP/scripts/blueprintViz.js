import { world, system } from "@minecraft/server";
import { getBlueprint } from "./blueprint.js";
import { readBlueprintId, BLUEPRINT_ID } from "./blueprintItem.js";
import { getPickerState } from "./blueprintPicker.js";

const OUTLINE_PARTICLE = "minecraft:endrod";
const CORNER_PARTICLE = "minecraft:balloon_gas_particle";
const RENDER_INTERVAL_TICKS = 10; // 0.5s — endrod lingers longer than that
const MAX_DISTANCE_SQ = 96 * 96;

function selectedSlot(player) {
  return player.selectedSlotIndex ?? player.selectedSlot ?? 0;
}

function heldBlueprintStack(player) {
  const inv = player.getComponent("inventory")?.container;
  if (!inv) return null;
  const stack = inv.getItem(selectedSlot(player));
  if (!stack || stack.typeId !== BLUEPRINT_ID) return null;
  return stack;
}

function drawEdge(dim, x1, y1, z1, x2, y2, z2) {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  const dz = Math.sign(z2 - z1);
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1));
  let x = x1, y = y1, z = z1;
  for (let i = 0; i <= steps; i++) {
    try {
      dim.spawnParticle(OUTLINE_PARTICLE, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    } catch (_) { /* chunk unloaded */ }
    x += dx; y += dy; z += dz;
  }
}

function drawBox(dim, box) {
  const { x1, y1, z1, x2, y2, z2 } = box;
  // Bottom rectangle
  drawEdge(dim, x1, y1, z1, x2, y1, z1);
  drawEdge(dim, x1, y1, z2, x2, y1, z2);
  drawEdge(dim, x1, y1, z1, x1, y1, z2);
  drawEdge(dim, x2, y1, z1, x2, y1, z2);
  // Top rectangle
  drawEdge(dim, x1, y2, z1, x2, y2, z1);
  drawEdge(dim, x1, y2, z2, x2, y2, z2);
  drawEdge(dim, x1, y2, z1, x1, y2, z2);
  drawEdge(dim, x2, y2, z1, x2, y2, z2);
  // Vertical edges
  drawEdge(dim, x1, y1, z1, x1, y2, z1);
  drawEdge(dim, x2, y1, z1, x2, y2, z1);
  drawEdge(dim, x1, y1, z2, x1, y2, z2);
  drawEdge(dim, x2, y1, z2, x2, y2, z2);
}

function distSqToBoxCenter(loc, box) {
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const cz = (box.z1 + box.z2) / 2;
  const dx = cx - loc.x, dy = cy - loc.y, dz = cz - loc.z;
  return dx * dx + dy * dy + dz * dz;
}

export function startVisualization() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      const held = heldBlueprintStack(player);
      if (!held) continue;
      const bpId = readBlueprintId(held);
      if (!bpId) continue;
      const bp = getBlueprint(bpId);
      if (!bp) continue;

      const dim = player.dimension;
      const loc = player.location;

      for (const room of bp.rooms) {
        for (const box of room.boxes) {
          if (box.dim !== dim.id) continue;
          if (distSqToBoxCenter(loc, box) > MAX_DISTANCE_SQ) continue;
          drawBox(dim, box);
        }
      }

      const ps = getPickerState(player.id);
      if (ps && ps.firstCorner && ps.dim === dim.id) {
        const c = ps.firstCorner;
        for (let i = 0; i < 4; i++) {
          try {
            dim.spawnParticle(CORNER_PARTICLE, {
              x: c.x + 0.5, y: c.y + 0.5 + i * 0.25, z: c.z + 0.5,
            });
          } catch (_) {}
        }
      }
    }
  }, RENDER_INTERVAL_TICKS);
}
