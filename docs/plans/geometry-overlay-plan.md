# Geometry Overlay Implementation Plan

**Status (2026-07-12, per user): preferred plan for future implementation.** The shader
overlay (`docs/plans/shader-overlay-plan.md`, shipped as opt-in `useShaderOverlay` in
`e4a6d1e`, 2026-03-09) turned out to be a performance dead end — its own commit message
already flags "at cost of performance," and canvas overlay was made the default again
13 days later (`73e9ead Make canvas overlay default`, 2026-03-22) to walk it back. This plan
was written the same day as the shader overlay shipped, specifically to solve that
performance problem properly (native-resolution `LineSegments2`/`Points` in the scene graph
instead of a per-frame SDF-evaluated DataTexture). It was never implemented — moved here from
gitignored `tmp/` since it's now the intended direction, not a discarded exploration.

**Dependency (2026-07-12, per user):** the hybrid strategy below assumes a clean 2D-edit-mode /
3D-view-mode switch exists in Shopfront's `TilingControlPanel`. It doesn't yet — today there is
only an "Object mesh" viewer dropdown (Flat/Sphere/Fabric drape), not a dedicated edit-vs-view
mode with an overhead/orthographic camera and displacement disabled. Building that switch is
scoped as part of the V2 tiling editor redesign — see the new To-do item in
`shopfront/docs/tiling-control-panel-features.md`. This plan is blocked on that (or at least on
a minimal version of it) before the "2D editing mode" half of the hybrid strategy can be wired
up; the "3D view mode" half (shader overlay retained for seam/grid lines) has no such dependency.

## Overview

Add a third overlay rendering path — **geometry overlay** — that places
`THREE.LineSegments` and `THREE.Points` objects directly into the Three.js
scene with `renderOrder=999, depthTest=false`. This eliminates both problems
with the existing paths:

| Path | Problem |
|---|---|
| Canvas overlay (`useShaderOverlay=false`) | Fixed-resolution 2048×2048 texture blurs badly at zoom |
| Shader overlay (`useShaderOverlay=true`) | `buildVectorPrimitives()` runs on every drag/pan event → lag |
| **Geometry overlay (new)** | Native framebuffer resolution; geometry tracks camera for free → zero cost on pan |

### Hybrid strategy

* **2D editing mode** (flat plane, overhead camera, displacement disabled):
  use geometry overlay for all primitives (segments, circles, control points).
* **3D view mode** (arbitrary mesh, free camera):
  keep shader overlay for seam/tile-grid lines only (static params, zero CPU
  cost on interaction because grid uniforms never change during drag/pan/zoom).

---

## Architecture

### Scene graph placement

```
scene
  mesh                      (BRDF material)
  _geomGroup                (new THREE.Group)
    _geomSegs               (THREE.LineSegments, renderOrder=999)
    _geomPts                (THREE.Points,        renderOrder=999)
```

Both overlay objects share:
* `renderOrder = 999` — drawn after the mesh
* `material.depthTest = false` — z never blocks; displacement irrelevant
* `material.depthWrite = false` — don't corrupt the depth buffer
* `position.z = 0.001` — tiny offset keeps rendering order deterministic

### Thick lines

`THREE.LineBasicMaterial` is limited to 1 px on most GPUs (WebGL `lineWidth`
is ignored). For configurable pixel-width lines use **`Line2` /
`LineMaterial`** from `three/examples/jsm/lines/`:

```js
import { LineSegments2 }  from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial }   from 'three/examples/jsm/lines/LineMaterial.js';
```

`LineMaterial` takes `linewidth` in **world units** (or `resolution` + screen
pixels if `worldUnits=false`). Use `worldUnits=false` so that line width
stays constant in screen pixels regardless of zoom — matching the existing
shader overlay behaviour.

### Control-point circles

Use flat `THREE.CircleGeometry` meshes batched into an `InstancedMesh`, or
use `THREE.Points` with a circular sprite (built-in `gl_PointSize` +
`discard` circle in the point shader). `THREE.Points` requires less setup
and no per-primitive draw calls.

---

## Coordinate Mapping

Texture-pixel space → rawUV [0,1]² (matches `ptToUV` in `bivot.js`):

```js
const rawU = (x - td[0] / 2) / im[0] + 0.5;   // td = state.texDims, im = untiledImDims
const rawV = 0.5 - (y - td[1] / 2) / im[1];
```

rawUV → world space (same scale as `getPlaneGeometry()`):

```js
const planeWidth = 2048 / (300 / 0.0254);       // ≈ 0.17333 m
const wx = (rawU - 0.5) * planeWidth;
const wy = (rawV - 0.5) * planeWidth;           // already +up because rawV is already flipped
```

Both conversions use values already available on `this`:
* `this.state.texDims` → `td`
* `this.untiledImDims` → `im` (next-power-of-two square of max(texW, texH))

---

## New State Field

Add to the default `this.state` object (near line 407, beside `useShaderOverlay`):

```js
useGeometryOverlay: false,
```

---

## New Instance Fields

Initialise in `initGeometryOverlay()` (add to the `this.XXX = null` block
near line 522 as documentation):

```js
this._geomGroup  = null;   // THREE.Group added to scene
this._geomSegs   = null;   // LineSegments2  (thick lines)
this._geomPts    = null;   // THREE.Points   (circle handles)
this._geomSegBuf = null;   // Float32Array  interleaved start/end position pairs
this._geomPtBuf  = null;   // Float32Array  x,y,z per point
```

---

## New Methods in `bivot.js`

### `initGeometryOverlay()`

Called once, directly after `this.initShaderOverlay()` in the `startRender`
mainline (around line 690). Modelled on `initShaderOverlay()`.

```js
initGeometryOverlay() {
  if (!this.state.useGeometryOverlay) return;
  if (this._geomGroup) return; // idempotent

  const planeWidth = 2048 / (300 / 0.0254);

  // --- line segments (thick, screen-space pixel width) ---
  this._geomSegGeo = new LineSegmentsGeometry();
  this._geomSegMat = new LineMaterial({
    color: 0xffffff,
    linewidth: 2,          // screen pixels
    worldUnits: false,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
  });
  this._geomSegMat.resolution.set(
    this.renderer.domElement.width,
    this.renderer.domElement.height
  );
  this._geomSegs = new LineSegments2(this._geomSegGeo, this._geomSegMat);
  this._geomSegs.renderOrder = 999;

  // --- control-point circles (Points) ---
  this._geomPtGeo = new THREE.BufferGeometry();
  this._geomPtMat = new THREE.PointsMaterial({
    size: 8,               // screen pixels (sizeAttenuation=false)
    sizeAttenuation: false,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
  });
  this._geomPts = new THREE.Points(this._geomPtGeo, this._geomPtMat);
  this._geomPts.renderOrder = 999;

  this._geomGroup = new THREE.Group();
  this._geomGroup.position.z = 0.001;
  this._geomGroup.add(this._geomSegs);
  this._geomGroup.add(this._geomPts);
  this.scene.add(this._geomGroup);
}
```

### `_ptToWorld(x, y)`

Pure utility, extracted from the coordinate-mapping formula above. Returns
`[wx, wy]` in metres.

```js
_ptToWorld(x, y) {
  const td = this.state.texDims    || [1, 1];
  const im = this.untiledImDims    || [1, 1];
  const planeWidth = 2048 / (300 / 0.0254);
  const rawU = (x - td[0] / 2) / im[0] + 0.5;
  const rawV = 0.5 - (y - td[1] / 2) / im[1];
  return [(rawU - 0.5) * planeWidth, (rawV - 0.5) * planeWidth];
}
```

### `updateOverlayGeometry()`

Full rebuild from `state.pointsControl`. Called by the `updateOverlay()`
dispatcher. O(N primitives) CPU work; zero GPU state upload beyond uploading
the updated `BufferAttribute` arrays.

```js
updateOverlayGeometry() {
  if (!this._geomGroup || !this.state.pointsControl) return;

  const segPositions = [];  // flat [x0,y0,0, x1,y1,0, ...] pairs
  const segColors    = [];  // flat [r,g,b, r,g,b, ...] per vertex
  const ptPositions  = [];  // flat [x,y,0, ...]
  const ptColors     = [];  // flat [r,g,b, ...]

  this.state.pointsControl.forEach((pc, gi) => {
    if (!pc.visible) return;
    const pts   = pc.points;
    const isSelected = (gi === this.dragState.group);
    const col   = hexColorToRGBA(isSelected ? pc.selectedColor : pc.color);
    const [r, g, b] = [col[0], col[1], col[2]];

    // --- line segments ---
    const addSeg = (a, b_) => {
      const [ax, ay] = this._ptToWorld(a.x, a.y);
      const [bx, by] = this._ptToWorld(b_.x, b_.y);
      segPositions.push(ax, ay, 0, bx, by, 0);
      segColors.push(r, g, b,  r, g, b);
    };

    if (pts.length >= 2) {
      if (pc.lines === 'open') {
        for (let i = 0; i < pts.length - 1; i++) addSeg(pts[i], pts[i + 1]);
      } else if (pc.lines === 'loop') {
        for (let i = 0; i < pts.length; i++) addSeg(pts[i], pts[(i + 1) % pts.length]);
      } else if (pc.lines === 'closed' || pc.lines === 'closed4') {
        for (let i = 0; i < pts.length; i++) addSeg(pts[i], pts[(i + 1) % pts.length]);
      } else if (pc.lines === 'pairs') {
        for (let i = 0; i < pts.length - 1; i += 2) addSeg(pts[i], pts[i + 1]);
      } else if (pc.lines === 'rect' && pts.length >= 2) {
        const [p0, p1] = [pts[0], pts[1]];
        addSeg(p0, {x: p1.x, y: p0.y});
        addSeg({x: p1.x, y: p0.y}, p1);
        addSeg(p1, {x: p0.x, y: p1.y});
        addSeg({x: p0.x, y: p1.y}, p0);
      }
    }

    // --- control-point circles ---
    pts.forEach((p, pi) => {
      const [wx, wy] = this._ptToWorld(p.x, p.y);
      const ptSelected = isSelected && pi === this.dragState.point;
      const ptCol = hexColorToRGBA(ptSelected ? pc.selectedColor : pc.color);
      ptPositions.push(wx, wy, 0);
      ptColors.push(ptCol[0], ptCol[1], ptCol[2]);
    });
  });

  // Upload segments
  if (segPositions.length > 0) {
    this._geomSegGeo.setPositions(segPositions);
    this._geomSegGeo.setColors(segColors);
    this._geomSegs.visible = true;
  } else {
    this._geomSegs.visible = false;
  }

  // Upload points
  const ptPosAttr = new THREE.Float32BufferAttribute(ptPositions, 3);
  const ptColAttr = new THREE.Float32BufferAttribute(ptColors, 3);
  this._geomPtGeo.setAttribute('position', ptPosAttr);
  this._geomPtGeo.setAttribute('color', ptColAttr);
  this._geomPts.visible = ptPositions.length > 0;
}
```

### Incremental single-point update (optional optimisation, Tier 1)

During drag, only the position of the dragged point changes. Rather than
rebuilding all buffers, update only the affected vertices:

```js
updateOverlayGeometryPoint(group, pointIdx, x, y) {
  // ... targeted setXYZ() on position BufferAttribute + needsUpdate = true
  // ... update the two segment endpoints that connect to this point
}
```

Skip for Tier 0; add as a follow-up once the full rebuild path is working.

---

## Dispatcher Change

Modify `updateOverlay()` (line 3668) to add the third branch:

```js
updateOverlay() {
  if (this.state.useGeometryOverlay && this._geomGroup) {
    this.updateOverlayGeometry();
    return;
  }
  if (this.state.useShaderOverlay && this.segTex) {
    this.updateOverlayShader();
  } else {
    this.updateOverlayCanvas();
  }
}
```

Note: when `useGeometryOverlay` is active, the shader overlay DataTextures
still live in memory but are not updated. That's intentional — they hold
the seam/grid data for when the user switches back to 3D mode.

---

## `LineMaterial` Resolution Update

`LineMaterial.resolution` must match the renderer output size (in physical
pixels) to produce correct screen-space line widths. Update it whenever the
canvas is resized:

In `updateRenderSize(width, height)` (around line 4622), add:

```js
if (this._geomSegMat) {
  this._geomSegMat.resolution.set(width, height);
}
```

---

## Dispose

In `dispose()` (around line 5614), add cleanup:

```js
if (this._geomGroup) {
  this.scene.remove(this._geomGroup);
  this._geomSegGeo.dispose();
  this._geomSegMat.dispose();
  this._geomPtGeo.dispose();
  this._geomPtMat.dispose();
  this._geomGroup = null;
  this._geomSegs = null;
  this._geomPts = null;
}
```

---

## Files to Create / Modify

```
src/bivot-js/bivot.js
  ~6 targeted changes, ~140 lines total:
  1. state default: add useGeometryOverlay: false   (line ~407)
  2. instance field declarations                     (line ~522)
  3. initGeometryOverlay() call in startRender()     (line ~690)
  4. initGeometryOverlay() method definition         (after initShaderOverlay)
  5. _ptToWorld() helper                             (near buildVectorPrimitives)
  6. updateOverlayGeometry() method                  (after updateOverlayShader)
  7. updateOverlay() dispatcher change               (line ~3668)
  8. updateRenderSize() resolution update            (line ~4622)
  9. dispose() cleanup                               (line ~5614)

No changes required:
  src/bivot-js/overlay-shader.js   (shader overlay kept intact for 3D mode)
  src/bivot-js/shaders.js          (BRDF shaders unaffected)
```

The `LineSegments2 / LineSegmentsGeometry / LineMaterial` imports are already
available in the Three.js installation at `three/examples/jsm/lines/`; add
them to the import block at the top of `bivot.js`.

---

## Stress Test Fixture (Tier 0 validation)

To reproduce the worst-case drag lag with the shader overlay and confirm its
absence with geometry overlay, use a 12×12 grid of control points (144
points, 143 segments per group):

```js
// Paste into browser console or bivot options.state after textures load
const N = 12;
const td = bivot.state.texDims;   // e.g. [4096, 4096]
const pts = [];
for (let row = 0; row < N; row++) {
  for (let col = 0; col < N; col++) {
    pts.push({ x: (col + 1) * td[0] / (N + 1),
               y: (row + 1) * td[1] / (N + 1) });
  }
}
bivot.state.pointsControl = [{
  visible: true,
  draggable: true,
  addNew: false,
  lines: 'open',
  color: '#ffff00',
  selectedColor: '#ff8800',
  points: pts,
}];
bivot.updateOverlay();
bivot.requestRender();
```

**Primary performance test**: hold a middle control point and drag while
watching the FPS counter (`Ctrl+F`). With shader overlay, every drag event
triggers `buildVectorPrimitives()` + 3× DataTexture upload + ~574M SDF
evaluations per frame at 1080p. With geometry overlay, buffer updates are
O(N) float writes and the camera pan at rest costs zero.

**Secondary test**: pan the scene (right-drag) with 144 points visible.
With shader overlay, `_overlayNeedsRebuild` fires every pan frame.
With geometry overlay, no overlay code runs at all during pan.

---

## Out of Scope for Tier 0

| Feature | Tier |
|---|---|
| Incremental single-point update on drag | 1 |
| Dashed lines | 1 |
| `Shift+V` toggle between overlay modes | 1 |
| Shader overlay seam-grid retained in 3D mode while geom overlay active in 2D | 1 |
| GPU position map for occlusion on non-flat meshes | 2 |
| `depthTest=true` occlusion (ball/drape meshes) | 2 |

---

## Why This Is Correct on a Flat Plane

The `uvTransform` uniform controls zoom and pan by moving the **camera**, not
the mesh vertices. The mesh and the overlay geometry both stay fixed in world
space — they move together as the camera moves. Therefore:

* No need to update overlay geometry on pan or zoom.
* No need to account for `uvTransform` in the world-space coordinates.
* Displacement map moves mesh vertices in **z only** (flat plane, normal =
  (0,0,1)). With `depthTest=false` the overlay z is irrelevant — displacement
  has zero effect on overlay placement accuracy.
* Float32 precision: at 8K textures each texture pixel is
  `0.1733 / 8192 ≈ 21 µm` of world space. Float32 epsilon at 0.1733 is
  ~10 nm → ~2100 representable steps per pixel. Precision is not a
  constraint.
