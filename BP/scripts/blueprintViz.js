import { world, system } from "@minecraft/server";
import { getBlueprint } from "./blueprint.js";
import { readBlueprintId, BLUEPRINT_ID } from "./blueprintItem.js";
import { getPickerState } from "./blueprintPicker.js";

const WALL_PARTICLE = "minecraft:endrod";
const DOORWAY_PARTICLE = "minecraft:balloon_gas_particle";
const VERTEX_PARTICLE = "minecraft:balloon_gas_particle";
const RENDER_INTERVAL_TICKS = 10;
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

// Bresenham-style line stepping through integer XZ positions, sampled at
// a fixed Y. Skips indexes flagged as openings, spawns a highlight
// particle at endpoints.
function drawEdgeParticles(dim, ax, az, bx, bz, y, openingSet) {
  const dx = Math.abs(bx - ax), dz = Math.abs(bz - az);
  const sx = ax < bx ? 1 : -1;
  const sz = az < bz ? 1 : -1;
  let err = dx - dz;
  let x = ax, z = az;
  let idx = 0;
  while (true) {
    const isOpening = openingSet && openingSet.has(idx);
    try {
      dim.spawnParticle(
        isOpening ? DOORWAY_PARTICLE : WALL_PARTICLE,
        { x: x + 0.5, y: y + 0.5, z: z + 0.5 }
      );
    } catch (_) {}
    if (x === bx && z === bz) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
    idx++;
  }
}

// Build set of block indexes along a given edge that are inside any
// opening range on that edge.
function edgeOpeningSet(floor, segIdx) {
  const s = new Set();
  const opens = (floor.openings ?? []).filter(o => o.segIdx === segIdx);
  for (const o of opens) {
    for (let k = o.startBlock; k <= o.endBlock; k++) s.add(k);
  }
  return s;
}

function drawFloor(dim, floor) {
  const poly = floor.polygon;
  const n = poly.length;
  const y1 = floor.floorY, y2 = floor.ceilingY;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const opens = edgeOpeningSet(floor, i);
    drawEdgeParticles(dim, a.x, a.z, b.x, b.z, y1, opens);
    drawEdgeParticles(dim, a.x, a.z, b.x, b.z, y2, opens);
    // Vertical corner indicators
    for (let y = y1; y <= y2; y += 2) {
      try {
        dim.spawnParticle(WALL_PARTICLE, { x: a.x + 0.5, y: y + 0.5, z: a.z + 0.5 });
      } catch (_) {}
    }
  }
}

function distSqToPolygonCenter(loc, polygon) {
  let cx = 0, cz = 0;
  for (const p of polygon) { cx += p.x; cz += p.z; }
  cx /= polygon.length; cz /= polygon.length;
  const dx = cx - loc.x, dz = cz - loc.z;
  return dx * dx + dz * dz;
}

// While the player is drawing a polygon, show the vertices they've placed
// and a highlight on the origin (the block they'd tap to close).
function drawPickerState(dim, ps) {
  if (!ps.vertices || ps.vertices.length === 0) return;
  const v0 = ps.vertices[0];
  // Origin marker: multi-height column
  for (let dy = 0; dy < 4; dy++) {
    try {
      dim.spawnParticle(DOORWAY_PARTICLE, {
        x: v0.x + 0.5, y: v0.y + 0.5 + dy * 0.5, z: v0.z + 0.5,
      });
    } catch (_) {}
  }
  // Draw wall segments between placed vertices so far
  for (let i = 0; i < ps.vertices.length - 1; i++) {
    const a = ps.vertices[i];
    const b = ps.vertices[i + 1];
    drawEdgeParticles(dim, a.x, a.z, b.x, b.z, a.y, null);
  }
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
        for (const floor of room.floors ?? []) {
          if (floor.dim !== dim.id) continue;
          if (distSqToPolygonCenter(loc, floor.polygon) > MAX_DISTANCE_SQ) continue;
          drawFloor(dim, floor);
        }
      }

      const ps = getPickerState(player.id);
      if (ps && ps.dim === dim.id) drawPickerState(dim, ps);
    }
  }, RENDER_INTERVAL_TICKS);
}
