
// Compares two same-sized arrays and finds the maximally changed value in the arrays.
// Returns:
//   The index of the element which is most different.  -1 if none are different.
export function getDelta(oldArray, newArray) {
  var index = -1;
  var maxDelta = 0;
  for (i = 0; i < oldArray.length; i++) {
    const delta = Math.abs(oldArray[i] - newArray[i]);
    if (delta > maxDelta) {
      maxDelta = delta;
      index = i;
    }
  }
  return index;
}
