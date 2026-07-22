# Phase A — Runtime tile-composed breaker box UI

Persisted so it survives context compression.

## Non-goal (learned from user feedback)

**No hardcoded per-game backdrops.** The addon must support arbitrary
fan-built restaurants (JOTC, TJOC, custom pizzerias), so any UI that
requires a per-game PNG floor plan is a dead end. The backdrop and
button positions BOTH have to come from the user's applied blueprint,
composed at runtime.

## Constraint

Bedrock has no runtime pixel composition. So the map has to be built
from a **small pre-shipped tile set**, arranged in a JSON-UI grid, with
each cell picked by the server per-render from the world scan.

## Architecture

### Tile set (pre-shipped PNGs)

Small (16×16 or 32×32) images at `RP/textures/ui/breaker_tiles/`:

- `blank.png`         — solid black (outside)
- `floor.png`         — solid black (interior — same as blank; room outline is drawn by walls)
- `wall_n.png`        — thin white line along the top
- `wall_s.png`        — bottom
- `wall_e.png`        — right
- `wall_w.png`        — left
- `corner_ne.png`     — L-shape top-right
- `corner_nw.png`     — L-shape top-left
- `corner_se.png`     — L-shape bottom-right
- `corner_sw.png`     — L-shape bottom-left
- `door_h.png`        — dashed horizontal line (or full gap)
- `door_v.png`        — dashed vertical
- `breaker_on.png`    — small green switch icon
- `breaker_off.png`   — small red switch icon

Adjacent-wall combos (`wall_ns`, `wall_ew`, etc.) can be added if the
map looks bad without them.

### JSON-UI

- `RP/ui/_ui_defs.json` — declares `ui/server_form.json`.
- `RP/ui/server_form.json` — overrides the vanilla server form,
  **gated by a magic title prefix** (`§0§ƒ§b§r`) so other addons'
  server forms fall through to vanilla.
- When the prefix matches: render the button collection as a grid
  (24 columns × 14 rows = 336 buttons). Each button has:
    - fixed size (e.g. 16px × 16px)
    - `#form_button_texture` binding for its per-render icon
    - very small padding so cells tile edge-to-edge

### Server side

`breakerBox.js` when opening a matched panel:

1. **Classify each cell** via the world scan (same logic as
   `mapRender.js`), returning one of: `exterior`, `interior`,
   `wall_*`, `corner_*`, `door_*`, `breaker`.
2. **Compute breaker slot per room** — each room's XZ centroid mapped
   to the closest cell; that cell's tile becomes `breaker_on` or
   `breaker_off` depending on the current state.
3. **Emit 336 buttons in row-major order.** Every button carries:
    - text = `` (empty; JSON-UI hides it)
    - icon = path to the tile PNG matching this cell's classification
4. **Maintain an in-memory cell→room map** so the click handler knows
   which button indices are real breakers.
5. **Click handler**: `res.selection` is a 0..335 index. Look it up
   in the cell→room map; if it points to a room, toggle. If not, no-op.

### Fallback

If the applied blueprint has zero rooms or the world scan produces no
interior cells, we don't emit the magic prefix and the panel falls back
to the current ActionForm text UI (that's still shipping today).

## Effort / iteration expectations

JSON-UI is finicky and I can't preview locally. Expected loop:
1. First pass: tiles render but grid misaligned, buttons too big/small.
2. Nudge cell size / spacing.
3. First pass tiles wrong (walls not connecting): iterate on the
   classifier's connect-north/south/east/west logic.
4. Iteration on tile art if the outline looks wrong on-device.

Realistic: 3–5 back-and-forth turns before it looks right.

## Room detection for centroid

Room XZ centroid = midpoint of its union AABB projected to the same
downsampled grid space as the tile map. If two rooms' centroids land
in the same cell, the second bumps to the next-nearest empty cell so
both breakers are visible.

## Non-goals for now

- FNAF-branded backdrop images (rejected)
- Runtime pixel composition (impossible)
- Blueprint editor JSON-UI (stays text; that's fine for editing)
- Camera map (out of scope; may reuse the tile system later)
