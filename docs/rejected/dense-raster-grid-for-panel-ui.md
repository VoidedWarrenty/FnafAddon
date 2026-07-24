---
title: Dense raster grid (24x18 = 432 buttons) as electrical panel UI
type: rejected-pattern
status: rejected-superseded
rejected_on: 2026-07-24
successor: Path B fixed pool (walls + breakers only, no empty background cells)
scope: transport encoder for breaker box
confidence: verified
tags: [renderer, ui, grid, path-b, rejected]
---

# Rejected: 24×18 raster grid as electrical panel UI

## What we shipped

A grid transport where every world cell was represented by an
interactive ActionForm button, texture-mapped to wall / floor / door /
breaker / transparent per-cell. 24 columns × 18 rows = **432 buttons**.

## Why it should not survive

- **Violates the vault's non-negotiable rule**: "walls are images,
  breakers are buttons — blank map cells are not interactive"
  ([[docs/verified/architecture/renderer-rules.md]] — planned page).
- **Open latency is noticeable on iPad** at 400+ buttons; the demo we
  reproduced showed no such delay because it uses long-run wall images
  and few interactive icons, not one button per cell.
- **Scales poorly**: Pizza-Plex-sized buildings require higher
  fidelity than the grid can provide within the button budget the
  transport allows.

## What replaces it (Path B, ADR-005)

A **fixed pre-positioned pool** of:
- N wall-image slots (target: 100–200; empirically determined during
  Renderer Migration Plan Phase 2)
- M breaker-button slots (target: 20–40)

The encoder picks which slots render per building; unused slots hide.
Blank background is a single black rectangle, not 432 individual
transparent cells.

## Migration

The grid stays as a working baseline while the Path B encoder is
built (parallel encoder pattern per ADR-006). Old grid deletes once
the Path B encoder passes the Test Plan.

Intermediate resolution history:

- **432 buttons (24×18)** — original density that inspired the
  rejection. Currently active; provides enough per-room detail on
  small/medium buildings.
- **192 buttons (16×12)** — briefly shipped 2026-07-24 as a
  perf-first milestone; reverted after device testing showed narrow
  halls collapsed to indistinguishable blobs. Kept in vault as
  Lessons Learned: pixel budget × building density is bounded by
  the number of rooms, not the button count.

The **destination** is not any of these numbers — it's a fixed pool
of wall + breaker slots where the button count is bounded by the
number of rooms, not the raster resolution. That work happens after
the Path B encoder lands.

## Cross-check

Transport-scoped rejection. The grid **shape** (raster) is an engine
concept the Geometry layer still uses for room detection — that's
fine. What's rejected is exposing the raster grid as the **transport
representation** of the map.
