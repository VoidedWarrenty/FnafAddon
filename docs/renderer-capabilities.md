---
title: RendererCapabilities Contract
type: contract
status: authoritative
tags: [engine, capabilities, contract, transport]
adr: [ADR-006]
---

# RendererCapabilities Contract

`RendererCapabilities` is the reverse contract of the Render Model:
the encoder declares what it **can** draw, so the renderer adapts
before producing a model rather than the encoder truncating silently.

Per ADR-006, transport constraints must **never** leak upward into
engine logic. This object is the sanctioned channel.

## Framing

Capabilities are described **positively**. A flag names what a
transport supports, never what it lacks. This lets future transports
add richer capabilities without redesigning the interface, and lets a
renderer adapt by enabling optional pathways when they're available.

A missing capability is expressed by the absence of the flag or the
flag being `false`. There is no "unsupported" or "cannot" naming in
the contract.

## Non-negotiable rules

- No file above the Encoder layer imports transport-specific constants.
  Every capacity and feature flag comes from `RendererCapabilities`.
- The renderer may consult capabilities to make placement or
  simplification choices. It may not consult transport internals.
- If geometry exceeds an advertised capacity, the encoder must fail
  loudly (raise a warning on the Render Model, refuse to draw, or
  both) — never silently truncate.

## Shape

```js
/**
 * @typedef {Object} RendererCapabilities
 *
 * ==== Capabilities (positive framing) ====
 *
 * @property {boolean} supportsDynamicPositioning
 *   Per-item runtime offset. When true, encoders can place items at
 *   arbitrary computed positions. When false, the renderer uses a
 *   fixed-slot pool at pre-declared positions.
 *
 * @property {boolean} supportsDynamicSizing
 *   Per-item runtime size. When true, item dimensions may vary
 *   independently per instance.
 *
 * @property {boolean} supportsColorTint
 *   Encoder can tint a base texture via a color property, letting one
 *   texture serve multiple abstract colors.
 *
 * @property {boolean} supportsLayeredImages
 *   Encoder can composite multiple images per item with independent
 *   layer ordering.
 *
 * @property {boolean} supportsRuntimeLabels
 *   Encoder can render text labels whose content is bound to
 *   Render Model data at open time.
 *
 * @property {boolean} supportsHoverTooltips
 *   Interactive items can present a hover tooltip drawn from their
 *   `label` field.
 *
 * @property {boolean} supportsClipping
 *   Items whose viewport rect exceeds the viewport are clipped
 *   cleanly by the encoder (renderer does not need to cull).
 *
 * @property {boolean} supportsPolygonFill
 *   Encoder can fill an arbitrary polygon (as opposed to only
 *   axis-aligned rectangles).
 *
 * ==== Capacities ====
 *
 * @property {number} maxWalls
 * @property {number} maxBreakers
 * @property {number} maxIcons
 * @property {number} maxLabels
 * @property {number} maxPolygons
 *
 * ==== Viewport ====
 *
 * @property {number} viewportWidthPx
 * @property {number} viewportHeightPx
 */
```

## Usage

**Renderer side.** Before producing a Render Model, the Device Renderer
inspects the capabilities and adapts:

```js
if (walls.length > caps.maxWalls) {
  simplifyGeometry(walls, caps.maxWalls);
  model.warnings.push(`Simplified from ${walls.length} to ${caps.maxWalls} walls`);
}
if (caps.supportsRuntimeLabels) {
  model.labels = buildRoomLabels(rooms);
}
if (!caps.supportsPolygonFill) {
  model.polygons = [];   // renderer chose not to build any if fills won't render
}
```

**Encoder side.** The encoder is the authoritative source of its own
capabilities. It ships a `getCapabilities()` function called by the
device before rendering.

## Multiple layouts

An encoder may advertise **different** capabilities for different
layouts. Example: a JSON-UI ActionForm encoder might ship three named
layouts — Small, Medium, Large — each with its own slot pool:

```
JsonUiEncoder.layouts.small  → maxWalls:  60, viewport: [200, 150]
JsonUiEncoder.layouts.medium → maxWalls: 120, viewport: [280, 210]
JsonUiEncoder.layouts.large  → maxWalls: 200, viewport: [340, 260]
```

The Renderer or the Device chooses a layout by measuring the source
geometry against each layout's caps before rendering.

## Current implementations (planned)

Values inferred from Verified Research
[[docs/verified/research/actionform-transport-limitations.md]]:

| Encoder | Layout | maxWalls | maxBreakers | supportsDynamicPositioning | supportsColorTint |
|---|---|---|---|---|---|
| `JsonUiEncoder` (ActionForm) | fixed pool | TBD (Phase 2) | ~20 | **false** | untested |
| `DebugAsciiEncoder` | none | Infinity | Infinity | true (trivially) | n/a |

`maxWalls` for the ActionForm layout is empirically determined during
Renderer Migration Plan Phase 2. The current 16×12 = 192-cell grid
after the 2026-07-24 optimization milestone is an over-provisioned
proxy pending the real slot pool.

## Enforcement

- The renderer accepts a `RendererCapabilities` argument. It never
  imports encoder or transport files.
- The encoder's capabilities are a plain data object — no methods, no
  hidden state. Reproducible across process boundaries.

## Related

- [[docs/render-model.md]] — the forward contract this reverses.
- [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]] —
  the first transport-scoped finding expressed as a
  `supportsDynamicPositioning: false` in the ActionForm encoder.
- [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]] — the
  separation this contract structurally enforces.
