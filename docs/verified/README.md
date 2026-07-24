# Verified Knowledge

Three classes of verified knowledge, each with different lifetime and
different reasons to trust it.

## Architecture

Long-term design decisions we intend to keep across major rewrites.

Examples: "circuits are not rooms" (ADR-003), "shared blueprint, per-device overlays" (ADR-002).

Move to `verified/architecture/` when an ADR reaches `status: accepted`.

## Implementation

Known-working implementation techniques verified on device against a
specific engine version.

Examples: `textures/ui/White` renders as a live stock texture; Skyls'
`long_form` + `common_dialogs.main_panel_no_buttons` chrome pattern
produces native ActionForm chrome around a custom canvas.

Move to `verified/implementation/` after a device screenshot confirms
the technique. Each page must state the engine version tested and the
scope (transport, block context, etc.).

## Research

Observed engine behavior — often a limitation or capability we probed
but did not put into production.

Examples: "ActionForm transport cannot dynamically bind per-item
offsets" (from the U1 experiments). "textures/ui/White exists but
its tint via `color` property is untested."

Move to `verified/research/` when we have evidence but no ready
implementation depends on it, or when we've probed a boundary of the
engine.

Research findings feed into Rejected Patterns (when a technique is
declared unusable for a given transport) and into ADRs (when they
change how the engine or transport layer is scoped).

## Confidence

Every Verified and Rejected page carries a `confidence:` field in its
front-matter, drawn from a four-value taxonomy:

- `verified` — Reproducibly observed on device against a specific
  engine version. Claims are bound to the tested surface.
- `likely` — Strongly evidenced (matching community reports, cross-tool
  observations, prior successful analogues) but not yet reproduced in
  a first-party experiment.
- `hypothesis` — Untested; recorded because it is worth eventually
  probing. Never load-bearing for a shipping decision.
- `deprecated` — Was verified against a previous engine/transport; the
  underlying surface has moved and the claim no longer applies. Kept
  for history; superseded by a linked replacement.

Confidence lets a future discovery supersede an earlier assumption
without deleting the history: promote the earlier page to
`deprecated`, link the successor, and record the delta as a
Lesson Learned.
