import { GRID_W, GRID_H, NO_ROOM } from "./blueprintTypes.js";

// Place a breaker icon inside each room at the cell farthest from any
// wall or non-room cell. This is a chamfer-distance approximation of the
// "largest inscribed disk" centre — deals with L-shaped and concave
// rooms far better than a centroid, which can land outside the polygon.
//
// Implementation: multi-source BFS starting from every cell that is NOT
// in the current room. Distances are chamfer 4-neighbourhood
// (Manhattan-ish); the farthest cell inside the room is our pick. Ties
// broken by (cy, cx) for determinism.
//
// We run one BFS per room. Grid is small (32*24 = 768) so this is cheap.

function idx(cx, cy) { return cy * GRID_W + cx; }

function placeOneRoom(roomIdGrid, room) {
  const target = room.id;
  const dist = new Int16Array(GRID_W * GRID_H).fill(-1);
  const queue = [];

  // Seed: every cell whose roomId != target starts at distance 0.
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const i = idx(cx, cy);
      if (roomIdGrid[i] !== target) {
        dist[i] = 0;
        queue.push(i);
      }
    }
  }
  // If the entire grid is this room (shouldn't happen — exterior wraps),
  // fall back to centre.
  if (queue.length === GRID_W * GRID_H) {
    return idx(GRID_W >> 1, GRID_H >> 1);
  }

  // BFS. Distance grows by 1 per step; farthest interior cell wins.
  let bestIdx = -1;
  let bestDist = -1;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % GRID_W;
    const cy = (cur / GRID_W) | 0;
    const d = dist[cur];
    if (roomIdGrid[cur] === target && d > bestDist) {
      bestDist = d;
      bestIdx = cur;
    }
    const nbs = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
    ];
    for (const [nx, ny] of nbs) {
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const ni = idx(nx, ny);
      if (dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  // Deterministic tie-break: prefer smaller (cy, cx) at same best distance.
  if (bestIdx >= 0) {
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const i = idx(cx, cy);
        if (roomIdGrid[i] !== target) continue;
        if (dist[i] === bestDist) return i;
      }
    }
  }

  // Fallback — should be unreachable.
  return room.cells[0] ?? idx(0, 0);
}

// For each detected room, return its breaker cell index. Result parallels
// the input rooms array.
export function placeBreakers(rooms, roomIdGrid) {
  const out = new Array(rooms.length);
  for (let i = 0; i < rooms.length; i++) {
    out[i] = placeOneRoom(roomIdGrid, rooms[i]);
  }
  return out;
}
