import { world } from "@minecraft/server";

// Renders a top-down ASCII map of the given rooms in the given dimension.
// Every cell is the same '█' character; only the color code changes, so
// alignment holds up even in Bedrock's variable-width font (all block
// characters render at the same fixed width).
//
// Cell coloring:
//   §f  bright white  — a solid block in a room's AABB (a wall)
//   §7  light gray    — a solid block outside any room's AABB (external walls)
//   §8  medium gray   — a room interior (air inside an AABB)
//   §0  black         — outside everything
//
// The block scan reflects the *current* world, so an open doorway reads as
// a gap automatically. Closed doors show as walls until they open.

const DEFAULT_MAX_COLS = 48;
const DEFAULT_MAX_ROWS = 22;

function unionBox(boxes) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    if (b.x1 < minX) minX = b.x1;
    if (b.x2 > maxX) maxX = b.x2;
    if (b.y1 < minY) minY = b.y1;
    if (b.y2 > maxY) maxY = b.y2;
    if (b.z1 < minZ) minZ = b.z1;
    if (b.z2 > maxZ) maxZ = b.z2;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function collectBoxes(rooms, dimensionId) {
  const out = [];
  for (const r of rooms) {
    for (const b of r.boxes) {
      if (b.dim === dimensionId) out.push(b);
    }
  }
  return out;
}

export function renderMap(dimensionId, rooms, options = {}) {
  const maxCols = options.maxCols ?? DEFAULT_MAX_COLS;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const boxes = collectBoxes(rooms, dimensionId);
  if (boxes.length === 0) {
    return "§8§o(no boxes defined for this dimension yet)";
  }

  const bb = unionBox(boxes);
  const padX = 1, padZ = 1;
  const minX = bb.minX - padX, maxX = bb.maxX + padX;
  const minZ = bb.minZ - padZ, maxZ = bb.maxZ + padZ;
  const worldW = maxX - minX + 1;
  const worldD = maxZ - minZ + 1;

  const cellW = Math.max(1, Math.ceil(worldW / maxCols));
  const cellD = Math.max(1, Math.ceil(worldD / maxRows));
  const cols = Math.ceil(worldW / cellW);
  const rows = Math.ceil(worldD / cellD);

  const sliceY = Math.floor((bb.minY + bb.maxY) / 2);
  const dim = world.getDimension(dimensionId);

  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    let currentColor = "";
    const wz1 = minZ + ry * cellD;
    const wz2 = Math.min(wz1 + cellD - 1, maxZ);
    for (let cx = 0; cx < cols; cx++) {
      const wx1 = minX + cx * cellW;
      const wx2 = Math.min(wx1 + cellW - 1, maxX);

      let anySolid = false;
      let anyInRoom = false;
      for (let sx = wx1; sx <= wx2 && (!anySolid || !anyInRoom); sx++) {
        for (let sz = wz1; sz <= wz2 && (!anySolid || !anyInRoom); sz++) {
          for (const b of boxes) {
            if (sx >= b.x1 && sx <= b.x2 &&
                sz >= b.z1 && sz <= b.z2 &&
                sliceY >= b.y1 && sliceY <= b.y2) {
              anyInRoom = true;
              break;
            }
          }
          try {
            const block = dim.getBlock({ x: sx, y: sliceY, z: sz });
            if (block && block.typeId !== "minecraft:air") anySolid = true;
          } catch (_) { /* chunk unloaded */ }
        }
      }

      let color;
      if (anySolid && anyInRoom) color = "§f";
      else if (anyInRoom)        color = "§8";
      else if (anySolid)         color = "§7";
      else                       color = "§0";

      if (color !== currentColor) {
        line += color;
        currentColor = color;
      }
      line += "█";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// A compact numbered legend below the map. Rooms are laid out in 2 columns.
export function renderRoomLegend(rooms) {
  if (!rooms || rooms.length === 0) return "";
  const numbered = rooms.map((r, i) => `§b[${i + 1}]§r ${r.name}`);
  const lines = [];
  for (let i = 0; i < numbered.length; i += 2) {
    const left = (numbered[i] || "").padEnd(28, " ");
    const right = numbered[i + 1] || "";
    lines.push(left + right);
  }
  return lines.join("\n");
}
