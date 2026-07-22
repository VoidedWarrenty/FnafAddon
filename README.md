# FNAF Addon (Bedrock) — Prototype

A Minecraft Bedrock addon that will eventually implement a full Five Nights at
Freddy's power and light system (generators, batteries, solar day-mode). This
initial commit is a **prototype of the FNAF 1 breaker box** — the input
control surface for the future power system.

## What's in this prototype

Two custom blocks:

- **`fnaf:breaker_box_1`** — right-click to open a themed UI showing 11
  breakers, one per FNAF 1 room. Toggling a breaker cuts or restores power to
  that room. There is also a "Main Breaker" pair for all-on / all-off. State
  is persisted in world dynamic properties so it survives reloads.
- **`fnaf:room_light`** — a placeable light that reads its power state from
  the nearest breaker box in the same dimension (within 96 blocks). Sneak +
  right-click to assign it to a specific FNAF 1 room. When the corresponding
  breaker is ON it emits full light; when OFF it goes dark.

## Rooms (FNAF 1)

1. Show Stage
2. Dining Area
3. Pirate Cove
4. West Hall
5. W. Hall Corner
6. Supply Closet
7. East Hall
8. E. Hall Corner
9. Backstage
10. Kitchen
11. Restrooms

## Installing

1. Package the packs (or symlink into your Bedrock `com.mojang` folder):

   ```
   BP/  →  development_behavior_packs/fnaf_bp/
   RP/  →  development_resource_packs/fnaf_rp/
   ```

2. Create or edit a world with **Experimental Features → Beta APIs** enabled
   (required by `@minecraft/server-ui`), then activate both packs.

3. Give yourself the blocks in creative:

   ```
   /give @s fnaf:breaker_box_1
   /give @s fnaf:room_light
   ```

## Using it

- Place a `fnaf:breaker_box_1` on a wall in your build.
- Place `fnaf:room_light` blocks in each room. Sneak + right-click each one
  and pick the room it belongs to from the list.
- Right-click the breaker box. Flip breakers. Watch the lights in the matching
  rooms turn on/off in real time.

## What's intentionally NOT in this prototype

Per the task scope — this is only the breaker box surface. Not built yet:

- Generator block with a battery that drains from load.
- Actual power draw calculation (each device consumes wattage).
- Day/night switch to solar backup.
- Wiring / connection topology between generator ↔ breaker box.
- FNAF 2/3/4 breaker variants with those games' maps.
- JSON-UI overlay of the FNAF 1 map behind the breaker buttons (see below).

## Design notes for the next steps

- **Generator / battery:** add a `fnaf:generator` block with `dynamicProperty`
  fields for `battery`, `capacity`, and `load`. On each tick, sum the load of
  connected breaker boxes (each ON breaker adds a room's rated draw) and
  subtract from the battery. When battery hits 0, force all downstream
  breakers off.
- **Connections:** simplest MVP is proximity-based ("nearest generator within
  N blocks"), which is what the current room_light ↔ breaker_box link uses.
  A later pass can add a wire item or an item-based pairing tool.
- **Solar day mode:** in `system.runInterval`, read `world.getTimeOfDay()`;
  if within day range, treat all power draws as free and don't drain the
  battery.
- **Custom map UI:** Bedrock lets you override the vanilla `server_form.json`
  in the resource pack's `ui/` folder to add a background image. Drop the
  FNAF 1 map PNG into `RP/textures/ui/fnaf1_map.png` and layer it via a
  custom `server_form.json`. Keeping the buttons where they are makes room
  labels line up with map locations for a real map-as-UI feel. This wasn't
  included here because it requires shipping the map art.

## Textures

`RP/textures/blocks/fnaf/*.png` are 16×16 placeholders (dark gray box with
red switch marks for the breaker; warm yellow / dim gray for the lights).
Replace them with real art at the same paths. Regenerate the placeholders
with:

```
python3 scripts/make_placeholder_textures.py
```

## File tree

```
BP/
  manifest.json
  blocks/
    breaker_box_1.json
    room_light.json
  scripts/
    main.js
    breakerBox.js
    roomLight.js
    rooms.js
    state.js
  texts/{en_US.lang, languages.json}
RP/
  manifest.json
  blocks.json
  textures/
    terrain_texture.json
    blocks/fnaf/*.png
  texts/{en_US.lang, languages.json}
scripts/
  make_placeholder_textures.py
```
