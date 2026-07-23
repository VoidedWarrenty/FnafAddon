# Addon Architecture

Approved architecture as of Phase 0.

## Five-layer pipeline

```
        Blueprint
           │
           ▼
    Geometry Engine        ← architectural math, UI-blind
           │
           ▼
   Device Renderer         ← "for THIS device, what primitives exist?"
           │
           ▼
     Render Model          ← pure geometry primitives, UI-agnostic
           │
           ▼
      UI Encoder           ← transports primitives to a UI backend
           │
           ▼
   ┌───────┴───────┐
   │       │       │
JSON UI  DDUI    Editor preview / debug tools / …
```

Each layer knows only the layer above it. Nothing below the Render Model
line is allowed to reach up into the geometry or renderer.

## Layer responsibilities

### 1. Blueprint

Persistent architectural fact of a world. One blueprint per building.
Reused by every device. Domain of `blueprint.js`.

Owns:
- Polygon-defined rooms
- Per-floor Y range (floorY, ceilingY)
- Doorway openings along polygon edges
- Persistence via world dynamic properties

Never reads or writes device state (breakers, cameras, alarms).

### 2. Geometry Engine

Pure math on the blueprint. Produces normalized, deduplicated,
merge-ready primitives.

Owns:
- Raster (for room detection only)
- Room detection (flood fill, exterior discard)
- Wall normalization (segments in a canonical form)
- Collinear merge (touching + overlapping segments coalesce)
- Doorway subtraction (display walls carve openings)
- World bounds
- World → UI-pixel + world → raster-cell transforms
- Room interior points (breaker/camera placement math)

Never picks icons, colors, labels, or slot counts.

Output shape (JSDoc, since project is JavaScript):

```js
/**
 * @typedef {Object} GeometrySummary
 * @property {ArchWall[]} walls       - normalized + merged, no doors carved
 * @property {ArchWall[]} displayWalls - collinear-merged AND doors subtracted
 * @property {ArchRoom[]} rooms       - detected regions with cells + bbox
 * @property {Map<number, {x,y,z}>} roomInteriorPoints
 * @property {MapTransform} transform - world → UI-pixel + world → cell
 * @property {WorldBounds} bounds
 */
```

### 3. Device Renderer

For a SPECIFIC device (breaker box, camera panel, fire panel), decides
which primitives should exist on screen.

Owns:
- What kinds of items appear (breakers vs cameras vs detectors)
- Icon choice
- Label text
- Item placement (leverages Geometry Engine's interior points)
- Visibility rules (electrical state → breaker color, etc.)

Never touches JSON UI, texture paths, button indexes, or UI slot counts.

One renderer per device type:

```
BreakerBoxRenderer(geometry, electricalState) → RenderModel
CameraPanelRenderer(geometry, cameraState)    → RenderModel
FirePanelRenderer(geometry, alarmState)       → RenderModel
```

### 4. Render Model

Pure geometry description. UI-blind. Rejects any concept from below.

```js
/** @typedef {Object} RenderWall
 *  @property {number} x
 *  @property {number} y
 *  @property {number} w
 *  @property {number} h
 */

/** @typedef {Object} RenderBreaker
 *  @property {string} id           - stable identity for callbacks
 *  @property {number} x
 *  @property {number} y
 *  @property {"on"|"off"} state
 *  @property {string} label
 */

/** @typedef {Object} RenderLabel
 *  @property {number} x
 *  @property {number} y
 *  @property {string} text
 */

/** @typedef {Object} RenderIcon
 *  @property {string} kind         - "camera" | "detector" | …
 *  @property {number} x
 *  @property {number} y
 *  @property {string=} state
 *  @property {string=} label
 */

/** @typedef {Object} RenderPolygon
 *  @property {[number,number][]} points
 *  @property {string=} fill
 *  @property {string=} stroke
 */

/** @typedef {Object} RenderModel
 *  @property {RenderWall[]} walls
 *  @property {RenderBreaker[]} breakers
 *  @property {RenderIcon[]} icons
 *  @property {RenderLabel[]} labels
 *  @property {RenderPolygon[]} polygons
 *  @property {{width:number, height:number}} viewport
 *  @property {string[]} warnings
 */
```

Fields not needed by a given device are simply empty arrays. Order of
arrays is a hint to encoders about rendering layer (bg → walls → labels
→ interactive), but the encoder owns final ordering.

### 5. UI Encoder

Consumes a Render Model + a **RendererCapabilities** contract and emits
whatever the target UI backend needs.

```js
/** @typedef {Object} RendererCapabilities
 *  @property {number} maxWalls
 *  @property {number} maxBreakers
 *  @property {number} maxIcons
 *  @property {number} maxLabels
 *  @property {number} viewportWidthPx
 *  @property {number} viewportHeightPx
 *  @property {boolean} supportsPerItemOffsetBinding
 *  @property {boolean} supportsPerItemSizeBinding
 *  @property {boolean} supportsImageTint
 */
```

The encoder MAY refuse a Render Model (too many walls, etc.) and MUST
report a diagnostic when it does; it never silently truncates.

One encoder per backend:

- `JsonUiEncoder(model, caps) → ActionFormData` (script side)  
  + `server_form.json` slot pool + bindings (RP side)
- `DebugAsciiEncoder(model) → string` — for chat dumps and tests
- Future: `EditorPreviewEncoder`, `WebEncoder`

## Consequences of this split

**A new device is a Renderer, not a rewrite.** Fire panel = new
`FirePanelRenderer`, nothing else changes.

**A new UI backend is an Encoder, not a rewrite.** If DDUI ever grows
the required capabilities, we add a `DduiEncoder` and pick between them
at runtime.

**Render Model is testable in isolation.** No Bedrock runtime dependency,
no JSON UI dependency, just plain data structures and functions.

**Capabilities live at the encoder boundary, not in the renderer.** A
breaker box on a low-resolution UI can advertise `maxWalls: 40`; on a
higher-fidelity UI, `maxWalls: 400`. Same renderer, different encoder
contracts.

## Where existing code lands

| Layer | Current files |
|---|---|
| Blueprint | `blueprint.js`, `state.js`, `rooms.js`, `blueprintItem.js`, `blueprintPicker.js`, `blueprintUi.js` (editor), `blueprintViz.js` |
| Geometry Engine | `wallRasterizer.js`, `roomDetector.js`, `breakerPlacement.js`, `mapTransform.js` (both transforms), NEW `wallNormalizer.js`, NEW `collinearMerge.js`, NEW `doorwaySubtract.js` |
| Device Renderer | NEW `renderers/breakerBoxRenderer.js` (and future `renderers/cameraPanelRenderer.js`, etc.) |
| Render Model | `renderModel.js` (JSDoc typedefs + factory helpers) |
| UI Encoder | NEW `encoders/jsonUiEncoder.js`, keep `mapDebug.js` as `DebugAsciiEncoder` |
| Transport (Bedrock UI) | `RP/ui/server_form.json`, `breakerBox.js`, `breakerForm.js` |
| Persistence | `mapSerializer.js`, `state.js` |
| Electrical model | `electricalRoomManager.js` split per ADR-003 |
| Light output | `roomLight.js` |
