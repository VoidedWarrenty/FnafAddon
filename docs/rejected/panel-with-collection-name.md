---
title: type panel with collection_name
type: rejected-pattern
status: rejected
rejected_on: 2026-07-24
scope: JSON-UI type: "panel" — any transport
confidence: verified
tags: [json-ui, panel, collection, rejected]
---

# Rejected: `type: "panel"` with `collection_name`

## What was attempted

```json
"proof_u1a_canvas": {
  "type": "panel",
  "collection_name": "form_buttons",
  "controls": [
    { "slot@server_form.proof_u1a_slot": {} }
  ]
}
```

## What happened

Fatal: `Unknown properties found in def[inside_header_panel] from
namespace[server_form] - Unknown property [collection_name]`. When the
panel is inflated into a parent that doesn't accept `collection_name`,
the property bubbles up and errors.

## Fix

Use `type: "stack_panel"` or `type: "grid"` — the two types that
legally accept collection iteration.

```json
"proof_u1a_canvas": {
  "type": "stack_panel",
  "collection_name": "form_buttons",
  ...
}
```

## Cross-check

Engine-scoped limitation (property model rule). Applies to every
transport that inflates a panel with a collection into a non-iterating
parent.
