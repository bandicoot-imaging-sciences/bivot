// Copyright (C) Bandicoot Imaging Sciences 2019
'use strict';

let uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      // Set textures to null here and assign later to avoid duplicating texture data.
      'diffuseMap': {value: null},
      'normalMap': {value: null}, // Three.js shader chunks assume normal map is called normalMap.
      'specularMap': {value: null},
      'normalScale': { value: new THREE.Vector2( 1, 1 ) }, // Three.js shader chunks: scaling for xy normals.
      'uExposure': {value: 1.0},
      'uDiffuse': {value: 1.0},
      'uSpecular': {value: 1.0},
      'uRoughness': {value: 1.0},
      'uTint': {value: true},
      'uFresnel': {value: false},
      'uBrdfModel': {value: 0}, // 0: BIS; 1: M/R
      'uBrdfVersion': {value: 2.0},
      'uLoadExr': {value: false},
      'uDual8Bit': {value: false},
      'uNormalMatrix': {value: new THREE.Matrix3()},
      'diffuseMapLow': {value: null},  // Low byte when dual 8-bit textures are loaded
      'normalMapLow': {value: null},   // Low byte when dual 8-bit textures are loaded
      'specularMapLow': {value: null}, // Low byte when dual 8-bit textures are loaded
    }
  ]);

  const glsl = x => x.toString(); // No-op to trigger GLSL syntax highlighting in VS Code with glsl-literal extension.
  const vertexShader = glsl`
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vec4 worldPosition = modelMatrix*vec4(position, 1.0);

      vUv = uv;
      // Alternatively this might be needed if we are scaling the texture:
      // vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>

      vNormal = normalize(transformedNormal);

      #include <begin_vertex>
      #include <project_vertex>

      vViewPosition = - mvPosition.xyz;
    }
    `;

  const fragmentShader = glsl`
    uniform sampler2D diffuseMap;
    // Defined in <normalmap_pars_fragment>
    // uniform sampler2D normalMap;
    uniform sampler2D specularMap;

    uniform sampler2D diffuseMapLow;
    uniform sampler2D normalMapLow;
    uniform sampler2D specularMapLow;

    uniform float uExposure;
    uniform float uDiffuse;
    uniform float uSpecular;
    uniform float uRoughness;
    uniform bool  uTint;
    uniform bool  uFresnel;
    uniform int   uBrdfModel;
    uniform float uBrdfVersion;
    uniform bool  uDual8Bit;
    uniform bool  uLoadExr;
    uniform mat3  uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    float s = 1.0;
    float pi = 3.14159265359;

    #include <common>
    #include <bsdfs>
    #include <packing>
    #include <lights_pars_begin>
    #include <normalmap_pars_fragment>

    float calcLightAttenuation(float lightDistance, float cutoffDistance, float decayExponent) {
      if (decayExponent > 0.0) {
        // The common ShaderChunk includes: #define saturate(a) clamp( a, 0.0, 1.0 )
        return pow(saturate(-lightDistance/cutoffDistance + 1.0), decayExponent);
      }
      return 1.0;
    }

    float DisneySpecular(float specular, float roughness, float ndh) {
      // TODO: Add episilon to fragile denominators.
      float r4 = pow(roughness, 4.0);
      float k = 1.0 - r4;
      float c = (1.0/(s*PI))*((1.0/r4 + (1.0/(2.0*sqrt(k))*log((sqrt(k) + k)/(sqrt(k) - k)))));
      float denom = pow((1.0 + (r4 - 1.0)*pow(ndh, 2.0)), 2.0);
      return (specular)/(c*denom);
    }

    vec3 MRFresnel(vec3 spec_color, float vdh, float white_L) {
      return spec_color + (white_L - spec_color) * pow(2.0, -5.55473*vdh*vdh - 6.98316*vdh);
    }

    float MRSpecular(float roughness, float ndh, float ndl, float ndv) {
      float r2 = roughness * roughness;
      //float visibility = 1.0 / ((ndl * (1.0 - r2) + r2) * (ndv * (1.0 - r2) + r2));
      float visibility = 1.0;
      float t = r2 / (1.0 + (r2 * r2 - 1.0) * ndh * ndh);
      return visibility * t * t / pi;
    }


    void main() {
      #include <normal_fragment_begin>
      #include <normal_fragment_maps>

      vec3 outgoingLight = vec3(0.0);

      vec4 diffuseSurface = texture2D(diffuseMap, vUv);
      vec3 normalSurface = texture2D(normalMap, vUv).xyz;
      vec4 specularTexel = texture2D(specularMap, vUv);

      if (uDual8Bit) {
        vec4 diffuseSurfaceLow = texture2D(diffuseMapLow, vUv) / 256.0;
        vec3 normalSurfaceLow = texture2D(normalMapLow, vUv).xyz / 256.0;
        vec4 specularTexelLow = texture2D(specularMapLow, vUv) / 256.0;

        diffuseSurface = diffuseSurface + diffuseSurfaceLow;
        normalSurface = normalSurface + normalSurfaceLow;
        specularTexel = specularTexel + specularTexelLow;
      }

      float white_L = 1.0;
      float specularSurface = 0.0;
      float roughnessSurface = 0.0;
      float tintSurface = 0.0;
      float metallicSurface = 0.0;

      if (uBrdfModel == 1) {
        // (M/R model)
        white_L = 16383.0;
        roughnessSurface = specularTexel.r;
        metallicSurface = specularTexel.g;
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

      vec3 macroNormal = normalize(vNormal);
      //vec3 mesoNormal = normal;  // Enable for tangent-space normal map
      vec3 mesoNormal = normalize(uNormalMatrix * (normalSurface * 2.0 - 1.0));  // For object space normal map
      vec3 viewerDirection = normalize(vViewPosition);
      float ndv = max(dot(mesoNormal, viewerDirection), 0.0);

      vec3 totalSpecularLight = vec3(0.0);
      vec3 totalDiffuseLight = vec3(0.0);

#if NUM_POINT_LIGHTS > 0
      float diffuseSurfaceMean = dot(diffuseSurface.rgb, vec3(1.0))/3.0;
      for (int i = 0; i < NUM_POINT_LIGHTS; i ++) {
        vec3 lVector = pointLights[i].position + vViewPosition.xyz;
        lVector = normalize(lVector);
        vec3 halfVector = normalize(lVector + viewerDirection);
        //float ndh = max(dot(mesoNormal, halfVector), 0.0);
        float ndh = dot(mesoNormal, halfVector);
        float ndl = max(dot(mesoNormal, lVector), 0.0);

        float pointSpecularWeight;
        vec3 pointSpecularColor;
        vec3 pointDiffuseColor;
        if (uBrdfModel == 1) {
          pointSpecularWeight = ndl * MRSpecular(uRoughness*roughnessSurface, ndh, ndl, ndv);
          pointSpecularColor = uSpecular * diffuseSurface.rgb * metallicSurface;
          pointDiffuseColor = diffuseSurface.rgb * (1.0 - metallicSurface) * (1.0 - pointSpecularColor) / pi;
          if (uFresnel) {
            float vdh = dot(viewerDirection, halfVector);
            pointSpecularColor *= MRFresnel(pointSpecularColor, vdh, 1.0);
          }
        } else {  // uBrdfModel == 0
          pointSpecularWeight = DisneySpecular(uSpecular*specularSurface, uRoughness*roughnessSurface, ndh);
          // FIXME: This assumes the light colour is white or grey.
          pointSpecularWeight = pointSpecularWeight * pointLights[i].color.r;
          pointSpecularColor = (diffuseSurface.rgb/diffuseSurfaceMean)*tintSurface + (1.0 - tintSurface);
          pointDiffuseColor = diffuseSurface.rgb;
        }

        float attenuation = calcLightAttenuation(length(lVector), pointLights[i].distance, pointLights[i].decay);

        totalDiffuseLight += attenuation * ndl * pointLights[i].color * pointDiffuseColor;
        totalSpecularLight += attenuation * pointSpecularWeight * pointSpecularColor;
      }
#endif
      vec3 ambientContrib = diffuseSurface.rgb * ambientLightColor;
      if (uBrdfModel == 0) {
        ambientContrib = ambientContrib * 4.0;
      }

      outgoingLight = white_L * uExposure *
          (ambientContrib + uDiffuse*totalDiffuseLight + totalSpecularLight);

      gl_FragColor = vec4(outgoingLight, 1.0);
    }
    `;
