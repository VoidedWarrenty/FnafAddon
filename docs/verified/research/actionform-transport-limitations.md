---
title: ActionForm + long_form transport limitations
type: verified-research
status: verified
verified_on: 2026-07-24
engine_version: "@minecraft/server 1.11.0; Bedrock engine 1.21+"
scope: server_form.long_form → common_dialogs.main_panel_no_buttons chrome
confidence: verified
tags: [json-ui, actionform, transport, limitations, verified-research]
---

# Observed transport limitations — ActionForm + `long_form` chrome

Findings from the U1–U8 experiment cycle (2026-07-24). These are
**transport-scoped** observations. They do not constrain the engine
(see [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]]).

## Confirmed limitations

### Per-item runtime `offset` binding — does not work in this transport

Three attempted syntaxes for binding `offset` on a collection-iterated
image to a value derived from `#collection_index`:

| Attempt | Result |
|---|---|
| `view` binding writes local `#slot_x`; `offset: ["#slot_x", 0]` | Silent bind failure — all slots at x=0 |
| `property_bag: {"#slot_x": "(#collection_index * 30)"}` + `offset: ["#slot_x", 0]` | Fatal parse crash at `inside_header_panel/slot`: `Dangling number (no % or px in Size)` |
| `view` binding to magic `#offset_x` | Same fatal parse crash |

Root cause hypothesis: `common_dialogs.main_panel_no_buttons` resolves
child sizes at chrome-inflation time, before per-iteration bindings
run. Any child template whose geometry depends on per-iteration
`#collection_index` fails at the chrome layer.

Rejected pattern: [[docs/rejected/dynamic-per-item-offset-binding.md]]
Encoder capability: `supportsPerItemOffsetBinding = false`
ADR: [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]]

### `type: "panel"` does not accept `collection_name`

`collection_name` requires `type: "stack_panel"` or `type: "grid"`.
Setting it on a plain panel emits `Unknown property [collection_name]`
and disables iteration.

Rejected pattern: [[docs/rejected/panel-with-collection-name.md]]

### Inline arithmetic in `offset` array is not a real syntax

`offset: ["(#collection_index * 30)", 40]` is not parsed as an
expression. The size parser reaches `40` with no `px`/`%` unit and
errors fatally on `Dangling number`.

Rejected pattern: [[docs/rejected/inline-arithmetic-in-offset.md]]

### `common_buttons.light_content_button` does not resolve

Falls back to a bright-green "control not found" placeholder in
current Bedrock. Use `common_buttons.light_text_button` or bare
`type: "button"`.

Rejected pattern: [[docs/rejected/light-content-button-base.md]]

### Empty-text buttons are dropped by `ActionFormData` before reaching the collection

`.button("", "some/texture")` produces no visible entry. Send a
non-empty label for every button, gate visibility downstream on the
label content instead.

## Untested boundaries (from the original inventory)

Open follow-ups tagged for a future experiment cycle. Each would
inform an encoder-capabilities flag if run.

- **U2** — can `size` bind to a runtime value at the same collection
  scope where `offset` cannot?
- **U3** — can MoLang parse structured numeric strings out of
  `#form_button_text` reliably enough to encode positions server-side?
- **U5** — does the `color` property tint a white base texture?
- **U6** — does JSON-UI clip children whose offset+size exceeds the
  parent viewport?
- **U7** — can a `type: "label"` inside a canvas bind `text` to
  `#form_button_text` per iteration?
- **U8** — can image visibility be gated independently of a button
  hitbox when both share a data source? (v4 pack retained U8 in the
  menu; needs a clean device run.)

## Cross-transport hypotheses

These are **not** proven limitations of Bedrock itself. Each is a
candidate for future experimentation on a different transport:

- **NPC Dialog UI** — different chrome model; per-item positioning may
  or may not work.
- **Custom screens outside `server_form`** — the `main_panel_no_buttons`
  inflation issue is specific to that chrome. A custom screen with
  no vanilla chrome inheritance may allow per-item binding.
- **DDUI** — if the API ever exposes per-item transforms.
- **Future Bedrock engine versions** — bindings sometimes gain new
  sources at engine bumps. Re-run U1 periodically.

## Related

- [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]]
- [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]]
- [[docs/lessons-learned/2026-07-24-transport-vs-engine.md]]
