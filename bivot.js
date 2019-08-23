// Copyright (C) Bandicoot Imaging Sciences 2019

/*
Parts of this script were adapted from third party code. Refer to LICENSE-third_party.md for the
relevant licenses.

Parts adapted from Threejs:
- EXR texture loading.
  https://github.com/mrdoob/three.js/blob/dev/examples/webgl_loader_texture_exr.html
- Initial shader structure including lighting.
  https://github.com/mrdoob/three.js/blob/dev/examples/js/shaders/SkinShader.js
  https://github.com/mrdoob/three.js/blob/dev/examples/js/shaders/TerrainShader.js
- Tangent-space normal map calculations.
  https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical_vert.glsl.js
  https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical_frag.glsl.js

Parts adapted from Threejsfundamentals:
- Responsive layout
- On demand rendering
- Initial HTML and JS structure
- Texture loading progress bar.
  https://github.com/greggman/threejsfundamentals/blob/master/threejs/threejs-render-on-demand-w-gui.html
  https://github.com/greggman/threejsfundamentals/blob/master/threejs/threejs-textured-cube-wait-for-all-textures.html
*/

'use strict';

function main() {
  // Initial state and configuration.  This will likely get overridden by the config file,
  // but if the config can't be loaded, then these are the defaults.
  let state = {
    exposure: 1.0,
    focalLength: 85,
    diffuse: 1.0,
    specular: 1.0,
    roughness: 1.0,
    tint: true,
    lightMotion: 'mouse',
    lightPosition: new THREE.Vector3(0, 0, 1),
    lightNumber: 1,
    lightSpacing: 0.5,
    light45: false,
    scan: 'kimono-matte-v2',
    brdfVersion: 2,
    statusText: '',
  };

  let config = {
    loadExr: true,
    dual8Bit: false,
    showInterface: true,
    mouseCamControlsZoom: true,
    mouseCamControlsRotate: true,
    mouseCamControlsPan: true,
    initCamZ: 0.9,
    minCamZ: 0.4,
    maxCamZ: 2.0,
    linearFilter: true,
    // The following factors must have an absolute value <= 1.0.
    camTiltWithMousePos: 0.0,  // Factor to tilt camera based on mouse position (0.1 is good)
    camTiltWithDeviceOrient: 0.0,  // Factor to tilt camera based on device orientation (-0.4 is good)
    lightTiltWithMousePos: 1.0,  // Factor to tilt light based on mouse position
    lightTiltWithDeviceOrient: 1.0,  // Factor to tilt light based on device orientation
    initialState: {},
  };

  // Store initial state in the config
  for (var k in state) {
    config.initialState[k] = state[k];
  }


  let scans = {};
  let renderRequested = false;
  let lights = null;
  let lights45 = null;
  let renderer = null;
  let geometry = null;
  let scene = new THREE.Scene();
  let fov = null;
  let camera = null;
  let controls = null;
  let stats = new Stats();
  let ambientLight = null;
  let exposureGain = 1/10000; // Texture intensities in camera count scale (e.g. 14 bit).
  let gyroDetected = false;
  let touchDetected = false;
  let lightMotionModes = [
    'gyro',
    'mouse',
    'sliders',
  ]
  let loadManager = null;
  let loader = null;
  let firstRenderLoaded = false;
  let brdfTextures = null;
  let urlFlags = getUrlFlags();

  const canvas = document.querySelector('#c');
  const loadingElem = document.querySelector('#loading');
  const progressBarElem = loadingElem.querySelector('.progressbar');
  const subtitleElem = document.querySelector('#subtitle');
  const subtitleTextElem = document.querySelector('.subtitle-text');

  let iOSVersion = null;
  let iOSVersionOrientBlocked = false;
  let iOSVersionTimeoutID = null;
  const iOSDetected = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (iOSDetected) {
    iOSVersion = navigator.userAgent.match(/OS [\d_]+/i)[0].substr(3).split('_').map(n => parseInt(n));
    iOSVersionOrientBlocked = (iOSVersion[0] == 12 && iOSVersion[1] >= 2);
  }

  loadConfig('bivot-config.json', 'bivot-renders.json', function () {
    // After loading (or failing to load) the config, begin the initialisation sequence.
    initialiseRenderer();
    initialiseGeometry();
    initialiseLighting();
    initialiseCamera();
    initialiseControls();
    if (config.showInterface) {
      addControlPanel();
    }
    loadScan();

    // Add listeners after finishing config and initialisation
    window.addEventListener('devicemotion', detectGyro, false);
    window.addEventListener('resize', requestRender);
    window.addEventListener('touchstart', detectTouch, false);
  });



  // ========== End mainline; functions follow ==========

  function onLoad() {
    // Run after all textures are loaded.
    loadingElem.style.display = 'none';
    uniforms.diffuseMap.value = brdfTextures.get('diffuse');
    uniforms.normalMap.value = brdfTextures.get('normals');
    uniforms.specularMap.value = brdfTextures.get('specular');
    if (config.dual8Bit) {
      uniforms.diffuseMapLow.value = brdfTextures.get('diffuse_low');
      uniforms.normalMapLow.value = brdfTextures.get('normals_low');
      uniforms.specularMapLow.value = brdfTextures.get('specular_low');
    }
    let material = new THREE.ShaderMaterial({fragmentShader, vertexShader, uniforms, lights: true});
    material.defines = {
      USE_NORMALMAP: 1,
      // USE_TANGENT: 1,
    };
    material.extensions.derivatives = true;
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // The devicemotion event has been deprecated for privacy reasons.
    // A work around on iOS >= 12.2 is to enable it in iOS Settings > Safari (off by default).
    // The web page also has to be served over https.
    // iOS 13 will introduce a permissions API so that we can ask the user more directly.
    if (!firstRenderLoaded && iOSVersionOrientBlocked && !gyroDetected) {
      setTiltWarning();
    }
    firstRenderLoaded = true;

    requestRender();
  };

  function loadConfig(configFilename, renderFilename, configDone)
  {
    getJSON(configFilename,
      function(err, data) {
        if (err == null) {
          console.log('Loaded bivot-config.json');
          config = JSON.parse(data);
          // Store initial state from JSON into the live state
          for (var k in config.initialState) {
            state[k] = config.initialState[k];
          }
          console.assert(Math.abs(config.camTiltWithDeviceOrient) <= 1.0);
          console.assert(Math.abs(config.camTiltWithMousePos) <= 1.0);
          console.assert(Math.abs(config.lightTiltWithDeviceOrient) <= 1.0);
          console.assert(Math.abs(config.lightTiltWithMousePos) <= 1.0);
          // Make lightPosition a THREE.Vector3 rather than an array
          const lightPos = state.lightPosition;
          state.lightPosition = new THREE.Vector3();
          state.lightPosition.fromArray(lightPos);
          console.log('Config:', config);
          console.log('State:', state);
        } else {
          console.log('Failed to load ' + configFilename + ': ' + err);
        }

        getJSON(renderFilename,
          function(err, data_renders) {
            if (err == null) {
              let j = JSON.parse(data_renders);

              if (urlFlags.showcase == 1) {
                for (let r in j.renders) {
                  if (j.renders.hasOwnProperty(r)) {
                    if (j.renders[r].showcase > 0) {
                      scans[r] = j.renders[r];
                    }
                  }
                }
              } else {
                scans = j.renders;
              }
              console.log('Renders:', scans)
            } else {
              console.log('Failed to load ' + renderFilename + ': ' + err);
            }

            if (!scans.hasOwnProperty(state.scan)) {
              // If the scan state isn't a scan in the list, use the first scan in the list
              state.scan = Object.keys(scans)[0];
            }

            configDone();
          });
      });
  }

  function getJSON(url, callback) {
    var req = new XMLHttpRequest();
    req.open("GET", url);
    req.overrideMimeType("application/json");
    req.onload = function() {
      var status = req.status;
      if (status == 200) {
        callback(null, req.response);
      } else {
        callback(status, req.response);
      }
    };
    req.send();
  };

  function getUrlFlags() {
    var dict = {};

    var flags = window.location.href.split('?')[1];

    if (flags) {
      var params = flags.split('&');
      var num_params = params.length;

      for (var i = 0; i < num_params; i++) {
        var key_value = params[i].split('=');
        dict[key_value[0]] = key_value[1];
      }
    }

    console.log('URL flags:', dict);

    return dict;
  }

  function initialiseRenderer() {
    renderer = new THREE.WebGLRenderer({canvas});
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ReinhardToneMapping;
  }

  function initialiseGeometry() {
    const dpi = 300;
    const pixelsPerMetre = dpi/0.0254;
    const textureWidthPixels = 2048;
    const textureHeightPixels = 2048;
    // const matxs = 1928;
    // const matys = 1285;
    // const padxs = 2048;
    // const padys = padxs;
    // const planeHeight = matys/matxs;
    const planeWidth = textureWidthPixels/pixelsPerMetre;
    const planeHeight = textureHeightPixels/pixelsPerMetre;
    geometry = new THREE.PlaneBufferGeometry(planeWidth, planeHeight);
  }

  function initialiseLighting() {
    scene.background = new THREE.Color(0x222222);

    updateLightingGrid();
    updateLightMotion();

    const ambientColour = 0xFFFFFF;
    const ambientIntensity = 1.0;
    ambientLight = new THREE.AmbientLight(ambientColour, ambientIntensity);
    scene.add(ambientLight);
  }

  function initialiseCamera() {
    // Physical distance units are in metres.
    const sensorHeight = 0.024;
    fov = fieldOfView(state.focalLength, sensorHeight);
    const aspect = 2;  // the canvas default
    const near = 0.01;
    const far = 10;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, config.initCamZ);
  }

  function initialiseControls() {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.panSpeed = 0.1;
    controls.rotateSpeed = 0.15;
    controls.zoomSpeed = 1.0;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.enableZoom = config.mouseCamControlsZoom;
    controls.enableRotate = config.mouseCamControlsRotate;
    controls.enablePan = config.mouseCamControlsPan;
    controls.minDistance = config.minCamZ;
    controls.maxDistance = config.maxCamZ;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI - 0.1;
    controls.minAzimuthAngle = -Math.PI/2 + 0.1;
    controls.maxAzimuthAngle = +Math.PI/2 - 0.1;

    controls.addEventListener('change', requestRender);
  }

  function detectGyro(event) {
    if (event.rotationRate.alpha || event.rotationRate.beta || event.rotationRate.gamma) {
      gyroDetected = true;
      window.removeEventListener('devicemotion', detectGyro, false);
      state.lightMotion = 'gyro';
      updateLightMotion();
    }
  }

  function detectTouch(event) {
    touchDetected = true;
    controls.zoomSpeed *= 0.25;
    window.removeEventListener('touchstart', detectTouch, false);
  }

  function setTiltWarning () {
    iOSVersionTimeoutID = setTimeout(() => {
      state.statusText = 'To enable tilt control, please switch on Settings > Safari > Motion & Orientation Access and then reload this page.';
      updateStatusTextDisplay();
    }, 1000);
    window.addEventListener('deviceorientation', clearTiltWarning);
  }

  function clearTiltWarning () {
    clearTimeout(iOSVersionTimeoutID);
    window.removeEventListener(clearTiltWarning);
    state.statusText = '';
    updateStatusTextDisplay();
  }

  function updateStatusTextDisplay() {
    if (state.statusText.length == 0) {
      subtitleElem.style.display = 'none';
      subtitleTextElem.innerHTML = '';   
    } else {
      subtitleElem.style.display = 'flex';
      subtitleTextElem.innerHTML = state.statusText;
    }
  }

  function updateLightMotion() {
    if (state.lightMotion == 'mouse') {
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      document.addEventListener('mousemove', onDocumentMouseMove, false);
      document.addEventListener('mouseout', onDocumentMouseOut, false);
    } else if (state.lightMotion == 'gyro') {
      window.addEventListener('deviceorientation', onDeviceOrientation, false);
      document.removeEventListener('mousemove', onDocumentMouseMove, false);
      document.removeEventListener('mouseout', onDocumentMouseOut, false);
    } else {
      console.assert(state.lightMotion == 'sliders');
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      document.removeEventListener('mousemove', onDocumentMouseMove, false);
      document.removeEventListener('mouseout', onDocumentMouseOut, false);
      if (lights) {
        state.lightPosition.set(0, 0, 1);
        updateLightingGrid();
      }
    }
  }

  function updateLightingGrid() {
    // FIXME: Ideally we should adjust exisiting lights to match new state, rather than just deleting them all
    // and starting again. Although if it's fast to reconstruct the whole lighting state, that's actually
    // safer from a state machine point of view.
    if (lights) {
      scene.remove(lights);
    }
    if (lights45) {
      scene.remove(lights45);
    }
    // Our custom shader assumes the light colour is grey or white.
    const color = 0xFFFFFF;
    const totalIntensity = 1;
    let totalLights = state.lightNumber**2;
    if (state.light45) {
      totalLights *= 2;
    }
    const lightIntensity = totalIntensity/(totalLights);
    const distanceLimit = 10;
    const decay = 2; // Set this to 2.0 for physical light distance falloff.

    // Create a grid of lights in XY plane at z = length of lightPosition vector.
    let upVector = new THREE.Vector3(0, 0, state.lightPosition.length());
    lights = new THREE.Group();
    // We assume state.lightNumber is an odd integer.
    let mid = state.lightNumber/2 - 0.5;
    for (let i = 0; i < state.lightNumber; i++) {
      for (let j = 0; j < state.lightNumber; j++) {
        let offset = new THREE.Vector3(
          (i - mid)*state.lightSpacing,
          (j - mid)*state.lightSpacing,
          0
        );
        let light = new THREE.PointLight(color, lightIntensity, distanceLimit, decay);
        light.position.copy(upVector);
        light.position.add(offset);
        // console.log(light.position);
        lights.add(light);
      }
    }
    let upVectorNorm = upVector.clone();
    upVectorNorm.normalize();
    let lightVectorNorm = state.lightPosition.clone();
    lightVectorNorm.normalize();
    let rotationAxis = new THREE.Vector3(0, 0, 0);
    rotationAxis.crossVectors(upVectorNorm, lightVectorNorm);
    let rotationAngle = Math.acos(upVectorNorm.dot(lightVectorNorm));
    lights.rotateOnAxis(rotationAxis, rotationAngle);
    scene.add(lights);

    if (state.light45) {
      // Add an extra light at 45 deg elevation for natural viewing on phone or tablet.
      lights45 = lights.clone();
      let xAxis = new THREE.Vector3(1, 0, 0);
      lights45.rotateOnAxis(xAxis, Math.PI/4);
      scene.add(lights45);
    } else {
      lights45 = null;
    }

    requestRender();
  }

  function updateCameraPosition(x, y) {
    // Move camera based on supplied transverse position within a unit circle
    console.assert(Math.abs(x) <= 1.0);
    console.assert(Math.abs(y) <= 1.0);
    let cam_x = x;
    let cam_y = y;
    let cam_z = Math.sqrt(1 - cam_x * cam_x - cam_y * cam_y);

    // Scale by existing camera distance
    const c = camera.position;
    const cam_dist = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
    cam_x *= cam_dist;
    cam_y *= cam_dist;
    cam_z *= cam_dist;

    if (!(isNaN(cam_x) || isNaN(cam_y) || isNaN(cam_z))) {
      camera.position.set(cam_x, cam_y, cam_z);
    }
  }

  function onDocumentMouseMove(event) {
    // Move light source based on mouse position
    event.preventDefault();
    let x = (event.clientX / window.innerWidth) * 2 - 1;
    let y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Normalise vectors longer than 1 to lie on unit circle
    const x2y2 = x * x + y * y;
    if (x2y2 > 1) {
      const n = Math.sqrt(x2y2);
      x /= n;
      y /= n;
    }

    if (lights) {
      const light_x = config.lightTiltWithMousePos*x;
      const light_y = config.lightTiltWithMousePos*y;
      const light_z = Math.sqrt(1.001 - x * x - y * y);
      state.lightPosition.set(light_x, light_y, light_z);
      updateLightingGrid();
    }

    if (camera && config.camTiltWithMousePos != 0.0) {
      // Move camera based on mouse position
      updateCameraPosition(config.camTiltWithMousePos*x, config.camTiltWithMousePos*y);
    }
  }

  // Reset light position and camera tilt if the mouse moves out.
  function onDocumentMouseOut(event) {
    if (lights) {
      state.lightPosition.set(0, 0, 1);
      updateLightingGrid();
    }

    if (camera && config.camTiltWithMousePos != 0.0) {
      const c = camera.position;
      const cam_dist = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
      camera.position.set(0, 0, cam_dist);
    }
  }

  function onDeviceOrientation(event) {
    let orient = window.orientation || 0;
    let xRotation; // Rotation around X axis.
    let yRotation; // Rotation around Y axis.
    if (orient == 0 || orient == 180) {
      // Portrait
      xRotation = event.beta;
      yRotation = event.gamma;
    } else {
      // Landscape
      xRotation = event.gamma;
      yRotation = event.beta;
    }
    if (orient == 0) {
      yRotation = -yRotation;
    } else if (orient == 90) {
      xRotation = -xRotation;
      yRotation = -yRotation;
    } else if (orient == 180) {
      xRotation = -xRotation;
    }
    let x = Math.asin(THREE.Math.degToRad(yRotation));
    let y = Math.asin(THREE.Math.degToRad(xRotation));
    if (lights && config.lightTiltWithDeviceOrient != 0.0) {
      let light_x = config.lightTiltWithDeviceOrient*x;
      let light_y = config.lightTiltWithDeviceOrient*y;
      const light_z = Math.sqrt(1.001 - x * x - y * y);
      console.assert(!isNaN(light_z));
      state.lightPosition.set(light_x, light_y, light_z);
      updateLightingGrid();
    }

    if (camera && config.camTiltWithMousePos != 0.0) {
      // Move camera based on device tilt
      // It feels better with 4x more sensitivity to device tilt compared with mouse motion.
      // It also seems more natural to tilt the camera in the opposite direction wih device tilt.
      updateCameraPosition(config.camTiltWithDeviceOrient*x, config.camTiltWithDeviceOrient*y);
    }
  }

  function addControlPanel() {
    const gui = new dat.GUI();
    gui.close();
    gui.add(state, 'scan', Array.from(Object.keys(scans))).onChange(loadScan).listen();
    gui.add(state, 'exposure', 0, 5, 0.01).onChange(requestRender).listen();
    gui.add(state, 'diffuse', 0, 5, 0.01).onChange(requestRender).listen();
    gui.add(state, 'specular', 0, 5, 0.01).onChange(requestRender).listen();
    gui.add(state, 'roughness', 0, 5, 0.01).onChange(requestRender).listen();
    gui.add(state, 'tint').onChange(requestRender).listen();
    gui.add(ambientLight, 'intensity', 0, 5, 0.01).onChange(requestRender).name('ambient').listen();
    gui.add(state, 'lightMotion', lightMotionModes).onChange(updateLightMotion).listen();
    gui.add(state.lightPosition, 'x', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light x');
    gui.add(state.lightPosition, 'y', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light y');
    gui.add(state.lightPosition, 'z', 0.1, 3, 0.01).onChange(updateLightingGrid).listen().name('centre light z');
    gui.add(state, 'lightNumber', 1, 10, 1).onChange(updateLightingGrid);
    gui.add(state, 'lightSpacing', 0.01, 5, 0.01).onChange(updateLightingGrid);
    gui.add(state, 'light45').onChange(updateLightingGrid);
    gui.add(state, 'focalLength', 30, 200, 10).onChange(updateFOV);
    gui.add(camera.position, 'x', -1, 1, 0.01).onChange(requestRender).listen().name('camera.x');
    gui.add(camera.position, 'y', -1, 1, 0.01).onChange(requestRender).listen().name('camera.y');
    gui.add(camera.position, 'z', 0.1, 2, 0.01).onChange(requestRender).listen().name('camera.z');

    stats.showPanel(0); // 0: fps, 1: ms / frame, 2: MB RAM, 3+: custom
    document.body.appendChild(stats.dom);
  }

  function loadScansImpl(brdfTexturePaths, loadManager) {
    state.brdfVersion = scans[state.scan].version;

    brdfTextures = new Map();

    if (config.loadExr) {
      loader = new THREE.EXRLoader(loadManager);
    } else{
      loader = new THREE.TextureLoader(loadManager);
    }
    onProgress('', 0, 1);

    // In theory, the extension OES_texture_float_linear should enable mip-mapping for floating point textures.
    // However, even though these extensions load OK, when I set texture.magFilter to LinearMipMapLinearFilter I
    // get a blank texture and WebGL console errors complaining that the texture is not renderable. Tested on
    // Chrome for Windows and Safari for iOS 12.3.1.

    /*
    if (! renderer.extensions.get('OES_texture_float')) {
      alert('OES_texture_float not supported');
      throw 'missing webgl extension';
    }

    if (! renderer.extensions.get('OES_texture_float_linear')) {
      alert('OES_texture_float_linear not supported');
      throw 'missing webgl extension';
    }
    */
    for (let [key, value] of brdfTexturePaths) {
      loader.load(value.path,
        function (texture, textureData) {
          // Run after each texture is loaded.

          // Both LinearFilter and NearestFilter work on Chrome for Windows and Safari for iOS 12.3.1. In
          // principle, for most surfaces, LinearFilter should reduce shimmer caused by anti-aliasing.
          // However, for some surfaces with high-frequency normals or specular detials, LinearFilter causes
          // cause moire artifacts, so NearestFilter is used.
          if (config.linearFilter) {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
          } else {
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
          }
          // FIXME: Setting magFilter to LinearMipMapLinearFilter doesn't seem to work for float EXR textures.
          // WebGL complains: RENDER WARNING: texture bound to texture unit 0 is not renderable. It maybe
          // non-power-of-2 and have incompatible texture filtering. This can possibly be overcome by loading
          // the right extensions:
          // OES_texture_float
          // OES_texture_float_linear
          // or the equivalent for half-float textures. However, when I tried this I got a blank render and
          // console errors (see notes on extension loading above).

          texture.name = key;
          // Flip from chart space back into camera view space.  Only needed when loading EXR.
          texture.flipY = config.loadExr;
          // EXRLoader sets the format incorrectly for single channel textures.
          texture.format = value.format;
          // iOS does not support WebGL2
          // Textures need to be square powers of 2 for WebGL1
          // texture.repeat.set(matxs/padxs, matxs/padys);
          console.log('Loaded:', key, texture, textureData);
          brdfTextures.set(key, texture);
        }
      );
    }
  }

  function loadScan() {
    let paths = new Map();

    if (config.loadExr) {
      paths.set('diffuse', {path: 'textures/' + state.scan + '/brdf-diffuse_cropf16.exr', format:THREE.RGBFormat});
      paths.set('normals', {path: 'textures/' + state.scan + '/brdf-normals_cropf16.exr', format:THREE.RGBFormat});
      paths.set('specular', {path: 'textures/' + state.scan + '/brdf-specular-srt_cropf16.exr', format: THREE.RGBFormat});
    }
    else
    {
      paths.set('diffuse', {path: 'textures/' + state.scan + '/brdf-diffuse_cropu8_hi.png', format:THREE.RGBFormat});
      paths.set('normals', {path: 'textures/' + state.scan + '/brdf-normals_cropu8_hi.png', format:THREE.RGBFormat});
      paths.set('specular', {path: 'textures/' + state.scan + '/brdf-specular-srt_cropu8_hi.png', format: THREE.RGBFormat});
      if (config.dual8Bit) {
        paths.set('diffuse_low', {path: 'textures/' + state.scan + '/brdf-diffuse_cropu8_lo.png', format:THREE.RGBFormat});
        paths.set('normals_low', {path: 'textures/' + state.scan + '/brdf-normals_cropu8_lo.png', format:THREE.RGBFormat});
        paths.set('specular_low', {path: 'textures/' + state.scan + '/brdf-specular-srt_cropu8_lo.png', format: THREE.RGBFormat});
      }
    }

    loadManager = new THREE.LoadingManager();
    loadManager.onLoad = onLoad;
    loadManager.onProgress = onProgress;
    loadScansImpl(paths, loadManager);


    let s = [];
    if (scans[state.scan].hasOwnProperty('state')) {
      s = scans[state.scan].state;
    }
    let keys = ['exposure', 'diffuse', 'specular', 'roughness', 'tint', 'ambient'];
    keys.forEach(function(item, index) {
      if (item in s) {
        state[item] = s[item];
      } else {
        state[item] = config.initialState[item];
      }
    });
  }

  function onProgress(urlOfLastItemLoaded, itemsLoaded, itemsTotal) {
    const progress = itemsLoaded / itemsTotal;
    loadingElem.style.display = '';
    progressBarElem.style.transform = `scaleX(${progress})`;
  };

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const pixelRatio = window.devicePixelRatio;
    const width  = canvas.clientWidth  * pixelRatio | 0;
    const height = canvas.clientHeight * pixelRatio | 0;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function fieldOfView(focalLength, sensorHeight) {
    // Focal length is in mm for easier GUI control.
    // Three.js defines the field of view angle as the vertical angle.
    return 2*Math.atan(sensorHeight/(2*focalLength/1000))*180/Math.PI;
  }

  function updateFOV() {
    fov = fieldOfView(state.focalLength, sensorHeight);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function render() {
    renderRequested = undefined;

    stats.begin();
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    controls.update();

    uniforms.uExposure.value = exposureGain*state.exposure;
    uniforms.uDiffuse.value = state.diffuse;
    uniforms.uSpecular.value = state.specular;
    uniforms.uRoughness.value = state.roughness;
    uniforms.uTint.value = state.tint;
    uniforms.uBrdfVersion.value = state.brdfVersion;
    uniforms.uLoadExr.value = config.loadExr;
    uniforms.uDual8Bit.value = config.dual8Bit;
    renderer.render(scene, camera);
    stats.end();
  }

  // Request a render frame only if a request is not already pending.
  function requestRender() {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  }

}

if ( WEBGL.isWebGLAvailable() === false ) {
    document.body.appendChild( WEBGL.getWebGLErrorMessage() );
}

main();
