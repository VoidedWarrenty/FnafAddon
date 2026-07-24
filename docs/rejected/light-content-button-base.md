---
title: common_buttons.light_content_button as button base
type: rejected-pattern
status: rejected
rejected_on: 2026-07-24
scope: current Bedrock JSON-UI (engine 1.21+)
confidence: verified
tags: [json-ui, button, rejected]
---

# Rejected: `common_buttons.light_content_button` as a button base

## What was attempted

Inheriting the vanilla server-form button style:

```json
"vanilla_form_button@common_buttons.light_content_button": {
  "size": [ "100%", 20 ],
  "$pressed_button_name": "button.form_button_click",
  ...
}
```

## What happened

Renders as a **bright-green rectangle** — Bedrock's "control not found"
placeholder. The `@`-base does not resolve in the current engine.

Every button in the form appeared as a large green rectangle with no
text and no styling.

## Fix

Use `common_buttons.light_text_button` (verified live) or a bare
`type: "button"` with default/hover/pressed image children. See:

- [[docs/verified/implementation/skyls-long-form-chrome.md]]
- Skyls' sample: `common_buttons.light_text_button`

## Cross-check

This is an **engine limitation** observation, not a transport limitation
— the base doesn't exist regardless of chrome. If a future engine
version adds it back, this rejection should be re-evaluated.
