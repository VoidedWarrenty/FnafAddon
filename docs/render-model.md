---
title: Render Model Contract
type: contract
status: authoritative
tags: [engine, render-model, contract, transport-agnostic]
adr: [ADR-006]
---

# Render Model Contract

The Render Model is the load-bearing contract between the engine
(Blueprint → Geometry Engine → Device Renderer) and the transport
(Encoder → UI backend). Per ADR-006, it is strictly transport-agnostic.

## Non-negotiable rules

The Render Model **may not** contain any of:

- JSON-UI binding names
- Button indices or collection scope references
- Texture paths or texture file identifiers
- JSON-UI slot IDs, collection names, or template identifiers
- Any transport-specific encoding

The Render Model **may only** contain:

- Geometric primitives in the renderer's target coordinate space
- Semantic identifiers (stable IDs for callbacks, human-readable labels)
- Colors and other **abstract** appearance hints (never as texture paths)
- Warnings and diagnostics from the renderer

If a transport encoder needs additional data, it derives that data from
the Render Model plus its `RendererCapabilities`. It does not request
new fields be added to the Render Model.

## Coordinate space

The Render Model uses a **viewport coordinate space** defined by the
Renderer. Origin at top-left. Units are abstract pixels; the encoder
maps them onto the target UI's coordinate system.

```js
/**
 * @typedef {Object} Viewport
 * @property {number} width  - abstract pixels
 * @property {number} height - abstract pixels
 */
```

The Renderer decides the viewport dimensions based on the geometry it
receives. The encoder scales or clips as its transport requires.

## Primitives

```js
/**
 * A rectangular wall segment.
 * @typedef {Object} RenderWall
 * @property {number} x        - top-left X in viewport space
 * @property {number} y        - top-left Y in viewport space
 * @property {number} w        - width
 * @property {number} h        - height
 * @property {string=} color   - abstract color name; encoder may map
 *                               to texture, tint, or hex. Never a path.
 */

/**
 * A breaker control point. Encoders render as interactive.
 * @typedef {Object} RenderBreaker
 * @property {string} id       - stable identity for callbacks
 * @property {number} x
 * @property {number} y
 * @property {"on"|"off"|"tripped"} state
 * @property {string} label    - human-readable
 */

/**
 * A non-breaker interactive icon (camera, detector, valve, …).
 * @typedef {Object} RenderIcon
 * @property {string} id
 * @property {string} kind     - abstract kind, e.g. "camera",
 *                               "smoke_detector". Encoder maps to
 *                               transport-specific texture or icon.
 * @property {number} x
 * @property {number} y
 * @property {string=} state
 * @property {string=} label
 */

/**
 * A text label positioned at a point.
 * @typedef {Object} RenderLabel
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {"small"|"medium"|"large"=} weight
 */

/**
 * A closed polygon for filled or stroked regions.
 * @typedef {Object} RenderPolygon
 * @property {[number, number][]} points
 * @property {string=} fill
 * @property {string=} stroke
 */

/**
 * The full model handed to a transport encoder.
 * @typedef {Object} RenderModel
 * @property {Viewport} viewport
 * @property {RenderWall[]}    walls
 * @property {RenderBreaker[]} breakers
 * @property {RenderIcon[]}    icons
 * @property {RenderLabel[]}   labels
 * @property {RenderPolygon[]} polygons
 * @property {string[]}        warnings
 */
```

Fields not used by a given device renderer stay as empty arrays. The
order of arrays hints at intended layer order (background → walls →
polygons → labels → interactive) but the encoder owns final rendering
order.

## Colors

Colors are **abstract identifiers**, not texture paths or hex values.

```
"wall"           — architectural wall
"door"           — doorway break
"floor"          — room interior fill
"breaker_on"     — energized breaker indicator
"breaker_off"    — de-energized breaker indicator
"camera_active"  — camera indicator
"warning"        — highlight for warnings
```

The encoder maps each identifier to a transport-specific resource
(a texture, a tint, a hex value). New identifiers are added by
convention; there is no closed enum.

## Warnings

The Renderer surfaces render-time concerns (e.g. "room #5 has no
interior point; breaker placed at fallback centroid"). Encoders may
render warnings or ignore them, but must never suppress the underlying
model.

## Enforcement

- `renderModel.js` (planned) contains only these typedefs and factory
  helpers. It imports nothing from `@minecraft/server*`.
- CI-equivalent (code review): a PR that adds a texture path or
  JSON-UI binding to any Render Model type is a violation of ADR-006.
