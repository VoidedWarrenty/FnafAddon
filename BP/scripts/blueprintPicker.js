// Per-player "picking" state for adding a box to a room. Session-only:
// picking is a live interaction, and losing state on script reload is fine.
//
// state: { bpId, roomId, dim, firstCorner: {x,y,z}|null }

const picking = new Map(); // playerId -> state

export function isPicking(playerId) {
  return picking.has(playerId);
}

export function getPickerState(playerId) {
  return picking.get(playerId) ?? null;
}

export function startPicking(playerId, bpId, roomId, dimensionId) {
  picking.set(playerId, { bpId, roomId, dim: dimensionId, firstCorner: null });
}

export function stopPicking(playerId) {
  picking.delete(playerId);
}

export function recordCorner(playerId, x, y, z) {
  const s = picking.get(playerId);
  if (!s) return null;
  if (!s.firstCorner) {
    s.firstCorner = { x, y, z };
    return { kind: "first" };
  }
  const box = { first: s.firstCorner, second: { x, y, z } };
  picking.delete(playerId);
  return { kind: "second", box, bpId: s.bpId, roomId: s.roomId, dim: s.dim };
}
