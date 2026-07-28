# Versioning & Revisions

The system we use for FNAF Addon. Portable to any project.

## The number: `0.MAJOR.MINOR.PATCH`

Four positions. The leading `0` is a **pre-release flag** — while it's
there, the project has not shipped a real release. On the day of the
first real release, everything shifts and becomes `1.0.0`.

Roles of the three moving positions while `0` is leading:

| Position | Role | Bump when |
|----------|------|-----------|
| `X` (1st after 0) | **Beta / big feature releases** | You added a whole new capability — not "one more block." A new subsystem, a new demo entity end-to-end, a whole new UI surface. |
| `Y` (2nd after 0) | **Alpha / small revisions & bug fixes** | Everything else: a bug fix, a texture swap, a wording tweak, a config change, a schema fix. |

So the numbers move like this:

```
0.1.0   first working version
0.1.1   fix a bug in that version
0.1.2   fix another bug
0.2.0   next big feature lands  ← MAJOR bumps, PATCH resets to 0
0.2.1   bug fix
0.2.2   bug fix
0.2.3   bug fix
...
0.3.0   next big feature
1.0.0   first real release  ← leading 0 falls off, everything resets
1.0.1   first post-release bug fix
1.1.0   first post-release feature
```

The number is meant to be **read at a glance**. If someone sees `0.5.2`,
they know: 5 feature milestones in, 2 bug fixes since the last one.

## What counts as a MAJOR (feature) vs. PATCH (fix)?

The line matters — otherwise every commit becomes a "feature" and the
number stops meaning anything.

**MAJOR bump** — "there is now a thing that wasn't there before":
- A new subsystem lands (animation editor, breaker panel)
- A new entity/block/item that stands on its own end-to-end
- A user-visible workflow that changes how the addon is used
- A whole new integration (dialogue UI, JSON-UI custom panel)

**PATCH bump** — "the same thing but working better":
- Fix a crash / render bug / broken JSON
- Swap a texture, tune a size, rename a label
- Adjust a script's math, tighten a threshold
- Repair a schema error surfaced by a log
- Iterate on the same feature without changing its scope

A useful gut check: **if the changelog line starts with "Fix", "Adjust",
"Tune", "Rename", "Retry" → PATCH**. If it starts with "Add", "Introduce",
"Wire", "Convert (whole pack)" → MAJOR.

## Bumping in practice (for Bedrock addons specifically)

Bedrock's pack.manifest holds versions in three places. All three must
move together:

1. `header.version` — the pack version itself
2. Every entry in `modules[].version` — the resources/data/script module version
3. Every `dependencies[].version` — cross-pack dependency pins (BP depending on RP, etc.)

Bump these in **lockstep across BP and RP**. If BP goes `0.2.4 → 0.2.5`,
RP also goes `0.2.4 → 0.2.5`, and BP's `dependencies[]` entry for the
RP UUID also updates to `0.2.5`. Anything less and Bedrock will pull
mismatched versions from cache.

## Making versions visible in-game

Bedrock stores the pack name in `header.name`. Set it to include the
version — e.g. `"FNAF Addon v0.2.4 (Resources)"` — so different builds
are visually distinguishable in the Resource / Behavior Pack list at
world-load time. Same for `header.description`.

Without this, iPad Bedrock (and other platforms) can silently show two
copies of the same pack after a version bump, and you can't tell which
is which unless the name includes the version.

## Cache & re-import behavior

Bedrock is *supposed* to auto-upgrade when same UUID + higher version
lands. On desktop/console it usually does; on iPad it often creates a
duplicate pack entry in Storage rather than replacing. Two rules keep
this manageable:

- **Same UUIDs, higher version** — never change UUIDs between revisions
  of the same pack. Only bump the version numbers. UUID changes create
  a *different* pack, not an upgrade, and worlds that referenced the old
  UUID break.
- **Import with the world closed** — some Bedrock builds keep pack
  contents cached in RAM while a world is open. Closing the world before
  installing a new build makes the upgrade reliably pick up.

If storage shows two entries with the same UUID and different versions,
the world load prefers the higher version. The lower version is
orphaned bytes — safe to delete from Storage manually.

## Working with revisions

Commit-per-fix, ship-per-bump. Rough rhythm:

- **Every fix or feature gets a git commit** with a clear message. Commit
  messages describe the *why*, not the *what* — the diff shows what.
- **A version bump batches the "shippable" state of the branch.**  You
  can commit five bug fixes and only bump the version once when you're
  ready to hand over a build. Each intermediate commit still exists in
  git history for diagnostics.
- **The commit that bumps the version** should have a message that
  summarizes what changed since the last bump. That commit is the
  changelog entry.

## Pre-flight checklist before bumping

Before bumping the version and shipping a build, verify:

- [ ] `header.version` bumped in **BP** manifest
- [ ] `header.version` bumped in **RP** manifest
- [ ] Every `modules[].version` matches (both BP and RP)
- [ ] Every `dependencies[].version` matches
- [ ] `header.name` reflects the new version so builds are distinguishable
- [ ] Commit message summarizes the changes since the last bump

Automate this if possible — a `bump-version.py` script that takes the
new version string and touches all the right fields is worth writing
once.
