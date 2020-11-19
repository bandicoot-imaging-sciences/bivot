
export function getBasePath(location) {
  if (location.includes('/')) {
    const loc_parts = location.split('/')
    loc_parts.pop();
    return loc_parts.join('/');
  } else {
    return '.';
  }
}
