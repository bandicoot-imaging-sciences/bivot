// Bivot material viewer
// https://github.com/bandicoot-imaging-sciences/bivot
// Copyright (C) Bandicoot Imaging Sciences 2019

/*
Parts of this script were adapted from third party code. Refer to LICENSE.md for the
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

/*
  The options object is optional and can include the following:
    canvasID: ID for the HTML canvas element that Bivot should use for rendering
    overlayID: ID for the HTML div element that Bivot should use for the progress bar and status text
    configPath: relative or absolute URL for the JSON configuration file
    renderPath: relative or absolute URL for the JSON render file
    texturePath: relative or absolute URL for the folder containing the texture folders
*/
function Bivot(options) {
  let defaultOptions = {
    canvasID: 'bivot-canvas',
    overlayID: 'bivot-overlay',
    configPath: 'bivot-config.json',
    renderPath: 'bivot-renders.json',
    texturePath: 'textures'
  }
  let opts = {...defaultOptions, ...options};

  // Initial state and configuration.  This will likely get overridden by the config file,
  // but if the config can't be loaded, then these are the defaults.
  let state = {
    exposure: 1.0,
    focalLength: 85,
    diffuse: 1.0,
    specular: 1.0,
    roughness: 1.0,
    tint: true,
    fresnel: false,
    ambient: 1.0,
    fxaa: true,
    bloom: 0.1,
    adaptiveToneMap: false,
    gammaCorrect: true,
    threeJsShader: true,
    lightType: 'point',
    areaLightWidth: 5.0,
    areaLightHeight: 0.2,
    lightMotion: 'mouse',
    lightPosition: new THREE.Vector3(0, 0, 1),
    lightNumber: 1,
    lightSpacing: 0.5,
    light45: false,
    scan: 'kimono-matte-v2',
    brdfModel: 0,
    brdfVersion: 2,
    yFlip: true,
    statusText: '',
    background: 0x05,
    meshRotateZDegrees: 0,
    meshRotateZDegreesPrevious: 0
  };

  let config = {
    textureFormat: 'EXR', // Valid formats are 'JPG', 'PNG', 'EXR'.
    loadExr: undefined, // Deprecated, use textureFormat instead.
    loadPng: undefined, // Deprecated, use textureFormat instead.
    loadJpeg: undefined, // Deprecated, use textureFormat instead.
    dual8Bit: false, // Make 16-bit texture from two 8-bit PNG images. Only valid when textureFormat == 'PNG'.
    showInterface: true,
    mouseCamControlsZoom: true,
    mouseCamControlsRotate: true,
    mouseCamControlsPan: true,
    initCamZ: 0.9,
    minCamZ: 0.4,
    maxCamZ: 2.0,
    linearFilter: true,
    gamma: 1.8,
    toneMapDarkness: 0.04,
    camTiltWithMousePos: 0.0,  // Factor to tilt camera based on mouse position (-0.1 is good)
    camTiltWithDeviceOrient: 0.0,  // Factor to tilt camera based on device orientation (0.6 is good)
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
  let composer = null;
  let renderPass = null;
  let bloomPass = null;
  let fxaaPass = null;
  let toneMappingPass = null;
  let gammaCorrectPass = null;
  let mesh = null;
  let scene = new THREE.Scene();
  let fov = null;
  let camera = null;
  let controls = null;
  let stats = new Stats();
  let ambientLight = null;
  let exposureGain = 1/10000; // Texture intensities in camera count scale (e.g. 14 bit).
  let gyroDetected = false;
  let touchDetected = false;
  let baselineTilt = new THREE.Vector2(0, 0);
  let baselineTiltSet = false;
  let lightMotionModes = [
    'gyro',
    'mouse',
    'sliders',
  ]
  let lightTypeModes = [
    'point',
    'area',
  ]
  let loadManager = null;
  let loader = null;
  let firstRenderLoaded = false;
  let brdfTextures = null;
  let gui = null;

  const canvas = document.getElementById(opts.canvasID);
  const overlay = document.getElementById(opts.overlayID);
  console.assert(canvas != null, 'canvas element ID not found:', opts.canvasID);
  console.assert(overlay != null, 'overlay div element ID not found:', opts.overlayID);
  let loadingElem = null;
  let progressBarElem = null;
  let subtitleElem = null;
  let subtitleTextElem = null;

  // Device orientation events require user permission for iOS > 13.
  // We use a feature detector for tilt permission in case Android picks up the same API.
  let orientPermNeeded = (typeof DeviceOrientationEvent !== 'undefined'
                       && typeof DeviceOrientationEvent.requestPermission === 'function');
  // Do we actually want to use the device orientation for anything?
  // We set this later after loading the config.
  let orientPermWanted = null;
  let orientPermObtained = false;

  // Device orientation events are blocked by default on iOS 12.2 - 12.4.
  // The user can unblock them in Settings.
  let iOSVersion = null;
  let iOSVersionOrientBlocked = false;
  let iOSVersionTimeoutID = null;
  const iOSDetected = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (iOSDetected) {
    iOSVersion = navigator.userAgent.match(/OS [\d_]+/i)[0].substr(3).split('_').map(n => parseInt(n));
    iOSVersionOrientBlocked = (iOSVersion[0] == 12 && iOSVersion[1] >= 2);
  }

  let urlFlags = getUrlFlags(); // Get options from URL

  loadConfig(opts.configPath, opts.renderPath, function () {
    // After loading (or failing to load) the config, begin the initialisation sequence.
    processUrlFlags();

    // Backward compatibility for deprecated load* flags.
    console.assert(((config.loadExr || 0) + (config.loadPng || 0) + (config.loadJpeg || 0)) <= 1);
    if (config.loadExr) {
      config.textureFormat = 'EXR';
    } else if (config.loadPng) {
      config.textureFormat = 'PNG';
    } else if (config.loadJpeg) {
      config.textureFormat = 'JPG';
    }
    if (config.hasOwnProperty('textureFormat') && typeof config.textureFormat === 'string') {
      config.textureFormat = config.textureFormat.toUpperCase();
    }
    
    console.log('Config:', config);
    console.log('State:', state);
    console.log('Renders:', scans)

    orientPermWanted = (config.camTiltWithDeviceOrient != 0.0 || config.lightTiltWithDeviceOrient != 0.0);

    initialiseOverlays();
    initialiseLighting();
    initialiseCamera();
    initialiseControls();
    if (config.showInterface) {
      addControlPanel();
    }
    THREE.RectAreaLightUniformsLib.init(); // Initialise LTC look-up tables for area lighting
    initialiseRenderer();
    loadScan();

    // Add listeners after finishing config and initialisation
    if (orientPermWanted) {
      window.addEventListener('deviceorientation', detectGyro, false);
    }
    window.addEventListener('resize', requestRender);
    window.addEventListener('touchstart', detectTouch, false);
  });


  // ========== End mainline; functions follow ==========

  function onLoad() {
    // Run after all textures and the mesh are loaded.
    loadingElem.style.display = 'none';
    uniforms.diffuseMap.value = brdfTextures.get('diffuse');
    uniforms.normalMap.value = brdfTextures.get('normals');
    uniforms.specularMap.value = brdfTextures.get('specular');
    if (config.dual8Bit) {
      uniforms.diffuseMapLow.value = brdfTextures.get('diffuse_low');
      uniforms.normalMapLow.value = brdfTextures.get('normals_low');
      uniforms.specularMapLow.value = brdfTextures.get('specular_low');
    }

    // Set up the material and attach it to the mesh
    let material = new THREE.ShaderMaterial({fragmentShader, vertexShader, uniforms, lights: true});
    material.defines = {
      USE_NORMALMAP: 1,
      OBJECTSPACE_NORMALMAP: 1,
      // USE_TANGENT: 1,
    };
    material.extensions.derivatives = true;
    mesh.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
    scene.add(mesh);

    // The deviceorientation event has been restricted for privacy reasons.
    // A work around on iOS >= 12.2 is for the user to enable it in iOS Settings > Safari (off by default).
    // The web page also has to be served over https.
    // iOS 13 introduced a permissions API so that we can ask the user more directly. The request has to be in
    // response to a "user gesture", e.g. in response to the user tapping on the canvas.
    if (orientPermWanted && !firstRenderLoaded && (iOSVersionOrientBlocked || orientPermNeeded) && !gyroDetected) {
      setTiltWarning();
    }
    firstRenderLoaded = true;
    baselineTiltSet = false;

    requestRender();
  };

  function mergeDictKeys(keys, out, first, second, third)
  {
    keys.forEach(function(item, index) {
      if (item in first) {
        out[item] = first[item];
      } else if (item in second) {
        out[item] = second[item];
      } else if (item in third) {
        out[item] = third[item];
      }
    });
  }

  function loadConfig(configFilename, renderFilename, configDone)
  {
    getJSON(configFilename,
      function(err, data) {
        if (err == null) {
          console.log('Loaded:', configFilename);
          var json_config = JSON.parse(data);
          // Merge items from the JSON config file into the initial state
          for (var k in json_config) {
            if (k == 'initialState') {
              for (var s in json_config[k]) {
                config.initialState[s] = json_config[k][s];
              }
            } else {
              config[k] = json_config[k];
            }
          }
          // Store initial state from JSON into the live state
          for (var k in config.initialState) {
            state[k] = config.initialState[k];
          }
          // Make lightPosition a THREE.Vector3 rather than an array
          const lightPos = state.lightPosition;
          state.lightPosition = new THREE.Vector3();
          state.lightPosition.fromArray(lightPos);
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
    req.onerror = function() {
      callback(req.status, req.response);
    };
    req.send();
  };

  function getUrlFlags() {
    // FIXME: Replace with URL API to reduce security risk.
    // https://developer.mozilla.org/en-US/docs/Web/API/URL
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

  function processUrlFlags() {
    // WARNING: load* flags are deprecated.
    if (urlFlags.hasOwnProperty('loadJpeg')) {
      config.loadJpeg = (decodeURI(urlFlags.loadJpeg) == 1);
    }
    if (urlFlags.hasOwnProperty('loadPng')) {
      config.loadPng = (decodeURI(urlFlags.loadPng) == 1);
    }
    if (urlFlags.hasOwnProperty('loadExr')) {
      config.loadExr = (decodeURI(urlFlags.loadExr) == 1);
    }
    if (urlFlags.hasOwnProperty('show')) {
      state.scan = decodeURI(urlFlags.show);
    }
    if (urlFlags.hasOwnProperty('textureFormat')) {
      config.textureFormat = decodeURI(urlFlags.textureFormat);
    }
  }

  function initialiseOverlays() {
    let loadingDiv = document.createElement('div');
    loadingDiv.id = 'bivot-loading';
    let progressDiv = document.createElement('div');
    progressDiv.id = 'bivot-progress';
    let progressBarDiv = document.createElement('div');
    progressBarDiv.id = 'bivot-progressbar';
    overlay.appendChild(loadingDiv);
    loadingDiv.appendChild(progressDiv);
    progressDiv.appendChild(progressBarDiv);

    let subtitleDiv = document.createElement('div');
    subtitleDiv.id = 'bivot-subtitle';
    let subtitleBGDiv = document.createElement('div');
    subtitleBGDiv.id = 'bivot-subtitle-background';
    let subtitleTextP = document.createElement('p');
    subtitleTextP.id = 'bivot-subtitle-text';
    overlay.appendChild(subtitleDiv);
    subtitleDiv.appendChild(subtitleBGDiv);
    subtitleBGDiv.appendChild(subtitleTextP);

    loadingElem = loadingDiv;
    progressBarElem = progressBarDiv;
    subtitleElem = subtitleDiv;
    subtitleTextElem = subtitleTextP;
  }

  function initialiseRenderer() {
    renderer = new THREE.WebGLRenderer({canvas});
    renderer.physicallyCorrectLights = true;

    renderer.gammaInput = true;
    renderer.gammaOutput = false;
    renderer.gammaFactor = config.gamma;

    composer = new THREE.EffectComposer(renderer);

    renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      state.bloom, // strength
      0.4, // radius
      0.99 // threshold
    );
    composer.addPass(bloomPass);

    fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    setFxaaResolution();
    composer.addPass(fxaaPass);

    gammaCorrectPass = new THREE.ShaderPass(THREE.GammaCorrectionShader);
    composer.addPass(gammaCorrectPass);

    toneMappingPass = new THREE.AdaptiveToneMappingPass(true, 256);
    updateToneMapParams();
    composer.addPass(toneMappingPass);
  }

  function updateToneMapParams() {
    if (!state.adaptiveToneMap) {
      toneMappingPass.setAdaptive(false);
      toneMappingPass.setAverageLuminance(state.toneMapDarkness);
    }
  }

  function updateBackground() {
    scene.background = new THREE.Color(state.background * 0x010101);
    requestRender();
  }

  function initialiseLighting() {
    scene.background = new THREE.Color(state.background * 0x010101);

    updateLightingGrid();
    updateLightMotion();

    const ambientColour = 0x3F3F3F;
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
    controls.panSpeed = 0.3;
    controls.rotateSpeed = 1.0;
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
    controls.screenSpacePanning = true;

    controls.addEventListener('change', requestRender);
  }

  function detectGyro(event) {
    if (event.alpha || event.beta || event.gamma) {
      gyroDetected = true;
      window.removeEventListener('deviceorientation', detectGyro, false);

      state.lightMotion = 'gyro';
      updateLightMotion();
    }
  }

  function detectTouch(event) {
    touchDetected = true;
    controls.zoomSpeed *= 0.25;
    window.removeEventListener('touchstart', detectTouch, false);
  }

  function requestTiltPermission(event) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            orientPermObtained = true;
            updateLightMotion();
            clearTiltWarning();
          }
        })
        .catch(console.error);
    }
  }

  function setTiltWarning() {
    iOSVersionTimeoutID = setTimeout(() => {
      if (iOSVersionOrientBlocked) {
        state.statusText = 'To enable tilt control, please switch on Settings > Safari > Motion & Orientation Access and then reload this page.';
      }
      updateStatusTextDisplay();
    }, 1000);
    window.addEventListener('deviceorientation', clearTiltWarning);
  }

  function clearTiltWarning() {
    clearTimeout(iOSVersionTimeoutID);
    window.removeEventListener('deviceorientation', clearTiltWarning);
    state.statusText = '';
    updateStatusTextDisplay();
  }

  function updateStatusTextDisplay() {
    // Trying to add this button while also displaying status text sends iOS Safari into a reload loop. So the
    // button takes precedence.
    if (orientPermWanted && orientPermNeeded && !orientPermObtained) {
      subtitleElem.style.display = 'flex';
      let requestButton = document.createElement('button');
      requestButton.innerHTML = 'Tap to enable tilt control';
      requestButton.onclick = requestTiltPermission;
      subtitleTextElem.appendChild(requestButton);
    } else if (state.statusText.length == 0) {
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
        if (state.lightType == 'area') {
          let areaFactor = lightIntensity / (Math.atan(state.areaLightWidth) * Math.atan(state.areaLightHeight));
          let rectLight = new THREE.RectAreaLight(color, areaFactor, state.areaLightWidth, state.areaLightHeight);
          rectLight.position.copy(upVector);
          rectLight.position.add(offset);
          // console.log(light.position);
          lights.add(rectLight);
          //var rectLightHelper = new THREE.RectAreaLightHelper( rectLight );
          //rectLight.add( rectLightHelper );
        } else {
          let light = new THREE.PointLight(color, lightIntensity, distanceLimit, decay);
          light.position.copy(upVector);
          light.position.add(offset);
          // console.log(light.position);
          lights.add(light);
        }
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

  function xy_to_3d_direction(xy, sensitivity) {
    // Convert input XY co-ords in range -1..1 and given sensitivity to a unit 3D direction vector
    let new_xy = new THREE.Vector2();
    new_xy.copy(xy).multiplyScalar(sensitivity).clampLength(0.0, 1.0);
    const z2 = 1 - new_xy.lengthSq();
    let new_z = 0.0;
    if (z2 > 0.0) {
      new_z = Math.sqrt(z2);
    }
    console.assert(!isNaN(new_z));
    return new THREE.Vector3(new_xy.x, new_xy.y, new_z);
  }

  function updateCamsAndLightsFromXY(xy, light_sensitivity, cam_sensitivity) {
    if (lights && light_sensitivity != 0.0) {
      state.lightPosition.copy(xy_to_3d_direction(xy, light_sensitivity));
      updateLightingGrid();
    }
    if (camera && cam_sensitivity != 0.0) {
      // Retain existing camera distance
      camera.position.copy(xy_to_3d_direction(xy, cam_sensitivity).multiplyScalar(camera.position.length()));
      requestRender();
    }
  }

  function onDocumentMouseMove(event) {
    // Update cams and lights using relative mouse co-ords between -1 and 1 within the window
    event.preventDefault();
    let xy = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    updateCamsAndLightsFromXY(xy, config.lightTiltWithMousePos, config.camTiltWithMousePos);
  }

  function onDocumentMouseOut(event) {
    // Reset light position and camera tilt if the mouse moves out.
    if (lights) {
      state.lightPosition.set(0, 0, 1);
      updateLightingGrid();
    }

    if (camera && config.camTiltWithMousePos != 0.0) {
      camera.position.set(0, 0, camera.position.length());
    }
  }

  function getOrientation(event) {
    // Update lights and camera using the device tilt rotation
    let orient = window.orientation || 0;
    let rotation = new THREE.Vector2();
    if (orient == 0 || orient == 180) {
      // Portrait
      rotation.set(event.beta, event.gamma);
    } else {
      // Landscape
      rotation.set(event.gamma, event.beta);
    }
    if (orient == 0) {
      rotation.y = -rotation.y;
    } else if (orient == 90) {
      rotation.x = -rotation.x;
      rotation.y = -rotation.y;
    } else if (orient == 180) {
      rotation.x = -rotation.x;
    }

    return rotation;
  }

  function onDeviceOrientation(event) {
    if (!baselineTiltSet) {
      baselineTilt.copy(getOrientation(event));
      baselineTiltSet = true;
    }
    const rots = getOrientation(event).sub(baselineTilt);
    const xy = new THREE.Vector2(
      Math.asin(THREE.Math.degToRad(rots.y)),
      Math.asin(THREE.Math.degToRad(rots.x))
    );
    updateCamsAndLightsFromXY(xy, config.lightTiltWithDeviceOrient, config.camTiltWithDeviceOrient);
  }

  function newMeshRotation() {
    state.meshRotateZDegreesPrevious = 0;
    updateMeshRotation();
  }

  function updateMeshRotation() {
    if (mesh) {
      mesh.rotateZ((state.meshRotateZDegrees - state.meshRotateZDegreesPrevious)*Math.PI/180);
      state.meshRotateZDegreesPrevious = state.meshRotateZDegrees;
    }
  }

  function addControlPanel() {
    gui = new dat.GUI();
    gui.close();
    gui.add(state, 'scan', Array.from(Object.keys(scans))).onChange(loadScan);
    gui.add(state, 'exposure', 0, 4, 0.1).onChange(requestRender).listen();
    let renderGui = gui.addFolder('Render');
    renderGui.add(state, 'background', 0, 255, 1).onChange(updateBackground);
    renderGui.add(state, 'diffuse', 0, 2, 0.01).onChange(requestRender).listen();
    renderGui.add(state, 'specular', 0, 2, 0.01).onChange(requestRender).listen();
    renderGui.add(state, 'roughness', 0, 2, 0.01).onChange(requestRender).listen();
    renderGui.add(state, 'tint').onChange(requestRender).listen();
    renderGui.add(state, 'fresnel').onChange(requestRender).listen();
    renderGui.add(ambientLight, 'intensity', 0, 2, 0.01).onChange(requestRender).name('ambient').listen();
    renderGui.add(state, 'fxaa').onChange(function(value){setFxaaResolution(); requestRender();}).listen();
    renderGui.add(state, 'bloom', 0, 2, 0.01).onChange(function(value){bloomPass.strength = Number(value); requestRender();}).listen();
    renderGui.add(state, 'gammaCorrect').onChange(function(value){gammaCorrectPass.enabled = value; requestRender();}).listen();
    renderGui.add(state, 'adaptiveToneMap').onChange(function(value){toneMappingPass.setAdaptive(value); requestRender();}).listen();
    renderGui.add(state, 'toneMapDarkness', 0, 0.2, 0.01).onChange(function(value){updateToneMapParams(); requestRender();}).listen();
    renderGui.add(state, 'threeJsShader').onChange(requestRender);
    let lightingGui = gui.addFolder('Lighting');
    lightingGui.add(state, 'lightType', lightTypeModes).onChange(updateLightingGrid);
    lightingGui.add(state, 'areaLightWidth', 0.1, 10, 0.1).onChange(updateLightingGrid);
    lightingGui.add(state, 'areaLightHeight', 0.1, 10, 0.1).onChange(updateLightingGrid);
    lightingGui.add(state, 'lightMotion', lightMotionModes).onChange(updateLightMotion).listen();
    lightingGui.add(state.lightPosition, 'x', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light x');
    lightingGui.add(state.lightPosition, 'y', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light y');
    lightingGui.add(state.lightPosition, 'z', 0.1, 3, 0.01).onChange(updateLightingGrid).listen().name('centre light z');
    lightingGui.add(state, 'lightNumber', 1, 10, 1).onChange(updateLightingGrid);
    lightingGui.add(state, 'lightSpacing', 0.01, 5, 0.01).onChange(updateLightingGrid);
    lightingGui.add(state, 'light45').onChange(updateLightingGrid);
    let sceneGui = gui.addFolder('Scene');
    sceneGui.add(state, 'meshRotateZDegrees', -180, 180).onChange(updateMeshRotation).name('obj rotate (deg)');
    sceneGui.add(state, 'focalLength', 30, 200, 10).onChange(updateFOV);
    sceneGui.add(camera.position, 'x', -1, 1, 0.01).onChange(requestRender).listen().name('camera.x');
    sceneGui.add(camera.position, 'y', -1, 1, 0.01).onChange(requestRender).listen().name('camera.y');
    sceneGui.add(camera.position, 'z', 0.1, 2, 0.01).onChange(requestRender).listen().name('camera.z');


    stats.showPanel(0); // 0: fps, 1: ms / frame, 2: MB RAM, 3+: custom
    document.body.appendChild(stats.dom);
  }

  function updateControlPanel() {
    for (var i = 0; i < Object.keys(gui.__folders).length; i++) {
      var key = Object.keys(gui.__folders)[i];
      for (var j = 0; j < gui.__folders[key].__controllers.length; j++ )
      {
          gui.__folders[key].__controllers[j].updateDisplay();
      }
    }
  }

  function loadScansImpl(brdfTexturePaths, meshPath, loadManager) {
    var objLoader = new THREE.OBJLoader(loadManager);

    objLoader.load(meshPath,
      function(object) {
        console.log('Loaded mesh object:', meshPath);
        mesh = object;
        newMeshRotation();
      },
      function (xhr) {},
      function (error) {
        console.log('Mesh unavailable; using planar geometry');
        mesh = new THREE.Mesh(getPlaneGeometry());
        newMeshRotation();
      }
    );

    brdfTextures = new Map();

    if (config.textureFormat == 'EXR') {
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
            if (config.textureFormat == 'EXR') {
              // FIXME: Setting magFilter to LinearMipMapLinearFilter doesn't seem to work for float EXR textures.
              // WebGL complains: RENDER WARNING: texture bound to texture unit 0 is not renderable. It maybe
              // non-power-of-2 and have incompatible texture filtering. This can possibly be overcome by loading
              // the right extensions:
              // OES_texture_float
              // OES_texture_float_linear
              // or the equivalent for half-float textures. However, when I tried this I got a blank render and
              // console errors (see notes on extension loading above).
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;
            } else {
              texture.minFilter = THREE.LinearMipMapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
            }
          } else {
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
          }

          texture.name = key;
          // Flip from chart space back into camera view space.  The handling of texture.flipY inside Three.js
          // is reversed for PNG compared with EXR.
          texture.flipY = (state.yFlip == (config.textureFormat == 'EXR'));
          // EXRLoader sets the format incorrectly for single channel textures.
          texture.format = value.format;
          // iOS does not support WebGL2
          // Textures need to be square powers of 2 for WebGL1
          // texture.repeat.set(matxs/padxs, matxs/padys);
          console.log('Loaded:', key, value.path);
          brdfTextures.set(key, texture);
        }
      );
    }
  }

  function loadScan() {
    if (mesh != null) {
      scene.remove(mesh); // Remove old mesh from scene and clean up memory
      mesh.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    }

    let tex_dir = opts.texturePath + '/' + state.scan;
    // List of keys to merge between the 3 states.
    let keys = Object.keys(config.initialState);
    // Remove lightPosition until we implement the special handling needed for JSON -> Vector3.
    let lpIndex = keys.indexOf('lightPosition');
    if (lpIndex > -1) {
      keys.splice(lpIndex, 1);
    }
    loadScanMetadata(tex_dir, keys);
  }

  function loadScanMetadata(texture_path, keys) {
    const jsonFilename = texture_path + '/render.json';
    getJSON(jsonFilename,
      function(err, data) {
        let bivotState = [];
        let scanState = [];

        if (err == null) {
          const metadata = JSON.parse(data);
          console.log('Loaded metata from ' + jsonFilename + ':', metadata);

          if (metadata.hasOwnProperty('state')) {
            scanState = metadata.state;
          }
          if (metadata.hasOwnProperty('version')) {
            scanState.brdfVersion = metadata.version;
          }
        } else {
          console.log('Render metadata (' + jsonFilename + ') not loaded: ' + err);
        }

        if (scans[state.scan].hasOwnProperty('state')) {
          bivotState = scans[state.scan].state;
        }
        if (scans[state.scan].hasOwnProperty('version')) {
          bivotState.brdfVersion = scans[state.scan].version;
        }

        mergeDictKeys(keys, state, bivotState, scanState, config.initialState);
        updateControlPanel();

        console.log('  BRDF model: ', state.brdfModel);
        console.log('  BRDF version: ', state.brdfVersion);

        loadScanFilenames(texture_path);
    });
  }

  function loadScanFilenames(tex_dir) {
    let texNames = new Map();
    if (state.brdfModel == 1 && state.brdfVersion >= 2.0) {
      texNames.set('diffuse', 'basecolor');
      texNames.set('normals', 'normals');
      texNames.set('specular', 'roughness-metallic');
    } else {
      texNames.set('diffuse', 'diffuse');
      texNames.set('normals', 'normals');
      texNames.set('specular', 'specular-srt');
    }

    let paths = new Map();
    console.assert(['JPG', 'PNG', 'EXR'].includes(config.textureFormat));
    if (config.textureFormat == 'EXR') {
      paths.set('diffuse', {path: tex_dir + '/brdf-' + texNames.get('diffuse') + '_cropf16.exr', format:THREE.RGBFormat});
      paths.set('normals', {path: tex_dir + '/brdf-' + texNames.get('normals') + '_cropf16.exr', format:THREE.RGBFormat});
      paths.set('specular', {path: tex_dir + '/brdf-' + texNames.get('specular') + '_cropf16.exr', format: THREE.RGBFormat});
    }
    else if (config.textureFormat == 'JPG') {
        paths.set('diffuse', {path: tex_dir + '/brdf-' + texNames.get('diffuse') + '_cropu8_hi.jpg', format:THREE.RGBFormat});
        paths.set('normals', {path: tex_dir + '/brdf-' + texNames.get('normals') + '_cropu8_hi.jpg', format:THREE.RGBFormat});
        paths.set('specular', {path: tex_dir + '/brdf-' + texNames.get('specular') + '_cropu8_hi.jpg', format: THREE.RGBFormat});
    } else {
        paths.set('diffuse', {path: tex_dir + '/brdf-' + texNames.get('diffuse') + '_cropu8_hi.png', format:THREE.RGBFormat});
        paths.set('normals', {path: tex_dir + '/brdf-' + texNames.get('normals') + '_cropu8_hi.png', format:THREE.RGBFormat});
        paths.set('specular', {path: tex_dir + '/brdf-' + texNames.get('specular') + '_cropu8_hi.png', format: THREE.RGBFormat});
      if (config.dual8Bit) {
        paths.set('diffuse_low', {path: tex_dir + '/brdf-' + texNames.get('diffuse') + '_cropu8_lo.png', format:THREE.RGBFormat});
        paths.set('normals_low', {path: tex_dir + '/brdf-' + texNames.get('normals') + '_cropu8_lo.png', format:THREE.RGBFormat});
        paths.set('specular_low', {path: tex_dir + '/brdf-' + texNames.get('specular') + '_cropu8_lo.png', format: THREE.RGBFormat});
      }
    }

    loadManager = new THREE.LoadingManager();
    loadManager.onLoad = onLoad;
    loadManager.onProgress = onProgress;

    loadScansImpl(paths, tex_dir + '/brdf-mesh.obj', loadManager);
  }

  function onProgress(urlOfLastItemLoaded, itemsLoaded, itemsTotal) {
    const progress = itemsLoaded / itemsTotal;
    loadingElem.style.display = '';
    progressBarElem.style.transform = `scaleX(${progress})`;
  };

  function getPlaneGeometry() {
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
    return new THREE.PlaneBufferGeometry(planeWidth, planeHeight);
  }

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

  function setFxaaResolution() {
    var fxaaUniforms = fxaaPass.material.uniforms;
    const pixelRatio = renderer.getPixelRatio();
    var val = 1.0 / pixelRatio;
    if (!state.fxaa) {
      val = 0.0;
    }
    fxaaUniforms['resolution'].value.x = val / window.innerWidth;
    fxaaUniforms['resolution'].value.y = val / window.innerHeight;
  }

  function render() {
    renderRequested = undefined;

    stats.begin();
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      composer.setSize(canvas.width, canvas.height);
      setFxaaResolution();
    }

    controls.update();

    uniforms.uExposure.value = exposureGain * state.exposure;
    uniforms.uDiffuse.value = state.diffuse;
    uniforms.uSpecular.value = state.specular;
    uniforms.uRoughness.value = state.roughness;
    uniforms.uTint.value = state.tint;
    uniforms.uFresnel.value = state.fresnel;
    uniforms.uThreeJsShader.value = state.threeJsShader;
    uniforms.uBrdfModel.value = state.brdfModel;
    uniforms.uBrdfVersion.value = state.brdfVersion;
    uniforms.uLoadExr.value = (config.textureFormat == 'EXR');
    uniforms.uDual8Bit.value = config.dual8Bit;
    uniforms.ltc_1.value = THREE.UniformsLib.LTC_1;
    uniforms.ltc_2.value = THREE.UniformsLib.LTC_2;

    composer.render();
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

function bivotCheckWebGL() {
  if (THREE.WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(THREE.WEBGL.getWebGLErrorMessage());
  }
}
