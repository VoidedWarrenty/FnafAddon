// Shared enums + constants for the raster-map pipeline.
//
// One breaker box holds a fixed-resolution grid of cells; every cell has
// exactly one state from CELL. The grid is generated once at
// blueprint-apply time and serialized on the box.

export const MAP_VERSION = 3;

// Grid resolution. Single tunable — everything downstream reads these.
// 24x18 = 432 cells (== 432 buttons in the ActionForm). Every module
// reads GRID_W / GRID_H, so bumping to 32x24 (768) if we want finer
// detail is a one-line change. Down to 16x12 (192) if it's still slow.
export const GRID_W = 24;
export const GRID_H = 18;

// Two cells of exterior padding around the world bbox when computing the
// world→grid transform.
export const GRID_PAD = 2;

// Cell states. Order chosen so the compact base64-ish RLE encoder can pick
// short glyphs (see mapSerializer.js).
export const CELL = Object.freeze({
  EMPTY:       0,   // outside every room (rendered transparent)
  WALL:        1,
  DOOR:        2,   // wall-cell that a doorway carved out
  ROOM_FLOOR:  3,
  BREAKER_ON:  4,   // exactly one per room
  BREAKER_OFF: 5,
});

// Reverse map for debug prints.
export const CELL_NAME = {
  0: "EMPTY", 1: "WALL", 2: "DOOR", 3: "FLOOR", 4: "BREAKER_ON", 5: "BREAKER_OFF",
};

// Single-char glyphs for the ASCII debug printout.
export const CELL_GLYPH = {
  0: ".", 1: "#", 2: "-", 3: " ", 4: "O", 5: "o",
};

// Bundled RP texture paths (per spec). Every cell renders as one of these.
export const TILE = Object.freeze({
  EMPTY:       "textures/ui/electrical_map/transparent",
  WALL:        "textures/ui/electrical_map/wall",
  DOOR:        "textures/ui/electrical_map/door",
  ROOM_FLOOR:  "textures/ui/electrical_map/floor",
  BREAKER_ON:  "textures/ui/electrical_map/breaker_on",
  BREAKER_OFF: "textures/ui/electrical_map/breaker_off",
});

export function tileForCell(cellValue) {
  switch (cellValue) {
    case CELL.WALL:        return TILE.WALL;
    case CELL.DOOR:        return TILE.DOOR;
    case CELL.ROOM_FLOOR:  return TILE.ROOM_FLOOR;
    case CELL.BREAKER_ON:  return TILE.BREAKER_ON;
    case CELL.BREAKER_OFF: return TILE.BREAKER_OFF;
    default:               return TILE.EMPTY;
  }
}

// Title prefix that gates the JSON-UI grid override.
export const ELECTRICAL_MAP_PREFIX = "ELECTRICAL_MAP|";

// Sentinel "no room" for roomIdGrid (0 = no room, 1..N = real rooms).
export const NO_ROOM = 0;

// Debug toggle. Flip at runtime with world.setDynamicProperty("fnaf:debug_map", true).
export const DEBUG_PROP = "fnaf:debug_map";
