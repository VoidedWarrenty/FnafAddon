import { world } from "@minecraft/server";
import { CELL, CELL_GLYPH, GRID_W, GRID_H, DEBUG_PROP, NO_ROOM } from "./blueprintTypes.js";
import { inflateSnapshot, loadMapSnapshot } from "./mapSerializer.js";
import { listUnassignedLights } from "./electricalRoomManager.js";

export function debugEnabled() {
  return world.getDynamicProperty(DEBUG_PROP) === true;
}

function line(cells, width) {
  let s = "";
  for (let i = 0; i < width; i++) s += CELL_GLYPH[cells[i]] ?? "?";
  return s;
}

// Format a snapshot into a multi-line string suitable for
// player.sendMessage. Includes:
//   - ASCII grid (cells)
//   - Cell → room-id overlay (single-digit rooms only)
//   - Room table (id, name, cellCount, worldBbox)
//   - Breaker cell positions
//   - Unassigned lights warning
//   - Wall-leak sanity (rooms suspiciously large)
export function debugDumpSnapshot(snap) {
  if (!snap) return "§c(no snapshot)";
  const { tiles, roomIdGrid } = inflateSnapshot(snap);
  const w = snap.w, h = snap.h;
  const gridLines = [];
  const roomLines = [];
  for (let y = 0; y < h; y++) {
    const row = tiles.slice(y * w, (y + 1) * w);
    const roomRow = roomIdGrid.slice(y * w, (y + 1) * w);
    gridLines.push(line(row, w));
    let rs = "";
    for (let x = 0; x < w; x++) {
      const rid = roomRow[x];
      rs += rid === NO_ROOM ? "." : (rid < 10 ? String(rid) : "+");
    }
    roomLines.push(rs);
  }

  const roomTable = snap.meta.map(m =>
    `  #${m.id} ${m.name.padEnd(20)} cells=${m.cellCount} bp=${m.bpRoomId ?? "?"} ` +
    `y=[${m.worldBbox?.minY}..${m.worldBbox?.maxY}] breakerIdx=${m.breakerIdx} lights=${m.lights?.length ?? 0}`
  ).join("\n");

  const leaks = snap.meta
    .filter(m => m.cellCount > (w * h) / 2)
    .map(m => `  #${m.id} ${m.name} (${m.cellCount} cells — likely wall leak)`)
    .join("\n");

  const unassigned = listUnassignedLights()
    .map(l => `  ${l.dimensionId} @ ${l.x},${l.y},${l.z}`)
    .join("\n");

  return [
    `§b--- MAP DEBUG: ${snap.sourceName} (${w}x${h}) ---`,
    "§7Cells:",
    ...gridLines.map(l => "§8" + l),
    "§7Room ids:",
    ...roomLines.map(l => "§8" + l),
    "§7Rooms:",
    roomTable || "  (none)",
    leaks ? "§cWall leaks:\n" + leaks : "",
    unassigned ? "§eUnassigned lights:\n" + unassigned : "",
  ].filter(Boolean).join("\n");
}

// Print the dump for the box at (dim,x,y,z) to a specific player.
export function dumpBoxToPlayer(player, dimensionId, x, y, z) {
  const snap = loadMapSnapshot(dimensionId, x, y, z);
  const text = debugDumpSnapshot(snap);
  player.sendMessage(text);
}
