
// Compares two same-sized arrays and finds up to one changed value in the arrays.
// Returns:
//   The index of the element which is different.  -1 if none are different.
export function getDelta(oldArray, newArray) {
  var index = -1;
  for (i = 0; i < oldArray.length; i++) {
    if (oldArray[i] != newArray[i]) {
      index = i;
      break;
    }
  }
  return index;
}
