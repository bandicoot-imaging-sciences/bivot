
// Return true if the given object has no properties
export function isEmpty(obj) {
  for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key))
          return false;
  }
  return true;
}
