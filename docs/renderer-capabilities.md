---
title: RendererCapabilities Contract
type: contract
status: authoritative
tags: [engine, capabilities, contract, transport]
adr: [ADR-006]
---

# RendererCapabilities Contract

`RendererCapabilities` is the reverse contract of the Render Model:
the encoder tells the renderer what it can and cannot draw, so the
renderer adapts before producing a model rather than the encoder
truncating silently.

Per ADR-006, transport constraints must **never** leak upward into
engine logic. This object is the sanctioned channel.

## Non-negotiable rules

- No file above the Encoder layer imports transport-specific constants.
  Every capacity and feature flag comes from `RendererCapabilities`.
- The renderer may consult capabilities to make placement or
  simplification choices. It may not consult transport internals.
- If geometry exceeds an advertised capacity, the encoder must fail
  loudly (raise a warning on the Render Model, refuse to draw, or
  both) — never silently truncate. See
  Performance-and-Troubleshooting.md.

## Shape

```js
/**
 * @typedef {Object} RendererCapabilities
 *
 * @property {number} maxWalls
 *   Hard ceiling on RenderWall count the encoder can transport.
 *
 * @property {number} maxBreakers
 *   Ceiling on RenderBreaker count.
 *
 * @property {number} maxIcons
 *   Ceiling on RenderIcon count.
 *
 * @property {number} maxLabels
 *   Ceiling on RenderLabel count.
 *
 * @property {number} maxPolygons
 *   Ceiling on RenderPolygon count.
 *
 * @property {number} viewportWidthPx
 *   The viewport size the encoder can host. Renderer scales its
 *   world→viewport transform to fit.
 * @property {number} viewportHeightPx
 *
 * @property {boolean} supportsPerItemOffsetBinding
 *   Whether each interactive item can have its position bound to a
 *   runtime-derived value. False for ActionForm today (ADR-005).
 *
 * @property {boolean} supportsPerItemSizeBinding
 *   Whether each item's size can be runtime-bound. False for
 *   ActionForm today (assumed by extension of ADR-005; untested).
 *
 * @property {boolean} supportsImageTint
 *   Whether the encoder can tint a base texture via a color property,
 *   letting one texture serve multiple abstract colors.
 *
 * @property {boolean} supportsClipping
 *   Whether items whose viewport rect exceeds the viewport are clipped
 *   cleanly. If false, the renderer must cull instead.
 *
 * @property {boolean} supportsTextLabels
 *   Whether text labels can be rendered at all in this transport.
 *
 * @property {boolean} supportsHoverTooltip
 *   Whether interactive items can present a hover tooltip from their
 *   `label` field. False for ActionForm today (untested; assumed
 *   absent).
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
if (!caps.supportsTextLabels) {
  model.labels = [];
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

| Encoder | Layout | maxWalls | maxBreakers | perItemOffset | Tint |
|---|---|---|---|---|---|
| `JsonUiEncoder` (ActionForm) | fixed pool | TBD (see below) | ~20 | **false** | untested |
| `DebugAsciiEncoder` | none | Infinity | Infinity | n/a | n/a |

`maxWalls` for the ActionForm layout is empirically determined during
Renderer Migration Plan Phase 2. The current 24×18 = 432-cell grid is
an over-provisioned proxy pending the real slot pool.

## Enforcement

- The renderer accepts a `RendererCapabilities` argument. It never
  imports encoder or transport files.
- The encoder's capabilities are a plain object — no methods, no state.
  Reproducible across process boundaries.
