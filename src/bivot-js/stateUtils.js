// Copyright (C) Bandicoot Imaging Sciences 2020

// The Three.js import paths in bivot.js, shaders.js and stateUtils.js need to match.
import * as THREE from '@bandicoot-imaging-sciences/three';

function arrayToVector(input, vecType) {
  // If the input is an Array, convert it to the specified vector type (either THREE.Vector2,
  // THREE.Vector3, or THREE.Color).
  console.assert(vecType == THREE.Vector2 || vecType == THREE.Vector3 || vecType == THREE.Color);
  var output;
  if (Array.isArray(input)) {
    output = new vecType();
    output.fromArray(input);
  } else {
    output = input;
  }
  return output;
}

// Define the keys in state which are vectors, and their type
export function jsonToState(inDict, outDict, vectorKeys=null) {
  if (vectorKeys == null) {
    vectorKeys = {
      "lightPosition": THREE.Vector3,
      "lightPositionOffset": THREE.Vector2,
      "cameraPan": THREE.Vector3,
    };
  }
  for (var key in inDict) {
    let t = vectorKeys[key];
    if (t == undefined) {
      outDict[key] = inDict[key];
    } else {
      outDict[key] = arrayToVector(inDict[key], t);
    }
  }
}

export function stateToJson(inDict, outDict, fieldsFilter, vectorKeys) {
  for (var i = 0; i < fieldsFilter.length; i++) {
    let key = fieldsFilter[i]
    let t = vectorKeys[key];
    if (t == undefined) {
      outDict[key] = inDict[key];
    } else {
      outDict[key] = Object.values(inDict[key]);
    }
  }
}

export function copyStatesCloneVectors(src, dst, vectorKeys) {
  for (var k in src) {
    let t = vectorKeys[k];
    if (t == undefined) {
      dst[k] = src[k];
    } else {
      // Ensure vector is copied as a new object
      dst[k] = src[k].clone();
    }
  }
}

export function copyStateFields(src, dst) {
  //console.log('copyStateFields: ', src, dst);
  for (var k in src) {
    if (typeof(k) == 'array') {
      dst[k] = src[k].slice();
    } else {
      dst[k] = src[k];
    }
  }
}
