import bivotJs, { defaultSize } from './bivot.js';
export { default as textureLayerConstants } from './textureLayerConstants.js';
export {
  TEXTURE_LAYER_INDICES,
  TEXTURE_LAYER_CONFIG,
  getTextureLayersForUI,
  getTextureLayerByName,
  isValidTextureLayer
} from './textureLayerConstants.js';

export function newBivot(options) {
  return new bivotJs(options);
}

export const bivotDefaultSize = defaultSize;
