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
    exposure: 2.0
  };
  // Texture intensities in camera count scale (e.g. 14 bit).
  let exposureGain = 1/10000;

  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({canvas});

  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ReinhardToneMapping;

  // Physical distance units are in metres.
  const focalLength = 0.085;
  const sensorWidth = 0.036;
  const fov = 2*Math.tan(sensorWidth/focalLength)*180/Math.PI;
  const aspect = 2;  // the canvas default
  const near = 0.01;
  const far = 10;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 0, 0.1);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  // FIXME: Panning speed is too touchy. The statement below didn't seem to have any effect.
  // controls.userPanSpeed = 0.01;
  controls.rotateSpeed = 0.1;
  controls.target.set(0, 0, 0);
  controls.update();

  const gui = new dat.GUI();
  gui.add(state, 'exposure', 0, 20, 0.01).onChange(render);
  gui.open();

  const scene = new THREE.Scene();
  
  scene.background = new THREE.Color(0x222222);

  const color = 0xFFFFFF;
  const intensity = 1;
  const distanceLimit = 10;
  const decay = 2;
  const light = new THREE.PointLight(color, intensity, distanceLimit, decay);
  light.position.set(1, 0, 1);
  scene.add(light);

  const dpi = 300;
  const pixelsPerMetre = dpi/0.0254;
  const textureWidthPixels = 512;
  const textureHeightPixels = 512;
  // const matxs = 1928;
  // const matys = 1285;
  // const padxs = 2048;
  // const padys = padxs;
  // const planeHeight = matys/matxs;
  const planeWidth = textureWidthPixels/pixelsPerMetre;
  const planeHeight = textureHeightPixels/pixelsPerMetre;
  const geometry = new THREE.PlaneBufferGeometry(planeWidth, planeHeight);

  const loadManager = new THREE.LoadingManager();
  const loader = new THREE.EXRLoader(loadManager);

  let brdfTexturePaths = new Map([
    ['diffuse', 'textures/coffee-matte/brdf-diffuse_cropf16.exr'],
    ['normals', 'textures/coffee-matte/brdf-normals_cropf16.exr'],
    ['roughness', 'textures/coffee-matte/brdf-roughness_cropf16.exr'],
    ['specular', 'textures/coffee-matte/brdf-specular_cropf16.exr'],
  ]);
  let brdfTextures = new Map();

  for (let [name, path] of brdfTexturePaths) {
    loader.load(path,
      function (texture, textureData) {
        // Run after each texture is loaded.
        console.log('Loaded:', name, texture, textureData);

        // FIXME: Mip map filtering doesn't seem to work for EXR textures. WebGL complains: RENDER WARNING: texture
        // bound to texture unit 0 is not renderable. It maybe non-power-of-2 and have incompatible texture
        // filtering. This can possibly be overcome by loading the right extensions:
        // this.ms_Renderer.context.getExtension( 'OES_texture_float' );
        // this.ms_Renderer.context.getExtension( 'OES_texture_float_linear' );
        // or the equivalent for half-float textures.
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.name = name;
        // Flip from chart space back into camera view space.
        texture.flipY = true;
        // iOS does not support WebGL2
        // Textures need to be square powers of 2 for WebGL1
        // texture.repeat.set(matxs/padxs, matxs/padys);       
        brdfTextures.set(name, texture);
      }
    );
  }

  const loadingElem = document.querySelector('#loading');
  const progressBarElem = loadingElem.querySelector('.progressbar');

  loadManager.onLoad = () => {
    // Run after all textures are loaded.
    loadingElem.style.display = 'none';
    uniforms.tDiffuse.value = brdfTextures.get('diffuse');
    uniforms.tNormals.value = brdfTextures.get('normals');
    uniforms.tSpecular.value = brdfTextures.get('specular');
    uniforms.tRoughness.value = brdfTextures.get('roughness');
    let material = new THREE.ShaderMaterial({fragmentShader, vertexShader, uniforms, lights: true});
    material.extensions.derivatives = true;
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    render();
  };

  loadManager.onProgress = (urlOfLastItemLoaded, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal;
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
    renderRequested = undefined;

    stats.begin();
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    controls.update();
    uniforms.uExposure.value = exposureGain*state.exposure;
    renderer.render(scene, camera);
    stats.end();
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
