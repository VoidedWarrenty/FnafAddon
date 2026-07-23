import { CELL, GRID_W, GRID_H, NO_ROOM } from "./blueprintTypes.js";

// 4-way flood fill over non-wall cells to find enclosed rooms.
//
// Rules:
//   - Both WALL and DOOR are treated as barriers during flood — otherwise
//     any two rooms sharing a doorway would merge.
//   - Any region that touches the grid boundary is considered EXTERIOR
//     and discarded.
//   - After detection, DOOR cells are reopened and each door records the
//     set of room ids it connects for the future switch/circuit system.
//
// Output:
//   {
//     rooms: [{
//       id,               // 1-indexed stable room id
//       cells: [idx,...], // row-major indexes
//       bboxCell,         // {minX,maxX,minY,maxY} in cell coords
//     }],
//     roomIdGrid: Uint8Array(GRID_W*GRID_H),  // 0 = no room, 1..N = rooms
//     doorLinks: Map<cellIndex, number[]>,    // room ids adjacent to this door
//   }
//
// Rooms cap at 254 (id 255 reserved).

const MAX_ROOMS = 254;

function idx(cx, cy) { return cy * GRID_W + cx; }

function isBarrier(grid, i) {
  const v = grid[i];
  return v === CELL.WALL || v === CELL.DOOR;
}

// BFS from a seed cell, respecting the barrier predicate and grid bounds.
// Marks visited via the visited Uint8Array. Returns { cells, touchesBoundary }.
function bfsRegion(grid, visited, seedCx, seedCy) {
  const region = [];
  let touchesBoundary = false;
  const queue = [seedCx * 65536 + seedCy]; // packed to avoid alloc churn
  visited[idx(seedCx, seedCy)] = 1;

  while (queue.length) {
    const packed = queue.pop();
    const cx = (packed >> 16) & 0xffff;
    const cy = packed & 0xffff;
    const i = idx(cx, cy);
    region.push(i);
    if (cx === 0 || cy === 0 || cx === GRID_W - 1 || cy === GRID_H - 1) {
      touchesBoundary = true;
    }
    const neighbours = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      if (isBarrier(grid, ni)) continue;
      visited[ni] = 1;
      queue.push(nx * 65536 + ny);
    }
  }
  return { region, touchesBoundary };
}

function bboxOfCells(cells) {
  let minX = GRID_W, maxX = -1, minY = GRID_H, maxY = -1;
  for (const i of cells) {
    const cx = i % GRID_W, cy = (i / GRID_W) | 0;
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }
  return { minX, maxX, minY, maxY };
}

export function detectRooms(grid) {
  const visited = new Uint8Array(GRID_W * GRID_H);
  const roomIdGrid = new Uint8Array(GRID_W * GRID_H);
  const rooms = [];

  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const i = idx(cx, cy);
      if (visited[i]) continue;
      if (isBarrier(grid, i)) continue;

      const { region, touchesBoundary } = bfsRegion(grid, visited, cx, cy);
      if (touchesBoundary) continue;                    // exterior — discard
      if (rooms.length >= MAX_ROOMS) continue;          // safety cap

      const roomId = rooms.length + 1;
      for (const j of region) roomIdGrid[j] = roomId;
      rooms.push({
        id: roomId,
        cells: region,
        bboxCell: bboxOfCells(region),
      });
      // Rewrite grid cells so exterior stays EMPTY and interior stays FLOOR.
      for (const j of region) grid[j] = CELL.ROOM_FLOOR;
    }
  }

  // Exterior regions we skipped stayed EMPTY; anything still non-barrier
  // and not visited would be an exterior region that flood-fill didn't
  // reach because it started with an interior seed. Sweep once more to
  // mark those.
  for (let i = 0; i < grid.length; i++) {
    if (!visited[i] && !isBarrier(grid, i)) grid[i] = CELL.EMPTY;
  }

  // Reveal doors and record which rooms each door touches.
  const doorLinks = new Map();
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const i = idx(cx, cy);
      if (grid[i] !== CELL.DOOR) continue;
      // Adjacent room ids from the 4-neighbourhood.
      const near = new Set();
      const nbs = [
        [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
      ];
      for (const [nx, ny] of nbs) {
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        const rid = roomIdGrid[idx(nx, ny)];
        if (rid !== NO_ROOM) near.add(rid);
      }
      if (near.size > 0) doorLinks.set(i, [...near]);
    }
  }

  return { rooms, roomIdGrid, doorLinks };
}
