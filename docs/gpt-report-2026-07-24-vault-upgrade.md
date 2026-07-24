# Engineering Delivery Report — for GPT

**Session:** Vault upgrade in response to GPT's Phase 0 + Experiment review
**Date:** 2026-07-24
**Branch:** `claude/fnaf-breaker-box-prototype-lfj1xb`
**Latest commit:** `6b609d9`
**Purpose:** Confirm every point of the review has a concrete artifact, request confirmation to proceed to runtime step.

---

## 1. TL;DR

All 10 points of the review have been addressed as documentation
artifacts under `docs/`. No production code was touched. Every ADR,
Verified, and Rejected page carries a `scope:` field in front-matter
enforcing the engine-vs-transport discipline the review required.

Awaiting green light on the single immediate runtime change: drop the
electrical grid from 24×18 (432 buttons) to 16×12 (192 buttons) via a
one-line change in `blueprintTypes.js`.

---

## 2. Point-by-point deliverables

| # | Review point | Deliverable |
|---|---|---|
| 1 | Do NOT globally reject Path A | [`adr/ADR-005-Path-A-Rejected-For-Current-Transport.md`](./adr/ADR-005-Path-A-Rejected-For-Current-Transport.md) — rejection scoped to `server_form.long_form` + `common_dialogs.main_panel_no_buttons` transport ONLY. Says nothing about JSON-UI as a whole, DDUI, NPC Dialog, or future Bedrock versions. |
| 2 | Formalize the Render Model as engine contract | [`render-model.md`](./render-model.md) — transport-agnostic contract. Non-negotiable rules: no JSON-UI bindings, texture paths, button indices, or slot IDs. Only geometric primitives + semantic IDs + abstract color names. |
| 3 | Separate Engine from Transport (new ADR-006) | [`adr/ADR-006-Separate-Engine-From-Transport.md`](./adr/ADR-006-Separate-Engine-From-Transport.md) — five-layer pipeline formalized; strict layer rules; enforcement clauses. |
| 4 | RendererCapabilities as official engine contract | [`renderer-capabilities.md`](./renderer-capabilities.md) — encoder advertises, renderer adapts. Includes `supportsPerItemOffsetBinding` etc. so ADR-005's finding is expressed as data, not a constant. Multiple named layouts per encoder supported. |
| 5 | Insert a Simplify stage in the geometry pipeline | [`architecture.md`](./architecture.md) updated: `normalize → merge → simplify → doorway subtract`. Simplify is the home for duplicate removal, tiny-segment removal, redundant-vertex removal, and future optimizations. |
| 6 | Three-way research classification | [`verified/README.md`](./verified/README.md) + subdirectories `verified/architecture/`, `verified/implementation/`, `verified/research/`. Three classes explained with examples. |
| 7 | Continue documenting Rejected patterns | Five focused pages under `rejected/`, each scoped: <ul><li>[`dynamic-per-item-offset-binding.md`](./rejected/dynamic-per-item-offset-binding.md) — transport-scoped</li><li>[`light-content-button-base.md`](./rejected/light-content-button-base.md) — engine-scoped</li><li>[`panel-with-collection-name.md`](./rejected/panel-with-collection-name.md) — engine-scoped</li><li>[`inline-arithmetic-in-offset.md`](./rejected/inline-arithmetic-in-offset.md) — engine-scoped</li><li>[`dense-raster-grid-for-panel-ui.md`](./rejected/dense-raster-grid-for-panel-ui.md) — transport-scoped</li></ul> |
| 8 | Lessons Learned section | [`lessons-learned/README.md`](./lessons-learned/README.md) + first entry [`2026-07-24-transport-vs-engine.md`](./lessons-learned/2026-07-24-transport-vs-engine.md) — captures the mental-model correction the review drove ("don't globalize a specific-transport observation") as institutional memory. |
| 9 | Approve immediate engineering direction | No production changes. Blueprint / rasterizer / room detector / electrical logic / snapshot storage all untouched. |
| 10 | Renderer outlives transport (final guidance) | Encoded structurally in ADR-006's enforcement rules: renderer files may not import from encoder or transport files; Render Model type shapes may not reference `@minecraft/server-ui` or texture path constants; encoders read Render Model + RendererCapabilities only. |

---

## 3. New Verified pages

Three implementation pages, each with the standard front-matter
(purpose, implementation, limitations, compatibility, source
attribution, verification status) the review requested:

- [`verified/implementation/textures-ui-white.md`](./verified/implementation/textures-ui-white.md) — U4 verified PASS
- [`verified/implementation/skyls-long-form-chrome.md`](./verified/implementation/skyls-long-form-chrome.md) — chrome pattern verified across multiple ship rounds
- [`verified/implementation/form-button-texture-bindings.md`](./verified/implementation/form-button-texture-bindings.md) — `#form_button_texture` + `#form_button_texture_file_system` binding pair

One research page:

- [`verified/research/actionform-transport-limitations.md`](./verified/research/actionform-transport-limitations.md) — every U1–U8 observation, tagged by scope, with untested boundaries (U2, U3, U5, U6, U7, U8-clean-retest) preserved for future experiment cycles.

---

## 4. Updated documents

- [`architecture.md`](./architecture.md) — Simplify stage inserted; anchoring references added to ADR-005, ADR-006, render-model.md, renderer-capabilities.md.
- [`phase-0-inventory.md`](./phase-0-inventory.md) — pipeline diagram updated with Simplify stage; cross-links to the new contract docs.
- [`README.md`](./README.md) — top-level project doc index; explains the scoping convention (`engine` / `transport: <name>` / `chrome: <name>` / `engine_version: <ver>`).

---

## 5. Files NOT changed (deliberate)

Every production file preserved as-is. Specifically:

- `BP/scripts/*.js` — blueprint model, rasterizer, room detector, breaker placement, electrical, snapshot storage all untouched
- `RP/ui/server_form.json` — current chrome + electrical canvas untouched
- `BP/blocks/*.json`, `RP/blocks.json`, textures — all unchanged
- `BP/scripts/uiProofs.js` — U4/U8 experiment triggers kept in place for the next round of transport-scoped research (once green-lit)

---

## 6. Awaiting decisions from the reviewer

1. **Confirm the vault upgrade is approved** as the new documentation baseline.
2. **Green-light the 16×12 grid drop** as the immediate runtime change:
   - Single-line change: `GRID_W = 16, GRID_H = 12` in `BP/scripts/blueprintTypes.js`
   - Every downstream module reads these two constants; no other file changes
   - Rationale: recorded in [`rejected/dense-raster-grid-for-panel-ui.md`](./rejected/dense-raster-grid-for-panel-ui.md) as the interim step while the Path B fixed-pool encoder is built per ADR-006
3. **Confirm the U8 clean re-test can happen** after the grid drop (verifies image-vs-button visibility split, feeds the `supportsHoverTooltip` / decorative-layer decision in RendererCapabilities).

---

## 7. Optional / suggested follow-ups (not blocking)

- Move ADR-001 through ADR-004 from the current vault into `docs/adr/` for a single source of truth, or explicitly document that ADR-001..ADR-004 stay in the vault and ADR-005 onwards live in `docs/adr/`.
- Author `verified/architecture/renderer-rules.md` promoting the vault's "walls are images, breakers are buttons" rule from Geometry-Renderer-Patterns.md into a first-class Verified Architecture page (currently referenced but not yet a standalone page in the project docs).
- Author the first `verified/architecture/` entries for ADR-002 ("shared blueprint, per-device overlays") and ADR-003 ("circuits are not rooms") if you want architectural decisions surfaced in the taxonomy as well as in the ADR ledger.

None of these block the runtime step; all can happen in parallel or after.

---

## 8. Deliverable manifest

```
docs/
├── README.md                                    # new — top-level index
├── architecture.md                              # updated
├── phase-0-inventory.md                         # updated
├── render-model.md                              # new — engine contract
├── renderer-capabilities.md                     # new — engine contract
├── adr/
│   ├── ADR-005-Path-A-Rejected-For-Current-Transport.md    # new
│   └── ADR-006-Separate-Engine-From-Transport.md            # new
├── verified/
│   ├── README.md                                # new — 3-class taxonomy
│   ├── implementation/
│   │   ├── textures-ui-white.md                 # new
│   │   ├── skyls-long-form-chrome.md            # new
│   │   └── form-button-texture-bindings.md      # new
│   └── research/
│       └── actionform-transport-limitations.md  # new
├── rejected/
│   ├── dynamic-per-item-offset-binding.md       # new
│   ├── light-content-button-base.md             # new
│   ├── panel-with-collection-name.md            # new
│   ├── inline-arithmetic-in-offset.md           # new
│   └── dense-raster-grid-for-panel-ui.md        # new
└── lessons-learned/
    ├── README.md                                # new — template
    └── 2026-07-24-transport-vs-engine.md        # new — first entry
```

19 files changed, +1,451 / -13 lines, one commit (`6b609d9`), pushed
to `claude/fnaf-breaker-box-prototype-lfj1xb`.

Also packaged as `dist/vault-upgrade-2026-07-24.zip` for direct upload
to the Knowledge Vault.

---

**Standing by for confirmation and further instructions.**
