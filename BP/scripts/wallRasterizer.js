import { CELL, GRID_W, GRID_H } from "./blueprintTypes.js";
import { worldToGrid, cellIndex } from "./mapTransform.js";

// Amanatides-Woo grid traversal (aka "supercover" DDA). Given two grid-
// space endpoints, yields every integer cell the segment passes through
// including the diagonal-touch cells that classic Bresenham skips. That
// no-gap property is critical: if flood-fill can leak through a diagonal
// wall pinhole, rooms merge into the exterior region and get discarded.
//
// The algorithm walks the ray from (x0,z0) to (x1,z1), always stepping
// into whichever neighbouring cell the ray enters next.
function supercoverCells(x0, z0, x1, z1) {
  const cells = [];
  let cx = Math.floor(x0);
  let cz = Math.floor(z0);
  const endCx = Math.floor(x1);
  const endCz = Math.floor(z1);

  const dx = x1 - x0;
  const dz = z1 - z0;
  const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
  const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);

  // t at which the ray crosses the next X / Z grid line.
  const nextX = stepX > 0 ? (cx + 1) : cx;
  const nextZ = stepZ > 0 ? (cz + 1) : cz;
  let tMaxX = dx !== 0 ? (nextX - x0) / dx : Infinity;
  let tMaxZ = dz !== 0 ? (nextZ - z0) / dz : Infinity;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  cells.push([cx, cz]);
  // Hard iteration cap so a degenerate segment can't loop forever.
  const maxIters = 4 * (GRID_W + GRID_H);
  for (let i = 0; i < maxIters; i++) {
    if (cx === endCx && cz === endCz) break;
    if (tMaxX < tMaxZ) {
      tMaxX += tDeltaX;
      cx += stepX;
    } else if (tMaxZ < tMaxX) {
      tMaxZ += tDeltaZ;
      cz += stepZ;
    } else {
      // Exact diagonal — step both. Push the two off-diagonal cells too
      // so a diagonal wall is still 4-connected. This is the crucial
      // supercover step.
      cells.push([cx + stepX, cz]);
      cells.push([cx, cz + stepZ]);
      tMaxX += tDeltaX;
      tMaxZ += tDeltaZ;
      cx += stepX;
      cz += stepZ;
    }
    cells.push([cx, cz]);
  }
  return cells;
}

function inGrid(cx, cy) {
  return cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H;
}

// Walk the world blocks along a polygon edge, using the same integer step
// count as the picker (so opening indices line up). For each block coord
// we sample the grid cell it maps to via the transform. This preserves
// the picker's contract: opening.startBlock..endBlock refer to blocks
// along the edge, and we mark exactly those cells.
function edgeWorldBlocks(a, b) {
  const out = [];
  let x0 = Math.round(a.x), z0 = Math.round(a.z);
  const x1 = Math.round(b.x), z1 = Math.round(b.z);
  const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  // Guard against pathological loops.
  const cap = dx + dz + 4;
  for (let i = 0; i < cap; i++) {
    out.push({ x: x0, z: z0 });
    if (x0 === x1 && z0 === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x0 += sx; }
    if (e2 < dx) { err += dx; z0 += sz; }
  }
  return out;
}

// Public API: fill grid + doorMeta from every polygon edge in every room.
//
// grid       — Uint8Array of length GRID_W*GRID_H, zero-initialized.
// doorMeta   — Map<cellIndex, {roomIds: Set<number>, segIdx, roomLocalId}>
//              populated on DOOR cells for later multi-room linking.
// rooms      — v2 blueprint rooms.
// dimId      — dimension we're rasterizing for.
// transform  — from mapTransform.buildTransform().
//
// Rooms that live in a different dimension are silently skipped.
export function rasterizeWallsAndDoors(grid, doorMeta, rooms, dimId, transform) {
  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const floors = room.floors ?? [];
    for (const floor of floors) {
      if (floor.dim !== dimId) continue;
      const poly = floor.polygon;
      const n = poly.length;
      if (n < 3) continue;

      // For every edge: rasterize world-block coords, translate each to
      // grid cells via the transform, mark as WALL. Then re-visit
      // opening runs on that edge and downgrade to DOOR.
      for (let ei = 0; ei < n; ei++) {
        const a = poly[ei];
        const b = poly[(ei + 1) % n];
        const worldBlocks = edgeWorldBlocks(a, b);

        // Also lay supercover in grid space so diagonals stay sealed
        // even when the transform quantises world-block cells sparsely.
        const ga = worldToGrid(transform, a.x, a.z);
        const gb = worldToGrid(transform, b.x, b.z);
        const superCells = supercoverCells(ga.gx, ga.gz, gb.gx, gb.gz);
        for (const [cx, cy] of superCells) {
          if (!inGrid(cx, cy)) continue;
          const idx = cellIndex(transform, cx, cy);
          if (grid[idx] !== CELL.DOOR) grid[idx] = CELL.WALL;
        }

        // Now handle explicit openings on this edge.
        const opens = (floor.openings ?? []).filter(o => o.segIdx === ei);
        if (opens.length === 0) continue;
        for (const o of opens) {
          const lo = Math.max(0, Math.min(o.startBlock, o.endBlock));
          const hi = Math.min(worldBlocks.length - 1, Math.max(o.startBlock, o.endBlock));
          for (let k = lo; k <= hi; k++) {
            const wb = worldBlocks[k];
            const g = worldToGrid(transform, wb.x, wb.z);
            const cx = Math.floor(g.gx);
            const cy = Math.floor(g.gz);
            if (!inGrid(cx, cy)) continue;
            const idx = cellIndex(transform, cx, cy);
            grid[idx] = CELL.DOOR;
            // Record which room this door belongs to; the connecting-rooms
            // set is populated later once every room touches its neighbours.
            let meta = doorMeta.get(idx);
            if (!meta) {
              meta = { roomLocalIds: new Set(), segIdx: ei };
              doorMeta.set(idx, meta);
            }
            meta.roomLocalIds.add(ri);
          }
        }
      }
    }
  }
}
