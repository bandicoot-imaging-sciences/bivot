
export function rgbHexValToColorObj(hexVal) {
  const rgb = {
    'r': (hexVal & 0xFF0000) / 0x10000,
    'g': (hexVal & 0x00FF00) / 0x100,
    'b': (hexVal & 0x0000FF)
  };
  const hex = rgbToHexStr(rgb.r, rgb.g, rgb.b);
  return { rgb, hex };
}

function rgbToHexStr(r, g, b) {
  return '#' + hexToString2(r) + hexToString2(g) + hexToString2(b);
}

function hexToString2(int) {
  // Convert a one-byte number to a 2-digit hex string
  const s = int.toString(16);
  return (s.length == 2) ? s : '0' + s;
}

export function rgbArrayToHexString(array) {
  return rgbToHexStr(array[0], array[1], array[2]);
}

export function rgbArrayToHexVal(array) {
  return array[0] * 0x10000 + array[1] * 0x100 + array[2];
}

export function rgbArrayToColorObj(array) {
  return rgbHexValToColorObj(rgbArrayToHexVal(array));
}
