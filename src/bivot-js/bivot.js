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

// The Three.js import paths in bivot.js, shaders.js and stateUtils.js need to match.

import * as THREE from '@bandicoot-imaging-sciences/three';

import { OrbitControls } from '@bandicoot-imaging-sciences/three/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from '@bandicoot-imaging-sciences/three/examples/jsm/loaders/EXRLoader.js';
import { OBJLoader } from '@bandicoot-imaging-sciences/three/examples/jsm/loaders/OBJLoader.js';
import { WEBGL } from '@bandicoot-imaging-sciences/three/examples/jsm/WebGL.js';
import { EffectComposer } from '@bandicoot-imaging-sciences/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '@bandicoot-imaging-sciences/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '@bandicoot-imaging-sciences/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '@bandicoot-imaging-sciences/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AdaptiveToneMappingPass } from '@bandicoot-imaging-sciences/three/examples/jsm/postprocessing/AdaptiveToneMappingPass.js';
import { FXAAShader } from '@bandicoot-imaging-sciences/three/examples/jsm/shaders/FXAAShader.js';
import { GammaCorrectionShader } from '@bandicoot-imaging-sciences/three/examples/jsm/shaders/GammaCorrectionShader.js';
import { RectAreaLightUniformsLib } from '@bandicoot-imaging-sciences/three/examples/jsm/lights/RectAreaLightUniformsLib.js';

import getShaders from './shaders.js';
import { loadJsonFile } from '../utils/jsonLib.js';
import { isEmpty } from '../utils/objLib.js';
import { jsonToState, copyStatesCloneVectors } from './stateUtils.js';

/*
  The options object is optional and can include the following:
    canvasID: ID for the HTML canvas element that Bivot should use for rendering
    overlayID: ID for the HTML div element that Bivot should use for the progress bar and status text
    configPath: relative or absolute URL for the JSON configuration file
    renderPath: relative or absolute URL for the JSON render file
    texturePath: relative or absolute URL for the folder containing the texture folders
*/
class bivotJs {

  constructor(options) {
    this.controlModes = {
      FULL: 'full',
      QA: 'qa',
      MANAGE: 'manage',
      NONE: 'none',
    }

    const { uniforms, vertexShader, fragmentShader } = getShaders();
    this.uniforms = uniforms;
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;


    let defaultOptions = {
      canvasID: 'bivot-canvas',
      overlayID: 'bivot-overlay',
      configPath: 'bivot-config.json',
      renderPath: 'bivot-renders.json',
      texturePath: 'textures',
      config: null,
      material: null,
      textures: null,
      materialSet: null,
      controlMode: this.controlModes.FULL,
      useTouch: null,
      width: 0,
      height: 0,
      state: null,
      stateLoadCallback: null,
      setZoomCallback: null,
    }
    this.opts = {...defaultOptions, ...options};

    // Initial state and configuration.  This will likely get overridden by the config file,
    // but if the config can't be loaded, then these are the defaults. Attributes with underscore prefixes are
    // intended for internal use only, and should not be set in the configuration files.
    this.state = {
      exposure: 1.0,
      brightness: 0.5,
      contrast: 0.5,
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
      toneMapDarkness: 0.04,
      threeJsShader: true,
      lightType: 'point',
      areaLightWidth: 5.0,
      areaLightHeight: 0.2,
      // Control modes are set using lightMotion:
      // mouse - control using mouse position and mouse buttons (auto-rotate when outside canvas)
      // gyro - control using device tilt (auto rotate always off)
      // animate - automated control (auto rotate always on)
      lightMotion: 'mouse',
      lightColor: [255, 255, 255],
      lightPosition: new THREE.Vector3(0, 0, 1),
      // Offset light controls by this vector. In screen co-ords: x-axis points right and y-axis points up.
      lightPositionOffset: new THREE.Vector2(0, 0),
      lightNumber: 1,
      lightSpacing: 0.5,
      light45: false,
      scan: 'kimono 2k',
      brdfModel: 1,
      brdfVersion: 2,
      yFlip: true,
      background: 0x05, // Legacy grayscale background
      backgroundColor: '#050505', // RGB background colour string
      meshRotateZDegrees: 0,
      camTiltWithMousePos: 0.0,  // Factor to tilt camera based on mouse position (-0.1 is good)
      camTiltWithDeviceOrient: 0.0,  // Factor to tilt camera based on device orientation (0.6 is good)
      camTiltLimitDegrees: 0.0, // Lowest elevation angle (in degrees) that the camera can tilt to.
      lightTiltWithMousePos: 1.0,  // Factor to tilt light based on mouse position
      lightTiltWithDeviceOrient: 1.0,  // Factor to tilt light based on device orientation
      lightTiltLimitDegrees: 0.0, // Lowest elevation angle (in degrees) that the light can tilt to.
      // Speed of device baseline drift towards current tilt, when current tilt elevation is lower than
      // camTiltLimitDegrees or lightTiltLimitDegrees.
      tiltDriftSpeed: 1.0,
      tiltZeroOnMouseOut: false, // If true, reset the tilt to zero when the mouse moves out of the window.
      portrait: false,
      autoRotatePeriodMs: 0,
      autoRotateFps: 30,
      autoRotateCamFactor: 0.5,
      autoRotateLightFactor: 0.9,
      // zoom: [0.4, 0.9, 2.0],  // No default, to allow legacy galleries to keep working
      _camPositionOffset: new THREE.Vector2(0, 0),
      _meshRotateZDegreesPrevious: 0,
      _statusText: '',
    };

    this.config = {
      textureFormat: 'EXR', // Valid formats are 'JPG', 'PNG', 'EXR'.
      loadExr: undefined, // Deprecated, use textureFormat instead.
      loadPng: undefined, // Deprecated, use textureFormat instead.
      loadJpeg: undefined, // Deprecated, use textureFormat instead.
      dual8Bit: false, // Make 16-bit texture from two 8-bit PNG images. Only valid when textureFormat == 'PNG'.
      showInterface: true,
      mouseCamControlsZoom: true,
      mouseCamControlsRotate: true,
      mouseCamControlsPan: true,
      // Enables touch control for phones and tablet, but disables scrolling the page for touch-drags inside the
      // Bivot canvas.
      useTouch: true,
      initCamZ: 0.9,
      minCamZ: 0.4, // Initial value, state is changed via controls object.
      maxCamZ: 2.0, // Initial value, state is changed via controls object.
      linearFilter: true, // Applied during texture loading.
      initialState: {},
    };

    if (this.opts.state) {
      // Merge in to state only the keys provided in the options; use defaults for others
      for (var k in this.state) {
        if (!this.opts.state.hasOwnProperty(k)) {
          this.opts.state[k] = this.state[k];
        }
      }

      // Use the passed-in state as the live state object
      this.state = this.opts.state;
    }

    // Define the keys in state which are vectors, and their type
    this.vectorKeys = {
      "lightPosition": THREE.Vector3,
      "lightPositionOffset": THREE.Vector2
    };

    // Store initial state in the config
    copyStatesCloneVectors(this.state, this.config.initialState, this.vectorKeys);

    this.canvas = document.getElementById(this.opts.canvasID);
    this.overlay = document.getElementById(this.opts.overlayID);
    console.assert(this.canvas != null, 'canvas element ID not found:', this.opts.canvasID);
    console.assert(this.overlay != null, 'overlay div element ID not found:', this.opts.overlayID);

    this.scans = {};
    this.materials = {};
    this.exposureGain = 1/10000; // Texture intensities in camera count scale (e.g. 14 bit).
    this.renderRequested = false;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.lights = null;
    this.lights45 = null;
    this.mesh = null;
    this.renderer = null;
    this.fxaaPass = null;
    this.toneMappingPass = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gammaCorrectPass = null;
    this.composer = null;
    this.controls = null;
    // Start false so that auto-rotate is always active until the mouse moves, even if the mouse starts over
    // the canvas.
    this.mouseInCanvas = false;

    // Tracking to handle cleanup
    this.shuttingDown = false;
    this.timeouts = [];
    this.listeners = [];
    this.elements = [];
  }

  startRender() {
    let _self = this;

    let fov = null;
    let ambientLight = null;
    let gyroDetected = false;
    let touchDetected = detectTouch();
    let baselineTilt = new THREE.Vector2(0, 0);
    let baselineTiltSet = false;
    let loader = null;
    let firstRenderLoaded = false;
    let brdfTextures = null;
    let gui = null;

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

    if (Object.values(this.controlModes).indexOf(urlFlags.controls) > -1) {
      this.opts.controlMode = urlFlags.controls;
    }

    initConfig().then(() => {
      // After loading (or failing to load) the config, begin the initialisation sequence.
      processUrlFlags();

      // Backward compatibility for deprecated load* flags.
      console.assert(((this.config.loadExr || 0) + (this.config.loadPng || 0) + (this.config.loadJpeg || 0)) <= 1);
      if (this.config.loadExr) {
        this.config.textureFormat = 'EXR';
      } else if (this.config.loadPng) {
        this.config.textureFormat = 'PNG';
      } else if (this.config.loadJpeg) {
        this.config.textureFormat = 'JPG';
      }
      if (this.config.hasOwnProperty('textureFormat') && typeof this.config.textureFormat === 'string') {
        this.config.textureFormat = this.config.textureFormat.toUpperCase();
      }

      console.log('Options:', this.opts);
      console.log('Config:', this.config);
      console.log('State:', this.state);
      console.log('Renders:', this.scans)

      orientPermWanted = (this.state.camTiltWithDeviceOrient != 0.0 || this.state.lightTiltWithDeviceOrient != 0.0);

      initialiseOverlays(this.overlay);
      initialiseLighting(this.getBgColorFromState(this.state), this.scene);
      this.camera = initialiseCamera(this.state.focalLength, this.config.initCamZ);
      this.controls = initialiseControls(this.camera, this.canvas, this.config, this.state.camTiltLimitDegrees);
      if (this.config.showInterface) {
        addControlPanel();
      }
      this.initialiseCanvas(this.canvas, this.opts.width, this.opts.height);
      this.renderer = this.initialiseRenderer();
      RectAreaLightUniformsLib.init(this.renderer); // Initialise LTC look-up tables for area lighting
      this.composer = this.initialiseComposer(this.renderer, updateToneMapParams);
      this.updateCanvas();

      loadScan();

      initialiseZoom(this.state.zoom);

      // Add listeners after finishing config and initialisation
      if (orientPermWanted) {
        this.registerEventListener(window, 'deviceorientation', detectGyro, false);
      }
      this.registerEventListener(window, 'resize', this.requestRender);

      if (this.opts.useTouch == true || this.opts.useTouch == false) {
        this.config.useTouch = this.opts.useTouch;
      }
    });
    // ========== End mainline; functions follow ==========

    async function initConfig() {
      if (_self.opts.materialSet) {
        _self.scans = await loadMaterialSet(_self.opts.materialSet);
      }
      if (!_self.scans || isEmpty(_self.scans)) {
        // materials not provided or failed to load
        await loadConfig(_self.opts.configPath, _self.config, _self.state, _self.opts.config, _self.vectorKeys)
        _self.scans = await loadRender(_self.opts.renderPath, _self.opts.material);
      }
      if (!_self.scans.hasOwnProperty(_self.state.scan)) {
        // If the scan state isn't a scan in the list, use the first scan in the list
        _self.state.scan = Object.keys(_self.scans)[0];
      }
    }

    function onLoad() {
      // Run after all textures and the mesh are loaded.
      loadingElem.style.display = 'none';
      _self.uniforms.diffuseMap.value = brdfTextures.get('diffuse');
      _self.uniforms.normalMap.value = brdfTextures.get('normals');
      _self.uniforms.specularMap.value = brdfTextures.get('specular');
      if (_self.config.dual8Bit) {
        _self.uniforms.diffuseMapLow.value = brdfTextures.get('diffuse_low');
        _self.uniforms.normalMapLow.value = brdfTextures.get('normals_low');
        _self.uniforms.specularMapLow.value = brdfTextures.get('specular_low');
      }

      // Set up the material and attach it to the mesh
      let material = new THREE.ShaderMaterial(
        {
          fragmentShader: _self.fragmentShader,
          vertexShader: _self.vertexShader,
          uniforms: _self.uniforms,
          lights: true
        }
      );
      material.defines = {
        USE_NORMALMAP: 1,
        OBJECTSPACE_NORMALMAP: 1,
        // USE_TANGENT: 1,
      };
      material.extensions.derivatives = true;
      _self.mesh.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
          child.material = material;
        }
      });
      _self.scene.add(_self.mesh);

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

      _self.updateLightingGrid();
      _self.requestRender();
    };

    function mergeDictKeys(keys, out, first, second, third, vectorKeys) {
      keys.forEach(function(item, index) {
        let t = vectorKeys[item];
        if (item in first) {
          if (t == undefined) {
            out[item] = first[item];
          } else {
            out[item].copy(first[item]);
          }
        } else if (item in second) {
          if (t == undefined) {
            out[item] = second[item];
          } else {
            out[item].copy(second[item]);
          }
        } else if (item in third) {
          if (t == undefined) {
            out[item] = third[item];
          } else {
            out[item].copy(third[item]);
          }
        }
      });
    }

    async function loadMaterialSet(filename) {
      console.log('loadMaterialSet(): Loading material set file:', filename);
      const materialSet = {};
      if (filename) {
        const jsonMaterialSet = await loadJsonFile(filename);
        if (jsonMaterialSet) {
          const numMaterials = jsonMaterialSet.materials.length;
          for (var i = 0; i < numMaterials; i++) {
            const galleryMats = jsonMaterialSet.materials[i].gallery;
            const galleryMat = galleryMats[galleryMats.length - 1];
            const render = galleryMat.config.renders[galleryMat.name];
            var bivotMat = {};
            for (var key in galleryMat) {
              if (key != 'config' && galleryMat.hasOwnProperty(key)) {
                bivotMat[key] = galleryMat[key];
              }
            }
            bivotMat['config'] = {
              renders: {
                [galleryMat.name]: {
                  state: {}
                }
              }
            };
            const bivotMatRender = bivotMat.config.renders[galleryMat.name];
            for (var key in render) {
              if (key != 'state' && render.hasOwnProperty(key)) {
                bivotMatRender[key] = render[key];
              }
            }
            jsonToState(render['state'], bivotMatRender['state']);
            materialSet[bivotMat.name] = bivotMat;
          }
        }
      }

      if (Object.keys(materialSet).length === 0) {
        console.log('Failed to load materialSet file: ', materialSet);
        return null;
      } else {
        console.log('materialSet loaded: ', materialSet);
        return materialSet;
      }
    }

    async function loadConfig(configFilename, config, state, optsConfig, vectorKeys) {
      if (configFilename) {
        const jsonConfig = await loadJsonFile(configFilename);
        if (jsonConfig) {
          console.log('Loaded:', configFilename);

          // Copy JSON config file into config.
          // For the initialState we do a merge instead of a plain copy.
          for (var k in jsonConfig) {
            if (k == 'initialState') {
              jsonToState(jsonConfig[k], config.initialState, vectorKeys);
            } else {
              config[k] = jsonConfig[k];
            }
          }

          // Copy initial state from JSON into the live state
          copyStatesCloneVectors(config.initialState, state, vectorKeys);
        } else {
          console.log('Error: Failed to load ' + configFilename);
        }
      } else if (optsConfig) {
        console.log('Using provided config object');
        for (var k in optsConfig) {
          if (k == 'initialState') {
            jsonToState(optsConfig[k], config.initialState, vectorKeys);
          } else {
            config[k] = optsConfig[k];
          }
        }
      }
    }

    async function loadRender(renderFilename, material) {
      var scans = {};
      if (renderFilename) {
        const jsonRender = await loadJsonFile(renderFilename);
        if (jsonRender) {
          console.log(`Loaded ${renderFilename}:`, jsonRender);
          if (urlFlags.showcase == 1) {
            for (let r in jsonRender.renders) {
              if (jsonRender.renders.hasOwnProperty(r)) {
                if (jsonRender.renders[r].showcase > 0) {
                  scans[r] = jsonRender.renders[r];
                }
              }
            }
          } else {
            scans = jsonRender.renders;
          }
        } else {
          console.log('Error: Failed to load ' + renderFilename);
        }
      } else if (material) {
        console.log('Using provided material object');
        scans = material.config.renders;
        // TODO: Apply showcase flag to this branch
      }
      return scans;
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
      const validFlags = {
        controls: ['full', 'qa', 'manage', 'none'],
        show: 'SAFE_STRING',
        showcase: ['1'],
        textureFormat: ['JPG', 'PNG', 'EXR']
      };

      const parsedUrl = new URL(window.location.href);
      let dict = {};

      for (const [key, value] of parsedUrl.searchParams) {
        const decodeValue = decodeURI(value)
        if (validFlags.hasOwnProperty(key)) {
          const validValues = validFlags[key];
          if (Array.isArray(validValues)) {
            if (validValues.includes(decodeValue)) {
              dict[key] = decodeValue;
            } else {
              console.warn('Invalid query parameter value for key:', key);
            }
          } else if (validValues == 'SAFE_STRING') {
            const re = /^[a-zA-Z0-9-_\s]*$/;
            if (re.test(decodeValue)) {
              dict[key] = decodeValue;
            } else {
              console.warn('Invalid characters in string value for key:', key);
            }
          }
        } else {
          console.warn('Invalid keys found in query parameters');
        }
      }

      console.log('URL flags:', dict);
      return dict;
    }

    function processUrlFlags() {
      if (urlFlags.hasOwnProperty('show')) {
        _self.state.scan = urlFlags.show;
      }
      if (urlFlags.hasOwnProperty('textureFormat')) {
        _self.config.textureFormat = urlFlags.textureFormat;
      }
    }

    function initialiseOverlays(overlay) {
      let loadingDiv = _self.registerElement(document, 'div');
      loadingDiv.className += 'bivot-loading';
      let progressDiv = _self.registerElement(document, 'div');
      progressDiv.className += 'bivot-progress';
      let progressBarDiv = _self.registerElement(document, 'div');
      progressBarDiv.className += 'bivot-progressbar';
      overlay.appendChild(loadingDiv);
      loadingDiv.appendChild(progressDiv);
      progressDiv.appendChild(progressBarDiv);

      let subtitleDiv = _self.registerElement(document, 'div');
      subtitleDiv.className += 'bivot-subtitle';
      let subtitleBGDiv = _self.registerElement(document, 'div');
      subtitleBGDiv.className += 'bivot-subtitle-background';
      let subtitleTextP = _self.registerElement(document, 'p');
      subtitleTextP.className += 'bivot-subtitle-text';
      overlay.appendChild(subtitleDiv);
      subtitleDiv.appendChild(subtitleBGDiv);
      subtitleBGDiv.appendChild(subtitleTextP);

      loadingElem = loadingDiv;
      progressBarElem = progressBarDiv;
      subtitleElem = subtitleDiv;
      subtitleTextElem = subtitleTextP;
    }

    function updateToneMapParams() {
      if (!_self.state.adaptiveToneMap) {
        _self.toneMappingPass.setAdaptive(false);
        _self.toneMappingPass.setAverageLuminance(_self.state.toneMapDarkness);
      }
    }

    function initialiseLighting(background, scene) {
      scene.background = new THREE.Color(background);

      _self.updateLightingGrid();
      updateLightMotion();

      const ambientColour = 0x3F3F3F;
      const ambientIntensity = 1.0;
      ambientLight = new THREE.AmbientLight(ambientColour, ambientIntensity);
      scene.add(ambientLight);
    }

    function initialiseCamera(focalLength, initZ) {
      // Physical distance units are in metres.
      const sensorHeight = 0.024;
      fov = fieldOfView(focalLength, sensorHeight);
      const aspect = 2;  // the canvas default
      const near = 0.01;
      const far = 10;
      var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      camera.position.set(0, 0, initZ);
      return camera;
    }

    function initialiseZoom(zoomArray) {
      if (zoomArray) {
        _self.state.currentZoom = zoomArray[1];
        _self.updateZoom();
      }
    }

    function controlsChange(event) {
      if (_self.opts.setZoomCallback) {
        _self.opts.setZoomCallback(_self.camera.position.length());
      }
      _self.requestRender();
    }

    function initialiseControls(camera, canvas, config, tiltLimit) {
      var controls = new OrbitControls(camera, canvas);
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
      controls.screenSpacePanning = true;
      if (touchDetected) {
        controls.zoomSpeed *= 0.25;
        if (!config.useTouch) {
          controls.dispose();
        }
      }
      updateCamTiltLimit(controls, tiltLimit);
      _self.registerEventListener(controls, 'change', controlsChange);
      return controls;
    }

    function updateCamTiltLimit(controls, limitDeg) {
      let tiltLimitRadians = Math.PI * limitDeg / 180;
      controls.minPolarAngle = tiltLimitRadians;
      controls.maxPolarAngle = Math.PI - tiltLimitRadians;
      controls.minAzimuthAngle = -Math.PI/2 + tiltLimitRadians;
      controls.maxAzimuthAngle = +Math.PI/2 - tiltLimitRadians;
    }

    function detectGyro(event) {
      // This can be called at a different point in the config and texture loading sequence, depending on
      // whether we are waiting for the user to grant permission, or if the browser already has permission.
      if (event.alpha || event.beta || event.gamma) {
        console.log('Gyro detected');
        gyroDetected = true;
        window.removeEventListener('deviceorientation', detectGyro, false);

        // This gets overwritten by initialState if a texture config is loaded after detectGyro().
        _self.state.lightMotion = 'gyro';
        // This resolves the overwriting problem above, but in turn may still get overwritten by a texture
        // config if that config sets lightMotion and is loaded after detectGyro().
        _self.config.initialState.lightMotion = 'gyro';
        updateLightMotion();
      }
    }

    function detectTouch() {
      // Detect if primary control is touch (true for phones and tablets, false for touch-screen laptops with
      // trackpad and mouse).
      return window.matchMedia("(pointer: coarse)").matches;
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
          _self.state._statusText = 'To enable tilt control, please switch on Settings > Safari > Motion & Orientation Access and then reload this page.';
        }
        updateStatusTextDisplay();
      }, 1000);
      _self.timeouts.push(iOSVersionTimeoutID);
      _self.registerEventListener(window, 'deviceorientation', clearTiltWarning);
    }

    function clearTiltWarning() {
      clearTimeout(iOSVersionTimeoutID);
      window.removeEventListener('deviceorientation', clearTiltWarning);
      _self.state._statusText = '';
      // Permission may have been granted in another window running Bivot, e.g. another IFRAME. If so, we should
      // have started to receive valid deviceorientation events, and gyroDetected will be true. This only works
      // if detectGyro() was added as a deviceorientation event listener *before* clearTiltWarning().
      if (gyroDetected) {
        orientPermObtained = true;
      }
      updateStatusTextDisplay();
    }

    function updateStatusTextDisplay() {
      // Trying to add this button while also displaying status text sends iOS Safari into a reload loop. So the
      // button takes precedence.
      if (orientPermWanted && orientPermNeeded && !orientPermObtained) {
        subtitleElem.style.display = 'flex';
        let requestButton = _self.registerElement(document, 'button');
        requestButton.className = 'bivot-button';
        requestButton.innerHTML = 'Tap to enable tilt control';
        requestButton.onclick = requestTiltPermission;
        subtitleTextElem.appendChild(requestButton);
      } else if (_self.state._statusText.length == 0) {
        subtitleElem.style.display = 'none';
        subtitleTextElem.innerHTML = '';
      } else {
        subtitleElem.style.display = 'flex';
        subtitleTextElem.innerHTML = _self.state._statusText;
      }
    }

    function updateLightMotion() {
      if (_self.state.lightMotion == 'mouse') {
        window.removeEventListener('deviceorientation', onDeviceOrientation, false);
        _self.registerEventListener(document, 'mousemove', onDocumentMouseMove, false);
        _self.registerEventListener(document, 'mouseout', onDocumentMouseOut, false);
        _self.registerEventListener(_self.canvas, 'mouseover', onCanvasMouseOver, false);
        _self.registerEventListener(_self.canvas, 'mouseout', onCanvasMouseOut, false);
      } else if (_self.state.lightMotion == 'gyro') {
        _self.registerEventListener(window, 'deviceorientation', onDeviceOrientation, false);
        document.removeEventListener('mousemove', onDocumentMouseMove, false);
        document.removeEventListener('mouseout', onDocumentMouseOut, false);
        _self.canvas.removeEventListener('mouseover', onCanvasMouseOver, false);
        _self.canvas.removeEventListener('mouseout', onCanvasMouseOut, false);
      } else {
        console.assert(_self.state.lightMotion == 'animate');
        window.removeEventListener('deviceorientation', onDeviceOrientation, false);
        document.removeEventListener('mousemove', onDocumentMouseMove, false);
        document.removeEventListener('mouseout', onDocumentMouseOut, false);
        _self.canvas.removeEventListener('mouseover', onCanvasMouseOver, false);
        _self.canvas.removeEventListener('mouseout', onCanvasMouseOut, false);        
      }
    }

    function onDocumentMouseMove(event) {
      // Update cams and lights using relative mouse co-ords between -1 and 1 within the canvas
      event.preventDefault();
      const viewPortX = event.clientX;
      const viewPortY = event.clientY;
      if (_self.isViewPortCoordInCanvas(viewPortX, viewPortY)) {
        const rect = _self.canvas.getBoundingClientRect();
        const xy = new THREE.Vector2(
          ((viewPortX - rect.left) / (rect.right - rect.left)) * 2 - 1,
          -((viewPortY - rect.top) / (rect.bottom - rect.top)) * 2 + 1
        );
        _self.updateCamsAndLightsFromXY(xy, _self.state.lightTiltWithMousePos, _self.state.camTiltWithMousePos);
      }
    }

    function onDocumentMouseOut(event) {
      // Reset light position and camera tilt if the mouse moves out.
      if (_self.lights && _self.state.tiltZeroOnMouseOut) {
        _self.state.lightPosition.set(_self.state.lightPositionOffset.x, _self.state.lightPositionOffset.y, 1);
        _self.state.lightPosition.copy(
          _self.xyTo3dDirection(new THREE.Vector2(0, 0), _self.state.lightPositionOffset, _self.state.lightTiltWithMousePos,
          _self.state.lightTiltLimitDegrees)
          );

        _self.updateLightingGrid();
      }

      if (_self.camera && _self.state.tiltZeroOnMouseOut && _self.state.camTiltWithMousePos != 0.0) {
        _self.camera.position.set(0, 0, _self.camera.position.length());
      }

      if (_self.state.autoRotatePeriodMs 
        && (_self.state.lightMotion == 'mouse' || _self.state.lightMotion == 'animate')) {
        _self.requestRender();
      }
    }

    function onCanvasMouseOver(event) {
      _self.mouseInCanvas = true;
    }

    function onCanvasMouseOut(event) {
      _self.mouseInCanvas = false;
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
      const currentTilt = getOrientation(event);
      if (!baselineTiltSet) {
        baselineTilt.copy(currentTilt);
        baselineTiltSet = true;
      }
      const deltaTilt = currentTilt.clone().sub(baselineTilt);
      const xy = new THREE.Vector2(
        Math.sin(THREE.Math.degToRad(deltaTilt.y)),
        Math.sin(THREE.Math.degToRad(deltaTilt.x))
      );
      const elevationLimit = Math.max(_self.state.camTiltLimitDegrees, _self.state.lightTiltLimitDegrees);
      const qLimit = Math.cos(THREE.Math.degToRad(elevationLimit));
      if (xy.length() > qLimit) {
        const surplus = xy.length() - xy.clone().clampLength(0.0, qLimit).length();
        baselineTilt.addScaledVector(deltaTilt, surplus * _self.state.tiltDriftSpeed);
      }
      _self.updateCamsAndLightsFromXY(xy, _self.state.lightTiltWithDeviceOrient, _self.state.camTiltWithDeviceOrient);
    }

    function newMeshRotation() {
      _self.state._meshRotateZDegreesPrevious = 0;
      _self.updateMeshRotation();
    }

    function loadScansImpl(brdfTexturePaths, meshPath, loadManager) {
      updateControlPanel(gui);
      var objLoader = new OBJLoader(loadManager);
      objLoader.load(meshPath,
        function(object) {
          console.log('Loaded mesh object:', meshPath);
          _self.mesh = object;
          // START: work around for https://github.com/mrdoob/three.js/issues/20492
          // TODO: Remove after upgrading to future Three.js release (r122) that will include a fix.
          _self.mesh.traverse(function(child) {
            if (child instanceof THREE.Mesh) {
              child.geometry.computeVertexNormals();
            }
          });
          // END work around.
          newMeshRotation();
        },
        function (xhr) {},
        function (error) {
          console.log('Mesh unavailable; using planar geometry');
          _self.mesh = new THREE.Mesh(getPlaneGeometry());
          newMeshRotation();
        }
      );

      brdfTextures = new Map();

      // If a materialSet was provided, set the texture format directly from the texture file extensions
      if (_self.opts.materialSet) {
        for (var [key, value] of brdfTexturePaths) {
          _self.config.textureFormat = value.path.split('.').pop().toUpperCase();
          break;
        }
      }

      if (_self.config.textureFormat == 'EXR') {
        loader = new EXRLoader(loadManager);
      } else{
        loader = new THREE.TextureLoader(loadManager);
      }
      onProgress('', 0, 1);

      // In theory, the extension OES_texture_float_linear should enable mip-mapping for floating point textures.
      // However, even though these extensions load OK, when I set texture.magFilter to LinearMipMapLinearFilter I
      // get a blank texture and WebGL console errors complaining that the texture is not renderable. Tested on
      // Chrome for Windows and Safari for iOS 12.3.1.

      /*
      if (! this.renderer.extensions.get('OES_texture_float')) {
        alert('OES_texture_float not supported');
        throw 'missing webgl extension';
      }

      if (! this.renderer.extensions.get('OES_texture_float_linear')) {
        alert('OES_texture_float_linear not supported');
        throw 'missing webgl extension';
      }
      */
      console.log(brdfTexturePaths)
      for (let [key, value] of brdfTexturePaths) {
        loader.load(value.path,
          function (texture, textureData) {
            // Run after each texture is loaded.

            // Both LinearFilter and NearestFilter work on Chrome for Windows and Safari for iOS 12.3.1. In
            // principle, for most surfaces, LinearFilter should reduce shimmer caused by anti-aliasing.
            // However, for some surfaces with high-frequency normals or specular detials, LinearFilter causes
            // cause moire artifacts, so NearestFilter is used.
            if (_self.config.linearFilter) {
              if (_self.config.textureFormat == 'EXR') {
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
            texture.flipY = (_self.state.yFlip == (_self.config.textureFormat == 'EXR'));
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
      if (_self.mesh != null) {
        _self.scene.remove(_self.mesh); // Remove old mesh from scene and clean up memory
        _self.mesh.traverse(function(child) {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
      }

      const loadManager = new THREE.LoadingManager();
      loadManager.onLoad = onLoad;
      loadManager.onProgress = onProgress;

      // List of keys to merge between the 3 states.
      const keys = Object.keys(_self.config.initialState);
      keys.push('zoom'); // Necessary because zoom is omitted from initialState to support legacy galleries
      if (_self.opts.materialSet) {
        const material = _self.scans[_self.state.scan];
        loadScanFromMaterial(loadManager, material, keys);
      } else if (_self.opts.textures && _self.opts.material) {
        loadScanFromTextures(loadManager, _self.opts.textures, _self.opts.material, keys);
      } else {
        const tex_dir = _self.opts.texturePath + '/' + _self.state.scan;
        loadScanMetadata(loadManager, tex_dir, keys);
      }
    }

    function loadScanFromMaterial(loadManager, material, keys) {
      const textures = {};
      for (var key in material.textures) {
        textures[key] = `${material.location}/${material.textures[key]}`;
      }
      return loadScanFromTextures(loadManager, textures, material, keys);
    }

    function loadScanFromTextures(loadManager, textures, material, keys) {
      let paths = new Map();
      paths.set('diffuse', {path: textures.basecolor, format: THREE.RGBFormat});
      paths.set('normals', {path: textures.normals, format: THREE.RGBFormat});
      paths.set('specular', {path: textures.specular, format: THREE.RGBFormat});

      let scanState = [];
      const metadata = material.config.renders[_self.state.scan];
      if (metadata.hasOwnProperty('state')) {
        jsonToState(metadata.state, scanState, _self.vectorKeys);
      }
      if (metadata.hasOwnProperty('version')) {
        scanState.brdfVersion = metadata.version;
      }
      mergeMetadata(scanState, keys);
      loadScansImpl(paths, textures.mesh, loadManager);
    }

    function loadScanMetadata(loadManager, texturePath, keys) {
      const jsonFilename = texturePath + '/render.json';

      getJSON(jsonFilename,
        function(err, data) {
          let scanState = [];
          if (!err) {
            try {
              const metadata = JSON.parse(data);
              console.log('Loaded metadata from ' + jsonFilename + ':', metadata);

              // Read valid render.json parameters, if present
              if (metadata.hasOwnProperty('state')) {
                jsonToState(metadata.state, scanState);
              }
              if (metadata.hasOwnProperty('version')) {
                scanState.brdfVersion = metadata.version;
              }
            } catch(e) {
              err = 1;
            }
          }
          if (err) {
            console.log('Render metadata (' + jsonFilename + ') not loaded: ' + err);
          }

          mergeMetadata(scanState, keys);
          loadScanFilenames(loadManager, texturePath);
        }
      );
    }

    function mergeMetadata(scanState, keys) {
      let bivotState = [];

      // Read valid bivot-renders.json parameters, if present
      const curScan = _self.scans[_self.state.scan];
      if (curScan.hasOwnProperty('cameraPositionX')) {
        _self.camera.position.x = curScan.cameraPositionX;
      }
      if (curScan.hasOwnProperty('cameraPositionY')) {
        _self.camera.position.y = curScan.cameraPositionY;
      }
      if (curScan.hasOwnProperty('cameraPositionZ')) {
        _self.camera.position.z = curScan.cameraPositionZ;
      }
      if (curScan.hasOwnProperty('controlsMinDistance')) {
        _self.controls.minDistance = curScan.controlsMinDistance;
      }
      if (curScan.hasOwnProperty('controlsMaxDistance')) {
        _self.controls.maxDistance = curScan.controlsMaxDistance;
      }
      if (curScan.hasOwnProperty('state')) {
        jsonToState(curScan.state, bivotState, _self.vectorKeys);
      }
      if (curScan.hasOwnProperty('version')) {
        bivotState.brdfVersion = curScan.version;
      }

      mergeDictKeys(keys, _self.state, bivotState, scanState, _self.config.initialState, _self.vectorKeys);

      console.log('  BRDF model: ', _self.state.brdfModel);
      console.log('  BRDF version: ', _self.state.brdfVersion);

      if (_self.opts.stateLoadCallback) {
        _self.opts.stateLoadCallback(_self.state);
      }
    }

    function loadScanFilenames(loadManager, texDir) {
      let texNames = new Map();
      if (_self.state.brdfModel == 1 && _self.state.brdfVersion >= 2.0) {
        texNames.set('diffuse', 'basecolor');
        texNames.set('normals', 'normals');
        texNames.set('specular', 'roughness-metallic');
      } else {
        texNames.set('diffuse', 'diffuse');
        texNames.set('normals', 'normals');
        texNames.set('specular', 'specular-srt');
      }

      let paths = new Map();
      console.assert(['JPG', 'PNG', 'EXR'].includes(_self.config.textureFormat));
      if (_self.config.textureFormat == 'EXR') {
        paths.set('diffuse', {path: texDir + '/brdf-' + texNames.get('diffuse') + '_cropf16.exr', format:THREE.RGBFormat});
        paths.set('normals', {path: texDir + '/brdf-' + texNames.get('normals') + '_cropf16.exr', format:THREE.RGBFormat});
        paths.set('specular', {path: texDir + '/brdf-' + texNames.get('specular') + '_cropf16.exr', format: THREE.RGBFormat});
      }
      else if (_self.config.textureFormat == 'JPG') {
        paths.set('diffuse', {path: texDir + '/brdf-' + texNames.get('diffuse') + '_cropu8_hi.jpg', format:THREE.RGBFormat});
        paths.set('normals', {path: texDir + '/brdf-' + texNames.get('normals') + '_cropu8_hi.jpg', format:THREE.RGBFormat});
        paths.set('specular', {path: texDir + '/brdf-' + texNames.get('specular') + '_cropu8_hi.jpg', format: THREE.RGBFormat});
      } else {
        paths.set('diffuse', {path: texDir + '/brdf-' + texNames.get('diffuse') + '_cropu8_hi.png', format:THREE.RGBFormat});
        paths.set('normals', {path: texDir + '/brdf-' + texNames.get('normals') + '_cropu8_hi.png', format:THREE.RGBFormat});
        paths.set('specular', {path: texDir + '/brdf-' + texNames.get('specular') + '_cropu8_hi.png', format: THREE.RGBFormat});
        if (_self.config.dual8Bit) {
          paths.set('diffuse_low', {path: texDir + '/brdf-' + texNames.get('diffuse') + '_cropu8_lo.png', format:THREE.RGBFormat});
          paths.set('normals_low', {path: texDir + '/brdf-' + texNames.get('normals') + '_cropu8_lo.png', format:THREE.RGBFormat});
          paths.set('specular_low', {path: texDir + '/brdf-' + texNames.get('specular') + '_cropu8_lo.png', format: THREE.RGBFormat});
        }
      }

      loadScansImpl(paths, texDir + '/brdf-mesh.obj', loadManager);
    }

    function onProgress(urlOfLastItemLoaded, itemsLoaded, itemsTotal) {
      const progress = itemsLoaded / itemsTotal;
      loadingElem.style.display = '';
      progressBarElem.style.transform = `scaleX(${progress})`;
    };

    function getPlaneGeometry() {
      const dpi = 300;
      const pixelsPerMetre = dpi / 0.0254;
      const textureWidthPixels = 2048;
      const textureHeightPixels = 2048;
      const planeWidth = textureWidthPixels / pixelsPerMetre;
      const planeHeight = textureHeightPixels / pixelsPerMetre;
      return new THREE.PlaneBufferGeometry(planeWidth, planeHeight);
    }

    function resizeRendererToDisplaySize() {
      //_self.canvas.width = window.innerWidth;     // equals window dimension
      //_self.canvas.height = window.innerHeight;
      console.log('canvas:')
      console.log(_self.canvas.width, _self.canvas.height)
      const pixelRatio = window.devicePixelRatio || 1;
      //const width  = _self.canvas.clientWidth  * pixelRatio;
      //const height = _self.canvas.clientHeight * pixelRatio;
      _self.canvas.width = _self.opts.width * pixelRatio;
      _self.canvas.height = _self.opts.height * pixelRatio;

      _self.canvas.style.width = _self.opts.width + 'px';
      _self.canvas.style.height = _self.opts.height + 'px';

      const width  = _self.canvas.clientWidth  | 0;
      const height = _self.canvas.clientHeight | 0;
      const needResize = _self.canvas.width !== width || _self.canvas.height !== height;
      if (needResize) {
        console.log(width, height);
        //_self.renderer.setSize(width, height, false);
      }
      return needResize;
    }

    function fieldOfView(focalLength, sensorHeight) {
      // Focal length is in mm for easier GUI control.
      // Three.js defines the field of view angle as the vertical angle.
      return 2 * Math.atan(sensorHeight / (2 * focalLength / 1000)) * 180 / Math.PI;
    }

    function updateFOV() {
      fov = fieldOfView(_self.state.focalLength, sensorHeight);
      _self.camera.fov = fov;
      _self.camera.updateProjectionMatrix();
      _self.requestRender();
    }

    function addControlPanel() {
      if (typeof dat !== 'undefined') {
        if (_self.opts.controlMode != _self.controlModes.NONE) {
          _self.gui = new dat.GUI();
          // _self.gui.add(_self.state, 'scan', Array.from(Object.keys(_self.scans))).onChange(loadScan);
          _self.gui.add(_self.state, 'exposure', 0, 8, 0.1).onChange(_self.requestRender).listen();
        }
      }
    }

    function updateControlPanel(gui) {
      if (gui) {
        for (var i = 0; i < Object.keys(gui.__folders).length; i++) {
          var key = Object.keys(gui.__folders)[i];
          for (var j = 0; j < gui.__folders[key].__controllers.length; j++ )
          {
              gui.__folders[key].__controllers[j].updateDisplay();
          }
        }
      }
    }
  }


  initialiseCanvas(canvas, width, height) {
    var w, h;
    const parent = this.overlay;

    if (!width || !height) {
      w = parent.clientWidth;
      h = parent.clientHeight;
    } else {
      w = width;
      h = height;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = w * pixelRatio;
    canvas.height = h * pixelRatio;
    canvas.style.width = canvas.width / pixelRatio + 'px';
    canvas.style.height = canvas.height / pixelRatio + 'px';

  }

  initialiseRenderer() {
    var renderer = new THREE.WebGLRenderer({ canvas: this.canvas, preserveDrawingBuffer: true });
    renderer.physicallyCorrectLights = true;

    return renderer;
  }

  initialiseComposer(renderer, updateToneMapParams) {
    var composer = new EffectComposer(renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.state.bloom, // strength
      0.4, // radius
      0.99 // threshold
    );
    composer.addPass(this.bloomPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.setFxaaResolution();
    composer.addPass(this.fxaaPass);

    this.toneMappingPass = new AdaptiveToneMappingPass(true, 256);
    updateToneMapParams();
    composer.addPass(this.toneMappingPass);

    // The effective gamma is hard-coded by the linear to sRGB mapping inside GammaCorrectionShader.
    // To implement adjustable gamma, we could implement our own GammaCorrectionShader.
    this.gammaCorrectPass = new ShaderPass(GammaCorrectionShader);
    composer.addPass(this.gammaCorrectPass);


    return composer;
  }

  isViewPortCoordInCanvas(x, y) {
    if (!this.canvas) {
      return false;
    }
    const rect = this.canvas.getBoundingClientRect();
    return (x >= rect.left && x < rect.right &&
            y >= rect.top  && y < rect.bottom);
  }

  updateLightingGrid() {
    // FIXME: Ideally we should adjust exisiting lights to match new state, rather than just deleting them all
    // and starting again. Although if it's fast to reconstruct the whole lighting state, that's actually
    // safer from a state machine point of view.
    if (this.lights) {
      this.scene.remove(this.lights);
    }
    if (this.lights45) {
      this.scene.remove(this.lights45);
    }
    // Our custom shader assumes the light colour is grey or white.
    const color =
        Math.round(0.5 * this.state.lightColor[0]) * 0x10000 +
        Math.round(0.5 * this.state.lightColor[1]) * 0x100 +
        Math.round(0.5 * this.state.lightColor[2]);
    const totalIntensity = 1;
    let totalLights = this.state.lightNumber ** 2;
    if (this.state.light45) {
      totalLights *= 2;
    }
    const lightIntensity = totalIntensity / (totalLights) * 2; // Doubled because color is halved (to allow colour range 0..2)
    const distanceLimit = 10;
    const decay = 2; // Set this to 2.0 for physical light distance falloff.

    // Create a grid of lights in XY plane at z = length of lightPosition vector.
    let upVector = new THREE.Vector3(0, 0, this.state.lightPosition.length());
    let lights = new THREE.Group();
    // We assume state.lightNumber is an odd integer.
    let mid = this.state.lightNumber/2 - 0.5;
    for (let i = 0; i < this.state.lightNumber; i++) {
      for (let j = 0; j < this.state.lightNumber; j++) {
        let offset = new THREE.Vector3(
          (i - mid) * this.state.lightSpacing,
          (j - mid) * this.state.lightSpacing,
          0
        );
        if (this.state.lightType == 'area') {
          let areaFactor = lightIntensity / (Math.atan(this.state.areaLightWidth) * Math.atan(this.state.areaLightHeight));
          let rectLight = new THREE.RectAreaLight(color, areaFactor, this.state.areaLightWidth, this.state.areaLightHeight);
          rectLight.position.copy(upVector);
          rectLight.position.add(offset);
          lights.add(rectLight);
        } else {
          let light = new THREE.PointLight(color, lightIntensity, distanceLimit, decay);
          light.position.copy(upVector);
          light.position.add(offset);
          lights.add(light);
        }
      }
    }
    let upVectorNorm = upVector.clone();
    upVectorNorm.normalize();
    let lightVectorNorm = this.state.lightPosition.clone();
    lightVectorNorm.normalize();
    let rotationAxis = new THREE.Vector3(0, 0, 0);
    rotationAxis.crossVectors(upVectorNorm, lightVectorNorm);
    let rotationAngle = Math.acos(upVectorNorm.dot(lightVectorNorm));
    lights.rotateOnAxis(rotationAxis, rotationAngle);
    this.lights = lights;
    this.scene.add(lights);

    if (this.state.light45) {
      // Add an extra light at 45 deg elevation for natural viewing on phone or tablet.
      this.lights45 = lights.clone();
      let xAxis = new THREE.Vector3(1, 0, 0);
      this.lights45.rotateOnAxis(xAxis, Math.PI / 4);
      this.scene.add(this.lights45);
    } else {
      this.lights45 = null;
    }

    this.requestRender();
  }

  updateCamsAndLightsFromXY(xy, light_sensitivity, cam_sensitivity) {
    if (this.lights && light_sensitivity != 0.0) {
      this.state.lightPosition.copy(
        this.xyTo3dDirection(xy, this.state.lightPositionOffset, light_sensitivity, this.state.lightTiltLimitDegrees)
      );
      this.updateLightingGrid();
    }
    if (this.camera && cam_sensitivity != 0.0) {
      // Retain existing camera distance
      let camVec = this.xyTo3dDirection(xy, this.state._camPositionOffset, cam_sensitivity,
        this.state.camTiltLimitDegrees);
      this.camera.position.copy(camVec.multiplyScalar(this.camera.position.length()));
      this.requestRender();
    }
  }

  xyTo3dDirection(xy, offset, sensitivity, elevationLimit) {
    // Convert input XY co-ords in range -1..1 and given sensitivity to a unit 3D direction vector
    let new_xy = new THREE.Vector2();
    // Clamp 2D length to elevation angle limit.
    let qLimit = Math.cos(Math.PI * elevationLimit / 180);
    new_xy.copy(xy).add(offset).multiplyScalar(sensitivity).clampLength(0.0, qLimit);
    const z2 = 1 - new_xy.lengthSq();
    let new_z = 0.0;
    if (z2 > 0.0) {
      new_z = Math.sqrt(z2);
    }
    console.assert(!isNaN(new_z));
    return new THREE.Vector3(new_xy.x, new_xy.y, new_z);
  }


  updateMeshRotation() {
    if (this.mesh) {
      this.mesh.rotateZ((this.state.meshRotateZDegrees - this.state._meshRotateZDegreesPrevious)*Math.PI/180);
      this.state._meshRotateZDegreesPrevious = this.state.meshRotateZDegrees;
    }
  }

  // Update all rendering dimensions to conform with canvas.width and canvas.height
  updateCanvas() {
    if (this.canvas) {
      const pixelRatio = window.devicePixelRatio || 1;

      this.canvas.style.width = this.canvas.width / pixelRatio + 'px';
      this.canvas.style.height = this.canvas.height / pixelRatio + 'px';

      this.renderer.setSize(this.canvas.width, this.canvas.height, false);
      this.camera.aspect = this.canvas.width / this.canvas.height;
      this.camera.updateProjectionMatrix();
      this.composer.setSize(this.canvas.width, this.canvas.height);
      this.setFxaaResolution();
    }
  }

  getBgColorFromState(state) {
    var bg;
    if (state.backgroundColor) {
      bg = parseInt(state.backgroundColor.replace('#', '0x'));
    } else {
      bg = state.background * 0x010101;
    }
    return bg;
  }

  updateBackground() {
    this.scene.background = new THREE.Color(this.getBgColorFromState(this.state));
    this.requestRender();
  }

  updateZoom() {
    if (this.controls) {
      this.controls.minDistance = this.state.zoom[0];
      this.controls.maxDistance = this.state.zoom[2];
    }

    if (this.camera) {
      // Retain existing camera angle, changing the distance
      const ratio = this.state.currentZoom / this.camera.position.length();
      this.camera.position.copy(this.camera.position.multiplyScalar(ratio));
    }
    this.requestRender();
  }

  setFxaaResolution() {
    var fxaaUniforms = this.fxaaPass.material.uniforms;
    const pixelRatio = this.renderer.getPixelRatio();
    var val = 1.0 / pixelRatio;
    if (!this.state.fxaa) {
      val = 0.0;
    }
    fxaaUniforms['resolution'].value.x = val / window.innerWidth; // FIXME: Should be canvas width?
    fxaaUniforms['resolution'].value.y = val / window.innerHeight; // FIXME: Should be canvas height?
  }

  updateAutoRotate(loopValue) {
    if (!this.mouseInCanvas || this.state.lightMotion == 'animate') {
      // loopValue is between 0 and 1
      const angle = 2 * Math.PI * loopValue;
      const xy = new THREE.Vector2(
        -Math.sin(angle),
        Math.cos(angle)
      );
      const camSensitivity = -0.3 * this.state.autoRotateCamFactor;
      const lightSensitivity = 1.0 * this.state.autoRotateLightFactor;

      this.timeouts.push(
        setTimeout(
          () => this.updateCamsAndLightsFromXY(xy, lightSensitivity, camSensitivity),
          1000 / this.state.autoRotateFps
        )
      );
    }
  }

  render(timeMs) {
    if (this.shuttingDown) {
      this.doShutdown();
    } else if (this.controls && this.composer) {
      if (this.state.dirty) {
        this.state.dirty = false;
        this.updateBackground();
        this.updateLightingGrid();
        this.updateMeshRotation();
        this.updateCanvas();
        this.updateZoom();
      }

      this.controls.update();

      if (this.state.autoRotatePeriodMs 
        && (this.state.lightMotion == 'mouse' || this.state.lightMotion == 'animate')) {
        this.updateAutoRotate((timeMs % this.state.autoRotatePeriodMs) / this.state.autoRotatePeriodMs);
      }

      this.uniforms.uExposure.value = this.exposureGain * this.state.exposure;
      this.uniforms.uBrightness.value = this.state.brightness;
      this.uniforms.uContrast.value = this.state.contrast;
      this.uniforms.uDiffuse.value = this.state.diffuse;
      this.uniforms.uSpecular.value = this.state.specular;
      this.uniforms.uRoughness.value = this.state.roughness;
      this.uniforms.uTint.value = this.state.tint;
      this.uniforms.uFresnel.value = this.state.fresnel;
      this.uniforms.uThreeJsShader.value = this.state.threeJsShader;
      this.uniforms.uBrdfModel.value = this.state.brdfModel;
      this.uniforms.uBrdfVersion.value = this.state.brdfVersion;
      this.uniforms.uLoadExr.value = (this.config.textureFormat == 'EXR');
      this.uniforms.uDual8Bit.value = this.config.dual8Bit;
      this.uniforms.ltc_1.value = THREE.UniformsLib.LTC_1;
      this.uniforms.ltc_2.value = THREE.UniformsLib.LTC_2;

      this.composer.render();

      this.renderRequested = false;
    }
  }

  // Request a render frame only if a request is not already pending.
  requestRender() {
    if (!this.renderRequested && this.render) {
      this.renderRequested = true;
      requestAnimationFrame(this.render.bind(this));
    }
  }

  checkWebGL() {
    if (WEBGL.isWebGLAvailable() === false) {
      document.body.appendChild(WEBGL.getWebGLErrorMessage());
    }
  }


  registerEventListener(object, type, listener, ...args) {
    object.addEventListener(type, listener, ...args);
    this.listeners.push({ object, type, listener });
  }

  registerElement(document, tagName) {
    const element = document.createElement(tagName);
    this.elements.push(element);
    return element;
  }

  shutdown() {
    this.shuttingDown = true;
  }

  doShutdown() {
    for (var i = 0; i < this.timeouts.length; i++) {
      clearTimeout(this.timeouts[i]);
    }
    this.timeouts = [];

    for (var i = 0; i < this.listeners.length; i++) {
      const { object, type, listener } = this.listeners[i];
      object.removeEventListener(type, listener);
    }
    this.listeners = [];

    for (var i = 0; i < this.elements.length; i++) {
      const elem = this.elements[i];
      elem.parentNode.removeChild(elem);
    }
    this.elements = [];

    this.canvas = null;
    this.overlay = null;
  }
}


export default bivotJs;
