// Copyright (C) Bandicoot Imaging Sciences 2019
'use strict';

// The Three.js import paths in bivot.js, shaders.js and stateUtils.js need to match.

import * as THREE from '@bandicoot-imaging-sciences/three';

export default function getShaders() {
  const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        // Set textures to null here and assign later to avoid duplicating texture data.
        'diffuseMap': {value: null},
        'normalMap': {value: null}, // Three.js shader chunks assume normal map is called normalMap.
        'specularMap': {value: null},
        'overlayMap': {value: null},
        'textureLayer': {value: 0},
        'normalScale': { value: new THREE.Vector2( 1, 1 ) }, // Three.js shader chunks: scaling for xy normals.
        'uExposure': {value: 1.0},
        'uDiffuse': {value: 1.0},
        'uSpecular': {value: 1.0},
        'uRoughness': {value: 1.0},
        'uTint': {value: true},
        'uFresnel': {value: false},
        'uAoStrength': {value: 1.0},
        'uBrdfModel': {value: 0}, // 0: BIS; 1: M/R
        'uThreeJsShader': {value: false},
        'uBrdfVersion': {value: 2.0},
        'uLoadExr': {value: false},
        'uDual8Bit': {value: false},
        'diffuseMapLow': {value: null},  // Low byte when dual 8-bit textures are loaded
        'normalMapLow': {value: null},   // Low byte when dual 8-bit textures are loaded
        'specularMapLow': {value: null}, // Low byte when dual 8-bit textures are loaded
        'ltc_1': {value: null}, // Linearly Transformed Cosines look-up table 1 for area lighting
        'ltc_2': {value: null}, // Linearly Transformed Cosines look-up table 2 for area lighting
        'uBrightness': {value: 1.0},
        'uContrast': {value: 0.5},
        'uHue': {value: 0.0},
        'uSaturation': {value: 0.0},
        'uColorTransform': { value: new THREE.Matrix3() }, // Default: Identity matrix
        'displacementMap': {value: null},
        'displacementScale': {value: 0.05},
        'displacementBias': {value: 0.0},
      }
    ]);

  const glsl = x => x.toString(); // No-op to trigger GLSL syntax highlighting in VS Code with glsl-literal extension.
  const vertexShader = glsl`
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    #ifdef USE_TANGENT
      varying vec3 vTangent;
      varying vec3 vBitangent;
    #endif

    #include <displacementmap_pars_vertex>

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);

      vUv = uv;
      // Alternatively this might be needed if we are scaling the texture:
      // vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>

      vNormal = normalize(transformedNormal);
      #ifdef USE_TANGENT
        vTangent = normalize(transformedTangent);
        vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);
      #endif

      #include <begin_vertex>
      #include <displacementmap_vertex>
      #include <project_vertex>

      vViewPosition = -mvPosition.xyz;
    }
    `;

  const fragmentShader = glsl`
    uniform sampler2D diffuseMap;
    // Defined in <normalmap_pars_fragment>
    // uniform sampler2D normalMap;
    uniform sampler2D specularMap;
    uniform sampler2D displacementMap;
    uniform sampler2D diffuseMapLow;
    uniform sampler2D normalMapLow;
    uniform sampler2D specularMapLow;

    uniform sampler2D overlayMap;
    uniform int textureLayer;

    uniform float uExposure;
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uDiffuse;
    uniform float uSpecular;
    uniform float uRoughness;
    uniform bool  uTint;
    uniform bool  uFresnel;
    uniform float uAoStrength;
    uniform bool  uThreeJsShader;
    uniform mat3  uColorTransform;
    uniform float uHue;
    uniform float uSaturation;

    uniform int   uBrdfModel;
    uniform float uBrdfVersion;
    uniform bool  uDual8Bit;
    uniform bool  uLoadExr;

    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    float pi = 3.14159265359;

    #include <common>
    #include <bsdfs>
    #include <packing>
    #include <lights_pars_begin>
    #include <normalmap_pars_fragment>
    #include <lights_physical_pars_fragment>

    float calcLightAttenuation(float lightDistance, float cutoffDistance, float decayExponent) {
      if (decayExponent > 0.0) {
        // The common ShaderChunk includes: #define saturate(a) clamp( a, 0.0, 1.0 )
        return pow(saturate(-lightDistance/cutoffDistance + 1.0), decayExponent);
      }
      return 1.0;
    }

    float DisneySpecular(float specular, float roughness, float ndh, float s) {
      // TODO: Add episilon to fragile denominators.
      float r4 = pow(roughness, 4.0);
      float k = 1.0 - r4;
      float c = (1.0/(s*PI))*((1.0/r4 + (1.0/(2.0*sqrt(k))*log((sqrt(k) + k)/(sqrt(k) - k)))));
      float denom = pow((1.0 + (r4 - 1.0)*pow(ndh, 2.0)), 2.0);
      return (specular)/(c*denom);
    }

    float MRSpecular(float roughness, float ndh, float ndl, float ndv) {
      float r2 = roughness * roughness;

      // Substance Designer uses a different expression for visibility:
      //   float k = r2 / 2.0;
      //   float visibility = 1.0 / (4.0 * (ndl * (1.0 - k) + k) * (ndv * (1.0 - k) + k));

      // Three.js
      //   The following code should be equivalent to calling:
      //     return G_GGX_Smith(r2, ndl, ndv) * D_GGX(r2, ndh);
      float k = r2 * r2;
      float gl = ndl + sqrt(ndv*ndv * (1.0 - k) + k);
      float gv = ndv + sqrt(ndl*ndl * (1.0 - k) + k);
      float visibility = 1.0 / (gl * gv);
      //float visibility = 0.25;
      float t = r2 / (1.0 + (r2 * r2 - 1.0) * ndh*ndh);
      return visibility * t*t / pi;
    }

    const mat3 RGB_TO_XYZ = (mat3(
      0.4124564, 0.2126729, 0.0193339,
      0.3575761, 0.7151522, 0.1191920,
      0.1804375, 0.0721750, 0.9503041
    ));

    const mat3 XYZ_TO_RGB = (mat3(
       3.2404542, -0.9692660,  0.0556434,
      -1.5371385,  1.8760108, -0.2040259,
      -0.4985314,  0.0415560,  1.0572252
    ));


    float cbrt(float x) {
      #ifdef HAS_BITS_TO_FLOAT
        // Carmack approximation to cube root
        float y = sign(x) * uintBitsToFloat(floatBitsToUint(abs(x)) / 3u + 0x2a514067u);

        // Newton iterations
        for (int i = 0; i < 2; i++) {
            y = (2.0 * y + x / (y * y)) * 0.333333333;
        }
        // Halley iterations
        for (int i = 0; i < 1; i++) {
          float y3 = y * y * y;
          y *= (y3 + 2.0 * x) / (2.0 * y3 + x);
        }
      #else
        float y = pow(x, 0.333333333);
      #endif
      return y;
    }

    vec3 rgbToXyz(vec3 rgb) {
      return RGB_TO_XYZ * rgb;
    }
    vec3 xyzToRgb(vec3 xyz) {
      return XYZ_TO_RGB * xyz;
    }

    const float LAB_EPS = 216.0 / 24389.0;
    const float LAB_KAP = 24389.0 / 27.0;
    const vec3 D65 = vec3(0.95047, 1.0, 1.08883);
    const float UW = 4.0 * D65.x / (D65.x + 15.0 * D65.y + 3.0 * D65.z);
    const float VW = 9.0 * D65.y / (D65.x + 15.0 * D65.y + 3.0 * D65.z);

    vec3 xyzToLuv(vec3 xyz) {
      float den = xyz.x + 15.0 * xyz.y + 3.0 * xyz.z;
      if (den == 0.0) {
        return vec3(0.0);
      }
      float uI = 4.0 * xyz.x / den;
      float vI = 9.0 * xyz.y / den;
      float yR = xyz.y / D65.y;
      float L = (yR > LAB_EPS) ? 116.0 * cbrt(yR) - 16.0 : LAB_KAP * yR;
      float u = 13.0 * L * (uI - UW);
      float v = 13.0 * L * (vI - VW);
      return vec3(L, u, v);
    }

    vec3 luvToXyz(vec3 luv) {
      float L0 = (luv.x + 16.0) / 116.0;
      float y = (luv.x > LAB_KAP * LAB_EPS) ? L0 * L0 * L0 : luv.x / LAB_KAP;
      float a = luv.x > 0.0 ? (52.0 * luv.x / (luv.y + 13.0 * luv.x * UW) - 1.0) / 3.0 : 0.0;
      float b = -5.0 * y;
      float c = -0.333333333;
      float d = luv.x > 0.0 ? y * (39.0 * luv.x / (luv.z + 13.0 * luv.x * VW) - 5.0) : 0.0;
      float x = (d - b) / (a - c);
      float z = x * a + b;
      return vec3(x, y, z);
    }

    vec3 luvToLCHuv(vec3 luv) {  // Note: returns h radians
      float c = length(vec2(luv.y, luv.z));
      float h = atan(luv.z, luv.y);
      return vec3(luv.x, c, h);
    }

    vec3 lchUVToLuv(vec3 lch) {  // Note: expects h in radians
      float u = lch.y * cos(lch.z);
      float v = lch.y * sin(lch.z);
      return vec3(lch.x, u, v);
    }

    vec3 hueSatShift(vec3 rgb, float hue, float saturation) {
      vec3 lch = luvToLCHuv(xyzToLuv(rgbToXyz(rgb)));
      lch.y = max(lch.y + lch.x * saturation, 0.0);
      lch.z += hue;
      return xyzToRgb(luvToXyz(lchUVToLuv(lch)));
    }

    void main() {
      vec4 diffuseSurface = texture2D(diffuseMap, vUv);
      vec3 normalSurface = texture2D(normalMap, vUv).xyz;
      vec4 specularTexel = texture2D(specularMap, vUv);

      #ifdef USE_DISPLACEMENTMAP
        vec3 displacementSurface = texture2D(displacementMap, vUv).xyz;
      #endif

      if (uDual8Bit) {
        vec4 diffuseSurfaceLow = texture2D(diffuseMapLow, vUv) / 256.0;
        vec3 normalSurfaceLow = texture2D(normalMapLow, vUv).xyz / 256.0;
        vec4 specularTexelLow = texture2D(specularMapLow, vUv) / 256.0;

        diffuseSurface = diffuseSurface + diffuseSurfaceLow;
        normalSurface = normalSurface + normalSurfaceLow;
        specularTexel = specularTexel + specularTexelLow;
      }

      float s = 1.0;
      float white_L = 1.0;
      float specularSurface = 0.0;
      float roughnessSurface = 0.0;
      float tintSurface = 0.0;
      float metallicSurface = 0.0;
      float aoSurface = 0.5;

      if (uBrdfModel == 1) {
        // (M/R model)
        if (uBrdfVersion >= 4.0) {
          white_L = 32767.0;
        } else {
          white_L = 16383.0;
        }
        roughnessSurface = specularTexel.r;
        metallicSurface = specularTexel.g;
        if (uBrdfVersion >= 3.0) {
          aoSurface = specularTexel.b;
        }
      } else {
        // uBrdfModel == 0 (BIS model)
        specularSurface = specularTexel.r;
        roughnessSurface = specularTexel.g;
        if (uTint && uBrdfVersion >= 2.0) {
          tintSurface = specularTexel.b;
        }
        if (uBrdfVersion >= 2.0) {
          s = 65535.0*0.01;
        }

        if (uLoadExr) {
          if (uBrdfVersion == 3.0) {
            diffuseSurface *= 16383.0;
          }
        } else {
          diffuseSurface *= 65535.0;
        }
      }

      #ifdef COLOR_TRANSFORM
        // Apply white balance transform to basecolor
        diffuseSurface = vec4(uColorTransform * diffuseSurface.rgb, diffuseSurface.a);
      #endif

      #ifdef HUE_SATURATION
        // Apply hue and saturation transform
        diffuseSurface = vec4(hueSatShift(diffuseSurface.rgb, uHue, uSaturation), diffuseSurface.a);
      #endif

      if (textureLayer == 1) {
        diffuseSurface = vec4(diffuseSurface.rgb / 2.0, 1.0);
        roughnessSurface = 1.0;
        metallicSurface = 0.0;
        normalSurface = vec3(0.0, 0.0, 1.0);
      } else if (textureLayer == 2) {
        diffuseSurface = vec4(vec3(roughnessSurface / 2.0), 1.0);
        roughnessSurface = 1.0;
        metallicSurface = 0.0;
        normalSurface = vec3(0.0, 0.0, 1.0);
      } else if (textureLayer == 3) {
        diffuseSurface = vec4(vec3(metallicSurface / 2.0), 1.0);
        roughnessSurface = 1.0;
        metallicSurface = 0.0;
        normalSurface = vec3(0.0, 0.0, 1.0);
      } else if (textureLayer == 4) {
        diffuseSurface = vec4(normalSurface.xyz / 2.0, 1.0);
        roughnessSurface = 1.0;
        metallicSurface = 0.0;
        normalSurface = vec3(0.0, 0.0, 1.0);
      #ifdef USE_DISPLACEMENTMAP
        } else if (textureLayer == 5) {
          diffuseSurface = vec4(displacementSurface.xyz / 2.0, 1.0);
          roughnessSurface = 1.0;
          metallicSurface = 0.0;
          normalSurface = vec3(0.0, 0.0, 1.0);
      #endif
      }

      // Composite the overlay onto the basecolor
      vec4 overlaySurface = texture2D(overlayMap, vUv);
      diffuseSurface.rgb = mix(diffuseSurface.rgb, overlaySurface.rgb, overlaySurface.a);

      if (uThreeJsShader && uBrdfModel == 1) {
        ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
        vec4 diffuseColor = diffuseSurface;
        float metalnessFactor = metallicSurface;
        float roughnessFactor = uRoughness * roughnessSurface;
        #include <normal_fragment_begin>
        #include <normal_fragment_maps>
        #include <lights_physical_fragment>
        #include <lights_fragment_begin>
        #include <lights_fragment_maps>
        #include <lights_fragment_end>

        float ambientOcclusion = (aoSurface - 1.0) * uAoStrength + 1.0;
        reflectedLight.indirectDiffuse *= ambientOcclusion;

        vec3 diffuseFactor = uDiffuse * (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse);
        vec3 specularFactor = uSpecular * (reflectedLight.directSpecular + reflectedLight.indirectSpecular);
        vec3 outgoingLight = white_L * uExposure * (diffuseFactor + specularFactor);
        gl_FragColor = vec4((uContrast * (outgoingLight * 2.0 - 1.0) + 0.5) + 2.0 * uBrightness - 1.0, diffuseColor.a);
      } else {
        vec3 macroNormal = normalize(vNormal);
        #ifdef TANGENTSPACE_NORMALMAP
          vec3 mesoNormal = vNormal;
        #else
          vec3 mesoNormal = normalize(normalMatrix * (normalSurface * 2.0 - 1.0));
        #endif
        vec3 viewerDirection = normalize(vViewPosition);
        float ndv = max(dot(mesoNormal, viewerDirection), 0.0);

        vec3 totalSpecularLight = vec3(0.0);
        vec3 totalDiffuseLight = vec3(0.0);

#if NUM_POINT_LIGHTS > 0
        vec3 pointSpecularColor;
        vec3 pointDiffuseColor;
        vec3 pointAmbientColor;
        float diffuseSurfaceMean = dot(diffuseSurface.rgb, vec3(1.0))/3.0;
        if (uBrdfModel == 1) {  // [Three.js MR]
          pointSpecularColor = diffuseSurface.rgb * metallicSurface + 0.04 * (1.0 - metallicSurface);
          pointDiffuseColor = diffuseSurface.rgb * (1.0 - metallicSurface);
          // Substance Designer:
          //pointDiffuseColor = diffuseSurface.rgb * (1.0 - metallicSurface) * (1.0 - pointSpecularColor);
          pointAmbientColor = ambientLightColor;
        } else {                // [BIS Disney]]
          pointSpecularColor = (diffuseSurface.rgb/diffuseSurfaceMean)*tintSurface + (1.0 - tintSurface);
          pointDiffuseColor = diffuseSurface.rgb * pi; // Convert to physically correct lighting
          pointAmbientColor = ambientLightColor * pi;  // Convert to physically correct lighting
        }
        for (int i = 0; i < NUM_POINT_LIGHTS; i ++) {
          vec3 lVector = pointLights[i].position + vViewPosition.xyz;
          lVector = normalize(lVector);
          vec3 halfVector = normalize(lVector + viewerDirection);
          float ndh = dot(mesoNormal, halfVector);
          float ndl = max(dot(mesoNormal, lVector), 0.0);

          float attenuation;
          float pointSpecularWeight;
          if (uBrdfModel == 1) {  // [Three.js MR]
            attenuation = punctualLightIntensityToIrradianceFactor(length(lVector), pointLights[i].distance, pointLights[i].decay);
            pointSpecularWeight = uSpecular * MRSpecular(uRoughness * roughnessSurface, ndh, ndl, ndv);
            if (uFresnel) {
              float vdh = dot(viewerDirection, halfVector);
              pointSpecularColor = F_Schlick(pointSpecularColor, vdh);
            }
          } else {                // [BIS Disney]
            attenuation = calcLightAttenuation(length(lVector), pointLights[i].distance, pointLights[i].decay);
            pointSpecularWeight = DisneySpecular(uSpecular*specularSurface, uRoughness*roughnessSurface, ndh, s) / ndl;
            // FIXME: This assumes the light colour is white or grey.
            pointSpecularWeight *= pointLights[i].color.r;
          }

          vec3 irradiance = ndl * attenuation * pointLights[i].color;
          totalDiffuseLight += pointDiffuseColor * irradiance / pi;
          totalSpecularLight += pointSpecularWeight * pointSpecularColor * irradiance;
        }
        vec3 ambientContrib = pointDiffuseColor * pointAmbientColor / pi;
#else
        vec3 ambientContrib = vec3(0.0);
#endif

        vec3 outgoingLight = white_L * uExposure *
            (ambientContrib + uDiffuse*totalDiffuseLight + totalSpecularLight);

        gl_FragColor = vec4((uContrast * (outgoingLight * 2.0 - 1.0) + 0.5) + 2.0 * uBrightness - 1.0, 1.0);
      }
    }
  `;

  return { uniforms, vertexShader, fragmentShader };
}
