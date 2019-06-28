// Copyright (C) Bandicoot Imaging Sciences 2019

let uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib['lights'],
    {
      // Set textures to null here and assign later to avoid duplicating texture data.
      'tDiffuse': {value: null},
      'tNormals': {value: null},
      'tRoughness': {value: null},
      'tSpecular': {value: null},
      'uExposure': {value: exposureGain*state.exposure},
    }
  ]);

  const glsl = x => x; // No-op to trigger GLSL syntax highlighting in VS Code with glsl-literal extension.
  const vertexShader = glsl`
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    ` + '\n' +
    THREE.ShaderChunk['common'] + '\n' +
    glsl`
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
    uniform sampler2D tRoughness;
    uniform sampler2D tSpecular;

    uniform float uExposure;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    ` + '\n' +
    THREE.ShaderChunk['common'] + '\n' +
    THREE.ShaderChunk['bsdfs'] + '\n' +
    THREE.ShaderChunk['packing'] + '\n' +
    THREE.ShaderChunk['lights_pars_begin'] + '\n' +
    THREE.ShaderChunk['bumpmap_pars_fragment'] + '\n' +
    glsl`
    float calcLightAttenuation(float lightDistance, float cutoffDistance, float decayExponent) {
      if ( decayExponent > 0.0 ) {
        return pow(saturate(-lightDistance/cutoffDistance + 1.0), decayExponent);
      }
      return 1.0;
    }

    void main() {
      vec3 outgoingLight = vec3(0.0);
      vec4 diffuseSurface = texture2D(tDiffuse, vUv);
      vec3 normal = normalize(vNormal);
      vec3 viewerDirection = normalize(vViewPosition);
      
      vec3 totalSpecularLight = vec3( 0.0 );
      vec3 totalDiffuseLight = vec3( 0.0 );
      const vec3 diffuseWeights = vec3(0.75, 0.375, 0.1875);

#if NUM_POINT_LIGHTS > 0
      for (int i = 0; i < NUM_POINT_LIGHTS; i ++) {
        vec3 lVector = pointLights[i].position + vViewPosition.xyz;

        float attenuation = calcLightAttenuation(length(lVector), pointLights[i].distance, pointLights[i].decay);

        lVector = normalize(lVector);

        float pointDiffuseWeightFull = max(dot(normal, lVector), 0.0);
        float pointDiffuseWeightHalf = max(0.5*dot(normal, lVector) + 0.5, 0.0);
        vec3 pointDiffuseWeight = mix(vec3(pointDiffuseWeightFull), vec3(pointDiffuseWeightHalf), diffuseWeights);

        // float pointSpecularWeight = KS_Skin_Specular(normal, lVector, viewerDirection, uRoughness, uSpecularBrightness);

        totalDiffuseLight += pointLights[i].color*(pointDiffuseWeight*attenuation);
        // totalSpecularLight += pointLights[i].color*specular*(pointSpecularWeight*specularStrength*attenuation);
      }
#endif

      outgoingLight = uExposure*diffuseSurface.rgb*totalDiffuseLight;
      gl_FragColor = linearToOutputTexel(vec4( outgoingLight, 1.0));
    }
    `;
