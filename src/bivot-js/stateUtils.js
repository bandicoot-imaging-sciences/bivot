// Copyright (C) Bandicoot Imaging Sciences 2020

// The Three.js import paths in bivot.js, shaders.js and stateUtils.js need to match.
import { Vector2, Vector3, Color } from 'three';

function arrayToVector(input, vecType) {
  // If the input is an Array, convert it to the specified vector type (either Vector2,
  // Vector3, or Color).
  console.assert(vecType == Vector2 || vecType == Vector3 || vecType == Color);
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
      "lightPosition": Vector3,
      "lightPositionOffset": Vector2,
      "cameraPan": Vector3,
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
