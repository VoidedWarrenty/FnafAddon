---
title: ADR-005 Path A Rejected For Current Transport
type: decision
status: accepted
date: 2026-07-24
supersedes: none
scope: transport
tags: [adr, json-ui, transport, path-a, actionform]
---

# ADR-005 · Path A rejected **for the current transport**

## Scope

This ADR rejects dynamic per-collection-item positioning **for the
following transport only**:

> `@minecraft/server-ui` `ActionFormData` → JSON-UI override of
> `server_form.long_form` → `common_dialogs.main_panel_no_buttons`
> chrome → per-item `stack_panel` / `grid` collection iteration.

The rejection applies to that transport chain. It says nothing about:

- JSON-UI as a whole
- DDUI
- NPC Dialog UI
- Custom screens authored outside `server_form`
- Future Bedrock engine versions
- Alternate transports we have not tested

The rejection is a **transport limitation**, not an **engine limitation**.
The renderer must remain capable of driving a transport that can do
per-item runtime positioning if we ever add one.

## Context

The Renderer Migration Plan (Renderer-Migration-Plan.md) requires
choosing between two implementation paths:

- **Path A** — bindable per-item geometry. One JSON-UI template + N
  collection iterations, each with `offset` and `size` bound to
  runtime-derived values.
- **Path B** — fixed pre-positioned pool. JSON-UI predeclares slots
  at hardcoded offsets/sizes; script picks which slots render.

Path A is dramatically cleaner if the target transport supports it.

## Experiment evidence

Three Path A syntax variants ran on device against the transport chain
in scope. Full data in
[[docs/rejected/dynamic-per-item-offset-binding.md]].

| Variant | Mechanism | Outcome |
|---|---|---|
| U1a | `view` binding writes local `#slot_x`; `offset` reads `#slot_x` | Silent bind failure — all slots at `x=0` |
| U1b | `property_bag: {"#slot_x": "(#collection_index * 30)"}` | Fatal parse crash: `Dangling number (no % or px in Size)` at `inside_header_panel/slot`, entire `server_form.json` namespace failed to load |
| U1c | `view` binding targeting magic `#offset_x` | Same fatal parse crash |

Bedrock version: `@minecraft/server 1.11.0`, engine 1.21+, iPad client.

## Root cause hypothesis

`common_dialogs.main_panel_no_buttons` inlines its `$child_control` into
`inside_header_panel/slot`. That slot's size/offset must resolve at
chrome-inflation time. When the child template's geometry depends on
per-iteration `#collection_index`, the resolver cannot compute a
concrete value at inflation time and fails at the chrome layer, not at
the binding layer.

This is a specific interaction between our chosen chrome wrapper and
per-item binding scope. A different transport (e.g. one that doesn't
route through `main_panel_no_buttons`) may not have the same failure
mode.

## Decision

For the transport in scope, the renderer commits to Path B:
JSON-UI predeclares N wall slots + M breaker slots at hardcoded
offsets and sizes; the encoder picks which slots render per building
via `#visible` bindings and per-slot texture assignment.

The encoder must advertise its capabilities
([[docs/renderer-capabilities.md]]) so the renderer can adapt to any
transport-imposed slot budget.

## Consequences

- **Renderer**: continues to produce a transport-agnostic
  [[docs/render-model.md]]. The Render Model itself is not affected by
  this decision.
- **Encoder**: must implement the fixed-pool strategy for the
  ActionForm transport. May implement Path A for future transports
  where the capability is verified.
- **RendererCapabilities**: `supportsPerItemOffsetBinding` and
  `supportsPerItemSizeBinding` are advertised as `false` for the
  ActionForm encoder.
- **Building fit**: geometry that exceeds the active pool must fail
  loudly, never silently truncate. Per
  Performance-and-Troubleshooting.md.

## Open follow-ups

Recorded in [[docs/verified/research/actionform-transport-limitations.md]]:

- Whether an intermediate wrapping element between
  `main_panel_no_buttons/slot` and our canvas would rescue Path A
- Whether `size` (rather than `offset`) can bind to runtime values in
  the same collection scope
- Whether NPC Dialog UI supports per-item positioning
- Whether Bedrock version bumps ever expose new binding sources

These are not blockers. The renderer works on Path B; Path A remains
a future encoder capability.
