// Copyright (C) Bandicoot Imaging Sciences 2024
'use strict';

/**
 * Texture Layer Constants for Bivot-JS
 *
 * These constants define texture layer indices, channel counts, and mappings
 * for both brdfModel 1 (shader-based) and brdfModel 2 (TSL node-based) rendering.
 *
 * Can be imported into Shopfront for UI controls.
 */

/**
 * Texture layer indices enum
 * Maps texture type names to their numeric layer IDs
 */
export const TEXTURE_LAYER_INDICES = {
  // Special values
  RENDER: 0,                    // Full PBR render (not a texture layer)

  // Core PBR textures (1-10)
  BASECOLOR: 1,                 // Base color / diffuse
  ROUGHNESS: 2,                 // Surface roughness
  METALLIC: 3,                  // Metallic / non-metallic
  NORMAL: 4,                    // Normal map
  DISPLACEMENT: 5,              // Height / displacement
  ALPHA: 6,                     // Transparency / opacity
  AMBIENT_OCCLUSION: 7,         // Ambient occlusion
  EMISSIVE: 8,                  // Emissive color
  BUMP: 9,                      // Bump map
  ANISOTROPY: 10,               // Anisotropic reflection

  // Clearcoat textures (11-13)
  CLEARCOAT: 11,                // Clearcoat strength
  CLEARCOAT_ROUGHNESS: 12,      // Clearcoat roughness
  CLEARCOAT_NORMAL: 13,         // Clearcoat normal map

  // Sheen textures (14-15)
  SHEEN_COLOR: 14,              // Fabric sheen color
  SHEEN_ROUGHNESS: 15,          // Sheen roughness

  // Specular workflow textures (16-17)
  SPECULAR_COLOR: 16,           // Specular color
  SPECULAR_INTENSITY: 17,       // Specular intensity

  // Volume/Transmission textures (18-19)
  TRANSMISSION: 18,             // Light transmission
  THICKNESS: 19,                // Material thickness

  // Iridescence textures (20-21)
  IRIDESCENCE: 20,              // Iridescent effect strength
  IRIDESCENCE_THICKNESS: 21,    // Iridescence film thickness

  // Additional textures (22-25)
  ALPHA_COLOR: 22,              // RGBA alpha color
  GLOSSINESS: 23,               // Glossiness (converted to roughness)
  IOR: 24,                      // Index of refraction
  SUBSURFACE: 25,               // Subsurface scattering
};

/**
 * Reverse mapping from layer index to name
 */
export const TEXTURE_LAYER_NAMES = Object.fromEntries(
  Object.entries(TEXTURE_LAYER_INDICES).map(([name, index]) => [index, name])
);

/**
 * Texture layer configuration
 * Defines properties for each texture layer including channel count,
 * color space, fallback values, and texture names
 */
export const TEXTURE_LAYER_CONFIG = {
  [TEXTURE_LAYER_INDICES.BASECOLOR]: {
    name: 'basecolor',
    aliases: ['diffuse'],
    channels: 3,
    srgb: true,
    fallback: [0.5, 0.5, 0.5],
    description: 'Base Color / Diffuse'
  },
  [TEXTURE_LAYER_INDICES.ROUGHNESS]: {
    name: 'roughness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    specularChannel: 'g',
    description: 'Surface Roughness'
  },
  [TEXTURE_LAYER_INDICES.METALLIC]: {
    name: 'metallic',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    specularChannel: 'b',
    description: 'Metallic / Non-metallic'
  },
  [TEXTURE_LAYER_INDICES.NORMAL]: {
    name: 'normals',
    aliases: ['normal'],
    channels: 3,
    srgb: false,
    fallback: [0.5, 0.5, 1.0],
    description: 'Normal Map'
  },
  [TEXTURE_LAYER_INDICES.DISPLACEMENT]: {
    name: 'displacement',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.5],
    description: 'Height / Displacement'
  },
  [TEXTURE_LAYER_INDICES.ALPHA]: {
    name: 'alpha',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Transparency / Opacity'
  },
  [TEXTURE_LAYER_INDICES.AMBIENT_OCCLUSION]: {
    name: 'aomap',
    aliases: ['ambientOcclusion'],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    specularChannel: 'r',
    description: 'Ambient Occlusion',
    // Material setup properties
    nodeProperty: 'aoNode',
    mapProperty: 'aoMap',
    intensityProperty: 'aoMapIntensity',
    intensityValue: 1.0,
  },
  [TEXTURE_LAYER_INDICES.EMISSIVE]: {
    name: 'emissive',
    aliases: [],
    channels: 3,
    srgb: true,
    fallback: [0.0, 0.0, 0.0],
    description: 'Emissive Color',
    // Material setup properties
    nodeProperty: 'emissiveNode',
    mapProperty: 'emissiveMap',
  },
  [TEXTURE_LAYER_INDICES.BUMP]: {
    name: 'bump',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.5],
    description: 'Bump Map'
  },
  [TEXTURE_LAYER_INDICES.ANISOTROPY]: {
    name: 'anisotropy',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Anisotropic Reflection'
  },
  [TEXTURE_LAYER_INDICES.CLEARCOAT]: {
    name: 'clearcoat',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Clearcoat Strength',
    // Material setup properties
    nodeProperty: 'clearcoatNode',
    mapProperty: 'clearcoatMap',
  },
  [TEXTURE_LAYER_INDICES.CLEARCOAT_ROUGHNESS]: {
    name: 'clearcoatRoughness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Clearcoat Roughness',
    // Material setup properties
    nodeProperty: 'clearcoatRoughnessNode',
    mapProperty: 'clearcoatRoughnessMap',
  },
  [TEXTURE_LAYER_INDICES.CLEARCOAT_NORMAL]: {
    name: 'clearcoatNormal',
    aliases: [],
    channels: 3,
    srgb: false,
    fallback: [0.5, 0.5, 1.0],
    description: 'Clearcoat Normal Map',
    // Material setup properties
    nodeProperty: 'clearcoatNormalNode',
    mapProperty: 'clearcoatNormalMap',
    isNormalMap: true,
  },
  [TEXTURE_LAYER_INDICES.SHEEN_COLOR]: {
    name: 'sheenColor',
    aliases: ['sheen'],
    channels: 3,
    srgb: true,
    fallback: [0.0, 0.0, 0.0],
    description: 'Fabric Sheen Color',
    // Material setup properties
    nodeProperty: 'sheenColorNode',
    mapProperty: 'sheenColorMap',
  },
  [TEXTURE_LAYER_INDICES.SHEEN_ROUGHNESS]: {
    name: 'sheenRoughness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Sheen Roughness',
    // Material setup properties
    nodeProperty: 'sheenRoughnessNode',
    mapProperty: 'sheenRoughnessMap',
  },
  [TEXTURE_LAYER_INDICES.SPECULAR_COLOR]: {
    name: 'specularColor',
    aliases: ['specular'],
    channels: 3,
    srgb: true,
    fallback: [1.0, 1.0, 1.0],
    description: 'Specular Color'
  },
  [TEXTURE_LAYER_INDICES.SPECULAR_INTENSITY]: {
    name: 'specularIntensity',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Specular Intensity'
  },
  [TEXTURE_LAYER_INDICES.TRANSMISSION]: {
    name: 'transmission',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Light Transmission',
    // Material setup properties
    nodeProperty: 'transmissionNode',
    mapProperty: 'transmissionMap',
  },
  [TEXTURE_LAYER_INDICES.THICKNESS]: {
    name: 'thickness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Material Thickness',
    // Material setup properties
    nodeProperty: 'thicknessNode',
    mapProperty: 'thicknessMap',
  },
  [TEXTURE_LAYER_INDICES.IRIDESCENCE]: {
    name: 'iridescence',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Iridescent Effect Strength'
  },
  [TEXTURE_LAYER_INDICES.IRIDESCENCE_THICKNESS]: {
    name: 'iridescenceThickness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.0],
    description: 'Iridescence Film Thickness'
  },
  [TEXTURE_LAYER_INDICES.ALPHA_COLOR]: {
    name: 'alphaColor',
    aliases: [],
    channels: 4,
    srgb: true,
    fallback: [0.5, 0.5, 0.5, 1.0],
    description: 'RGBA Alpha Color'
  },
  [TEXTURE_LAYER_INDICES.GLOSSINESS]: {
    name: 'glossiness',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Glossiness (converted to roughness)'
  },
  [TEXTURE_LAYER_INDICES.IOR]: {
    name: 'ior',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [1.5],
    description: 'Index of Refraction'
  },
  [TEXTURE_LAYER_INDICES.SUBSURFACE]: {
    name: 'subsurface',
    aliases: [],
    channels: 1,
    srgb: false,
    fallback: [0.0],
    description: 'Subsurface Scattering'
  },
};

/**
 * Multi-channel texture mappings
 * Defines how combined textures map to individual texture layers
 */
export const MULTI_CHANNEL_MAPPINGS = {
  // Combined specular texture (roughness-metallic-ao format)
  specular: {
    name: 'Combined Specular (RMA)',
    description: 'Roughness (G), Metallic (B), AO (R)',
    channels: {
      r: TEXTURE_LAYER_INDICES.AMBIENT_OCCLUSION,
      g: TEXTURE_LAYER_INDICES.ROUGHNESS,
      b: TEXTURE_LAYER_INDICES.METALLIC,
    }
  },

  // Combined metallic-roughness texture
  metallicRoughness: {
    name: 'Combined Metallic-Roughness',
    description: 'Metallic (B), Roughness (G)',
    channels: {
      g: TEXTURE_LAYER_INDICES.ROUGHNESS,
      b: TEXTURE_LAYER_INDICES.METALLIC,
    }
  },

  // Combined alpha color (RGBA)
  alphaColor: {
    name: 'Combined Alpha Color',
    description: 'Base Color (RGB), Alpha (A)',
    channels: {
      rgb: TEXTURE_LAYER_INDICES.BASECOLOR,
      a: TEXTURE_LAYER_INDICES.ALPHA,
    }
  },
};

/**
 * Get texture layer configuration by index
 * @param {number} layerIndex - Texture layer index
 * @returns {Object|null} Configuration object or null if not found
 */
export function getTextureLayerConfig(layerIndex) {
  return TEXTURE_LAYER_CONFIG[layerIndex] || null;
}

/**
 * Get all available texture layer indices
 * @returns {number[]} Array of all valid texture layer indices
 */
export function getAllTextureLayerIndices() {
  return Object.values(TEXTURE_LAYER_INDICES).sort((a, b) => a - b);
}

/**
 * Get texture layers for UI display (excluding RENDER)
 * @returns {Array} Array of {index, name, description} objects for UI
 */
export function getTextureLayersForUI() {
  return Object.entries(TEXTURE_LAYER_CONFIG).map(([index, config]) => ({
    index: parseInt(index),
    name: TEXTURE_LAYER_NAMES[index],
    description: config.description,
    channels: config.channels,
    srgb: config.srgb,
    textureName: config.name,
    aliases: config.aliases,
  })).sort((a, b) => a.index - b.index);
}

/**
 * Get texture layer by name
 * @param {string} name - Texture name (e.g., 'basecolor', 'roughness')
 * @returns {number|null} Texture layer index or null if not found
 */
export function getTextureLayerByName(name) {
  for (const [index, config] of Object.entries(TEXTURE_LAYER_CONFIG)) {
    if (config.name === name || config.aliases.includes(name)) {
      return parseInt(index);
    }
  }
  return null;
}

/**
 * Check if a texture layer index is valid
 * @param {number} layerIndex - Texture layer index
 * @returns {boolean} True if valid
 */
export function isValidTextureLayer(layerIndex) {
  const maxLayerIndex = Math.max(...Object.values(TEXTURE_LAYER_INDICES).filter(val => val > 0));
  return layerIndex === TEXTURE_LAYER_INDICES.RENDER ||
         (layerIndex >= 1 && layerIndex <= maxLayerIndex && TEXTURE_LAYER_CONFIG[layerIndex] !== undefined);
}

/**
 * Legacy mapping for backward compatibility with existing shader code
 * Maps the old hardcoded layer numbers to the new constants
 */
export const LEGACY_TEXTURE_LAYERS = {
  1: TEXTURE_LAYER_INDICES.BASECOLOR,      // diffuse
  2: TEXTURE_LAYER_INDICES.ROUGHNESS,      // roughness
  3: TEXTURE_LAYER_INDICES.METALLIC,       // metallic
  4: TEXTURE_LAYER_INDICES.NORMAL,         // normal
  5: TEXTURE_LAYER_INDICES.DISPLACEMENT,   // displacement
  6: TEXTURE_LAYER_INDICES.ALPHA,          // alpha
};

export default {
  TEXTURE_LAYER_INDICES,
  TEXTURE_LAYER_NAMES,
  TEXTURE_LAYER_CONFIG,
  MULTI_CHANNEL_MAPPINGS,
  getTextureLayerConfig,
  getAllTextureLayerIndices,
  getTextureLayersForUI,
  LEGACY_TEXTURE_LAYERS,
};
