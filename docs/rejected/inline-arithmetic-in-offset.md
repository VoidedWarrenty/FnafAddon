---
title: Inline arithmetic in offset array
type: rejected-pattern
status: rejected
rejected_on: 2026-07-24
scope: JSON-UI offset/size arrays — any transport
confidence: verified
tags: [json-ui, offset, syntax, rejected]
---

# Rejected: inline arithmetic in `offset` array

## What was attempted

```json
"proof_u1c_slot": {
  "type": "image",
  "size": [ 20, 20 ],
  "offset": [ "(#collection_index * 30)", 40 ]
}
```

Placing a MoLang arithmetic expression as a string element of the
`offset` array.

## What happened

Fatal parse error:
`[Json][error] … Dangling number (no % or px in Size)`.

The parser treats a string in the offset array as a size expression,
finds no `%` or `px` unit on the neighbouring numeric `40`, and errors
fatally, breaking the entire `server_form.json` namespace load.

## Fix

There is no valid inline-expression syntax for offset/size arrays in
Bedrock JSON-UI. Values must be:
- Bare numbers: `[10, 20]`
- Explicit units: `["10px", "20px"]`
- Bound variables (e.g. `["#slot_x", "0px"]`) — but see
  [[docs/rejected/dynamic-per-item-offset-binding.md]] for the transport
  scope where even that fails at inflation.

## Cross-check

Engine-scoped syntax rule. Applies universally.
