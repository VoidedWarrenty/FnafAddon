# Phase 0 — Renderer Migration Inventory

Target architecture: **vector renderer** per ADR-001, formalized as a
five-layer pipeline in [docs/architecture.md](./architecture.md).
Approach: **engine refactor, not rewrite** — preserve every subsystem that
already works, replace only the layer that draws the map.

Pipeline the target expects:

```
Blueprint
  → Geometry Engine  (rasterize → detect rooms → normalize → merge → simplify → subtract doors → bounds)
  → Device Renderer  (this device's primitives — walls, breakers, labels, icons)
  → Render Model     (UI-agnostic geometry primitives — docs/render-model.md)
  → UI Encoder       (consumes RendererCapabilities — docs/renderer-capabilities.md — emits transport)
  → JSON UI (server_form) OR future backends (DDUI, editor preview, web)
```

Simplify is a dedicated stage inserted per GPT review (2026-07-24) —
holds duplicate removal, tiny-segment removal, redundant-vertex removal,
and future geometry optimizations, so Merge stays narrowly focused on
collinear coalescence.

The Render Model is its own subsystem — not a byproduct of `mapPipeline`.
Full type shapes (RenderWall, RenderBreaker, RenderLabel, RenderIcon,
RenderPolygon, RendererCapabilities) live in
[docs/architecture.md](./architecture.md).

Classification legend:

| Tag | Meaning |
|-----|---------|
| **KEEP** | Works, aligns with target, no changes |
| **MODIFY** | Core is right; needs additions or minor reshape |
| **REPLACE** | Approach is wrong for the vector renderer; must be rewritten |
| **DELETE LATER** | No place in the target; remove after cutover so revert paths stay open |
| **UNKNOWN / TEST REQUIRED** | Cannot classify until a JSON-UI proof lands |

---

## Behavior Pack — scripts

### KEEP

| File | Role | Why it stays |
|---|---|---|
| `BP/scripts/main.js` | Event wiring, tick loops | Event subscriptions + throttling are correct; the only change needed is wiring the new form entry point, which is a MODIFY, not a rewrite. Reclassify → MODIFY. |
| `BP/scripts/blueprint.js` | Polygon room model, world dynamic properties, `pointInPolygon`, `polygonBounds`, `floorsBounds`, `closestEdgeToPoint` | This IS the "shared architectural blueprint" ADR-002 mandates. Reusable by every future device (cameras, fire, plumbing, HVAC). |
| `BP/scripts/blueprintItem.js` | Blueprint item lifecycle (lore-based ID, stamping, picker dispatch) | Item concerns, unrelated to renderer. |
| `BP/scripts/blueprintPicker.js` | Wall-by-wall + ceiling + openings picker state machine | Capture flow, unrelated to renderer. |
| `BP/scripts/blueprintUi.js` | Blueprint editor `ActionFormData` + `ModalFormData` | This is the editor UI, not the panel UI. Vanilla styling is correct here. The map preview inside it (`renderMap`) is separate and covered under `mapRender.js` below. |
| `BP/scripts/blueprintViz.js` | Particle in-world visualization of polygon edges + openings | World-space debug aid. Independent of panel renderer. |
| `BP/scripts/state.js` | World dynamic-property indices (`registerBreakerBox`, `registerRoomLight`, `getBreakerBoxSnapshot`, etc.) | Persistence primitives. Unrelated to rendering. |
| `BP/scripts/rooms.js` | `FNAF1_ROOMS` preset | Static domain data. |
| `BP/scripts/roomLight.js` | Light block sync (`syncAllRoomLights` → per-block `resolveLightState`) | Correctly separated from UI. Consumer of the electrical resolver only. |
| `BP/scripts/roomDetector.js` | 4-way flood fill + exterior discard + door linking | Room detection off the raster. Vector renderer still needs a raster for this step — the raster is a means, not the deliverable. |
| `BP/scripts/breakerPlacement.js` | Multi-source BFS for largest-inscribed cell | Where breakers land inside their rooms. The world position it returns feeds the render model unchanged. |

### MODIFY

| File | Current role | Required change |
|---|---|---|
| `BP/scripts/main.js` | Above | Add `system.runInterval` cleanup for stale UI sessions if we add a client-side session cache. Otherwise unchanged. |
| `BP/scripts/blueprintTypes.js` | `CELL` enum, `GRID_W/H`, `TILE` paths, `ELECTRICAL_MAP_PREFIX` | Split into **two** concerns: (a) shared enums that survive (`ELECTRICAL_MAP_PREFIX`, `NO_ROOM`, `MAP_VERSION`), (b) renderer constants (`WALL_THICKNESS`, `MAX_RENDER_WALLS`, `MAX_RENDER_BREAKERS`, canvas dims). `CELL` + `TILE` + `tileForCell` become raster-only debug helpers and move to `mapDebug.js`. `GRID_W/H` retained but tagged as "raster resolution for room detection only, not display resolution". |
| `BP/scripts/mapTransform.js` | world→raster-cell aspect-preserving scale | Reshape output to world→UI-pixel coordinates. Same algorithm (uniform scale, aspect preserve, padded centre) — different unit basis. Add a second transform `worldToRasterCell` retained for room detection. |
| `BP/scripts/wallRasterizer.js` | Amanatides-Woo supercover into cell grid + door overlay | Keep as-is: it feeds room detection which needs a sealed cell grid. Its output is no longer rendered — that's the sole change to its role. |
| `BP/scripts/mapPipeline.js` | Orchestrates transform + rasterize + detect + place + stamp cells → snapshot | Insert new stages after room detection: **wall normalization → collinear merge → doorway subtract → render model build**. Stop stamping breaker cells into tile grid (grid is now internal). Output snapshot now carries walls + breakers + roomIdGrid + transform. |
| `BP/scripts/mapSerializer.js` | RLE tile grid + roomIdGrid + `meta[]` | Retain roomIdGrid RLE (needed for `resolveLightRoom`). Replace tile RLE with wall list + breaker list. Bump `MAP_VERSION` to 4. Wire migration from v3 (raster) → v4 (vector) by regenerating from source blueprint at open. |
| `BP/scripts/electricalRoomManager.js` | Reads roomIdGrid to resolve world→room, applies breaker→light | Correct in behavior but conflates "which room contains this point" with "is this breaker on". Per ADR-003, split into (a) `rooms.js` extension `resolveWorldToRoom` (pure geometry) and (b) `electricalRoomManager.js` (electrical only). |
| `BP/scripts/mapDebug.js` | ASCII dump of tile + roomId grids | Adopt raster helpers moved from `blueprintTypes.js`. Add `dumpRenderModel` for the new artefact. |
| `BP/scripts/breakerBox.js` | Thin dispatcher, `applyBlueprintToBreakerBox` | Repoint `openBreakerBox` to the new form; keep `applyBlueprintToBreakerBox` (regenerate snapshot with new pipeline). |

### REPLACE

| File | Current role | Why replaced | Successor |
|---|---|---|---|
| `BP/scripts/breakerForm.js` | Emits `GRID_W*GRID_H` ActionForm buttons (432 currently), each carrying a tile texture; JSON-UI lays them out as a 24×18 grid | Directly violates ADR-001 ("walls are images, breakers are buttons") and the "no interactive blank cells" rule. Perf ceiling for Pizza Plex. | New `breakerForm.js` builds from render model: emits N wall data-buttons (with position/size encoded per Bindings.md string-encoded transport) + N breaker buttons (interactive) up to `MAX_RENDER_WALLS` + `MAX_RENDER_BREAKERS`. |
| `RP/ui/server_form.json` — `electrical_canvas` + `electrical_cell` | 24×18 grid of tile cells | Same reason. | Fixed pool of `wall_slot_XXX` positioned + sized via bindings, fixed pool of `breaker_slot_XX` (interactive), gated on `#form_button_text` populated/empty. Skyls' `long_form` + `common_dialogs.main_panel_no_buttons` chrome pattern KEEPS. |

### DELETE LATER

| File | Reason |
|---|---|
| `BP/scripts/breakerTileGrid.js` | Old tile-grid utility from a prior JSON-UI attempt; verified no importers via grep. Remove after new renderer lands. |
| `BP/scripts/mapRender.js` | Legacy ASCII/Unicode renderer for the blueprint editor's map preview. Currently imported by `blueprintUi.js`. Once we have a small vector preview available, blueprint editor can use it too. Delete after successor is ready. |
| `RP/textures/ui/breaker_tiles/*.png` (14 files) | Atlas from a prior tile-grid attempt; no reference in current JSON-UI. Remove after new renderer lands. |
| `docs/phase-a-plan.md` | Superseded by the vault + this document. Archive or remove. |

### UNKNOWN / TEST REQUIRED (blocks REPLACE work)

Everything here is a JSON-UI capability I've asserted but not proven on device. Each is a candidate for a minimal proof per ADR-004 before any renderer code depends on it.

| # | Capability | Why it matters | Test shape |
|---|---|---|---|
| U1 | `offset` binding to a runtime value inside a collection scope | If we can bind per-slot `offset: [x, y]` from server data, we can have one wall template + N iterations. If not, we're forced into a fixed pool of pre-positioned slots. | One `wall_slot_test` with `offset` bound to `#form_button_text` parsed via MoLang; verify visible position responds to varying label. |
| U2 | `size` binding to a runtime value inside a collection scope | Same question, for `size: [w, h]`. | Same shape as U1, targeting `size`. |
| U3 | Parsing structured strings out of `#form_button_text` via MoLang | Only script-authored data channel we have for arbitrary numbers. If MoLang can't `-`-strip numeric literals cleanly, we need a very-wide fixed pool. | Encode `"12,34,100,2"` in button text; try extracting `12` via nested subtractions or comparison against a 0..N literal table. |
| U4 | `textures/ui/White` (or equivalent stock 1-pixel texture) | Wall rectangles need a base color texture. Ship-your-own is fine but stock is smaller. | Direct: `type: image, texture: "textures/ui/White"` in a proof screen. |
| U5 | Image tint via `color` property in Bedrock JSON-UI | Would let ONE wall texture serve multiple colors (breaker state, room highlight). | Set `color: [1, 0.4, 0.4]` on a white image; verify red rendering. |
| U6 | Canvas overflow clipping | Whether walls whose `offset+size` extends past the canvas panel get clipped or bleed. | Deliberately over-size a slot; observe. |
| U7 | Text label element with runtime `text` binding for room labels | Needed for optional room name labels in the render model. | `type: label` with `text: #form_button_text` inside canvas. |
| U8 | Image visibility controllable independently of button visibility while sharing the same data source | If yes, decorative layers (walls, labels) can share a collection with the interactive buttons and just hide the button hitbox for non-interactive items — one channel, two lifecycles. If no, walls and breakers must be separate control pools. | One `image + button` pair bound to the same collection, image visible always, button visibility gated on a second binding; verify only the image survives when the button hides. |

The result of U1/U2/U3 decides between two REPLACE branches:

- **Path A — bindable geometry**: server sends N buttons, JSON-UI has one wall template that reads geometry per iteration. Clean, unbounded (up to `MAX_RENDER_WALLS`).
- **Path B — fixed pool**: JSON-UI predeclares `wall_000..wall_199`, server sends structured data to each, unused slots hide themselves via texture-empty visibility. Verbose but deterministic; matches the vault's Dynamic-Content-Collections-Factories.md guidance.

**Recommendation**: run U1 first as a two-hour experiment before writing any REPLACE code. If it passes, we're on Path A. If it doesn't, Path B.

---

## Behavior Pack — non-script

| File | Class | Notes |
|---|---|---|
| `BP/manifest.json` | KEEP | Manifest fine. Increment version when we ship v4 snapshot format. |
| `BP/blocks/breaker_box_1.json` | KEEP | Wall-mount panel with `fnaf:is_open` state; selection_box already fixed. |
| `BP/blocks/room_light.json` | KEEP | Light block with `fnaf:powered` state. |
| `BP/items/blueprint.json` | KEEP | Blueprint item. |
| `BP/texts/languages.json` | KEEP | Localization. |

## Resource Pack

| File | Class | Notes |
|---|---|---|
| `RP/manifest.json` | KEEP | |
| `RP/blocks.json` | KEEP | Block-to-texture registry. |
| `RP/models/blocks/breaker_panel.geo.json` | KEEP | Panel geometry (with door variant). |
| `RP/textures/blocks/fnaf/*.png` | KEEP | Block textures. |
| `RP/textures/items/fnaf/*.png` | KEEP | Item icons. |
| `RP/textures/terrain_texture.json` | KEEP | |
| `RP/textures/item_texture.json` | KEEP | |
| `RP/texts/languages.json` | KEEP | |
| `RP/textures/ui/electrical_map/breaker_on.png` | KEEP | Needed for breaker pool. |
| `RP/textures/ui/electrical_map/breaker_off.png` | KEEP | Needed for breaker pool. |
| `RP/textures/ui/electrical_map/transparent.png` | KEEP | Needed for hidden slots. |
| `RP/textures/ui/electrical_map/wall.png` | MODIFY | Repurpose as a 1×1 white pixel (or delete in favor of stock `textures/ui/White` if U4 passes). |
| `RP/textures/ui/electrical_map/door.png` | MODIFY | Repurpose as a 1×1 yellow (or wall-with-gap) pixel. |
| `RP/textures/ui/electrical_map/floor.png` | DELETE LATER | No floor tiles in the vector renderer — background is one black rectangle behind the whole canvas. |
| `RP/textures/ui/breaker_tiles/*.png` (14 files) | DELETE LATER | Old atlas; no importers. |
| `RP/ui/_ui_defs.json` | KEEP | |
| `RP/ui/server_form.json` — `long_form` + `default_long_form` + `electrical_long_form` + `common_dialogs.main_panel_no_buttons` chrome + title-gated visibility | KEEP | Skyls chrome pattern is verified working on device. |
| `RP/ui/server_form.json` — `electrical_canvas` (grid) + `electrical_cell` | REPLACE | Grid of interactive cells becomes a canvas with wall slots + breaker slots. |

## Docs

| File | Class | Notes |
|---|---|---|
| `docs/phase-a-plan.md` | DELETE LATER | Superseded. |
| `docs/phase-0-inventory.md` (this file) | KEEP | Living document; update on classification changes. |

---

## Summary counts

- **KEEP**: 30 files (30 unchanged behavior-pack + resource-pack code paths)
- **MODIFY**: 9 files (all script; core intact, additions or reshape)
- **REPLACE**: 2 files (`breakerForm.js`, `RP/ui/server_form.json:electrical_canvas`)
- **DELETE LATER**: 17 items (2 script, 14 tile PNGs, 1 doc, 1 texture)
- **UNKNOWN / TEST REQUIRED**: 7 JSON-UI capability questions, all gating REPLACE work

## Sequenced next steps

1. **Prove or reject U1–U3** — smallest possible in-project proofs on a test form. This decides Path A vs Path B in less than a day.
2. Once path chosen, MODIFY `mapPipeline.js` to produce the render model (walls list + breaker list) alongside the current snapshot. Non-breaking — the current form keeps running.
3. Add new REPLACE `breakerForm.js` + `server_form.json` canvas behind a title prefix (e.g. `ELECTRICAL_MAP_V4|`) so both renderers coexist during comparison.
4. Cut over `openBreakerBox` to the new prefix.
5. DELETE LATER items removed in a single commit.
6. Vault: record U1–U3 outcomes as verified pages; move any that fail into a Rejected page.

_No code changes are authorized under Phase 0 beyond the proof-of-concept experiments listed in step 1._
