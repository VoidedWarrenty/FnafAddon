import { CELL, GRID_W, GRID_H, NO_ROOM } from "./blueprintTypes.js";
import { buildTransform } from "./mapTransform.js";
import { rasterizeWallsAndDoors } from "./wallRasterizer.js";
import { detectRooms } from "./roomDetector.js";
import { placeBreakers } from "./breakerPlacement.js";
import { buildSnapshot } from "./mapSerializer.js";
import { floorsBounds, polygonBounds } from "./blueprint.js";

// One-shot: blueprint + dimension → serializable raster snapshot.
//
// Steps mirror the design spec: transform, rasterize walls+doors,
// flood-fill for rooms, place breakers, then stamp breaker cells into
// the grid. Returns null if there's nothing to render.
//
// The mapping from detected-room-id (1..N) to bp-room-id relies on the
// first cell in each detected region belonging to some bp room. We look
// up which bp room's polygon contains that world coord via the polygons
// themselves (not via the grid — the grid is lossy at low resolutions).

import { pointInPolygon } from "./blueprint.js";

function bpRoomIdForCell(cellIdx, transform, bpRooms) {
  const cx = cellIdx % transform.gridW;
  const cy = Math.floor(cellIdx / transform.gridW);
  // Sample world XZ at cell centre.
  const wx = transform.minX + (cx + 0.5 - transform.originGx) / transform.scale;
  const wz = transform.minZ + (cy + 0.5 - transform.originGz) / transform.scale;
  for (const r of bpRooms) {
    for (const f of r.floors ?? []) {
      if (pointInPolygon(wx, wz, f.polygon)) return { bpRoomId: r.id, name: r.name };
    }
  }
  return null;
}

function worldBboxForBpRoom(room) {
  let bb = null;
  for (const f of room.floors ?? []) {
    const pb = polygonBounds(f.polygon);
    if (!bb) {
      bb = {
        minX: pb.minX, maxX: pb.maxX,
        minZ: pb.minZ, maxZ: pb.maxZ,
        minY: f.floorY, maxY: f.ceilingY,
      };
    } else {
      if (pb.minX < bb.minX) bb.minX = pb.minX;
      if (pb.maxX > bb.maxX) bb.maxX = pb.maxX;
      if (pb.minZ < bb.minZ) bb.minZ = pb.minZ;
      if (pb.maxZ > bb.maxZ) bb.maxZ = pb.maxZ;
      if (f.floorY < bb.minY) bb.minY = f.floorY;
      if (f.ceilingY > bb.maxY) bb.maxY = f.ceilingY;
    }
  }
  return bb;
}

export function generateMapSnapshot(blueprint, dimensionId) {
  const rooms = blueprint.rooms ?? [];
  if (rooms.length === 0) return null;

  const transform = buildTransform(rooms, dimensionId);
  if (!transform) return null;

  const grid = new Uint8Array(GRID_W * GRID_H);
  const doorMeta = new Map();

  rasterizeWallsAndDoors(grid, doorMeta, rooms, dimensionId, transform);
  const { rooms: detected, roomIdGrid, doorLinks } = detectRooms(grid);

  // Map each detected region to its bp room (name + id) by sampling the
  // first interior cell in its cells list.
  const roomNames = [];
  const roomBpIds = [];
  const worldBboxes = [];
  for (const dr of detected) {
    const sampleCell = dr.cells[0];
    const bp = bpRoomIdForCell(sampleCell, transform, rooms);
    if (bp) {
      roomNames.push(bp.name);
      roomBpIds.push(bp.bpRoomId);
      const bpRoom = rooms.find(r => r.id === bp.bpRoomId);
      worldBboxes.push(bpRoom ? worldBboxForBpRoom(bpRoom) : null);
    } else {
      // Detected region with no matching bp polygon — shouldn't happen,
      // but keep the arrays aligned.
      roomNames.push(`Room ${dr.id}`);
      roomBpIds.push(null);
      worldBboxes.push(null);
    }
  }

  const breakerIdx = placeBreakers(detected, roomIdGrid);

  // Stamp breaker cells into the grid so they render.
  for (let i = 0; i < detected.length; i++) {
    grid[breakerIdx[i]] = CELL.BREAKER_OFF;
  }

  const snap = buildSnapshot({
    sourceBpId: blueprint.id,
    sourceName: blueprint.name,
    transform, grid, roomIdGrid,
    rooms: detected, breakerIdx, doorLinks,
    roomNames, roomBpIds, worldBboxes,
  });

  return snap;
}
