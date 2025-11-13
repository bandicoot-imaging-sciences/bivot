// Copyright (C) Bandicoot Imaging Sciences 2024
'use strict';

// TSL Node Material utilities for BRDF Model 2 (PBR mode)

import { MeshPhysicalNodeMaterial, TSL } from 'three/webgpu';
import { FrontSide } from 'three';

import { TEXTURE_LAYER_CONFIG, TEXTURE_LAYER_INDICES } from './textureLayerConstants.js';

// Extract TSL functions we need
const { texture, normalMap, float, vec3 } = TSL;

/**
 * Creates a TSL node-based PBR material for specular-gloss workflow
 * @param {Map} brdfTextures - Map of texture names to THREE texture objects
 * @param {string} brdfModelVariant - 'metalRoughness' or 'specularGloss'
 * @param {Object} state - Current bivot state object
 * @returns {MeshPhysicalNodeMaterial} Configured node material
 */
export function createTslPbrMaterial(brdfTextures, brdfModelVariant, state) {
  console.debug('Creating TSL PBR material with variant:', brdfModelVariant);

  const material = new MeshPhysicalNodeMaterial();
  const useSpecularGloss = brdfModelVariant === 'specularGloss';

  // Handle texture layer pass-through for debugging
  if (state.textureLayer > 0) {
    return createTextureLayerMaterial(brdfTextures, state.textureLayer);
  }

  // Set basic properties
  material.transparent = false;
  material.side = FrontSide;

  if (useSpecularGloss) {
    setupSpecularGlossWorkflow(material, brdfTextures);
  } else {
    setupMetallicRoughnessWorkflow(material, brdfTextures);
  }

  // Add common texture maps for both workflows
  setupCommonTextureMaps(material, brdfTextures, useSpecularGloss);

  return material;
}

/**
 * Sets up basic PBR properties (basecolor/diffuse and normals) using configuration
 */
function setupBasicPbrProperties(material, brdfTextures) {
  // Set up basecolor/diffuse using config
  const basecolorConfig = TEXTURE_LAYER_CONFIG[TEXTURE_LAYER_INDICES.BASECOLOR];
  const textureKey = findTextureKey(brdfTextures, basecolorConfig);
  if (textureKey) {
    material.colorNode = texture(brdfTextures.get(textureKey));
  }

  // Set up normals using config
  const normalConfig = TEXTURE_LAYER_CONFIG[TEXTURE_LAYER_INDICES.NORMAL];
  const normalKey = findTextureKey(brdfTextures, normalConfig);
  if (normalKey) {
    material.normalNode = normalMap(texture(brdfTextures.get(normalKey)));
  }
}

/**
 * Helper function to find texture key from brdfTextures using layer config
 */
function findTextureKey(brdfTextures, layerConfig) {
  if (brdfTextures.has(layerConfig.name)) {
    return layerConfig.name;
  }

  for (const alias of layerConfig.aliases) {
    if (brdfTextures.has(alias)) {
      return alias;
    }
  }

  return null;
}

/**
 * Sets up specular-gloss workflow using TSL nodes
 */
function setupSpecularGlossWorkflow(material, brdfTextures) {
  console.debug('Setting up specular-gloss workflow with TSL nodes');

  // Set up basic properties using config
  setupBasicPbrProperties(material, brdfTextures);

  // Specular-Gloss workflow using TSL nodes
  if (brdfTextures.has('specular') && brdfTextures.has('gloss')) {
    const specularTex = texture(brdfTextures.get('specular'));
    const glossTex = texture(brdfTextures.get('gloss'));

    // Convert specular-gloss to metallic-roughness for Three.js compatibility
    // This is a simplified conversion - in a real implementation you might want
    // more sophisticated conversion algorithms
    material.metalnessNode = float(0.0); // Specular workflow typically has low metalness
    material.roughnessNode = float(1.0).sub(glossTex.r); // Roughness = 1 - Gloss

    // Use specular color to modulate the base color
    if (material.colorNode) {
      material.colorNode = material.colorNode.mul(specularTex);
    } else {
      material.colorNode = specularTex;
    }
  } else {
    // Fallback to default values
    material.metalness = 0.0;
    material.roughness = 1.0;
  }
}

/**
 * Sets up metallic-roughness workflow using TSL nodes
 */
function setupMetallicRoughnessWorkflow(material, brdfTextures) {
  console.debug('Setting up metallic-roughness workflow with TSL nodes');

  // Set up basic properties using config
  setupBasicPbrProperties(material, brdfTextures);

  // Metallic-roughness workflow using config-driven approach
  const roughnessConfig = TEXTURE_LAYER_CONFIG[TEXTURE_LAYER_INDICES.ROUGHNESS];
  const metallicConfig = TEXTURE_LAYER_CONFIG[TEXTURE_LAYER_INDICES.METALLIC];

  // Set up roughness
  const roughnessKey = findTextureKey(brdfTextures, roughnessConfig);
  if (roughnessKey) {
    material.roughnessNode = texture(brdfTextures.get(roughnessKey)).r;
  } else if (brdfTextures.has('specular') && roughnessConfig.specularChannel) {
    // Use the specular texture which contains roughness data in specified channel
    material.roughnessNode = texture(brdfTextures.get('specular'))[roughnessConfig.specularChannel];
  } else {
    material.roughness = 1.0;
  }

  // Set up metallic
  const metallicKey = findTextureKey(brdfTextures, metallicConfig);
  if (metallicKey) {
    material.metalnessNode = texture(brdfTextures.get(metallicKey)).r;
  } else if (brdfTextures.has('specular') && metallicConfig.specularChannel) {
    // Use the specular texture which contains metallic data in specified channel
    material.metalnessNode = texture(brdfTextures.get('specular'))[metallicConfig.specularChannel];
  } else {
    material.metalness = 0.0;
  }
}

/**
 * Sets up common texture maps that work with both workflows using configuration-driven approach
 */
function setupCommonTextureMaps(material, brdfTextures, useNodeMaterial = true) {
  // Get texture layers that have material setup properties defined
  const textureLayersWithSetup = Object.values(TEXTURE_LAYER_CONFIG).filter(config =>
    config.nodeProperty && config.mapProperty
  );

  // Process each texture layer configuration
  textureLayersWithSetup.forEach(config => {
    // Find texture key using the findTextureKey helper
    const textureKey = findTextureKey(brdfTextures, config);

    if (textureKey) {
      const textureMap = brdfTextures.get(textureKey);

      if (useNodeMaterial) {
        // Set up TSL node
        let textureNode = texture(textureMap);

        if (config.isNormalMap) {
          textureNode = normalMap(textureNode);
        } else if (config.channels === 1) {
          textureNode = textureNode.r;
        }

        material[config.nodeProperty] = textureNode;
      } else {
        // Set up traditional material map
        material[config.mapProperty] = textureMap;

        // Set intensity property if specified
        if (config.intensityProperty && config.intensityValue !== undefined) {
          material[config.intensityProperty] = config.intensityValue;
        }
      }
    }
  });

  // Special case: IOR (typically scalar, not texture-based)
  if (brdfTextures.has('ior')) {
    // Note: IOR maps are rare, usually just a scalar value
    material.ior = 1.5; // Default glass IOR when IOR texture is present
  }
}



/**
 * Creates a material for texture layer pass-through (debugging mode)
 * Supports all Texin texture types for comprehensive material debugging
 * @param {Map} brdfTextures - Map of texture names to THREE texture objects
 * @param {number} textureLayer - Layer number (1-25, see TEXTURE_LAYER_CONFIG for complete list)
 * @returns {MeshPhysicalNodeMaterial} Material configured for single texture display
 */
function createTextureLayerMaterial(brdfTextures, textureLayer) {
  console.debug('Creating texture layer material for layer:', textureLayer);

  const material = new MeshPhysicalNodeMaterial();
  material.transparent = false;
  material.side = FrontSide;

  // Get texture configuration
  const config = TEXTURE_LAYER_CONFIG[textureLayer];
  if (!config) {
    console.warn('Unknown texture layer:', textureLayer);
    material.colorNode = vec3(1.0, 0.0, 1.0); // Magenta for invalid layers
    material.lightingModel = null;
    return material;
  }

  let textureNode = null;
  let textureFound = false;

  // Try to find the texture in brdfTextures
  if (brdfTextures.has(config.name)) {
    textureNode = getTextureNode(brdfTextures.get(config.name), config);
    textureFound = true;
  } else {
    // Try aliases
    for (const alias of config.aliases) {
      if (brdfTextures.has(alias)) {
        textureNode = getTextureNode(brdfTextures.get(alias), config);
        textureFound = true;
        break;
      }
    }
  }

  // Special handling for combined textures (e.g., specular map containing multiple channels)
  if (!textureFound && config.specularChannel && brdfTextures.has('specular')) {
    const specularTex = texture(brdfTextures.get('specular'));
    textureNode = specularTex[config.specularChannel];
    textureFound = true;
  }

  // Handle special cases
  if (!textureFound) {
    switch (textureLayer) {
      case TEXTURE_LAYER_INDICES.GLOSSINESS: // Glossiness - convert to roughness
        if (brdfTextures.has('glossiness')) {
          textureNode = float(1.0).sub(texture(brdfTextures.get('glossiness')).r);
          textureFound = true;
        }
        break;
    }
  }

  // Use fallback if no texture found
  if (!textureFound) {
    console.debug(`Texture '${config.name}' not found, using fallback`);
    if (config.channels === 1) {
      textureNode = float(config.fallback[0]);
    } else if (config.channels === 3) {
      textureNode = vec3(config.fallback[0], config.fallback[1], config.fallback[2]);
    } else if (config.channels === 4) {
      // For 4-channel fallback, just use RGB part
      textureNode = vec3(config.fallback[0], config.fallback[1], config.fallback[2]);
    }
  }

  // Convert to RGB for display
  if (textureNode) {
    textureNode = convertToDisplayColor(textureNode, config);
    material.colorNode = textureNode;
  } else {
    // Final fallback
    material.colorNode = vec3(0.0, 0.0, 0.0);
  }

  // Disable lighting for texture pass-through
  material.lightingModel = null;

  return material;
}

/**
 * Creates a texture node from a THREE texture with proper channel extraction
 */
function getTextureNode(threeTexture, config) {
  const texNode = texture(threeTexture);

  if (config.channels === 1) {
    // Single channel - use red channel
    return texNode.r;
  } else if (config.channels === 3) {
    // RGB
    return texNode.rgb || texNode;
  } else if (config.channels === 4) {
    // RGBA - for display purposes, just show RGB
    return texNode.rgb || texNode;
  }

  return texNode;
}

/**
 * Converts texture node to proper display color
 */
function convertToDisplayColor(textureNode, config) {
  let displayNode = textureNode;

  // Convert single channel to RGB for visualization
  if (config.channels === 1) {
    displayNode = vec3(textureNode, textureNode, textureNode);
  }

  // Apply sRGB conversion for linear textures (most non-color textures need this for proper display)
  if (!config.srgb) {
    // Convert from linear to sRGB for proper display
    // This makes roughness, metallic, etc. maps visible when displayed as colors
    displayNode = displayNode.pow(1.0/2.2);
  }

  return displayNode;
}

export default {
  createTslPbrMaterial,
};
