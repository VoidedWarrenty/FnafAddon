# FNAF Addon (Bedrock) — Prototype

A Minecraft Bedrock addon that will eventually implement a full Five Nights at
Freddy's power and light system. This iteration adds a **blueprint tool** so
the room layout is defined per-build (works for any fan map — JOTC, TJOC,
Sister Location, custom pizzerias) instead of being hardcoded to the FNAF 1
floor plan.

## Blocks and items

- **`fnaf:blueprint`** *(item)* — the design surface. Right-click in the air
  or on any block to open the editor. Sneak + right-click a breaker box to
  snapshot the blueprint onto it. Every blueprint has a UUID (stored quietly
  in item lore); the room data lives in a world-level registry, so two
  blueprints with different names are two separate designs.
- **`fnaf:breaker_box_1`** — right-click to open the power panel for the
  rooms in whatever blueprint was last stamped onto it. Toggling a breaker
  cuts or restores power to that room. If no blueprint is applied, the panel
  tells you how to apply one.
- **`fnaf:room_light`** — a light block. Power state is derived by testing
  whether the light's position sits inside a room box in some breaker box's
  applied snapshot; the *nearest* such breaker box wins. No per-block room
  assignment — placement and blueprint containment do all the work.

## The blueprint model

Snapshot-on-apply, not live reference. When you sneak-click a breaker box
with a blueprint, its current room list is **copied** into that box's own
storage. Later edits to the blueprint don't retroactively touch deployed
boxes until you re-apply. That's what makes the following patterns work:

- **Safe iteration.** Edit the blueprint freely without worrying about
  breaking existing wiring; devices stay on the last snapshot.
- **Backups.** Duplicate blueprints by giving yourself another item and
  copying the room list manually (a proper copy tool is a follow-up).
- **Hidden rooms per operator.** Give the main office a blueprint that
  omits secret rooms; give the admin office a fuller blueprint that
  includes them. Each box only sees what its own snapshot claims.

## Defining rooms

1. `/give @s fnaf:blueprint` — the first right-click auto-assigns a UUID and
   registers an empty blueprint.
2. Right-click the blueprint in the world → editor opens. Rename the
   blueprint, then **+ Add Room** and enter a room name (e.g. "West Hall").
3. From the room submenu, **+ Add Box**. The menu closes and the actionbar
   prompts you to tap the first corner.
4. Right-click any block in the world → first corner is planted (shown as
   a floating particle). Right-click a second block → the box is added.
5. Add more boxes to the same room for **L-shapes**, hallways, or hidden
   compartments — one room can be many boxes.
6. Repeat for every room. Use **Load FNAF 1 Room Preset** to seed the
   11 canonical FNAF 1 room *names* if you want a starting point.
7. Sneak + right-click a `fnaf:breaker_box_1` while holding the blueprint
   → the room list is stamped onto that box.

## Seeing bounds in the world

While you're holding a blueprint, every box in that blueprint renders as a
particle outline (white `minecraft:endrod` sparks along the 12 edges of each
box) within 96 blocks of you, refreshed every 0.5 s. The first corner during
picking is shown with a distinct puff so you can visually confirm the anchor
before choosing the opposite corner. Put the blueprint away and the outlines
disappear — nothing is left behind in the world.

## Rooms (FNAF 1 preset)

Show Stage · Dining Area · Pirate Cove · West Hall · W. Hall Corner ·
Supply Closet · East Hall · E. Hall Corner · Backstage · Kitchen · Restrooms

## Installing

Two options.

**A. Package + import** (one-shot, easy):
Grab the built `fnaf_addon.mcaddon` (regenerate with the packaging steps
below), tap it in the iPad Files app, choose *Open in Minecraft*. Enable
**Experimental: Beta APIs** on the world and activate both packs.

**B. Development folders** (iterate without re-import — recommended):
Link `BP/` and `RP/` into
`On My iPad/Minecraft/games/com.mojang/development_behavior_packs/fnaf_bp/`
and `.../development_resource_packs/fnaf_rp/` (Working Copy's "Link
Directory" is the cleanest iOS route). Edit files in place; use `/reload`
in-world for script changes; leave and re-enter the world for JSON/texture
changes.

Give yourself the items:

```
/give @s fnaf:blueprint
/give @s fnaf:breaker_box_1
/give @s fnaf:room_light
```

## Packaging into an .mcaddon

```
mkdir -p dist
(cd BP && zip -rq ../dist/fnaf_bp.mcpack .)
(cd RP && zip -rq ../dist/fnaf_rp.mcpack .)
(cd dist && zip -q fnaf_addon.mcaddon fnaf_bp.mcpack fnaf_rp.mcpack)
```

## What's NOT in this iteration

- **Generator + battery.** The breaker box is only the input surface — a
  future `fnaf:generator` will feed it, with battery drain proportional to
  how many breakers are ON.
- **Day/solar mode.** Free power during in-game daytime.
- **ASCII / JSON-UI map** in the breaker panel. Current UI is a button list
  per room; a black-background/white-wall map render is the next natural
  step and will use live world block scans so open doorways read as gaps.
- **Cameras.** The blueprint format is designed to be reused by camera
  hubs — a monitor block will consume the same snapshot to route cameras
  by room.
- **Blueprint duplication tool.** For now, more blueprints = more `/give`s.

## File tree

```
BP/
  manifest.json
  items/blueprint.json
  blocks/{breaker_box_1.json, room_light.json}
  scripts/
    main.js                (event wiring + tick loop)
    blueprint.js           (data model + world registry)
    blueprintItem.js       (item lore stamping + use handlers)
    blueprintUi.js         (editor forms)
    blueprintPicker.js     (per-player corner-picking state)
    blueprintViz.js        (in-world particle outlines)
    breakerBox.js          (panel UI + snapshot-apply)
    roomLight.js           (containment-based sync)
    state.js               (per-box state + snapshot storage + registries)
    rooms.js               (FNAF 1 preset room names)
  texts/{en_US.lang, languages.json}
RP/
  manifest.json
  blocks.json
  textures/
    terrain_texture.json
    item_texture.json
    blocks/fnaf/*.png
    items/fnaf/blueprint.png
  texts/{en_US.lang, languages.json}
scripts/
  make_placeholder_textures.py
```

## Note if you had earlier `fnaf:room_light` blocks

The `fnaf:room` block state has been removed — room lights now derive their
room automatically via blueprint containment. Any lights placed with the
previous version may vanish on load; break and replace them, then draw a
blueprint box around them.
