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
  let state = {
    exposure: 1.0,
    diffuse: 1.0,
    specular: 1.0,
    roughness: 1.0,
    tint: true,
    lightMotion: 'mouse',
    scan: 'charcoal-tile-v2',
    brdfVersion: 2,
  };

  let sceneLoaded = false;
  let light = null;
 
  // Texture intensities in camera count scale (e.g. 14 bit).
  let exposureGain = 1/10000;

  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({canvas});

  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ReinhardToneMapping;

  // Physical distance units are in metres.
  const focalLength = 0.085;
  const sensorHeight = 0.024;
  // Three.js defines the field of view angle as the vertical angle.
  const fov = 2*Math.atan(sensorHeight/(2*focalLength))*180/Math.PI;
  const aspect = 2;  // the canvas default
  const near = 0.01;
  const far = 10;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 0, 0.9);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.15;
  // FIXME: Panning speed is too touchy. The statement below didn't seem to have any effect.
  // controls.userPanSpeed = 0.01;
  controls.rotateSpeed = 0.15;
  controls.target.set(0, 0, 0);
  controls.update();

  let gyroDetected = false;
  let lightMotionModes = [
    'gyro',
    'mouse',
    'sliders',
  ]

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
  window.addEventListener('devicemotion', detectGyro, false);

  function updateLightMotion() {
    if (state.lightMotion == 'mouse') {
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      window.removeEventListener('orientationchange', onDeviceOrientation, false);
      document.addEventListener('mousemove', onDocumentMouseMove, false);
    } else if (state.lightMotion == 'gyro') {
      window.addEventListener('deviceorientation', onDeviceOrientation, false);
      window.addEventListener('orientationchange', onDeviceOrientation, false);
        document.removeEventListener('mousemove', onDocumentMouseMove, false);
    } else {
      console.assert(state.lightMotion == 'sliders');
      window.removeEventListener('deviceorientation', onDeviceOrientation, false);
      window.removeEventListener('orientationchange', onDeviceOrientation, false);
      document.removeEventListener('mousemove', onDocumentMouseMove, false);
      if (light) {
        light.position.set(0, 0, 1);
      }
    }
  }

  function onDocumentMouseMove(event) {
    event.preventDefault();
    let x = (event.clientX / window.innerWidth) * 2 - 1;
    let y = -(event.clientY / window.innerHeight) * 2 + 1;
    const x2y2 = x * x + y * y;
    if (x2y2 > 1) {
      const n = Math.sqrt(x2y2);
      x /= n;
      y /= n;
    }
    const z = Math.sqrt(1.001 - x * x - y * y);
    if (light) {
      light.position.set(x, y, z);
      requestRenderIfNotRequested();
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
    if (light) {
      light.position.set(x, y, z);
      requestRenderIfNotRequested();
    }
  }

  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x222222);

  const color = 0xFFFFFF;
  const intensity = 1;
  const distanceLimit = 10;
  const decay = 2; // Set this to 2.0 for physical light distance falloff.
  light = new THREE.PointLight(color, intensity, distanceLimit, decay);
  light.position.set(0, 0, 1);
  scene.add(light);
  updateLightMotion();

  const ambientColour = 0xFFFFFF;
  const ambientIntensity = 1.0;
  const ambientLight = new THREE.AmbientLight(ambientColour, ambientIntensity);
  scene.add(ambientLight);

  let scans = new Map([
    ['bamboo-board-v2', {version: 2}],
    ['charcoal-tile-v2', {version: 2}],
    ['chopping-board-v2', {version: 2}],
    ['coffee-matte', {version: 1}],
    ['coffee-matte-v2', {version: 2}],
    ['gold-edge-v2', {version: 2}],
    ['gold-zelle-v2', {version: 2}],
    ['kimono-matte', {version: 1}],
    ['kimono-matte-v2', {version: 2}],
    ['shimmy-v2', {version: 2}],
    ['soiree', {version: 1}],
    ['soiree-v2', {version: 2}],
    ['tan-wallet-v2', {version: 2}],
  ]);

  const gui = new dat.GUI();
  gui.add(state, 'scan', Array.from(scans.keys())).onChange(loadScan);
  gui.add(state, 'exposure', 0, 5, 0.01).onChange(render);
  gui.add(state, 'diffuse', 0, 5, 0.01).onChange(render);
  gui.add(state, 'specular', 0, 5, 0.01).onChange(render);
  gui.add(state, 'roughness', 0, 5, 0.01).onChange(render);
  gui.add(state, 'tint').onChange(render);
  gui.add(ambientLight, 'intensity', 0, 5, 0.01).onChange(render).name('ambient');
  gui.add(state, 'lightMotion', lightMotionModes).onChange(updateLightMotion).listen();
  gui.add(light.position, 'x', -1, 1, 0.01).onChange(render).listen().name('light.x');
  gui.add(light.position, 'y', -1, 1, 0.01).onChange(render).listen().name('light.y');
  gui.add(light.position, 'z', 0.1, 3, 0.01).onChange(render).listen().name('light.z');
  gui.add(camera.position, 'x', -1, 1, 0.01).onChange(render).listen().name('camera.x');
  gui.add(camera.position, 'y', -1, 1, 0.01).onChange(render).listen().name('camera.y');
  gui.add(camera.position, 'z', 0.1, 2, 0.01).onChange(render).listen().name('camera.z');
  gui.close();

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
  const geometry = new THREE.PlaneBufferGeometry(planeWidth, planeHeight);

  let loadManager = null;
  let loader = null;
  const loadingElem = document.querySelector('#loading');
  const progressBarElem = loadingElem.querySelector('.progressbar');

  let brdfTextures = null;

  function loadScan() {
    state.brdfVersion = scans.get(state.scan).version;

    let brdfTexturePaths = new Map([
      ['diffuse', {path: 'textures/' + state.scan + '/brdf-diffuse_cropf16.exr', format:THREE.RGBFormat}],
      ['normals', {path: 'textures/' + state.scan + '/brdf-normals_cropf16.exr', format:THREE.RGBFormat}],
      ['specular', {path: 'textures/' + state.scan + '/brdf-specular-srt_cropf16.exr', format: THREE.RGBFormat}],
    ]);
    brdfTextures = new Map();

    loadManager = new THREE.LoadingManager();
    loadManager.onLoad = onLoad;
    loadManager.onProgress = onProgress;
    loader = new THREE.EXRLoader(loadManager);
    onProgress('', 0, 1);

    for (let [key, value] of brdfTexturePaths) {
      loader.load(value.path,
        function (texture, textureData) {
          // Run after each texture is loaded.

          // FIXME: Mip map filtering doesn't seem to work for EXR textures. WebGL complains: RENDER WARNING: texture
          // bound to texture unit 0 is not renderable. It maybe non-power-of-2 and have incompatible texture
          // filtering. This can possibly be overcome by loading the right extensions:
          // this.ms_Renderer.context.getExtension( 'OES_texture_float' );
          // this.ms_Renderer.context.getExtension( 'OES_texture_float_linear' );
          // or the equivalent for half-float textures.
          texture.minFilter = THREE.NearestFilter;
          texture.magFilter = THREE.NearestFilter;
          texture.name = key;
          // Flip from chart space back into camera view space.
          texture.flipY = true;
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

  loadScan();

  function onLoad() {
    // Run after all textures are loaded.
    loadingElem.style.display = 'none';
    uniforms.diffuseMap.value = brdfTextures.get('diffuse');
    uniforms.normalMap.value = brdfTextures.get('normals');
    uniforms.specularMap.value = brdfTextures.get('specular');
    let material = new THREE.ShaderMaterial({fragmentShader, vertexShader, uniforms, lights: true});
    material.defines = {
      USE_NORMALMAP: 1,
      // USE_TANGENT: 1,
    };
    material.extensions.derivatives = true;
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    sceneLoaded = true;
    render();
  };

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

  let stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms / frame, 2: MB RAM, 3+: custom
  document.body.appendChild(stats.dom);

  let renderRequested = false;

  function render() {
    if (sceneLoaded) {
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
      renderer.render(scene, camera);
      stats.end();
    }
  }
  render();

  function requestRenderIfNotRequested() {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  }

  controls.addEventListener('change', requestRenderIfNotRequested);
  window.addEventListener('resize', requestRenderIfNotRequested);
}

if ( WEBGL.isWebGLAvailable() === false ) {
    document.body.appendChild( WEBGL.getWebGLErrorMessage() );
}

main();
