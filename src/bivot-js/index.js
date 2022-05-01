import bivotJs, { defaultSize } from './bivot.js';

export function newBivot(options) {
  return new bivotJs(options);
}

export const bivotDefaultSize = defaultSize;