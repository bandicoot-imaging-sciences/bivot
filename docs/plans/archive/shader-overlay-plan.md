# Shader Overlay Implementation Plan

**Status (2026-07-12, per user): superseded — performance dead end, kept for historical
context.** Shipped as opt-in `useShaderOverlay` in `e4a6d1e` (2026-03-09; commit message
itself notes "at cost of performance"). Canvas overlay was made the default again 13 days
later (`73e9ead Make canvas overlay default`, 2026-03-22), effectively walking this back.
`docs/plans/geometry-overlay-plan.md` (written the same day this shipped) is the intended
successor and is now the preferred plan for future overlay work. Don't invest further here
without checking that plan first.

## Overview

Replace the Canvas 2D `overlayMap` texture with a fully GPU-side vector
renderer evaluated in the fragment shader. The existing canvas path is kept
intact and toggled via `Shift+V`.

---

## WebGL1 Compatibility Analysis

This is the primary constraint given the mobile-device target range.

### `dFdx` / `dFdy`
Require `GL_OES_standard_derivatives`. **Already declared** at the top of
`bivot-fragment.glsl` and effectively already in use by `perturbNormal2Arb`.
No new action needed.

### `gl_FrontFacing`
Available in GLSL ES 1.00 and 3.00. No extension required.

### Float / half-float DataTextures
| Type | WebGL1 requirement | Coverage |
|---|---|---|
| `THREE.FloatType` | `OES_texture_float` | ~85% of WebGL1 devices |
| `THREE.HalfFloatType` | `OES_texture_half_float` | ~99% of WebGL1 devices |

**Use `HalfFloatType` as primary.** Precision is ~3 significant digits in
[0, 1] – sufficient for UV coords and pixel widths up to ~2000px. At init,
check `renderer.extensions.has('OES_texture_half_float')`; if absent (very
old devices), fall back to the legacy canvas path unconditionally.

Three.js 0.149 (already in use) handles half-float DataTexture upload on
both WebGL1 and WebGL2.

### Dynamic loop bounds in GLSL ES 1.00
GLSL ES 1.00 requires loop bounds to be compile-time constants. The pattern
used throughout this plan is:

```glsl
#define MAX_SEGS 256  // injected via Three.js material.defines
for (int i = 0; i < MAX_SEGS; i++) {
  if (i >= uNumSegs) break;   // runtime guard
  ...
}
```

The compile-time constant `MAX_SEGS` satisfies the spec. The `break` on a
dynamic condition is permitted by GLSL ES 1.00 §6.4 and is compiled
correctly by all major WebGL1 implementations (Angle/D3D, Metal, Vulkan
translation layers, Mesa).

### Texture sampling in loops (WebGL1 limitation)
GLSL ES 1.00 requires texture lookups inside loops to use a loop-invariant
sampler and a non-loop-dependent LOD. `texture2D(uSegTex, vec2(u, 0.5))`
with a calculated `u` satisfies this because the LOD is implicit (mipmap
disabled) and the sampler is uniform. This pattern is widely supported in
practice even though the spec is technically ambiguous.

---

## File Structure Changes

```
src/bivot-js/
  shaders.js              ← add new uniforms, inject overlayShaderGlsl
  bivot.js                ← add toggle, initShaderOverlay(), buildVectorPrimitives(),
                             updateOverlayCanvas() (renamed), updateOverlayShader()
  overlay-shader.js       ← NEW: exports GLSL string for the overlay include
```

No build-config changes are needed. `overlay-shader.js` exports a plain JS
template-literal string (`export default \`...\``), which microbundle/rollup
handles natively. No GLSL raw-loader required.

---

## DataTexture Layout

Two `THREE.DataTexture` instances, `RGBA`, `HalfFloatType`, 1 row tall.

### `uSegTex` – line segments

Each segment occupies **3 texels** (12 floats):

| Texel offset | R | G | B | A |
|---|---|---|---|---|
| +0 | `a.u` | `a.v` | `b.u` | `b.v` |
| +1 | `color.r` | `color.g` | `color.b` | `color.a` |
| +2 | `halfWidthPx` | `dashPeriodPx` (0=solid) | `dashDuty` (0.5=50%) | — |

Texture width = `MAX_SEGS * 3`. Default `MAX_SEGS = 256`.

### `uCircleTex` – point handles (circle outlines)

Each circle occupies **2 texels** (8 floats):

| Texel offset | R | G | B | A |
|---|---|---|---|---|
| +0 | `center.u` | `center.v` | `outerRadiusPx` | `halfWidthPx` |
| +1 | `color.r` | `color.g` | `color.b` | `color.a` |

Texture width = `MAX_CIRCLES * 2`. Default `MAX_CIRCLES = 256`.

### `uGridTex` – analytical grid descriptors

Each grid entry occupies **2 texels**:

| Texel offset | R | G | B | A |
|---|---|---|---|---|
| +0 | `spacingU` | `spacingV` | `offsetU` | `offsetV` |
| +1 | `color.r` | `color.g` | `color.b` | `halfWidthPx` |

Max 8 grid entries (separate grids for tile grid, selection grid, seam
overlay). Texture width = `MAX_GRIDS * 2 = 16`.

### Allocation

Pre-allocated once in `initShaderOverlay()`:

```js
const MAX_SEGS    = 256;
const MAX_CIRCLES = 256;
const MAX_GRIDS   = 8;
const SEG_TEX_W    = MAX_SEGS    * 3;
const CIRCLE_TEX_W = MAX_CIRCLES * 2;
const GRID_TEX_W   = MAX_GRIDS   * 2;

// Float16 backing: Three.js accepts Float32Array for HalfFloatType and
// converts internally on upload.
this.segData    = new Float32Array(SEG_TEX_W    * 4);
this.circleData = new Float32Array(CIRCLE_TEX_W * 4);
this.gridData   = new Float32Array(GRID_TEX_W   * 4);

function makeDataTex(data, width) {
  const t = new THREE.DataTexture(
    data, width, 1,
    THREE.RGBAFormat, THREE.HalfFloatType
  );
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}
this.segTex    = makeDataTex(this.segData,    SEG_TEX_W);
this.circleTex = makeDataTex(this.circleData, CIRCLE_TEX_W);
this.gridTex   = makeDataTex(this.gridData,   GRID_TEX_W);
```

---

## New Uniforms (added to `shaders.js` `uniforms` object)

```js
'uSegTex':       { value: null },    // DataTexture
'uCircleTex':    { value: null },    // DataTexture
'uGridTex':      { value: null },    // DataTexture
'uNumSegs':      { value: 0 },       // int
'uNumCircles':   { value: 0 },       // int
'uNumGrids':     { value: 0 },       // int
'uViewportSize': { value: new THREE.Vector2(1, 1) },
```

Existing `overlayMap` and `textureLayer` uniforms are **kept** (used by the
canvas path and the `textureLayer` pass-through, which are always active).

---

## `overlay-shader.js` – New File

```js
// overlay-shader.js
// GLSL ES 1.00-compatible overlay SDF renderer.
// Injected into the fragment shader via a JS string include.

const glsl = x => x;   // syntax highlight hint only
export default glsl`

// ---- Overlay SDF helpers ------------------------------------------------

// Fetch one RGBA texel from a 1-row DataTexture by integer index.
// texWidth must match the JS-side DataTexture width.
vec4 ovFetch(sampler2D tex, int idx, int texWidth) {
  float u = (float(idx) + 0.5) / float(texWidth);
  return texture2D(tex, vec2(u, 0.5));
}

// Build the screen-pixel-space Jacobian at the current fragment.
// Returns (dScreen/dU, dScreen/dV) where screen is in pixels.
// uViewportSize.xy = (canvasW, canvasH) in CSS pixels.
void ovJacobian(vec2 fragUV, out vec2 Jx, out vec2 Jy) {
  // dFdx/dFdy give the UV change per *screen* pixel in x and y directions.
  // Invert: (screen pixels per UV unit) = 1 / (UV per pixel).
  // We work with (UV per pixel) directly to avoid division instability.
  Jx = dFdx(fragUV) * uViewportSize.x;   // UV change per canvas pixel, x-axis
  Jy = dFdy(fragUV) * uViewportSize.y;   // UV change per canvas pixel, y-axis
}

// Transform a UV delta into screen-pixel-space using the local Jacobian.
// Jx, Jy from ovJacobian().
// Result is a 2D vector in pixel space.
vec2 ovUVtoPx(vec2 deltaUV, vec2 Jx, vec2 Jy) {
  // Solve: [Jx | Jy]^T * pxDelta = deltaUV
  // i.e. pxDelta.x * Jx + pxDelta.y * Jy = deltaUV
  // This is a 2x2 linear system. Let M = [Jx Jy] (columns), invert M.
  float det = Jx.x * Jy.y - Jx.y * Jy.x;
  float invDet = 1.0 / (abs(det) + 1e-8);
  float px =  ( Jy.y * deltaUV.x - Jy.x * deltaUV.y) * invDet;
  float py =  (-Jx.y * deltaUV.x + Jx.x * deltaUV.y) * invDet;
  return vec2(px, py);
}

// Returns true if the Jacobian is degenerate (UV seam / back-projected texel).
// Guards against false draws at UV discontinuities.
bool ovSeamGuard(vec2 Jx, vec2 Jy) {
  float lenJx = length(Jx);
  float lenJy = length(Jy);
  // If one UV axis spans > 0.5 UV units per pixel, we're at a seam - skip.
  return (lenJx > 0.5 || lenJy > 0.5);
}

// Signed distance to a line segment [a, b], in screen pixels.
float ovSegSDF(vec2 fragUV, vec2 aUV, vec2 bUV, vec2 Jx, vec2 Jy) {
  vec2 A = ovUVtoPx(aUV - fragUV, Jx, Jy);
  vec2 B = ovUVtoPx(bUV - fragUV, Jx, Jy);
  vec2 AB = B - A;
  float t = clamp(dot(-A, AB) / max(dot(AB, AB), 1e-8), 0.0, 1.0);
  return length(A + t * AB);
}

// Dash modulation along a segment. Returns 1.0 if 'on', 0.0 if in gap.
// t: normalised position along segment [0..1]
// period: dash period in screen pixels; 0.0 = solid line
// duty: fraction of period that is 'on' (typically 0.5)
// segLenPx: total segment length in pixels
float ovDash(float t, float period, float duty, float segLenPx) {
  if (period < 0.5) return 1.0;   // solid
  float phase = mod(t * segLenPx, period);
  return step(phase, period * duty);
}

// For dashed lines we need the closest point parameter t as well.
float ovSegSDFWithT(vec2 fragUV, vec2 aUV, vec2 bUV, vec2 Jx, vec2 Jy,
                    out float t, out float segLenPx) {
  vec2 A = ovUVtoPx(aUV - fragUV, Jx, Jy);
  vec2 B = ovUVtoPx(bUV - fragUV, Jx, Jy);
  vec2 AB = B - A;
  float lenAB2 = max(dot(AB, AB), 1e-8);
  segLenPx = sqrt(lenAB2);
  // t is relative to fragment, offset by A
  // closest t = -A·AB / |AB|²  remapped to [0..1] along segment
  // We want t along the full segment [a, b], so offset by 0.5 of frag distance
  t = clamp(dot(-A, AB) / lenAB2, 0.0, 1.0);
  return length(A + t * AB);
}

// Signed distance to a circle outline (ring), in screen pixels.
float ovCircleSDF(vec2 fragUV, vec2 centerUV, float outerRadPx, vec2 Jx, vec2 Jy) {
  vec2 d = ovUVtoPx(centerUV - fragUV, Jx, Jy);
  return abs(length(d) - outerRadPx);
}

// Anti-aliased coverage from a distance and half-width, both in screen pixels.
float ovAA(float distPx, float halfWidthPx) {
  return 1.0 - smoothstep(halfWidthPx - 0.5, halfWidthPx + 0.5, distPx);
}

// Analytical aa grid line distance in screen pixels for one axis.
// coord: the UV coordinate along the grid axis
// spacing: grid spacing in UV units
// offset: grid phase offset in UV units
// The Jacobian component: uvPerPx for this axis
float ovGridLineDist(float coord, float spacing, float offset, float uvPerPx) {
  float c = mod((coord - offset) / spacing, 1.0);         // [0, 1) within cell
  float distUV = min(c, 1.0 - c) * spacing;               // UV distance to nearest line
  return distUV / max(abs(uvPerPx), 1e-8);                 // convert to screen pixels
}

// ---- Overlay composite --------------------------------------------------

void applyShaderOverlay(inout vec4 fragColor) {

  // Back-face guard: skip overlay on back faces
  if (!gl_FrontFacing) return;

  vec2 Jx, Jy;
  ovJacobian(vUv, Jx, Jy);

  // Seam / degenerate Jacobian guard
  if (ovSeamGuard(Jx, Jy)) return;

  vec4 accum = vec4(0.0);

  // -- Analytical grids --------------------------------------------------
  #define MAX_GRIDS 8
  for (int gi = 0; gi < MAX_GRIDS; gi++) {
    if (gi >= uNumGrids) break;
    vec4 g0 = ovFetch(uGridTex, gi * 2,     GRID_TEX_W);
    vec4 g1 = ovFetch(uGridTex, gi * 2 + 1, GRID_TEX_W);
    float spacU = g0.r, spacV = g0.g, offU = g0.b, offV = g0.a;
    vec4  col   = vec4(g1.rgb, 1.0);
    float hw    = g1.a;

    // Distance to nearest U grid line (in screen pixels)
    float uvPerPxU = length(Jx);   // magnitude of dUV/dpx in x-screen direction
    float uvPerPxV = length(Jy);
    float dU = ovGridLineDist(vUv.x, spacU, offU, uvPerPxU);
    float dV = ovGridLineDist(vUv.y, spacV, offV, uvPerPxV);
    float d  = min(dU, dV);
    float a  = ovAA(d, hw);
    accum = mix(accum, col, a * col.a);
  }

  // -- Line segments -----------------------------------------------------
  #define MAX_SEGS 256
  for (int si = 0; si < MAX_SEGS; si++) {
    if (si >= uNumSegs) break;
    vec4 t0 = ovFetch(uSegTex, si * 3,     SEG_TEX_W);
    vec4 t1 = ovFetch(uSegTex, si * 3 + 1, SEG_TEX_W);
    vec4 t2 = ovFetch(uSegTex, si * 3 + 2, SEG_TEX_W);
    vec2 aUV     = t0.xy;
    vec2 bUV     = t0.zw;
    vec4 col     = t1;
    float hw     = t2.r;
    float period = t2.g;
    float duty   = t2.b;

    float t, segLen;
    float d = ovSegSDFWithT(vUv, aUV, bUV, Jx, Jy, t, segLen);
    float dashOn = ovDash(t, period, duty, segLen);
    float a = ovAA(d, hw) * dashOn * col.a;
    accum = mix(accum, col, a);
  }

  // -- Circle outlines (point handles) -----------------------------------
  #define MAX_CIRCLES 256
  for (int ci = 0; ci < MAX_CIRCLES; ci++) {
    if (ci >= uNumCircles) break;
    vec4 c0 = ovFetch(uCircleTex, ci * 2,     CIRCLE_TEX_W);
    vec4 c1 = ovFetch(uCircleTex, ci * 2 + 1, CIRCLE_TEX_W);
    vec2  cUV    = c0.xy;
    float radPx  = c0.z;
    float hw     = c0.w;
    vec4  col    = c1;
    float d = ovCircleSDF(vUv, cUV, radPx, Jx, Jy);
    float a = ovAA(d, hw) * col.a;
    accum = mix(accum, col, a);
  }

  // Composite accumulated overlay onto lit colour
  fragColor.rgb = mix(fragColor.rgb, accum.rgb, accum.a);
}
`;
```

### Constants exported alongside

```js
export const OVERLAY_MAX_SEGS    = 256;
export const OVERLAY_MAX_CIRCLES = 256;
export const OVERLAY_MAX_GRIDS   = 8;
export const OVERLAY_SEG_TEX_W    = OVERLAY_MAX_SEGS    * 3;
export const OVERLAY_CIRCLE_TEX_W = OVERLAY_MAX_CIRCLES * 2;
export const OVERLAY_GRID_TEX_W   = OVERLAY_MAX_GRIDS   * 2;
```

---

## `shaders.js` Changes

1. Import:
   ```js
   import overlayShaderGlsl, {
     OVERLAY_SEG_TEX_W, OVERLAY_CIRCLE_TEX_W, OVERLAY_GRID_TEX_W
   } from './overlay-shader.js';
   ```

2. Add new uniforms (see above).

3. In `fragmentShader` template, inject the overlay GLSL include and
   `applyShaderOverlay()` call:

   ```glsl
   // At top of fragmentShader template string, after existing uniform declarations:
   ${overlayShaderGlsl}   // inlined by JS template literal

   // defines injected via material.defines (both paths always compile):
   // -- SEG_TEX_W, CIRCLE_TEX_W, GRID_TEX_W

   // At end of main(), after gl_FragColor is set and before return:
   #ifdef USE_SHADER_OVERLAY
     applyShaderOverlay(gl_FragColor);
   #else
     // Legacy canvas composite (overlayMap already composited into
     // diffuseSurface earlier in the existing code)
   #endif
   ```

4. Add to `getShaders()` return value: also return `MAX_SEGS`,
   `MAX_CIRCLES`, `MAX_GRIDS` so `bivot.js` can use them.

5. Add `#define` constants via `material.defines`:
   ```js
   material.defines = {
     SEG_TEX_W:    OVERLAY_SEG_TEX_W,
     CIRCLE_TEX_W: OVERLAY_CIRCLE_TEX_W,
     GRID_TEX_W:   OVERLAY_GRID_TEX_W,
     USE_SHADER_OVERLAY: 1,  // toggled to undefined to disable
   };
   ```

---

## `bivot.js` Changes

### New state field

```js
useShaderOverlay: true,
```

Added to the `this.state` defaults block.

### `initShaderOverlay()` — called once after renderer is created

Checks for `OES_texture_half_float` (WebGL1). If absent, sets
`this.state.useShaderOverlay = false` and skips DataTexture allocation.

```js
initShaderOverlay() {
  const gl = this.renderer.getContext();
  const isWebGL2 = this.renderer.capabilities.isWebGL2;
  const hasHalfFloat = isWebGL2 ||
    gl.getExtension('OES_texture_half_float') !== null;
  if (!hasHalfFloat) {
    console.warn('OES_texture_half_float unavailable; using canvas overlay');
    this.state.useShaderOverlay = false;
    return;
  }

  this.segData    = new Float32Array(OVERLAY_SEG_TEX_W    * 4);
  this.circleData = new Float32Array(OVERLAY_CIRCLE_TEX_W * 4);
  this.gridData   = new Float32Array(OVERLAY_GRID_TEX_W   * 4);

  const make = (data, w) => {
    const t = new THREE.DataTexture(
      data, w, 1, THREE.RGBAFormat, THREE.HalfFloatType
    );
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    return t;
  };
  this.segTex    = make(this.segData,    OVERLAY_SEG_TEX_W);
  this.circleTex = make(this.circleData, OVERLAY_CIRCLE_TEX_W);
  this.gridTex   = make(this.gridData,   OVERLAY_GRID_TEX_W);

  this.uniforms.uSegTex.value    = this.segTex;
  this.uniforms.uCircleTex.value = this.circleTex;
  this.uniforms.uGridTex.value   = this.gridTex;
}
```

### `toggleOverlayMode()` — new method

```js
toggleOverlayMode() {
  this.state.useShaderOverlay = !this.state.useShaderOverlay;
  this.meshMaterial.defines.USE_SHADER_OVERLAY =
    this.state.useShaderOverlay ? 1 : undefined;
  this.meshMaterial.needsUpdate = true;   // forces shader recompile (~100ms, once)
  this.state.dirty |= DirtyFlag.Overlay;
  this.requestRender();
  console.log('Overlay mode:', this.state.useShaderOverlay ? 'shader SDF' : 'canvas texture');
}
```

### Keypress handler addition

In the existing `keydown` switch inside `startRender()`:

```js
case 86:  // V
  if (event.shiftKey && this.segTex) {   // only if shader overlay was initialised
    this.toggleOverlayMode();
  }
  break;
```

### `updateOverlay()` — dispatch

```js
updateOverlay() {
  if (this.state.useShaderOverlay && this.segTex) {
    this.updateOverlayShader();
  } else {
    this.updateOverlayCanvas();
  }
}
```

The body of the existing `updateOverlay()` becomes `updateOverlayCanvas()`
with **no other changes**.

### `updateOverlayShader()` — new method

```js
updateOverlayShader() {
  this.buildVectorPrimitives();
  this.segTex.needsUpdate    = true;
  this.circleTex.needsUpdate = true;
  this.gridTex.needsUpdate   = true;
}
```

### `buildVectorPrimitives()` — new method

Walks `state.pointsControl`, `state.boundary`, `state.subBoundary`,
`state.grid`, `state.gridSelection` and writes into `segData`,
`circleData`, `gridData`.

```js
buildVectorPrimitives() {
  let si = 0;   // segment index
  let ci = 0;   // circle index
  let gi = 0;   // grid index

  this.segData.fill(0);
  this.circleData.fill(0);
  this.gridData.fill(0);

  const td = this.state.texDims;
  if (!td) return;

  // Convert texture-pixel coords {x, y} → UV [0,1]
  const toUV = (p) => ({
    u: p.x / td[0],
    v: p.y / td[1]
  });

  // Write one segment record
  const writeSeg = (aUV, bUV, color, hw, dashPeriod=0, dashDuty=0.5) => {
    if (si >= OVERLAY_MAX_SEGS) return;
    const [r, g, b, a] = hexColorToRGBA(color);
    const base = si * 3 * 4;
    // texel 0: a.uv, b.uv
    this.segData[base + 0] = aUV.u;  this.segData[base + 1] = aUV.v;
    this.segData[base + 2] = bUV.u;  this.segData[base + 3] = bUV.v;
    // texel 1: color
    this.segData[base + 4] = r;      this.segData[base + 5] = g;
    this.segData[base + 6] = b;      this.segData[base + 7] = a;
    // texel 2: width / dash
    this.segData[base + 8] = hw;     this.segData[base + 9] = dashPeriod;
    this.segData[base + 10] = dashDuty;
    si++;
  };

  // Write one circle record
  const writeCircle = (cUV, radPx, hw, color) => {
    if (ci >= OVERLAY_MAX_CIRCLES) return;
    const [r, g, b, a] = hexColorToRGBA(color);
    const base = ci * 2 * 4;
    this.circleData[base + 0] = cUV.u;  this.circleData[base + 1] = cUV.v;
    this.circleData[base + 2] = radPx;  this.circleData[base + 3] = hw;
    this.circleData[base + 4] = r;      this.circleData[base + 5] = g;
    this.circleData[base + 6] = b;      this.circleData[base + 7] = a;
    ci++;
  };

  // Write one analytical grid record
  const writeGrid = (spacingUV, offsetUV, color, hw) => {
    if (gi >= OVERLAY_MAX_GRIDS) return;
    const [r, g, b, a] = hexColorToRGBA(color);
    const base = gi * 2 * 4;
    this.gridData[base + 0] = spacingUV[0]; this.gridData[base + 1] = spacingUV[1];
    this.gridData[base + 2] = offsetUV[0];  this.gridData[base + 3] = offsetUV[1];
    this.gridData[base + 4] = r;            this.gridData[base + 5] = g;
    this.gridData[base + 6] = b;            this.gridData[base + 7] = hw;
    gi++;
  };

  // --- Grids (analytical) ---
  if (this.state.texDims && this.state.stretch && this.state.grid) {
    const g = this.state.grid;
    const spacU = g[0] / td[0];
    const spacV = g[1] / td[1];
    if (this.seamsShowing) {
      writeGrid([spacU, spacV], [0, 0], '#009F', 0.6);
    }
    if (this.gridShowing) {
      writeGrid([spacU, spacV], [0, 0], '#009F', 1.0);
    }
    if (this.gridSelectionShowing && this.state.gridSelection) {
      const gs = this.state.gridSelection;
      const selSpacU = gs[0] * spacU;
      const selSpacV = gs[1] * spacV;
      const offU = gs.length >= 4 ? gs[2] * spacU : 0;
      const offV = gs.length >= 4 ? gs[3] * spacV : 0;
      writeGrid([selSpacU, selSpacV], [offU, offV], '#090F', 1.5);
    }
  }

  // --- Boundary (dashed polyline) ---
  if (this.state.boundary) {
    const pts = this.state.boundary;
    for (let i = 1; i < pts.length; i++) {
      writeSeg(toUV(pts[i-1]), toUV(pts[i]), '#FF0F', 0.7, 12, 0.5);
    }
  }

  // --- Sub-boundary ---
  if (this.state.subBoundary) {
    const { path } = this.state.subBoundary;
    for (let i = 1; i < path.length; i++) {
      writeSeg(toUV(path[i-1]), toUV(path[i]), '#FF0F', 0.7, 12, 0.5);
    }
  }

  // --- pointsControl groups ---
  if (this.state.pointsControl) {
    // Sort by z-priority (same as canvas path)
    let priorities = this.state.pointsControl.map((p, i) => ({
      index: i, priority: (p.z ?? 0) + i / 1000
    }));
    priorities.sort((a, b) => a.priority - b.priority);

    priorities.forEach(({ index }) => {
      const p = this.state.pointsControl[index];
      if (!p.visible || !p.points || !p.points.length) return;

      const groupSelected = ['draggingPoint', 'draggingRect', 'selected']
        .includes(this.dragState.state) && this.dragState.group === index;
      const anySelected = ['draggingPoint', 'draggingRect', 'selected']
        .includes(this.dragState.state);
      const alphaStr = (!groupSelected && anySelected) ? '7f' : 'ff';

      // Per-group line width in SCREEN PIXELS (new field, not texture-space)
      const hw    = (p.lineWidthPx    ?? 1.5) * 0.5;  // half-width
      const radPx = (p.pointRadiusPx  ?? 6.0);
      const color = (p.color ?? '#ffffff') + alphaStr;
      const selColor = (p.selectedColor ?? '#ffff00') + alphaStr;

      const uvPoints = p.points.map(toUV);

      // Draw connecting lines
      if (p.lines === 'closed4' || p.lines === 'rect') {
        const n = uvPoints.length;
        if (n >= 2) {
          writeSeg(uvPoints[0], uvPoints[1], color, hw);
        }
        if (p.lines === 'closed4' && n >= 4) {
          writeSeg(uvPoints[1], uvPoints[2], color, hw);
          writeSeg(uvPoints[2], uvPoints[3], color, hw);
          writeSeg(uvPoints[3], uvPoints[0], color, hw);
        } else if (p.lines === 'rect' && n >= 2) {
          writeSeg(uvPoints[0], {u: uvPoints[1].u, v: uvPoints[0].v}, color, hw);
          writeSeg({u: uvPoints[1].u, v: uvPoints[0].v}, uvPoints[1], color, hw);
          writeSeg(uvPoints[1], {u: uvPoints[0].u, v: uvPoints[1].v}, color, hw);
          writeSeg({u: uvPoints[0].u, v: uvPoints[1].v}, uvPoints[0], color, hw);
        }
      } else if (p.lines === 'pairs') {
        for (let i = 0; i < Math.floor(uvPoints.length / 2); i++) {
          writeSeg(uvPoints[i*2], uvPoints[i*2+1], color, hw);
        }
      }
      // Note: staggered closed4 geometry is more complex; see §Staggered below.

      // Draw point handles (circles)
      uvPoints.forEach((uv, i) => {
        const isSelected = groupSelected && i === this.dragState.point;
        const c = isSelected ? selColor : color;
        if (p.pointShape === 'square') {
          // Approximate square with 4 segments
          writeCircle(uv, radPx, hw, c);  // fallback: circle for now; see §Square below
        } else {
          writeCircle(uv, radPx, hw, c);
        }
      });
    });
  }

  this.uniforms.uNumSegs.value    = si;
  this.uniforms.uNumCircles.value = ci;
  this.uniforms.uNumGrids.value   = gi;
}
```

### `updateUniforms()` addition

```js
this.uniforms.uViewportSize.value.set(this.canvas.width, this.canvas.height);
```

---

## Deferred / Phased Work

### Phase 2 – Square point handles

Square handles require 4 segment records per point. Add `pointShape` check
in `buildVectorPrimitives()`:

```js
if (p.pointShape === 'square') {
  // 4 micro-segments forming a square of side 2*radPx
  // Compute corners in UV space by inverting the Jacobian (not available
  // in JS; approximate using texel-to-UV scale).
  // Simpler: encode as 4 segments with screen-px endpoints computed from
  // a per-frame UV-per-pixel estimate derived from camera distance.
}
```

### Phase 2 – Full staggered `closed4` geometry

The `p.staggered` case in `drawPoints()` computes derived construction lines
from 3 points. This logic translates 1:1 to JS — just call `writeSeg()`
instead of `drawLineSegment()`.

### Phase 2 – Square handle accurate corners

Pass the canvas-pixel-per-UV ratio as a pair of uniforms and compute square
corners analytically in the GLSL using the Jacobian inverse.

---

## UV Coordinate Convention

`td = state.texDims` is in **texture pixels**. `toUV(p)` maps
`{x, y}` in `[0, texDims[0]] × [0, texDims[1]]` to UV `[0,1]²`.

`vUv` in the fragment shader is the Three.js UV after applying
`uvTransform` (which incorporates `setTexRepeat()` scale+offset). So the
DataTexture UV coords need to be in the **same space** as `vUv` in the
shader.

**Solution**: store primitives in normalised UV [0,1]² and apply `uvTransform`
before storing, OR apply `uvTransform` in the shader before the SDF
evaluation. The shader approach is cleaner:

```glsl
// In applyShaderOverlay(), before using vUv:
// Invert the UV transform to get back to the [0,1] texture space
// that the primitive coordinates are stored in.
vec2 rawUV = (inverse(mat2(uvTransform[0].xy, uvTransform[1].xy)) *
              (vUv - vec2(uvTransform[2].x, uvTransform[2].y)));
// Then use rawUV instead of vUv throughout.
```

`mat2` inverse is available in GLSL ES 1.00, and `uvTransform` is already
a declared uniform. This ensures primitives defined in texture [0,1] space
are correctly located regardless of zoom/repeat.

---

## `hexColorToRGBA()` Helper

Small utility needed in `buildVectorPrimitives()`:

```js
function hexColorToRGBA(hex) {
  // Handles '#RRGGBB', '#RRGGBBAA', '#RGB', '#RGBA'
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+'ff';
  if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length === 6) h += 'ff';
  return [
    parseInt(h.slice(0,2),16)/255,
    parseInt(h.slice(2,4),16)/255,
    parseInt(h.slice(4,6),16)/255,
    parseInt(h.slice(6,8),16)/255,
  ];
}
```

---

## Summary of New State Fields

| Field | Location | Default | Purpose |
|---|---|---|---|
| `state.useShaderOverlay` | `this.state` | `true` | Toggle shader vs canvas path |
| `p.lineWidthPx` | each `pointsControl[i]` entry | `1.5` | Line half-width in screen pixels |
| `p.pointRadiusPx` | each `pointsControl[i]` entry | `6.0` | Point handle radius in screen pixels |

Old fields `lineThicknessFactor`, `pointSizeFactor`, `getLineWidths()`, and
`getPointRadii()` remain in place for the canvas path and are ignored in the
shader path.

---

## Files To Create / Modify

| File | Action |
|---|---|
| `src/bivot-js/overlay-shader.js` | **Create** |
| `src/bivot-js/shaders.js` | Modify: import, new uniforms, `#ifdef` block |
| `src/bivot-js/bivot.js` | Modify: `initShaderOverlay`, `toggleOverlayMode`, `updateOverlayShader`, `buildVectorPrimitives`, `updateOverlayCanvas` rename, keypress, `updateUniforms` |
| `src/bivot-js/stateUtils.js` | No changes |
| `src/bivot-js/bivot-fragment.glsl` | No runtime impact; ignore |
