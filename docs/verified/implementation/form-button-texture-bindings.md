---
title: form_button_texture + texture_file_system binding pair
type: verified-implementation
status: verified
verified_on: 2026-07-24
engine_version: "@minecraft/server 1.11.0; Bedrock engine 1.21+"
device: iPad client
scope: JSON-UI ActionFormData transport, per-collection-item icon
confidence: verified
tags: [json-ui, binding, texture, verified]
---

# `#form_button_texture` + `#form_button_texture_file_system`

## Purpose

Route the icon path an ActionFormData script-side button carries
(second argument to `.button(text, iconPath)`) into a custom
per-collection-item image element.

## Implementation

Both bindings must be present in tandem. `#form_button_texture` alone
resolves some texture sources but not others; adding
`#form_button_texture_file_system` covers the remaining cases.

```json
"cell_image": {
  "type": "image",
  "size": [ "100%", "100%" ],
  "layer": 200,
  "bindings": [
    {
      "binding_name": "#form_button_texture",
      "binding_name_override": "#texture",
      "binding_type": "collection",
      "binding_collection_name": "form_buttons"
    },
    {
      "binding_name": "#form_button_texture_file_system",
      "binding_name_override": "#texture_file_system",
      "binding_type": "collection",
      "binding_collection_name": "form_buttons"
    },
    {
      "binding_type": "view",
      "source_property_name": "(not ((#texture = '') or (#texture = 'loading')))",
      "target_property_name": "#visible"
    }
  ]
}
```

The visibility binding on `(#texture = '')` hides the image cleanly for
buttons whose script-side icon path is empty — the underlying hitbox
remains and the panel background shows through.

## Limitations

- Icon path is a **texture path string**, not a runtime-computed value.
  Whatever the script passes is what renders.
- No tint applied to the texture (see U5 open question in
  [[docs/verified/research/actionform-transport-limitations.md]]).

## Compatibility

- Bedrock engine 1.21+ on iPad; icons render correctly for stock
  textures (`textures/ui/White`) and for custom RP textures
  (`textures/ui/electrical_map/*.png`).

## Verification

Direct observation: with only `#form_button_texture` bound, some cells
showed missing-texture placeholders; with both bindings and the
visibility gate present, cells resolved reliably across the 432-cell
electrical grid.

## Related

- Skyls' sample uses both bindings —
  [[docs/verified/implementation/skyls-long-form-chrome.md]]
