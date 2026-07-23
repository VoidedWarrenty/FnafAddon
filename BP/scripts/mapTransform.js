import { GRID_W, GRID_H, GRID_PAD } from "./blueprintTypes.js";
import { floorsBounds } from "./blueprint.js";

// Given a set of rooms (with polygons), pick an aspect-preserving uniform
// scale that fits the entire world footprint into GRID_W x GRID_H with
// GRID_PAD cells of exterior padding on every side. The result is a
// serializable transform object; worldToGrid()/gridToWorld() take that
// object plus a point.
//
// Design notes:
//   - Uniform scale, so rooms stay proportional (never squashed).
//   - Padding lets rooms sit off the grid boundary — required for the
//     "any region touching boundary = exterior" rule in the room detector.
//   - originGx/originGz is the pixel position (float) of world (minX,minZ)
//     after centering, so both dimensions get symmetric padding.

export function buildTransform(rooms, dimensionId) {
  const bb = floorsBounds(rooms, dimensionId);
  if (!Number.isFinite(bb.minX)) return null;

  // World footprint size in blocks (inclusive, so +1).
  const worldW = (bb.maxX - bb.minX) + 1;
  const worldD = (bb.maxZ - bb.minZ) + 1;

  const usableW = GRID_W - 2 * GRID_PAD;
  const usableH = GRID_H - 2 * GRID_PAD;

  // Uniform scale that fits both axes inside the usable area.
  const scale = Math.min(usableW / worldW, usableH / worldD);

  // Grid-space size the world footprint will occupy.
  const gridFootW = worldW * scale;
  const gridFootD = worldD * scale;

  // Center within the padded usable region.
  const originGx = GRID_PAD + (usableW - gridFootW) / 2;
  const originGz = GRID_PAD + (usableH - gridFootD) / 2;

  return {
    // World bbox that the transform was built for.
    minX: bb.minX, maxX: bb.maxX,
    minZ: bb.minZ, maxZ: bb.maxZ,
    minY: bb.minY, maxY: bb.maxY,
    dimensionId,
    scale,
    originGx, originGz,
    gridW: GRID_W, gridH: GRID_H,
  };
}

// World → grid coordinates. Returns floats; caller usually floors.
export function worldToGrid(t, wx, wz) {
  return {
    gx: t.originGx + (wx - t.minX) * t.scale,
    gz: t.originGz + (wz - t.minZ) * t.scale,
  };
}

// World → integer cell. Clamped to grid bounds so a stray outside point
// still resolves to a valid cell.
export function worldToCell(t, wx, wz) {
  const { gx, gz } = worldToGrid(t, wx, wz);
  const cx = Math.max(0, Math.min(t.gridW - 1, Math.floor(gx)));
  const cy = Math.max(0, Math.min(t.gridH - 1, Math.floor(gz)));
  return { cx, cy };
}

// Grid cell → the world XZ block that best represents it (integer, at
// cell center). Y is not modelled by the transform — callers pass their
// own Y (usually mid of world bbox).
export function gridToWorld(t, cx, cy) {
  const wx = t.minX + (cx + 0.5 - t.originGx) / t.scale;
  const wz = t.minZ + (cy + 0.5 - t.originGz) / t.scale;
  return { wx: Math.round(wx), wz: Math.round(wz) };
}

// Row-major index for a cell.
export function cellIndex(t, cx, cy) {
  return cy * t.gridW + cx;
}

// Inverse of cellIndex.
export function indexToCell(t, idx) {
  return { cx: idx % t.gridW, cy: Math.floor(idx / t.gridW) };
}
