// Given a JSON file URL, return a Promise to load the file
export async function loadJsonFilePromise(url) {
  //console.log('loadJsonFilePromise: ', url);
  var promise = new Promise((resolve, reject) => {
    var req = new XMLHttpRequest();
    req.open("GET", url);
    req.overrideMimeType("application/json");
    req.onload = () => {
      if (req.status >= 200 && req.status < 300) {
        resolve(req.response);
      } else {
        reject(req.statusText);
      }
    };
    req.onerror = () => {
      reject(req.statusText);
    };
    req.send();
  });

  return promise;
}

// Given a JSON file URL, return the file contents as an object.
// If an exception occurs during loading or parsing, null is returned instead.
export async function loadJsonFile(url) {
  var parsed;
  try {
    const p = await loadJsonFilePromise(url);
    parsed = await JSON.parse(p);
  } catch(e) {
    parsed = null;
  }
  return parsed;
}
