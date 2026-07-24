---
title: Don't reject engine capabilities based on transport limitations
type: lesson-learned
date: 2026-07-24
confidence: verified
tags: [architecture, transport, engine, scope, judgment]
---

# Lesson: don't reject engine capabilities based on transport limitations

## What we expected

The U1 experiments were framed as: "Can Bedrock JSON-UI do dynamic
per-item positioning?" When U1a failed silently and U1b/U1c crashed the
file, the first framing of the finding was:

> Path A is dead. Bedrock cannot bind per-item offsets. Go Path B.

The engineering report to the reviewer opened with:

> **Path A (per-collection-item runtime `offset` / `size` binding) is
> rejected.**

That framing globalized a specific-transport observation.

## What actually happened

The reviewer immediately pushed back:

> I agree that Path A is rejected for the current transport. I do NOT
> agree that it should be rejected as a universal renderer capability.
> Our experiments only prove limitations of the current transport.

The reviewer was correct. Every one of our three failures was inside
`common_dialogs.main_panel_no_buttons` chrome, specifically at its
`inside_header_panel/slot` inflation step. That chrome layer is one
transport surface — not the entirety of Bedrock JSON-UI, not DDUI, not
NPC Dialog, not future engine versions.

## Why the assumption was wrong

We had built one transport (long_form + main_panel_no_buttons chrome)
and treated its limits as engine truths. The wrong mental model:

```
JSON-UI == our chrome path
Failure at our chrome path == JSON-UI failure
```

The right mental model:

```
JSON-UI is a language
Our chrome path is one dialect
Failure in our dialect proves nothing about other dialects
```

Any Bedrock addon that renders through a different chrome (or no
chrome at all — a fully custom screen) may have entirely different
binding behavior. Every finding is scoped to the surface where it was
observed.

## How we adapted

**Immediate:**

1. Rewrote ADR-005 to scope the rejection to the current transport
   only. See
   [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]].
2. Wrote ADR-006 to formalize the engine/transport separation. See
   [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]].
3. Every rejected-pattern page now names its scope in front-matter
   (`scope:` field) as `engine`, `transport: <name>`, or `chrome: <name>`.
4. Every verified-implementation page now names its scope the same
   way, with the engine version tested.
5. Every research finding lands in `verified/research/` with explicit
   cross-transport hypotheses listed.

**Durable process rule:**

> Before promoting a finding to "rejected as impossible," ask
> what surface the failure was observed on. If we tested one chrome
> path, one transport, or one engine version, the rejection is scoped
> to that surface.

That rule lives in the vault's operating procedure via this page and
the ADR-006 enforcement notes.

## Related

- [[docs/adr/ADR-005-Path-A-Rejected-For-Current-Transport.md]]
- [[docs/adr/ADR-006-Separate-Engine-From-Transport.md]]
- [[docs/verified/research/actionform-transport-limitations.md]]
- [[docs/renderer-capabilities.md]] — the sanctioned channel for
  transport constraints to reach the renderer without leaking upward
