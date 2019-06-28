// Copyright (C) Bandicoot Imaging Sciences 2019

let uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib['lights'],
    {
      // Set textures to null here and assign later to avoid duplicating texture data.
      'tDiffuse': {value: null},
      'tNormals': {value: null},
      'tSpecular': {value: null},
      'uExposure': {value: 1.0},
    }
  ]);

  const glsl = x => x; // No-op to trigger GLSL syntax highlighting in VS Code with glsl-literal extension.
  const vertexShader = glsl`
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    #include <common>

    ` + glsl`

    void main() {
      vec4 mvPosition = modelViewMatrix*vec4(position, 1.0);
      vec4 worldPosition = modelMatrix*vec4(position, 1.0);

      vViewPosition = -mvPosition.xyz;

      vNormal = normalize(normalMatrix*normal);

      vUv = uv;

      gl_Position = projectionMatrix*mvPosition;
    }
    `;

  const fragmentShader = glsl`
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormals;
    uniform sampler2D tSpecular;

    uniform float uExposure;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    #include <common>
    #include <bsdfs>
    #include <packing>
    #include <lights_pars_begin>
    #include <bumpmap_pars_fragment>
    
    ` + glsl`

    float calcLightAttenuation(float lightDistance, float cutoffDistance, float decayExponent) {
      if (decayExponent > 0.0) {
        // The common ShaderChunk includes: #define saturate(a) clamp( a, 0.0, 1.0 )
        return pow(saturate(-lightDistance/cutoffDistance + 1.0), decayExponent);
      }
      return 1.0;
    }

    float DisneySpecular(float specular, float roughness, float c, vec3 normal, vec3 light, vec3 view) {
      vec3 halfVector = normalize(light + view);
      float halfDot = dot(normal, halfVector);
      float denom = pow((1.0 + (pow(roughness, 4.0) - 1.0)*pow(halfDot, 2.0)), 2.0);
      return (specular*c)/denom;
    }

    void main() {
      vec3 outgoingLight = vec3(0.0);

      vec4 diffuseSurface = texture2D(tDiffuse, vUv);
      vec3 normalSurface = texture2D(tNormals, vUv).xyz;
      vec4 specularTexel = texture2D(tSpecular, vUv);
      float specularSurface = specularTexel.r;
      float roughnessSurface = specularTexel.g;

      vec3 macroNormal = normalize(vNormal);
      vec3 mesoNormal = normalize(macroNormal + normalSurface);
      vec3 viewerDirection = normalize(vViewPosition);
      
      vec3 totalSpecularLight = vec3(0.0);
      vec3 totalDiffuseLight = vec3(0.0);
      const vec3 diffuseWeights = vec3(0.75, 0.375, 0.1875);

      const float c = 1.0;

#if NUM_POINT_LIGHTS > 0
      for (int i = 0; i < NUM_POINT_LIGHTS; i ++) {
        vec3 lVector = pointLights[i].position + vViewPosition.xyz;

        float attenuation = calcLightAttenuation(length(lVector), pointLights[i].distance, pointLights[i].decay);

        lVector = normalize(lVector);

        float pointDiffuseWeightFull = max(dot(mesoNormal, lVector), 0.0);
        float pointDiffuseWeightHalf = max(0.5*dot(mesoNormal, lVector) + 0.5, 0.0);
        // vec3 pointDiffuseWeight = mix(vec3(pointDiffuseWeightFull), vec3(pointDiffuseWeightHalf), diffuseWeights);
        // vec3 pointDiffuseWeight = vec3(pointDiffuseWeightFull);
        vec3 pointDiffuseWeight = vec3(1.0);

        float pointSpecularWeight = DisneySpecular(specularSurface, roughnessSurface, c, macroNormal, lVector, viewerDirection);

        totalDiffuseLight += pointLights[i].color*(pointDiffuseWeight*attenuation);
        totalSpecularLight += pointLights[i].color*(pointSpecularWeight*attenuation);
      }
#endif

      outgoingLight = uExposure*(diffuseSurface.rgb*totalDiffuseLight + totalSpecularLight);
      gl_FragColor = linearToOutputTexel(vec4(outgoingLight, 1.0));
      // gl_FragColor = vec4(mesoNormal, 1.0);
    }
    `;
