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
    scan: 'kimono-matte-v2',
    brdfVersion: 2,
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
    minLinearFilter: true,
    camTiltWithMousePos: -0.0,  // Factor to tilt camera based on mouse position
    lightTiltWithMousePos: 1.0,  // Factor to tilt light based on mouse position
  };

  let scans = new Map([
    ['bamboo-board-v2', {version: 2}],
    ['bamboo-softbox', {version: 2}],
    ['blue-plate', {version: 2}],
    ['charcoal-tile-v2', {version: 2}],
    ['chopping-board-v2', {version: 2}],
    ['chopping-attach-flash-v2', {version: 2}],
    ['coffee-matte', {version: 1}],
    ['coffee-matte-v2', {version: 2}],
    ['gold-edge-v2', {version: 2}],
    ['gold-zelle-v2', {version: 2}],
    ['jeans', {version: 2}],
    ['kimono-attach', {version: 2}],
    ['kimono-matte', {version: 1}],
    ['kimono-matte-v2', {version: 2}],
    ['kimono-softbox', {version: 2}],
    ['shimmy-v2', {version: 2}],
    ['stool-attach', {version: 2}],
    ['soiree', {version: 1}],
    ['soiree-v2', {version: 2}],
    ['tan-wallet-v2', {version: 2}],
  ]);

  let renderRequested = false;
  let lights = null;
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
  let lightMotionModes = [
    'gyro',
    'mouse',
    'sliders',
  ]
  let loadManager = null;
  let loader = null;
  let brdfTextures = null;

  const canvas = document.querySelector('#c');
  const loadingElem = document.querySelector('#loading');
  const progressBarElem = loadingElem.querySelector('.progressbar');

  loadConfig('bivot-config.json', function () {
    // After loading (or failing to load) the config, begin the initialisation sequence.
    initialiseRenderer();
    initialiseGeometry();
    initialiseScene();
    initialiseCamera();
    initialiseControls();
    if (config.showInterface) {
      addControlPanel();
    }
    loadScan();

    // Add listeners after finishing config and initialisation
    window.addEventListener('devicemotion', detectGyro, false);
    window.addEventListener('resize', requestRender);
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

    requestRender();
  };

  function loadConfig(configFilename, configDone)
  {
    getJSON(configFilename,
      function(err, data) {
        if (err == null) {
          console.log('Loaded bivot-config.json');
          config = JSON.parse(data);
          state = config.initialState;
          // Make lightPosition a THREE.Vector3 rather than an array
          const lightPos = state.lightPosition;
          state.lightPosition = new THREE.Vector3(lightPos.x, lightPos.y, lightPos.z);
          console.log(config);
          console.log(state);
        } else {
          console.log('Failed to load bivot-config.json: ' + err);
        }
        configDone();
      });
  }

  function getJSON(url, callback) {
    var req = new XMLHttpRequest();
    req.open("GET", "bivot-config.json");
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
    // FIXME: Panning speed is too touchy. The statement below didn't seem to have any effect.
    // controls.userPanSpeed = 0.01;
    controls.rotateSpeed = 0.15;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.enableZoom = config.mouseCamControlsZoom;
    controls.enableRotate = config.mouseCamControlsRotate;
    controls.enablePan = config.mouseCamControlsPan;
    controls.minDistance = config.minCamZ;
    controls.maxDistance = config.maxCamZ;

    controls.addEventListener('change', requestRender);
  }

  // FIXME: devicemotion event has been deprecated for privacy reasons.
  // A work around is to enable it in iOS Settings > Safari (off by default).
  // The web page also has to be served over https.
  function detectGyro(event) {
    if (event.rotationRate.alpha || event.rotationRate.beta || event.rotationRate.gamma) {
      gyroDetected = true;
      window.removeEventListener('devicemotion', detectGyro, false);
      state.lightMotion = 'gyro';
      updateLightMotion();
    }
  }

  function updateLightMotion() {
    if (state.lightMotion == 'mouse') {
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      window.removeEventListener('orientationchange', onDeviceOrientation, false);
      document.addEventListener('mousemove', onDocumentMouseMove, false);
      document.addEventListener('mouseout', onDocumentMouseOut, false);
    } else if (state.lightMotion == 'gyro') {
      window.addEventListener('deviceorientation', onDeviceOrientation, false);
      window.addEventListener('orientationchange', onDeviceOrientation, false);
      document.removeEventListener('mousemove', onDocumentMouseMove, false);
      document.removeEventListener('mouseout', onDocumentMouseOut, false);
    } else {
      console.assert(state.lightMotion == 'sliders');
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      window.removeEventListener('orientationchange', onDeviceOrientation, false);
      document.removeEventListener('mousemove', onDocumentMouseMove, false);
      document.removeEventListener('mouseout', onDocumentMouseOut, false);
      if (lights) {
        state.lightPosition.set(0, 0, 1);
        updateLightingGrid();
      }
    }
  }

  function onDocumentMouseMove(event) {
    // Move light source based on mouse position
    event.preventDefault();
    let x = (event.clientX / window.innerWidth) * 2 - 1;
    let y = -(event.clientY / window.innerHeight) * 2 + 1;
    const x2y2 = x * x + y * y;
    if (x2y2 > 1) {
      const n = Math.sqrt(x2y2);
      x /= n;
      y /= n;
    }
    x *= config.lightTiltWithMousePos;
    y *= config.lightTiltWithMousePos;

    const z = Math.sqrt(1.001 - x * x - y * y);
    if (lights) {
      state.lightPosition.set(x, y, z);
      updateLightingGrid();
    }

    if (config.camTiltWithMousePos != 0) {
      // Move camera based on mouse position
      let cam_x = -x * config.camTiltWithMousePos;
      let cam_y = -y * config.camTiltWithMousePos;
      let cam_z = Math.sqrt(1 - cam_x * cam_x - cam_y * cam_y);

      // Scale by existing camera distance
      const c = camera.position;
      const cam_dist = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
      cam_x *= cam_dist;
      cam_y *= cam_dist;
      cam_z *= cam_dist;

      camera.position.set(cam_x, cam_y, cam_z);
    }
  }

  // Reset light position and camera tilt if the mouse moves out.
  function onDocumentMouseOut(event) {
    if (lights) {
      state.lightPosition.set(0, 0, 1);
      updateLightingGrid();
    }

    if (config.camTiltWithMousePos != 0) {
      const c = camera.position;
      const cam_dist = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
      camera.position.set(0, 0, cam_dist);
    }
  }

  function onDeviceOrientation(event) {
    // iOS and Andriod have different APIs for detecting screen orienation. This function works on iOS.
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
    const z = Math.sqrt(1.001 - x * x - y * y);
    if (lights) {
      state.lightPosition.set(x, y, z);
      updateLightingGrid();
    }
  }

  function initialiseScene()
  {
    scene.background = new THREE.Color(0x222222);

    updateLightingGrid();
    updateLightMotion();

    const ambientColour = 0xFFFFFF;
    const ambientIntensity = 1.0;
    ambientLight = new THREE.AmbientLight(ambientColour, ambientIntensity);
    scene.add(ambientLight);
  }

  function addControlPanel() {
    const gui = new dat.GUI();
    gui.close();
    gui.add(state, 'scan', Array.from(scans.keys())).onChange(loadScan);
    gui.add(state, 'exposure', 0, 5, 0.01).onChange(requestRender);
    gui.add(state, 'diffuse', 0, 5, 0.01).onChange(requestRender);
    gui.add(state, 'specular', 0, 5, 0.01).onChange(requestRender);
    gui.add(state, 'roughness', 0, 5, 0.01).onChange(requestRender);
    gui.add(state, 'tint').onChange(requestRender);
    gui.add(ambientLight, 'intensity', 0, 5, 0.01).onChange(requestRender).name('ambient');
    gui.add(state, 'lightMotion', lightMotionModes).onChange(updateLightMotion).listen();
    gui.add(state.lightPosition, 'x', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light x');
    gui.add(state.lightPosition, 'y', -1, 1, 0.01).onChange(updateLightingGrid).listen().name('centre light y');
    gui.add(state.lightPosition, 'z', 0.1, 3, 0.01).onChange(updateLightingGrid).listen().name('centre light z');
    gui.add(state, 'lightNumber', 1, 10, 1).onChange(updateLightingGrid);
    gui.add(state, 'lightSpacing', 0.01, 5, 0.01).onChange(updateLightingGrid);
    gui.add(state, 'focalLength', 30, 200, 10).onChange(updateFOV);
    gui.add(camera.position, 'x', -1, 1, 0.01).onChange(requestRender).listen().name('camera.x');
    gui.add(camera.position, 'y', -1, 1, 0.01).onChange(requestRender).listen().name('camera.y');
    gui.add(camera.position, 'z', 0.1, 2, 0.01).onChange(requestRender).listen().name('camera.z');

    stats.showPanel(0); // 0: fps, 1: ms / frame, 2: MB RAM, 3+: custom
    document.body.appendChild(stats.dom);
  }

  function updateLightingGrid() {
    // FIXME: Ideally we should adjust exisiting lights to match new state, rather than just deleting them all
    // and starting again. Although if it's fast to reconstruct the whole lighting state, that's actually
    // safer from a state machine point of view.
    if (lights) {
      scene.remove(lights);
    }
    // Our custom shader assumes the light colour is grey or white.
    const color = 0xFFFFFF;
    const totalIntensity = 1;
    const lightIntensity = totalIntensity/(state.lightNumber**2);
    const distanceLimit = 10;
    const decay = 2; // Set this to 2.0 for physical light distance falloff.
    lights = new THREE.Group();
    // We assume state.lightNumber is an odd integer.
    let mid = state.lightNumber/2 - 0.5;
    for (let i = 0; i < state.lightNumber; i++) {
      for (let j = 0; j < state.lightNumber; j++) {
        // Create a grid of lights in XY plane.
        let offset = new THREE.Vector3(
          (i - mid)*state.lightSpacing,
          (j - mid)*state.lightSpacing,
          0
        );
        let light = new THREE.PointLight(color, lightIntensity, distanceLimit, decay);
        light.position.copy(state.lightPosition);
        light.position.add(offset);
        // console.log(light.position);
        lights.add(light);
      }
    }
    scene.add(lights);
    requestRender();
  }

  function loadScansImpl(brdfTexturePaths, loadManager) {
    state.brdfVersion = scans.get(state.scan).version;

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
          if (config.minLinearFilter) {
            texture.minFilter = THREE.LinearFilter;
          } else {
            texture.minFilter = THREE.NearestFilter;
          }

          // FIXME: Setting magFilter to LinearMipMapLinearFilter doesn't seem to work for float EXR textures.
          // WebGL complains: RENDER WARNING: texture bound to texture unit 0 is not renderable. It maybe
          // non-power-of-2 and have incompatible texture filtering. This can possibly be overcome by loading
          // the right extensions:
          // OES_texture_float
          // OES_texture_float_linear
          // or the equivalent for half-float textures. However, when I tried this I got a blank render and
          // console errors (see notes on extension loading above).
          texture.magFilter = THREE.NearestFilter;

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
