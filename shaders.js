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
      'uBrdfVersion': {value: 2},
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
    uniform bool uTint;
    uniform int uBrdfVersion;
    uniform bool uDual8Bit;
    uniform bool uLoadExr;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    float s = 1.0;

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

    float DisneySpecular(float specular, float roughness, vec3 normal, vec3 light, vec3 view) {
      // TODO: Add episilon to fragile denominators.
      float k = 1.0 - pow(roughness, 4.0);
      float c = (1.0/(s*PI))*((1.0/pow(roughness, 4.0) + (1.0/(2.0*sqrt(k))*log((sqrt(k) + k)/(sqrt(k) - k)))));
      // float c = 1.0;

      vec3 halfVector = normalize(light + view);
      float halfDot = dot(normal, halfVector);
      float denom = pow((1.0 + (pow(roughness, 4.0) - 1.0)*pow(halfDot, 2.0)), 2.0);
      return (specular)/(c*denom);
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

      float specularSurface = specularTexel.r;
      if (!uLoadExr) {
        diffuseSurface *= 65535.0;
      }
      float roughnessSurface = specularTexel.g;
      float tintSurface = 0.0;
      if (uTint && uBrdfVersion == 2) {
        tintSurface = specularTexel.b;
      }
      if (uBrdfVersion == 2) {
        s = 65535.0*0.01;
      }

      float diffuseSurfaceMean = dot(diffuseSurface.rgb, vec3(1.0))/3.0;

      vec3 macroNormal = normalize(vNormal);
      //vec3 mesoNormal = normal;  // Enable for tangent-space normal map
      vec3 mesoNormal = normalize(uNormalMatrix * (normalSurface * 2.0 - 1.0));  // For object space normal map
      vec3 viewerDirection = normalize(vViewPosition);

      vec3 totalSpecularLight = vec3(0.0);
      vec3 totalDiffuseLight = vec3(0.0);
      const vec3 diffuseWeights = vec3(0.75, 0.375, 0.1875);

#if NUM_POINT_LIGHTS > 0
      for (int i = 0; i < NUM_POINT_LIGHTS; i ++) {
        vec3 lVector = pointLights[i].position + vViewPosition.xyz;

        float attenuation = calcLightAttenuation(length(lVector), pointLights[i].distance, pointLights[i].decay);

        lVector = normalize(lVector);

        float pointDiffuseWeightFull = max(dot(mesoNormal, lVector), 0.0);
        float pointDiffuseWeightHalf = max(0.5*dot(mesoNormal, lVector) + 0.5, 0.0);
        // It seems like this mix operation would produce a colour shift? But in practice the output doesn't
        // look colour shifted.
        // vec3 pointDiffuseWeight = mix(vec3(pointDiffuseWeightFull), vec3(pointDiffuseWeightHalf), diffuseWeights);
        vec3 pointDiffuseWeight = vec3(pointDiffuseWeightFull);
        // vec3 pointDiffuseWeight = vec3(1.0);

        float pointSpecularWeight = DisneySpecular(uSpecular*specularSurface, uRoughness*roughnessSurface,
          mesoNormal, lVector, viewerDirection);
        // FIXME: This assumes the light colour is white or grey.
        pointSpecularWeight = pointSpecularWeight * pointLights[i].color.r;

        totalDiffuseLight += attenuation*pointDiffuseWeight*pointLights[i].color;
        totalSpecularLight += attenuation*pointSpecularWeight
                              *((diffuseSurface.rgb/diffuseSurfaceMean)*tintSurface
                                + (1.0 - tintSurface));
      }
#endif

      outgoingLight = uExposure*(diffuseSurface.rgb*(uDiffuse*totalDiffuseLight + ambientLightColor)
                                 + totalSpecularLight);

      gl_FragColor = vec4(outgoingLight, 1.0);
    }
    `;
