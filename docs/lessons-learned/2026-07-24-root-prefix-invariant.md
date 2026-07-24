---
title: A root prefix that hides fallback IS an invariant, not a convention
type: lesson-learned
date: 2026-07-24
confidence: verified
tags: [json-ui, title-gating, invariant, judgment]
---

# Lesson: a root prefix that hides fallback IS an invariant, not a convention

## What we expected

The `FNAF|` root prefix was introduced to fix a double-panel bug: the
vanilla fallback wrapper needed a single gate to hide whenever any of
our custom forms opened. Consolidating every custom title under one
root meant one visibility check —
`((#title_text - 'FNAF|') = #title_text)` — hid the fallback for the
whole family.

We treated `FNAF|` as a **naming convention** — any custom form must
start with it. Add a new form → add the prefix → done.

## What actually happened

I gave the U1/U4/U8/menu experiment forms titles like
`FNAF|PROOF_U1A|…` and `FNAF|PROOF_MENU|…`. The specific proofs
(`PROOF_U1A|`, `PROOF_U4|`, `PROOF_U8|`) had matching per-form
wrappers in `server_form.json`. The menu (`PROOF_MENU|`) did not — I
forgot to add one, or assumed the fallback would catch it.

Result on device: `/scriptevent fnaf:proofs` opened an empty modal
that dismissed instantly. The menu title contained `FNAF|`, which hid
the fallback wrapper. No other wrapper matched. Nothing rendered.

## Why the assumption was wrong

`FNAF|` is not a naming convention. It is an **invariant**:

> Every title carrying `FNAF|` MUST have exactly one visible custom
> wrapper defined for its sub-prefix.

Break that invariant and the form silently disappears — worse than a
crash, because there's no log entry, no visible failure, no diff from
"just closed the form".

The mental model needs a second rule that the first implies but doesn't
state:

- Every custom sub-prefix has its own wrapper OR
- Custom sub-prefixes that intentionally use vanilla styling drop the
  `FNAF|` root, so the fallback still catches them

## How we adapted

**Immediate fix**

`BP/scripts/uiProofs.js`: menu title dropped from
`FNAF|PROOF_MENU|JSON-UI proofs` to plain `JSON-UI proofs`. Falls
through to the vanilla fallback via `default_long_form`. No `FNAF|`
= no gate to satisfy.

**Rule now recorded**

Whenever adding a new custom form, do exactly one of:

1. Add a matching per-form wrapper to `server_form.json` that gates on
   `(not ((#title_text - 'FNAF|<sub>|') = #title_text))` AND set the
   script-side title to `FNAF|<sub>|…`.
2. Set the script-side title with NO `FNAF|` prefix; the vanilla
   default wrapper renders it.

Do not do "half of both" — set the FNAF| prefix without also adding
a wrapper.

**Verification pattern**

Any time we add a new title prefix, grep both sides of the fence in
the same commit:

```
grep -R "FNAF|" BP/scripts/  RP/ui/  docs/
```

Every prefix on the BP side must appear as a gated wrapper on the RP
side. Missing pair = silent broken form.

## Related

- [[docs/verified/implementation/skyls-long-form-chrome.md]] — the
  chrome pattern this invariant supports.
- [[docs/lessons-learned/2026-07-24-transport-vs-engine.md]] — the
  meta-lesson that findings are scoped to their surface. This lesson
  is scoped to the ActionForm + long_form transport.
