---
title: ADR-007 Deterministic Rendering
type: decision
status: draft
date: 2026-07-24
promotes_after: runtime stabilization (post 16x12 optimization milestone)
tags: [adr, render-model, determinism, engine]
---

# ADR-007 · Deterministic Rendering

## Status

**Draft.** Formalizes a rule the engine has been following implicitly.
Promoted to `accepted` after the current runtime optimization
milestone stabilizes.

## Context

The Render Model contract ([[docs/render-model.md]]) already forbids
transport-specific data. That prohibition is necessary but not
sufficient. A model that is transport-agnostic can still be
non-reproducible if generation logic depends on wall-clock time,
random number sources, iteration order of unordered collections, or
session-scoped counters that vary between runs.

Reproducibility is required to:

- Compare two encoders' output against the same source of truth
- Attribute regressions to a specific input change, never to
  "something ran differently this time"
- Enable snapshot testing of Render Models in isolation
- Support future web / debug visualizers that consume the same model
  and must show the same picture

## Decision

Render Model generation shall be **deterministic** and **transport
independent**.

- **Deterministic**: given identical Blueprint, Device State, and
  RendererCapabilities, the Render Model is bit-for-bit identical
  across runs, sessions, and clients.
- **Transport independent**: only Transport Encoders may introduce
  transport-specific behavior. Neither the Geometry Engine nor the
  Device Renderer may reach the transport layer.

## Rules

Prohibited in the Blueprint → Geometry Engine → Device Renderer → Render
Model pipeline:

1. `Date.now()`, `new Date()`, `system.currentTick`, or any wall-clock
   source.
2. `Math.random()` or any non-seeded random source.
3. Iteration over `Set` / `Map` where insertion order isn't the
   deterministic sort order used by downstream consumers. When
   ordering matters, sort explicitly.
4. Session-scoped counters (`Symbol()`, auto-incrementing IDs based on
   process state).
5. Reads from any dynamic property or storage that isn't part of the
   declared Blueprint or Device State inputs.
6. Any conditional on `RendererCapabilities` that produces different
   *content* rather than different *selection* (see below).

Permitted:

- Consulting `RendererCapabilities` to include or exclude Render Model
  primitives (e.g. `if (caps.supportsRuntimeLabels) model.labels = …`).
  This is deterministic because caps are declared, not measured.
- Consulting `RendererCapabilities.maxWalls` to trigger
  Geometry Engine simplification. The chosen simplification algorithm
  must itself be deterministic (stable sort, canonical winner).

## Enforcement

- Code review: any PR introducing one of the prohibited sources in
  the pipeline is a violation.
- Testing (planned): a snapshot test runs the pipeline twice on the
  same inputs and asserts equal Render Models.
- Metrics (planned): pipeline timing may sample wall clock but must
  never *return* a wall-clock value that feeds the model.

## Consequences

- Positive: model diffs are always attributable. Regression debugging
  becomes trivial when the source is deterministic.
- Positive: Render Models are portable — a debug web viewer can
  consume the same model produced on-device.
- Positive: snapshot storage becomes a straightforward hash of inputs.
- Negative: existing code that reaches for `system.currentTick` or
  similar during model generation must be refactored. Pipeline stages
  that need timing collect it *around* the pipeline (metrics module),
  not *inside* it.

## Related

- ADR-006 (Separate Engine from Transport) — this ADR extends the
  same discipline from "no transport data in the model" to "no
  non-deterministic data anywhere in the pipeline".
- [[docs/render-model.md]] — the contract this ADR reinforces.
- [[docs/renderer-capabilities.md]] — the sanctioned channel for
  transport-influenced content selection.
