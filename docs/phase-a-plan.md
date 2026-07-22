# Phase A — Blueprint UI: JSON-UI shell + tile-based floor plan

Deferred plan. Persisted here so if context compresses, whoever picks this up
can execute without losing the design.

## Goal

Replace the current `ActionFormData` blueprint editor with a UI that visually
matches a real paper blueprint: blueprint-blue background, white grid, and a
top-down floor plan drawn from pre-authored **tiles** rather than ASCII. The
plan reads live world state so open doors show as gaps, closed doors as
walls.

## Why tiles, not ASCII, not pixel rendering

Bedrock has no runtime pixel composition. The only way to get a real-looking
line-drawn floor plan on the blue backdrop is to compose it from **pre-shipped
tile sprites**, one per cell. Every cell in the grid is chosen server-side
per world scan, and JSON-UI stamps the picked tile PNG into the cell.

## Technique

1. **`server_form.json` override, title-prefix scoped.** Put the custom
   layout behind a check like `#title == 'FNAF_BLUEPRINT_UI'` (or a hidden
   `§0§r` prefix that we already use elsewhere) so other addons' forms fall
   through to vanilla.
2. **Every map cell is a form button** in the underlying `ActionFormData`.
   JSON-UI binding `#form_button_texture` on each button resolves to a PNG
   path. The server-side code names each button after the tile the cell
   should show:
   - `button.tile.floor`
   - `button.tile.wall_h`, `button.tile.wall_v`
   - `button.tile.corner_ne`, `button.tile.corner_nw`, `button.tile.corner_se`, `button.tile.corner_sw`
   - `button.tile.door_h`, `button.tile.door_v`
   - `button.tile.blank`
   JSON-UI parses the button name into `.tile.<name>` and picks
   `textures/ui/blueprint_tiles/<name>.png`.
3. **Grid layout in JSON-UI** — a `stack_panel` per row, each containing a
   fixed row of buttons. The stack panels have zero spacing and fixed size,
   giving a pixel-perfect grid regardless of the underlying font.
4. **Tool buttons** on the left sidebar are the *last* `ActionFormData`
   buttons (indices >= N × M) and rendered by a separate JSON-UI panel that
   picks them up from index N × M onward.
5. **Live tile picking** — server-side scan of the world at the union
   bounding box's mid-Y (as our existing ASCII scanner does), but instead of
   returning `§f█`/`§8█`, returns one of the tile names above per cell.
   Corner/straight detection uses the 4-neighborhood of the current cell.

## Tile set

Ship all as 16×16 PNGs in `RP/textures/ui/blueprint_tiles/`. Minimum set for
MVP:

- `floor.png` — subtle blueprint-blue with a lighter dot grid
- `wall_h.png` — horizontal white line
- `wall_v.png` — vertical white line
- `corner_ne.png`, `corner_nw.png`, `corner_se.png`, `corner_sw.png` —
  L-shaped white lines
- `door_h.png`, `door_v.png` — dashed white line indicating door opening
- `blank.png` — solid blueprint-blue (outside all rooms)

Later additions: window tile, room label sprite, breaker box marker.

## JSON-UI files

- `RP/ui/server_form.json` — the override. Detects our title prefix and
  swaps to a custom layout element; otherwise falls back to vanilla.
- `RP/ui/blueprint_map.json` — layout definitions for the map grid + tile
  factory + sidebar.
- `RP/ui/_ui_defs.json` — registers `server_form.json` and any custom UI
  files.

## Server-side changes

- `blueprintUi.js` — pass the tile-picked strings as button *names* using
  `.button(name, iconPath)`; iconPath still exists for vanilla fallback.
  Add a prefix constant `FNAF_BLUEPRINT_UI_TITLE` used to gate the override.
- `mapRender.js` — add `renderTileGrid(dim, rooms, opts)` returning
  `string[][]` of tile names. Existing ASCII renderer stays for non-JSON-UI
  builds.

## Same shell reused for breaker box UI (interim, until Phase B lands the
real 3D panel)

Same override supports two modes via title prefix:
- `FNAF_BLUEPRINT_UI` → paper backdrop, tile grid map
- `FNAF_PANEL_UI` → electrical panel backdrop, buttons positioned over
  drawn switch positions

Once Phase B (3D interactive breaker box) is complete, this panel-mode
JSON-UI becomes the rarely-used config UI (rename rooms, etc.).

## Effort

~1–2 turns of work for the JSON-UI shell + tile picker. Extra time if we
end up drawing polished tile art vs placeholder tiles.

## Non-goals

- Runtime pixel composition
- Isometric / perspective rendering
- Full Ore UI rebuild (Mojang's UI migration is on the horizon but
  JSON-UI still ships and works)
