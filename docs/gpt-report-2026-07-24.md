# Engineering Status Report — for GPT

**Session:** JSON-UI experiments U1–U8 (device-verified)
**Date:** 2026-07-24
**Branch:** `claude/fnaf-breaker-box-prototype-lfj1xb`
**Purpose:** Update the Knowledge Vault with verified experiment outcomes, promote proven patterns, record rejected architectures, and set the next planned step.

---

## 1. TL;DR

- **Path A (per-collection-item runtime `offset` / `size` binding) is rejected.** Three syntax variants tested on device; none produced dynamic per-item positioning. Two of the three crashed the entire `server_form.json` namespace with fatal JSON parse errors.
- **Path B (fixed pre-positioned pool) is committed.** Our existing 24×18 electrical grid is already Path B, implemented at excessive density.
- **Two verified JSON-UI patterns** ready for promotion to the vault's Verified section: `textures/ui/White` availability, and Skyls' `long_form` + `common_dialogs.main_panel_no_buttons` chrome pattern.
- **Next planned step:** drop the electrical grid from 24×18 (432 buttons) to 16×12 (192 buttons) for Pizza-Plex-scale snappy performance, and stop making blank cells interactive.

---

## 2. Experiments completed

Every experiment used a title prefix under a shared `FNAF|` root and rendered via a `common_dialogs.main_panel_no_buttons` wrapper with `$child_control` pointing at a custom canvas. Bedrock version: `@minecraft/server 1.11.0`, engine `1.21+`.

### U1 — Runtime `offset` binding on collection items

Goal: bind `offset: [x, y]` on a per-collection-item control to a runtime-derived value (e.g. `#collection_index * 30`), enabling one wall template + N iterations with distinct positions.

Three variants tried:

| Variant | Mechanism | Outcome |
|---|---|---|
| U1a | `view` binding writes local `#slot_x`; `offset` reads `#slot_x` | **FAIL** (v1 device shot): five slots collapsed to `x=0`, visible as one vertical column. Binding did not resolve inside the collection iteration scope. |
| U1b | `property_bag` maps `#slot_x` to `(#collection_index * 30)`; `offset` reads it | **FATAL** (v2/v3): `[Json][error] … inside_header_panel/slot … Dangling number (no % or px in Size)`. Whole `server_form.json` file failed to load; every vanilla form disappeared. |
| U1c | View binding targeting Bedrock's magic `#offset_x` property | Same **FATAL** as U1b. |

Interpretation: `main_panel_no_buttons` embeds `$child_control` inside its `inside_header_panel/slot`. When the child template's own `size` / `offset` cannot be resolved to concrete `%` / `px` values at load time (because they depend on per-iteration `#collection_index`), the parser fails at chrome-inflation time, not at binding time. This is a structural limitation, not a syntax issue we can iterate around.

**Decision:** Path A rejected. No further U1 iteration.

### U4 — Stock `textures/ui/White` availability

Goal: confirm `textures/ui/White` is a live stock asset we can use directly as a wall fill (avoid shipping a solid-pixel PNG).

Test: `type: image, size: [32, 32], texture: "textures/ui/White"` centered in a panel. No bindings.

Outcome: **PASS** (v1 device shot). Solid white 32×32 rendered exactly where placed. Confirmed live in engine 1.21+.

Promote to Verified — see § 4.

### U8 — Independent visibility for decorative image vs interactive button

Goal: verify that inside one collection iteration, an image and a button can have independent `#visible` bindings so decorative and interactive layers can share a single collection.

Test: five buttons sent — three labeled `"keep"`, two labeled `"hide"`. Each collection item renders an always-visible white bar (image) and a hitbox button whose visibility depends on `#form_button_text = "keep"`.

Outcome (v1): **INCONCLUSIVE** — the vanilla wrapper rendered on top of the custom canvas (double-panel bug fixed in v2 by consolidating all custom titles under `FNAF|`), obscuring the split.

Outcome (v3): **NOT RUN** — U1 crashes prevented the file from loading. To be re-tested in v4 (JSON now valid).

Kept in the menu; needs one more device run.

---

## 3. Architectural decision — Path A rejected

**ADR update proposal for the vault** (candidate `ADR-005`):

> **ADR-005 · Reject dynamic per-item positioning; commit to fixed pre-positioned pool.**
>
> Verified on-device that Bedrock JSON-UI has no reliable syntax for binding per-collection-item `offset` or `size` to a value derived from `#collection_index`. Attempts either (a) failed silently to bind, or (b) crashed `server_form.json` at the vanilla chrome layer (`main_panel_no_buttons/inside_header_panel/slot`) with `Dangling number` errors.
>
> The renderer therefore commits to a **fixed pre-positioned pool**: JSON-UI predeclares N wall slots at hardcoded offsets/sizes, and the encoder decides which slots are visible per building via `#visible` bindings and per-slot texture assignment.

Consequences:

- The renderer's capabilities contract (`RendererCapabilities` in `docs/architecture.md`) becomes non-negotiable: `maxWalls`, `maxBreakers`, `maxIcons`, `maxLabels` are real ceilings tied to a specific `server_form.json` layout.
- Multiple layouts may coexist (small / medium / large building presets), each with its own slot pool sized and positioned differently. The encoder picks a layout at apply time.
- Buildings whose geometry exceeds the active pool must fail loudly (per `Performance-and-Troubleshooting.md`), never silently truncate.

---

## 4. Verified patterns — promote to `Research/` and `JSON-UI/` Verified pages

### 4.1 `textures/ui/White` — stock 1-pixel white texture

- **Purpose:** solid-color fill (walls, backgrounds, dividers) without shipping own PNG.
- **Implementation:** `{"type": "image", "texture": "textures/ui/White", "size": [w, h]}` — no bindings required.
- **Limitations:** color is fixed white. Combine with `color` property or `nine_slice_size` for variations (untested; separate experiment).
- **Compatibility:** Bedrock engine 1.21+ confirmed on iPad client.
- **Source attribution:** Discovered via experiment U4; matches informal community lore (Bedrock Wiki, addon repos).
- **Verification status:** **Verified** on device 2026-07-24.

### 4.2 Skyls' `long_form` override with `common_dialogs.main_panel_no_buttons`

- **Purpose:** custom ActionForm layout while preserving native chrome (title bar, border, close X).
- **Implementation:** Override `server_form.long_form` as a `type: panel` with N sibling children, each inheriting `common_dialogs.main_panel_no_buttons` and setting `$child_control` to a custom canvas namespace. Visibility on each sibling gates on a title-string subtraction check.
- **Key subordinate patterns already verified:**
  - Title-substring MoLang: `((#title_text - 'FNAF|SOMETHING|') = #title_text)` returns true when the prefix is absent, false when present. Bindings live on the outer wrapper, not inside collection scope.
  - Root-prefix consolidation: every custom title starts with `FNAF|`. The vanilla-fallback wrapper hides whenever `FNAF|` appears anywhere in the title, cleanly gating all custom forms with a single expression.
  - Cell layer ordering: image at `layer: 200`, hitbox `type: button` beneath. `common_buttons.light_text_button` chrome must be omitted for continuous wall visuals.
- **Limitations:** `common_buttons.light_content_button` does NOT resolve in current Bedrock — renders as a bright-green placeholder. Use `common_buttons.light_text_button` or plain `type: button`.
- **Source:** `https://skyls.de/samples/ui4/RP/ui/server_form.json`
- **Verification status:** **Verified** on device across multiple runs.

### 4.3 `#form_button_texture_file_system` binding

- **Purpose:** required alongside `#form_button_texture` for certain texture sources to resolve; without it some button icons render as missing textures.
- **Implementation:** always include both bindings in tandem:
  ```json
  { "binding_name": "#form_button_texture", "binding_name_override": "#texture", ... },
  { "binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system", ... }
  ```
- **Verification status:** **Verified** — after including this binding, tile textures resolved reliably.

---

## 5. Rejected patterns — promote to `Rejected/` section

### 5.1 Per-collection-item `offset` / `size` binding to derived values

- **Attempted syntaxes:**
  - `view` binding writes local `#slot_x`; `offset: ["#slot_x", 0]` reads it
  - `property_bag: {"#slot_x": "(#collection_index * 30)"}` + `offset: ["#slot_x", 0]`
  - View binding to Bedrock's magic `#offset_x`
- **Why rejected:** either fails silently to bind (all slots at `x=0`), or crashes the file with `Dangling number (no % or px in Size)` inside `main_panel_no_buttons/inside_header_panel/slot`.
- **Root cause hypothesis:** the vanilla wrapper resolves child sizes at chrome-inflation time before per-iteration bindings run, so any child whose size depends on a runtime binding fails resolution.
- **Do not repeat.** Renderer must not depend on dynamic per-item positioning.

### 5.2 `common_buttons.light_content_button` as a button base

- **Behavior:** renders as a bright-green rectangle (Bedrock's "control not found" placeholder).
- **Replacement:** `common_buttons.light_text_button` (verified live) or a bare `type: button` with no state controls.

### 5.3 `type: "panel"` with `collection_name`

- **Behavior:** fatal — `Unknown property [collection_name]`. `panel` does not accept collection iteration.
- **Replacement:** `type: "stack_panel"` or `type: "grid"`.

### 5.4 Inline arithmetic inside the `offset` array

- **Attempted:** `offset: ["(#collection_index * 30)", 40]`
- **Behavior:** fatal — `Dangling number`. Not a real Bedrock JSON-UI syntax.

### 5.5 432-cell dense raster grid as the electrical panel

- **What we shipped:** 24×18 grid, each cell a `common_buttons.light_text_button` variant, every cell interactive.
- **Why it should be superseded:** violates the vault's non-negotiable rule ("do not make blank map cells interactive"), and open latency is noticeable at ≥ 400 buttons on iPad.
- **Successor:** same encoder shape at 16×12 (192 buttons) as the immediate performance win; the eventual Path B target is a smaller fixed pool of wall+breaker slots only, no empty background cells.

---

## 6. Next planned steps

Ordered.

1. **Confirm v4 file loads clean** on device (electrical form, blueprint editor, unconfigured breaker panel). No more crashes from the U1 attempts.
2. **Drop `GRID_W`/`GRID_H` from 24×18 to 16×12** in `blueprintTypes.js`. One-line change — every downstream module reads those constants.
3. **Re-run U8** on the clean v4 file to confirm image/button visibility split works. Result gates future decorative-layer plans.
4. **Vault updates** as described in § 4 and § 5.
5. **Only then**: begin Phase 1 of the Renderer Migration Plan (implement pure geometry stage — wall normalization + collinear merge + doorway subtract — producing a `RenderModel` per `docs/architecture.md`).

No production rewrite happens until steps 1–4 are complete.

---

## 7. Open questions worth another experiment cycle later

None of these blocks Path B, but each would inform future work:

- **Can `size` bind to a runtime value at a different embed level** (not inside `main_panel_no_buttons/slot`)? Might open a Path A′ if the chrome path is what forbids it, not the binding itself.
- **Can `color` on `type: image` tint the white base texture?** (U5 from the original inventory, never shipped.) Would let one texture serve multiple wall/breaker colors.
- **Does JSON-UI clip children whose `offset+size` exceeds the parent's viewport?** (U6.) Matters for guardrails when a building overflows the pool.
- **Can `type: label` inside a canvas bind `text` to `#form_button_text` per iteration?** (U7.) Needed for optional room-name labels in the render model.
- **NPC dialog UI as an alternate transport.** Different chrome, different sizing model — might allow layouts unavailable in ActionForm.

---

## 8. Files to reference

- `docs/architecture.md` — 5-layer pipeline formalized (Blueprint → Geometry Engine → Device Renderer → Render Model → UI Encoder → transport)
- `docs/phase-0-inventory.md` — KEEP/MODIFY/REPLACE/DELETE/UNKNOWN classification of every current source file
- `docs/gpt-report-2026-07-24.md` — this file
- `RP/ui/server_form.json` — current verified chrome + electrical grid
- `BP/scripts/uiProofs.js` — surviving U4/U8 experiment triggers
- `BP/scripts/blueprintTypes.js` — `FNAF_ROOT_PREFIX` + grid constants (16×12 target)
