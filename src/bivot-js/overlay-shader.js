// overlay-shader.js
// GPU-side vector overlay renderer for bivot.
//
// Exports a GLSL ES 1.00-compatible fragment shader include string that
// evaluates SDF (signed distance field) for:
//   - Analytical grid lines (no canvas, no aliasing at any zoom level)
//   - Line segments with optional dashing
//   - Circle outlines (used for point handles)
//
// All primitive coordinates are stored in normalised texture UV space [0,1]².
// The shader inverts uvTransform to map vUv → rawUV before evaluation.
//
// Primitive data is stored in RGBA HalfFloat DataTextures (WebGL1-compatible
// via OES_texture_half_float; standard in WebGL2).
//
// Compatible with GLSL ES 1.00 (WebGL1) and GLSL ES 3.00 (WebGL2).
// Requires: GL_OES_standard_derivatives (already declared in bivot shaders).

'use strict';

const glsl = x => x; // no-op; enables GLSL syntax highlighting in VS Code

// ---------------------------------------------------------------------------
// JS-side constants.
// OVERLAY_MAX_* are compile-time loop ceilings baked into the shader — only a
// shader recompile can change them.  Set them high enough that they are never
// the binding constraint in practice.
// OVERLAY_INIT_*_CAP are the starting buffer capacities; buffers grow by
// doubling at runtime (see _growOverlayBuffer in bivot.js) up to the ceilings.
// ---------------------------------------------------------------------------
export const OVERLAY_MAX_SEGS        = 2048;
export const OVERLAY_MAX_CIRCLES     = 2048;
export const OVERLAY_MAX_GRIDS       = 64;
export const OVERLAY_INIT_SEG_CAP    = 1024;
export const OVERLAY_INIT_CIRCLE_CAP = 512;
export const OVERLAY_INIT_GRID_CAP   = 16;

// ---------------------------------------------------------------------------
// GLSL include string
// ---------------------------------------------------------------------------
export default glsl`
// =========================================================================
// Overlay SDF — injected into the bivot fragment shader.
// GLSL ES 1.00 compatible.
// Guarded by #ifdef USE_SHADER_OVERLAY so it compiles to nothing in the
// legacy canvas-texture path.
// =========================================================================

#ifdef USE_SHADER_OVERLAY

// Compile-time loop ceilings — buffers grow dynamically up to these values.
#define OVERLAY_MAX_SEGS     2048
#define OVERLAY_MAX_CIRCLES  2048
#define OVERLAY_MAX_GRIDS    64

// uvTransform is declared in the vertex shader; redeclare here for the
// fragment shader so we can invert vUv back to raw texture UV [0,1]².
// (uSegTex, uCircleTex, uGridTex, uNumSegs/Circles/Grids, and the texture-width
//  uniforms are declared unconditionally in the main fragment shader template in shaders.js.)
uniform mat3 uvTransform;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fetch one RGBA texel from a 1-row DataTexture by integer texel index.
vec4 ovFetch(sampler2D tex, int idx, float texWidth) {
  float u = (float(idx) + 0.5) / texWidth;
  return texture2D(tex, vec2(u, 0.5));
}

// Invert the affine part of uvTransform to recover raw texture UV from vUv.
//   vUv = (uvTransform * vec3(rawUV, 1.0)).xy
// Manual 2×2 inversion — no GLSL inverse() needed (GLSL ES 1.00 compatible).
vec2 ovRawUV(vec2 vu) {
  // Column-major mat3: [col0][row], so uvTransform[col][row]
  float a  = uvTransform[0][0];  float b  = uvTransform[1][0];
  float c  = uvTransform[0][1];  float d  = uvTransform[1][1];
  float tx = uvTransform[2][0];  float ty = uvTransform[2][1];
  float invDet = 1.0 / (a * d - b * c + 1e-10);
  vec2  dv     = vu - vec2(tx, ty);
  return vec2(
    ( d * dv.x - b * dv.y) * invDet,
    (-c * dv.x + a * dv.y) * invDet
  );
}

// Project a rawUV-space delta vector into screen pixels using the local
// Jacobian (Jx = dFdx(rawUV), Jy = dFdy(rawUV)).
// Solves:  px.x * Jx + px.y * Jy = dUV  (2×2 linear system)
vec2 ovUVtoPx(vec2 dUV, vec2 Jx, vec2 Jy) {
  float invDet = 1.0 / (Jx.x * Jy.y - Jy.x * Jx.y + 1e-10);
  return vec2(
    ( Jy.y * dUV.x - Jy.x * dUV.y) * invDet,
    (-Jx.y * dUV.x + Jx.x * dUV.y) * invDet
  );
}

// True if the Jacobian indicates a UV seam or back-projected fragment.
// If |dUV/dpx| > 0.5 UV/pixel, the fragment is likely at a discontinuity.
bool ovSeamGuard(vec2 Jx, vec2 Jy) {
  return (dot(Jx, Jx) > 0.25 || dot(Jy, Jy) > 0.25);
}

// Signed distance (screen pixels) from rawUV to closed segment [aUV, bUV].
// Also writes closest-point parameter t ∈ [0,1] (for dash evaluation).
float ovSegSDF(vec2 rawUV, vec2 aUV, vec2 bUV,
               vec2 Jx, vec2 Jy, out float t) {
  vec2 A  = ovUVtoPx(aUV - rawUV, Jx, Jy);
  vec2 B  = ovUVtoPx(bUV - rawUV, Jx, Jy);
  vec2 AB = B - A;
  t = clamp(dot(-A, AB) / max(dot(AB, AB), 1e-8), 0.0, 1.0);
  return length(A + t * AB);
}

// Signed distance (screen pixels) to a circle outline (ring).
// radUV is the circle radius in rawUV space (texture-pixel fixed when set to texPx/imDim).
float ovCircleSDF(vec2 rawUV, vec2 centerUV, float radUV,
                  vec2 Jx, vec2 Jy) {
  vec2  dUV    = centerUV - rawUV;
  float distUV = length(dUV);
  // UV vector from fragment to the nearest point on the ring
  vec2 toRing = dUV * (radUV / max(distUV, 1e-10) - 1.0);
  return length(ovUVtoPx(toRing, Jx, Jy));
}

// Signed distance (screen pixels) to a screen-axis-aligned square outline.
// halfSideUV: half-side length in rawUV space (same unit as circle radUV).
// The square is axis-aligned in screen space, computed via the local Jacobian.
float ovSquareSDF(vec2 rawUV, vec2 centerUV, float halfSideUV,
                  vec2 Jx, vec2 Jy) {
  // Fragment position relative to square centre in screen pixels
  vec2 p = ovUVtoPx(centerUV - rawUV, Jx, Jy);
  // Convert UV half-side to screen pixels, averaging U and V axes for robustness
  float hsU = length(ovUVtoPx(vec2(halfSideUV, 0.0), Jx, Jy));
  float hsV = length(ovUVtoPx(vec2(0.0, halfSideUV), Jx, Jy));
  float hs  = (hsU + hsV) * 0.5;
  // 2D box fill SDF (negative inside, positive outside, 0 on boundary)
  vec2  q        = abs(p) - hs;
  float fillDist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  // Ring distance: distance from fragment to the box perimeter line
  return abs(fillDist);
}

// AA coverage from distance and half-width (screen pixels).
float ovAA(float distPx, float halfWidthPx) {
  return 1.0 - smoothstep(halfWidthPx - 0.5, halfWidthPx + 0.5, distPx);
}

// ---------------------------------------------------------------------------
// Main overlay evaluation — call at end of main() after gl_FragColor is set.
// ---------------------------------------------------------------------------
void applyShaderOverlay(inout vec4 fragColor) {
  // Back-face guard: skip overlay on back-facing fragments
  if (!gl_FrontFacing) return;

  // Compute rawUV (normalised texture UV [0,1]²) from the interpolated vUv
  vec2 rawUV = ovRawUV(vUv);

  // Build the Jacobian: UV change per screen pixel in x/y screen directions
  vec2 Jx = dFdx(rawUV);
  vec2 Jy = dFdy(rawUV);

  // Detect UV discontinuities (seams, back-projected mesh edges).
  // Grids and circles are always suppressed at seams.  Segments can opt-out
  // of the guard via the seamBypass flag (t2.a == 1.0), so that boundary /
  // subBoundary polylines that run along the edge of the texture are still
  // rendered even where the 3D-mesh UV seam happens to coincide.
  bool atSeam = ovSeamGuard(Jx, Jy);

  // Accumulated overlay colour (straight alpha, over-composited front-to-back)
  vec3 accumRGB = vec3(0.0);
  float accumA  = 0.0;

  // ---- Analytical grid lines (skipped at UV seams unless seamBypass) ------
  // Each grid entry occupies 3 texels:
  //   texel+0: (spacU, spacV, offsetU, offsetV)  — spacing and phase in rawUV
  //   texel+1: (r, g, b, a)                      — colour (straight alpha)
  //   texel+2: (halfWidthPx, dashPeriodUV, _unused, _unused)
  //            halfWidthPx < 0 → render even at UV seam fragments (seamBypass)
  //            dashPeriodUV: dash half-period in rawUV units; 0 = solid
  //              U-gridlines (vertical)   dash along rawUV.y
  //              V-gridlines (horizontal) dash along rawUV.x
  for (int gi = 0; gi < OVERLAY_MAX_GRIDS; gi++) {
    if (gi >= uNumGrids) break;
    vec4 g0 = ovFetch(uGridTex, gi * 3,     uGridTexW);
    vec4 g1 = ovFetch(uGridTex, gi * 3 + 1, uGridTexW);
    vec4 g2 = ovFetch(uGridTex, gi * 3 + 2, uGridTexW);

    float spacU        = max(g0.r, 1e-8);  float spacV = max(g0.g, 1e-8);
    float offU         = g0.b;             float offV  = g0.a;
    vec4  col          = g1;
    bool  bypassGuard  = (g2.r < 0.0);    // negative halfWidthPx → ignore seam guard
    float hw           = abs(g2.r);
    float dashPeriodUV = g2.g;            // 0 = solid

    // Distance to nearest vertical gridline (constant rawUV.x lines)
    float cu       = mod((rawUV.x - offU) / spacU + 0.5, 1.0) - 0.5;
    float distU_px = length(ovUVtoPx(vec2(abs(cu) * spacU, 0.0), Jx, Jy));

    // Distance to nearest horizontal gridline (constant rawUV.y lines)
    float cv       = mod((rawUV.y - offV) / spacV + 0.5, 1.0) - 0.5;
    float distV_px = length(ovUVtoPx(vec2(0.0, abs(cv) * spacV), Jx, Jy));

    float alphaU = ovAA(distU_px, hw) * col.a;
    float alphaV = ovAA(distV_px, hw) * col.a;

    // Dashing: half-period in rawUV units so the mod argument stays bounded
    // (rawUV ∈ [0,1] → max argument = 1/dashPeriodUV, independent of zoom).
    // U-gridlines (vertical) dash along rawUV.y; V-gridlines along rawUV.x.
    if (dashPeriodUV > 0.0) {
      if (mod(rawUV.y / dashPeriodUV, 2.0) >= 1.0) alphaU = 0.0;
      if (mod(rawUV.x / dashPeriodUV, 2.0) >= 1.0) alphaV = 0.0;
    }

    float alpha = max(alphaU, alphaV);
    if (!atSeam || bypassGuard) {
      accumRGB = accumRGB * (1.0 - alpha) + col.rgb * alpha;
      accumA   = accumA + alpha * (1.0 - accumA);
    }
  }

  // ---- Line segments ---------------------------------------------------
  // Each segment occupies 3 texels:
  //   texel+0: (aU, aV, bU, bV)                              — endpoints in rawUV
  //   texel+1: (r, g, b, a)                                  — colour (straight alpha)
  //   texel+2: (halfWidthPx, halfPeriodUV, phaseOffsetUV, seamBypass)
  //            halfPeriodUV:  dash half-period in rawUV units; 0 = solid line
  //            phaseOffsetUV: cumulative UV arc length from polyline start
  //            seamBypass:    1.0 = render even at UV seam fragments
  for (int si = 0; si < OVERLAY_MAX_SEGS; si++) {
    if (si >= uNumSegs) break;
    vec4 t0 = ovFetch(uSegTex, si * 3,     uSegTexW);
    vec4 t1 = ovFetch(uSegTex, si * 3 + 1, uSegTexW);
    vec4 t2 = ovFetch(uSegTex, si * 3 + 2, uSegTexW);

    vec2  aUV          = t0.xy;    vec2  bUV        = t0.zw;
    vec4  col          = t1;
    float hw           = t2.r;
    float halfPeriodUV = t2.g;  // 0 = solid
    float phaseOffUV   = t2.b;  // cumulative UV arc length for phase continuity
    float bypassGuard  = t2.a;  // 1.0 = skip seam guard for this segment

    // Skip this segment at UV seams unless it has the seamBypass flag set.
    if (atSeam && bypassGuard < 0.5) continue;

    float t;
    float d = ovSegSDF(rawUV, aUV, bUV, Jx, Jy, t);

    float alpha = ovAA(d, hw) * col.a;

    // Dashing: half-period stored in rawUV units so the mod argument is
    // bounded by the polyline perimeter (independent of zoom level).
    // Phase is anchored to texture UV (stable when panning).
    if (halfPeriodUV > 0.0) {
      float arcLenUV = t * length(bUV - aUV) + phaseOffUV;
      if (mod(arcLenUV / halfPeriodUV, 2.0) >= 1.0) alpha = 0.0;
    }

    accumRGB = accumRGB * (1.0 - alpha) + col.rgb * alpha;
    accumA   = accumA + alpha * (1.0 - accumA);
  }

  // ---- Circle / square outlines (point handles, skipped at UV seams) --
  // Each handle occupies 2 texels:
  //   texel+0: (centerU, centerV, shapeR, halfWidthPx)
  //            shapeR > 0 → circle, radius = shapeR (rawUV)
  //            shapeR < 0 → screen-aligned square, half-side = abs(shapeR) (rawUV)
  //   texel+1: (r, g, b, a)                 — colour (straight alpha)
  if (!atSeam) {
  for (int ci = 0; ci < OVERLAY_MAX_CIRCLES; ci++) {
    if (ci >= uNumCircles) break;
    vec4 c0 = ovFetch(uCircleTex, ci * 2,     uCircleTexW);
    vec4 c1 = ovFetch(uCircleTex, ci * 2 + 1, uCircleTexW);

    vec2  cUV  = c0.xy;
    // c0.z encodes shape: positive = circle radius (rawUV), negative = square half-side (rawUV)
    float rawR = c0.z;
    float absR = abs(rawR);
    float hw   = c0.w;
    vec4  col  = c1;

    float d;
    if (rawR < 0.0) {
      d = ovSquareSDF(rawUV, cUV, absR, Jx, Jy);
    } else {
      d = ovCircleSDF(rawUV, cUV, absR, Jx, Jy);
    }
    float alpha = ovAA(d, hw) * col.a;
    accumRGB = accumRGB * (1.0 - alpha) + col.rgb * alpha;
    accumA   = accumA + alpha * (1.0 - accumA);
  }
  } // end !atSeam (circles)

  // ---- Composite accumulated overlay onto lit fragment -----------------
  fragColor.rgb = fragColor.rgb * (1.0 - accumA) + accumRGB * accumA;
}

#endif // USE_SHADER_OVERLAY
`;
