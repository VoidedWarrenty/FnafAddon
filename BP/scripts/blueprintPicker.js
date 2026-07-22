// Per-player picking state for drawing a polygon room. Session-only —
// the state resets if scripts reload, which is fine since picking is a
// live interaction.
//
// Phases:
//   VERTICES  — placing polygon corners; tap-to-add, tap-near-origin to close
//   CEILING   — polygon closed; waiting for ceiling block tap
//   OPENINGS  — floor complete; sneak-tap pairs to mark openings
//
// state shape: {
//   bpId, roomId, dim,
//   phase: "vertices" | "ceiling" | "openings",
//   vertices: [{x, y, z}],       // y kept just so we can auto-set floorY = first vertex Y
//   floorY, ceilingY,            // set as we go
//   openings: [{segIdx, startBlock, endBlock}],
//   pendingOpeningStart: {segIdx, blockIdx} | null,  // first sneak-tap of an opening pair
// }

const picking = new Map(); // playerId -> state

const CLOSE_TOLERANCE_SQ = 1.5 * 1.5;   // click within 1.5 blocks of origin to close
const MIN_VERTICES_TO_CLOSE = 3;

export function isPicking(playerId) { return picking.has(playerId); }
export function getPickerState(playerId) { return picking.get(playerId) ?? null; }

export function startPicking(playerId, bpId, roomId, dimensionId) {
  picking.set(playerId, {
    bpId, roomId, dim: dimensionId,
    phase: "vertices",
    vertices: [],
    floorY: null,
    ceilingY: null,
    openings: [],
    pendingOpeningStart: null,
  });
}

export function stopPicking(playerId) {
  picking.delete(playerId);
}

// Record a normal (non-sneak) tap on a block. Returns an event object the
// caller can react to.
export function recordTap(playerId, x, y, z) {
  const s = picking.get(playerId);
  if (!s) return null;

  if (s.phase === "vertices") {
    // If the polygon has enough vertices, allow closing by tapping near
    // the origin.
    if (s.vertices.length >= MIN_VERTICES_TO_CLOSE) {
      const v0 = s.vertices[0];
      const dx = x - v0.x, dz = z - v0.z;
      if (dx * dx + dz * dz <= CLOSE_TOLERANCE_SQ) {
        s.phase = "ceiling";
        s.floorY = s.vertices[0].y;
        return { kind: "closed" };
      }
    }
    s.vertices.push({ x, y, z });
    if (s.vertices.length === 1) s.floorY = y;
    return { kind: "vertex", count: s.vertices.length, first: s.vertices.length === 1 };
  }

  if (s.phase === "ceiling") {
    s.ceilingY = y;
    s.phase = "openings";
    return { kind: "ceiling_set", y };
  }

  // In "openings" phase, a normal tap is treated as "done" if the player
  // has already marked something (or nothing) — the current polygon is
  // final. Return "finish" so the caller can save the room.
  if (s.phase === "openings") {
    return { kind: "finish_request" };
  }

  return null;
}

// Sneak-tap during vertices phase = force-close (equivalent to menu Close).
// Sneak-tap during openings phase = mark opening endpoint.
export function recordSneakTap(playerId, x, y, z) {
  const s = picking.get(playerId);
  if (!s) return null;

  if (s.phase === "vertices") {
    if (s.vertices.length < MIN_VERTICES_TO_CLOSE) {
      return { kind: "too_few_vertices", count: s.vertices.length };
    }
    s.phase = "ceiling";
    s.floorY = s.vertices[0].y;
    return { kind: "closed" };
  }

  if (s.phase === "ceiling") {
    // Sneak-tapping in ceiling phase is treated as ceiling set too.
    s.ceilingY = y;
    s.phase = "openings";
    return { kind: "ceiling_set", y };
  }

  if (s.phase === "openings") {
    // Player is marking an opening endpoint. Requires two sneak-taps on
    // the same wall segment to complete an opening.
    return { kind: "opening_tap", x, y, z };
  }

  return null;
}

// Called by the picker handler after resolving the wall segment for an
// opening tap. Passes the segIdx + blockIdx (integer position along the
// edge). If this is the first tap of a pair, we buffer it; if the second,
// we finalize the opening.
export function pushOpeningTap(playerId, segIdx, blockIdx) {
  const s = picking.get(playerId);
  if (!s || s.phase !== "openings") return null;

  if (!s.pendingOpeningStart) {
    s.pendingOpeningStart = { segIdx, blockIdx };
    return { kind: "opening_start", segIdx, blockIdx };
  }
  const start = s.pendingOpeningStart;
  s.pendingOpeningStart = null;
  if (start.segIdx !== segIdx) {
    // Two taps on different wall segments — treat the second as a new
    // start rather than erroring out.
    s.pendingOpeningStart = { segIdx, blockIdx };
    return { kind: "opening_moved_segment", segIdx, blockIdx };
  }
  // Sneak-tapped blocks bookend the opening; the opening spans the
  // blocks BETWEEN them (exclusive of both endpoints).
  const a = Math.min(start.blockIdx, blockIdx);
  const b = Math.max(start.blockIdx, blockIdx);
  if (b - a < 2) {
    // Too close together — no interior blocks between them.
    return { kind: "opening_too_small" };
  }
  s.openings.push({ segIdx, startBlock: a + 1, endBlock: b - 1 });
  return { kind: "opening_done", segIdx, startBlock: a + 1, endBlock: b - 1 };
}

// Finalize the room. Returns the completed floor object (polygon +
// floorY + ceilingY + openings) and clears the picker state.
export function finalize(playerId) {
  const s = picking.get(playerId);
  if (!s) return null;
  if (s.phase !== "openings" && s.phase !== "ceiling") return null;
  const floor = {
    dim: s.dim,
    polygon: s.vertices.map(v => ({ x: v.x, z: v.z })),
    floorY: s.floorY,
    ceilingY: s.ceilingY ?? (s.floorY + 4),
    openings: s.openings,
  };
  const roomId = s.roomId;
  const bpId = s.bpId;
  picking.delete(playerId);
  return { bpId, roomId, floor };
}
