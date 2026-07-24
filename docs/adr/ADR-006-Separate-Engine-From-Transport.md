---
title: ADR-006 Separate Engine From Transport
type: decision
status: accepted
date: 2026-07-24
tags: [adr, architecture, engine, transport, render-model]
---

# ADR-006 · Separate Engine from Transport

## Context

The addon has grown from "build a breaker box" into a reusable
visualization engine. Multiple future devices (camera consoles, fire
panels, HVAC interfaces, debugging tools) will consume the same
architectural blueprint and produce their own overlays. Multiple future
transports (JSON-UI ActionForm today; DDUI, NPC Dialog, custom screens,
web debug viewers tomorrow) may render those overlays.

Coupling engine code to any one transport's constraints — such as
"ActionForms can't do dynamic per-item positioning" (ADR-005) — would
strand the engine when a better transport arrives.

## Decision

Formalize a strict five-layer pipeline. Each layer knows only the layer
above it. The Render Model is the load-bearing contract that separates
engine from transport.

```
┌────────────────────────────────────────────────┐
│  Blueprint          persistent architecture    │
├────────────────────────────────────────────────┤
│  Geometry Engine    pure math on architecture  │
├────────────────────────────────────────────────┤
│  Device Renderer    which primitives exist for │
│                     THIS device                │
├────────────────────────────────────────────────┤
│  Render Model       transport-agnostic         │
│                     geometry contract          │
├────────────────────────────────────────────────┤
│  Transport Encoder  consumes RendererCapabilities;
│                     emits the target UI's data │
├────────────────────────────────────────────────┤
│  UI Transport       ActionForm today; DDUI /   │
│                     NPC / custom / web later   │
└────────────────────────────────────────────────┘
```

Rules:

- **The Render Model is transport-agnostic.** It may not contain JSON-UI
  bindings, button indices, texture names, collection names, slot IDs,
  or any transport-specific encoding.
- **A new device is a new Renderer**, not a rewrite. Fire panel =
  `FirePanelRenderer` consuming the same geometry and producing its
  own Render Model.
- **A new transport is a new Encoder**, not a rewrite. DDUI transport
  = `DduiEncoder` consuming the same Render Model and producing DDUI
  data.
- **Transport constraints do not leak upward.** If the current transport
  can't do dynamic per-item positioning (ADR-005), that is recorded on
  the encoder's `RendererCapabilities` and the Renderer adapts. The
  Render Model does not shrink to fit.

## Contracts

- [[docs/render-model.md]] — geometric primitives (RenderWall,
  RenderBreaker, RenderLabel, RenderIcon, RenderPolygon).
- [[docs/renderer-capabilities.md]] — what an encoder promises to
  render and at what capacity.

## Consequences

- **Positive**: engine outlives transport. Every verified pattern for
  one transport (e.g. Skyls' `long_form` chrome for ActionForm) can be
  recorded in its own transport-scoped Verified page without
  contaminating the engine.
- **Positive**: rejected patterns become transport-scoped too. Path A
  is rejected for ActionForm (ADR-005), not for the engine — the
  renderer remains capable if a future transport supports it.
- **Positive**: parallel encoders are trivial to add. A debug
  `DebugAsciiEncoder` and a production `JsonUiEncoder` can consume the
  same Render Model side-by-side today.
- **Negative**: additional layer to enforce. Reviews must reject any PR
  where transport data (button indices, textures) leaks into the Render
  Model or the Renderer.

## Enforcement

- Renderer files may not `import` from encoder or transport files.
- Render Model type shapes (typedefs in `renderModel.js`) may not
  reference `@minecraft/server-ui` or any texture path constant.
- Encoders read Render Model + RendererCapabilities only. They do not
  request additional data from the Renderer.

## Related

- ADR-001 (Vector Renderer) — the "what the renderer produces"
  decision this ADR structurally supports.
- ADR-002 (Shared Blueprint, Separate Device Overlays) — the device-side
  parallel: one blueprint, many renderers.
- ADR-005 (Path A rejected for current transport) — the first
  transport-scoped rejection this ADR's separation makes safe to record.
