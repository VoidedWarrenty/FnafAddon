---
title: Dynamic per-item offset binding (ActionForm long_form transport)
type: rejected-pattern
status: rejected
rejected_on: 2026-07-24
scope: server_form.long_form + common_dialogs.main_panel_no_buttons
transport: ActionFormData
adr: [ADR-005]
confidence: verified
tags: [json-ui, binding, offset, path-a, rejected]
---

# Rejected: dynamic per-collection-item `offset` binding

**Scope of rejection**: current transport only. See
[[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]] and
[[docs/adr/ADR-006-Separate-Engine-From-Transport.md]] — the engine
still supports the capability if a future transport verifies it.

## What was attempted

Bind `offset: [x, y]` on a collection-iterated image to a
per-iteration value derived from `#collection_index`, so one JSON-UI
template + N script-side buttons produce N spatially-distinct slots.

Three syntax variants:

```json
// U1a — view binding writes local #slot_x
"proof_u1a_slot": {
  "type": "image",
  "offset": [ "#slot_x", 0 ],
  "bindings": [
    { "binding_type": "collection_details", "binding_collection_name": "form_buttons" },
    {
      "binding_type": "view",
      "source_property_name": "(#collection_index * 30)",
      "target_property_name": "#slot_x"
    }
  ]
}
```

```json
// U1b — property_bag with computed expression
"proof_u1b_slot": {
  "type": "image",
  "property_bag": {
    "#slot_x": "(#collection_index * 30)"
  },
  "offset": [ "#slot_x", 0 ]
}
```

```json
// U1c — view binding to magic #offset_x
"proof_u1c_slot": {
  "type": "image",
  "bindings": [
    { "binding_type": "collection_details", "binding_collection_name": "form_buttons" },
    {
      "binding_type": "view",
      "source_property_name": "(#collection_index * 30)",
      "target_property_name": "#offset_x"
    }
  ]
}
```

## What happened

- **U1a**: silent bind failure — all 5 slots at `x=0`, visible as a
  single stacked column.
- **U1b**: fatal — `[Json][error] … proof_u1b_long_form/panel_indent/
  inside_header_panel/slot | Dangling number (no % or px in Size)`.
  Whole `server_form.json` namespace failed to load; every vanilla
  form disappeared.
- **U1c**: same fatal error.

## Why it doesn't work in this transport

`common_dialogs.main_panel_no_buttons` inflates `$child_control`
into `inside_header_panel/slot`. That slot's size/offset must resolve
at chrome-inflation time — before per-iteration bindings run. A child
template whose geometry depends on `#collection_index` cannot resolve
at inflation time and the chrome layer errors.

## Consequences on the codebase

- Encoder capabilities in [[docs/renderer-capabilities.md]]
  advertise `supportsPerItemOffsetBinding = false` for the
  `JsonUiEncoder`.
- Renderer commits to Path B (fixed pre-positioned pool) via ADR-005.

## Do not repeat

Future work on the same transport should not attempt the same three
variants again. Time cost: ~4 ship rounds.

## Might work in another transport

Not tested. Do not extrapolate this rejection to:
- NPC Dialog UI
- Custom screens that don't route through `main_panel_no_buttons`
- Future Bedrock engine versions where binding scope may change

See [[docs/verified/research/actionform-transport-limitations.md#cross-transport-hypotheses]].
