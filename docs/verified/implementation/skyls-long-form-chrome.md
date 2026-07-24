---
title: Skyls' long_form + main_panel_no_buttons custom chrome
type: verified-implementation
status: verified
verified_on: 2026-07-24
engine_version: "@minecraft/server 1.11.0; Bedrock engine 1.21+"
device: iPad client
scope: JSON-UI ActionFormData transport
source: https://skyls.de/samples/ui4/RP/ui/server_form.json
confidence: verified
tags: [json-ui, server-form, chrome, title-gating, verified]
---

# Skyls' `long_form` override with `common_dialogs.main_panel_no_buttons`

## Purpose

Render a custom ActionForm layout while preserving native chrome
(title bar, border, close X) — without breaking any other server form.

## Implementation

Override `server_form.long_form` as a `type: panel` containing N sibling
children, each inheriting `common_dialogs.main_panel_no_buttons` and
setting `$child_control` to a custom canvas namespace. Visibility on
each sibling gates on a title-string subtraction check.

```json
"long_form": {
  "type": "panel",
  "size": [ "100%", "100%" ],
  "controls": [
    {
      "default_long_form@common_dialogs.main_panel_no_buttons": {
        "$child_control": "server_form.long_form_panel",
        "bindings": [
          { "binding_name": "#title_text" },
          {
            "binding_type": "view",
            "source_property_name": "((#title_text - 'FNAF|') = #title_text)",
            "target_property_name": "#visible"
          }
        ]
      }
    },
    {
      "electrical_long_form@common_dialogs.main_panel_no_buttons": {
        "$child_control": "server_form.electrical_canvas",
        "bindings": [
          { "binding_name": "#title_text" },
          {
            "binding_type": "view",
            "source_property_name": "(not ((#title_text - 'FNAF|ELECTRICAL_MAP|') = #title_text))",
            "target_property_name": "#visible"
          }
        ]
      }
    }
  ]
}
```

## Subordinate patterns (all verified together)

### Root-prefix consolidation

Every custom title starts with `FNAF|`. The vanilla-fallback wrapper
hides whenever `FNAF|` appears anywhere in the title, so a single
expression gates all custom forms.

```
((#title_text - 'FNAF|') = #title_text)
```

Returns **true** when the prefix is absent — vanilla path visible.

Returns **false** when the prefix is present — custom siblings own the frame.

### Bindings live on the OUTER wrapper

Bindings inside a collection-iterating panel (grid or stack_panel) do
not gate their siblings. The `#visible` binding must be on the wrapper
outside the collection scope.

### Cell layer ordering

Custom cells use image at `layer: 200` (Skyls' pattern) with a hitbox
`type: button` beneath at default layer. `common_buttons.light_text_button`
chrome must be omitted for continuous wall visuals — cells should be a
bare image + bare button.

## Limitations

- **Vanilla fallback breaks silently** if the root-prefix gate doesn't
  catch every custom form title. Two custom forms visible at once (the
  "double-panel" bug). Enforce a single root prefix.
- **Cannot inject content between chrome layers** — content lives inside
  `$child_control` only. No overlays on the title bar or the close X.
- **`common_buttons.light_content_button` does NOT resolve** in the
  same Bedrock version. Use `common_buttons.light_text_button` or a
  bare `type: button` — see
  [[docs/rejected/light-content-button-base.md]].

## Compatibility

- **Bedrock engine 1.21+** confirmed on iPad client, verified across
  multiple ship rounds 2026-07-23 → 2026-07-24
- Preserves vanilla forms from other addons — the chrome inheritance
  only activates for titles matching our gate

## Verification

Multiple ship rounds:
- Initial verification: 432-cell electrical grid renders inside chrome
- Verified again after v4 with U1 experiments removed
- Blueprint editor + unconfigured breaker panel render exactly as
  vanilla when title lacks `FNAF|` prefix

## Source attribution

Discovered by reverse-engineering Skyls' public sample
`https://skyls.de/samples/ui4/RP/ui/server_form.json`. Adapted for our
namespace and gated on our title prefix.

## Related

- [[docs/verified/implementation/form-button-texture-bindings.md]] —
  `#form_button_texture` + `#form_button_texture_file_system` binding
  pair.
- [[docs/rejected/light-content-button-base.md]]
- [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]] — this
  chrome IS the transport that ADR-005 scopes its rejection to.
