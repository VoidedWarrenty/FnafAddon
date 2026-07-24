---
title: textures/ui/White is a live stock 1-pixel white texture
type: verified-implementation
status: verified
verified_on: 2026-07-24
engine_version: "@minecraft/server 1.11.0; Bedrock engine 1.21+"
device: iPad client
scope: JSON-UI image element, any screen
source_experiment: U4
tags: [json-ui, texture, stock-asset, verified]
---

# `textures/ui/White` — verified stock texture

## Purpose

A solid-white 1×1 stock texture usable as a wall fill, divider,
background, or any place a solid color rectangle is needed without
shipping a custom PNG.

## Implementation

```json
{
  "type": "image",
  "size": [ 32, 32 ],
  "texture": "textures/ui/White",
  "anchor_from": "center",
  "anchor_to": "center"
}
```

No bindings required. Size can be any dimensions; texture stretches
cleanly.

## Limitations

- Color is **fixed white**. Tinting via a `color` property is untested
  ([[docs/verified/research/actionform-transport-limitations.md#u5]]).
- Not a nine-slice — no rounded corners or borders. Use dedicated
  nine-slice textures for those.

## Compatibility

- **Bedrock engine 1.21+** confirmed on iPad client, 2026-07-24
- **Not tested** on Windows / console clients (assumed same but see
  [[docs/lessons-learned/2026-07-24-transport-vs-engine.md]] — always
  scope claims to the tested surface)

## Verification

Experiment U4 shipped a form with a single centered `type: image`
element pointing at `textures/ui/White`. Device screenshot showed a
solid white 32×32 square at expected position; no `[Json][error]` or
`[UI][error]` log entries.

## Source attribution

Discovered via in-project experiment U4 on 2026-07-24. Matches
informal community usage in Bedrock addon repos and the Bedrock Wiki
UI documentation.

## Related

- Rejected: shipping our own `wall.png` when the stock texture works —
  [[docs/rejected/redundant-solid-color-pngs.md]] (planned)
- Encoder capability: `supportsImageTint` in
  [[docs/renderer-capabilities.md]] gates whether we need only white
  or a family of tinted white textures per abstract color.
