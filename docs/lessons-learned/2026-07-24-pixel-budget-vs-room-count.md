---
title: A grid's usable resolution is bounded by rooms, not by cells
type: lesson-learned
date: 2026-07-24
confidence: verified
tags: [renderer, grid, resolution, path-b, judgment]
---

# Lesson: a grid's usable resolution is bounded by rooms, not by cells

## What we expected

Optimizing the electrical panel from 432 to 192 buttons (24×18 → 16×12)
was framed as a straightforward perf win. The vault recorded it as an
"optimization milestone" per GPT approval. The reasoning:

> Fewer buttons → faster open on iPad. Building geometry remains the
> same; each room still gets its share of cells.

That reasoning treats "cells per building" as the meaningful metric.

## What actually happened

On device, applying a blueprint with west + east halls flanking an
office produced a floor plan that was unreadable:

- Adjacent narrow rooms merged into a single amorphous blob
- Multiple detected rooms rendered as one visual mass
- Breakers placed in tiny 1×1 room-cells were invisible behind their
  own wall pixels

At 16×12 across a ~10×15 world-block building, each cell covers
0.6–0.9 world blocks. A 3-block-wide hall becomes 3–4 pixels wide;
adjacent to an interior wall (1 block = 1 pixel), the whole thing
degrades to two barely-distinguishable stripes.

## Why the assumption was wrong

The correct metric is **cells per room**, not cells per building.

- A single-room map at 16×12 (192 cells / 1 room = 192 cells/room):
  ample.
- A 6-room map at 16×12 (192 cells / 6 rooms ≈ 32 cells/room = ~5×6
  each): tight but usable.
- A 10-room map with narrow halls at 16×12 (192 cells / 10 rooms ≈ 19
  cells/room = ~4×5 each): rooms fold into each other.

The threshold isn't linear. Below roughly **20 cells per detected
room**, human legibility falls off a cliff. Rooms visually merge and
breaker placement can't find an interior cell far enough from any
wall.

Compounding factor: buildings with mixed room sizes (a small office
next to a large stage) suffer even at high total cell counts because
the small rooms round to nothing while the large rooms have cells to
spare.

## How we adapted

**Immediate**

Reverted GRID_W/H to 24×18. Not "the answer" — a working middle that
gives ~20-40 cells per room for typical FNAF-scale buildings. Recorded
the resolution history in
[[docs/rejected/dense-raster-grid-for-panel-ui.md]] so future
engineers see the pixel-budget arc.

**Durable rule now recorded**

Any raster-grid encoder must be sized against **the tightest room in
the blueprint**, not the building bbox. A minimum floor is:

> Each detected room should occupy at least ~20 grid cells and be at
> least 3 cells wide on its shortest axis.

Below either threshold, the encoder should either bump grid
resolution (up to the transport's capacity ceiling) or refuse to
render with a diagnostic on the Render Model's `warnings[]`.

**Follow-up (architectural)**

Multiple named layouts on the encoder (per
[[docs/renderer-capabilities.md]]): small/medium/large/xl grid
variants. Server measures the tightest room and picks the smallest
layout that still meets the pixel-per-room floor. Encoder advertises
each layout's `maxWalls`/`viewport` in `RendererCapabilities`.

**Destination**

The real fix is Path B implemented properly: a fixed pool of wall
image slots + separate breaker button slots, where the count is
bounded by the number of rooms, not by raster resolution. Then pixel
budget is a per-room concern only for the FILL, and interactive
placement is decoupled entirely.

## Related

- [[docs/rejected/dense-raster-grid-for-panel-ui.md]] — resolution
  history entry.
- [[docs/renderer-capabilities.md]] — the "multiple layouts" pattern
  this problem justifies.
- [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]] — grid
  resolution is a transport concern, not an engine one; the
  renderer's job is to expose `warnings[]` when a building can't fit
  the current layout.
