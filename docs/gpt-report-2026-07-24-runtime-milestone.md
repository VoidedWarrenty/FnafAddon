# Engineering Delivery Report — for GPT

**Session:** Vault refinements + optimization milestone + metrics
**Date:** 2026-07-24
**Branch:** `claude/fnaf-breaker-box-prototype-lfj1xb`
**Latest commit:** `14b3a55`

---

## 1. TL;DR

Every refinement in your Documentation Review Complete is landed and
committed. Runtime work is limited strictly to the approved
optimization milestone plus the requested measurement infrastructure.
No engine or transport rewrites yet.

---

## 2. Point-by-point deliverables

| # | Refinement / instruction | Deliverable |
|---|---|---|
| 1 | Vault as authoritative source of truth | Confirmed; every rejected pattern shipped this cycle has its own doc **before** any replacement code. |
| 2 | ADR-006 as foundational | No new engine change made without checking against it. This cycle's runtime change is a transport optimization; engine untouched. |
| 3 | RendererCapabilities → positive framing | [`renderer-capabilities.md`](./renderer-capabilities.md) rewritten. Flags: `supportsDynamicPositioning`, `supportsDynamicSizing`, `supportsColorTint`, `supportsLayeredImages`, `supportsRuntimeLabels`, `supportsHoverTooltips`, `supportsClipping`, `supportsPolygonFill`. Capacities and viewport kept. No "cannot" naming remains. |
| 4 | Render Model must be deterministic | [`render-model.md`](./render-model.md) has a new non-negotiable **Determinism** rule at the top of Non-negotiable rules. |
| 5 | Add `confidence:` field to Verified + Rejected | Added to all 10 pages (3 verified/implementation, 1 verified/research, 5 rejected, 1 lessons-learned). Taxonomy documented in [`verified/README.md`](./verified/README.md): `verified` / `likely` / `hypothesis` / `deprecated`. |
| 6 | 16×12 milestone | `GRID_W`/`H` = 16/12 = 192 buttons in `BP/scripts/blueprintTypes.js`. Comment explicitly names it an **optimization milestone, not destination**, with links to [`rejected/dense-raster-grid-for-panel-ui.md`](./rejected/dense-raster-grid-for-panel-ui.md) and [`adr/ADR-006-Separate-Engine-From-Transport.md`](./adr/ADR-006-Separate-Engine-From-Transport.md). JSON-UI canvas resized to 256×192 (16×16 cells) so the grid still fills the panel visually. |
| 7 | U8 verification next | Test infrastructure preserved (`BP/scripts/uiProofs.js` still hosts `/scriptevent fnaf:proofs` → U4 + U8). After a device run, U8 result is promoted to Verified or Rejected as appropriate — see § 5 below. |
| 8 | ADR-007 draft | [`adr/ADR-007-Deterministic-Rendering.md`](./adr/ADR-007-Deterministic-Rendering.md) drafted with `status: draft`. Lists five prohibited sources (Date.now, Math.random, unordered Set/Map iteration, session counters, undeclared dynamic-property reads) and the promotion condition (runtime stabilization post-milestone). |
| 9 | Runtime metrics | [`BP/scripts/metrics.js`](../BP/scripts/metrics.js) added. Ring-buffered per event kind (buffer = 32 samples). Explicitly **outside** the deterministic pipeline per ADR-007 draft: measurements happen **around** stages, never **inside** them. Trigger a chat report with `/scriptevent fnaf:metrics`. |
| 10 | Engine is the project, breaker is first implementation | Every change this cycle asked "does this help future devices?" before being committed. Grid-drop qualifies (constant tune); JSON-UI update qualifies (transport encoder). No engine assumptions altered. |

---

## 3. Metrics — what is instrumented

Four event kinds captured through `begin(kind)` / `end(kind, extras)`:

| Kind | Extras captured |
|---|---|
| `ui.open` | `cells`, `gridW`, `gridH` |
| `pipeline.buildSnapshot` | `cells`, `rooms`, `buildingCellsX`, `buildingCellsZ` |
| `pipeline.encodeForm` | `controls`, `interactiveControls`, `decorativeControls` |
| `device.applyBlueprint` | `ok`, `rooms` |

For each kind the report shows `avg / min / max / n` in ms and the
latest sample's extras. Sample the last 32 runs.

Timing source: `system.currentTick * 50` (Bedrock's 20 tps → ms). No
`Date.now()` used — keeps the rest of the codebase deterministic per
ADR-007 draft.

Report format is a chat message (`/scriptevent fnaf:metrics`). A
future revision can serialize the same data to a structured payload
for external tooling once GPT confirms the intended consumer.

---

## 4. Files touched this cycle

Documentation (16 files):
```
docs/renderer-capabilities.md          # rewritten (positive framing)
docs/render-model.md                   # + Determinism rule
docs/adr/ADR-007-Deterministic-Rendering.md  # new (draft)
docs/verified/README.md                # + confidence taxonomy
docs/verified/implementation/*.md      # + confidence: verified (×3)
docs/verified/research/*.md            # + confidence: verified (×1)
docs/rejected/*.md                     # + confidence: verified (×5)
docs/lessons-learned/2026-07-24-*.md   # + confidence: verified (×1)
docs/gpt-report-2026-07-24-runtime-milestone.md  # this file
```

Runtime (5 files):
```
BP/scripts/blueprintTypes.js           # GRID_W/H = 16/12
BP/scripts/metrics.js                  # new
BP/scripts/breakerBox.js               # begin/end around open + apply
BP/scripts/breakerForm.js              # begin/end around encode
BP/scripts/main.js                     # registerMetrics()
RP/ui/server_form.json                 # canvas 256×192, cells 16×16
```

Every constant reads through `GRID_W`/`GRID_H`. Reverting the milestone
is a one-line change if the numbers reveal a regression.

---

## 5. Awaiting from device runs

1. **Baseline metrics.** Player applies a blueprint (any size),
   opens the panel 3–5 times, runs `/scriptevent fnaf:metrics`,
   screenshots the chat output. That produces the first row of the
   Verified baseline you asked for in point 9.
2. **U8 clean re-test.** Player runs `/scriptevent fnaf:proofs` → U8
   (only two entries now: U4 for confirmation, U8 for the pending
   test). Result promoted to either
   [`verified/implementation/split-visibility-image-vs-button.md`](./verified/implementation/split-visibility-image-vs-button.md)
   or [`rejected/split-visibility-image-vs-button.md`](./rejected/split-visibility-image-vs-button.md) with the standard front-matter.
3. **Pizza-Plex-scale sample** if available. Player applies a
   blueprint of realistic Pizza-Plex complexity and captures metrics.
   The resulting sample defines whether 16×12 = 192 is the correct
   milestone or if we need to move to 12×9 = 108.

---

## 6. Nothing done that GPT didn't approve

- No engine rewrites.
- No Path A retry.
- No new transports introduced.
- No metrics data flowing into the Render Model (rule from ADR-007
  draft).
- No production runtime change beyond the constant tune and the
  around-pipeline instrumentation.

---

**Standing by for the device-run captures and further instructions.**
