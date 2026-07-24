# Project Documentation Index

Living documentation. Parallel to the Knowledge Vault; every page is
paste-ready for vault promotion.

## Architecture

- [architecture.md](./architecture.md) — 5-layer pipeline
  (Blueprint → Geometry Engine → Device Renderer → Render Model →
  Transport Encoder → UI). Simplify stage added per GPT review.
- [render-model.md](./render-model.md) — transport-agnostic Render
  Model contract. Primitives (RenderWall, RenderBreaker, RenderIcon,
  RenderLabel, RenderPolygon). Non-negotiable rules.
- [renderer-capabilities.md](./renderer-capabilities.md) —
  RendererCapabilities engine contract. Encoder advertises; renderer
  adapts.

## Architectural Decisions

- [adr/ADR-005-Path-A-Rejected-For-Current-Transport.md](./adr/ADR-005-Path-A-Rejected-For-Current-Transport.md)
  — dynamic per-item positioning rejected for the ActionForm +
  long_form + main_panel_no_buttons transport. Scoped, not universal.
- [adr/ADR-006-Separate-Engine-From-Transport.md](./adr/ADR-006-Separate-Engine-From-Transport.md)
  — five-layer separation formalized. Render Model is
  transport-agnostic. Transport constraints reach the renderer only
  through RendererCapabilities.

(ADR-001…ADR-004 remain in the Knowledge Vault; move if desired.)

## Verified

Three classes ([verified/README.md](./verified/README.md)):

**Architecture** (long-term design decisions) — currently held in ADRs

**Implementation** (working techniques on device)
- [verified/implementation/textures-ui-white.md](./verified/implementation/textures-ui-white.md)
- [verified/implementation/skyls-long-form-chrome.md](./verified/implementation/skyls-long-form-chrome.md)
- [verified/implementation/form-button-texture-bindings.md](./verified/implementation/form-button-texture-bindings.md)

**Research** (observed engine behavior)
- [verified/research/actionform-transport-limitations.md](./verified/research/actionform-transport-limitations.md)

## Rejected Patterns

- [rejected/dynamic-per-item-offset-binding.md](./rejected/dynamic-per-item-offset-binding.md)
- [rejected/light-content-button-base.md](./rejected/light-content-button-base.md)
- [rejected/panel-with-collection-name.md](./rejected/panel-with-collection-name.md)
- [rejected/inline-arithmetic-in-offset.md](./rejected/inline-arithmetic-in-offset.md)
- [rejected/dense-raster-grid-for-panel-ui.md](./rejected/dense-raster-grid-for-panel-ui.md)

## Lessons Learned

- [lessons-learned/README.md](./lessons-learned/README.md) — template
- [lessons-learned/2026-07-24-transport-vs-engine.md](./lessons-learned/2026-07-24-transport-vs-engine.md)

## Working docs

- [phase-0-inventory.md](./phase-0-inventory.md) — KEEP / MODIFY /
  REPLACE / DELETE LATER / UNKNOWN classification of every source file
- [gpt-report-2026-07-24.md](./gpt-report-2026-07-24.md) —
  engineering status report submitted to GPT prior to this
  vault-upgrade turn
- [phase-a-plan.md](./phase-a-plan.md) — superseded (DELETE LATER)

## Scoping convention

Every ADR, Verified, and Rejected page carries a `scope` in its
front-matter. Valid values:

- `engine` — universal Bedrock behavior
- `transport: <name>` — a specific transport chain
- `chrome: <name>` — a specific chrome path within a transport
- `engine_version: <ver>` — bound to a specific engine version

If the scope isn't obvious from the finding, [ADR-006](./adr/ADR-006-Separate-Engine-From-Transport.md)
and the [transport-vs-engine lesson](./lessons-learned/2026-07-24-transport-vs-engine.md)
explain why we insist on it.
