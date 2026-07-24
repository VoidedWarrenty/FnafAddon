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
