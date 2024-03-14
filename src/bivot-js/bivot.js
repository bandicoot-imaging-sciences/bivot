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

// Polyfills
import ResizeObserver from 'resize-observer-polyfill';

// The Three.js import paths in bivot.js, shaders.js and stateUtils.js need to match.

import * as THREE from 'three';

import Stats from 'three/examples/jsm/libs/stats.module.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AdaptiveToneMappingPass } from 'three/examples/jsm/postprocessing/AdaptiveToneMappingPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
//import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import CameraControls from 'camera-controls';
CameraControls.install({ THREE: THREE });

import UAParser from 'ua-parser-js';

import getShaders from './shaders.js';
import { loadJsonFile } from '../utils/jsonLib.js';
import { isEmpty } from '../utils/objLib.js';
import { getBasePath } from '../utils/pathLib.js';
import { getDocumentFullScreenElement } from '../utils/displayLib';
import { jsonToState, copyStatesCloneVectors } from './stateUtils.js';
import { getWhiteBalanceMatrix } from './colour.js';

const styles = {
  'bivot-canvas': {
    'display': 'block',
    'margin': 0,
    'padding': 0,
    'width': '100%',
    'height': 'auto',
  },
  'bivot-container': {
    'position': 'relative',
  },
  'bivot-overlay': {
    'position': 'absolute',
    'display': 'block',
    'margin': 0,
    'padding': 0,
    'justify-content': 'center',
    'align-items': 'center',
    'width': '100%',
    'height': '100%',
    'top': '0',
    'user-drag': 'none',
    'user-select': 'none',
    '-moz-user-select': 'none',
    '-webkit-user-drag': 'none',
    '-webkit-user-select': 'none',
    '-ms-user-select': 'none',
  },
  'bivot-button': {
    'color': '#fff !important',
    'text-decoration': 'none',
    'background': '#333',
    'padding': '20px',
    'border-radius': '0px',
    'display': 'inline-block',
    'border': 'solid #fff',
  },
  'bivot-loading': {
    'top': 0,
    'left': 0,
    'width': '100%',
    'height': '100%',
    'display': 'flex',
    'justify-content': 'center',
    'align-items': 'center',
  },
  'bivot-progress': {
    'position': 'absolute',
    'background-color': 'rgba(100, 100, 100, 1.0)',
    'opacity': 0.7,
    'border': '1px solid white',
    'width': '80%',
    'top': '50%',
    'left': '50%',
    'transform': 'translate(-50%, -50%)',
  },
  'bivot-progressbar': {
    'margin': '2px',
    'background': 'white',
    'height': '0.5em',
    'transform-origin': 'top left',
    'transform': 'scaleX(0)',
  },
  'bivot-subtitle': {
    'position': 'absolute',
    'top': '100%',
    'transform': 'translate(0%, -100%)',
    'width': '100%',
    'display': 'none',
    'justify-content': 'center',
    'align-items': 'center',
    'text-align': 'center',
  },
  'bivot-subtitle-text': {
    'display': 'inline-block',
    'margin': '0.2em',
    'padding': '0.2em',
    'color': 'white',
    'background-color': 'rgba(100, 100, 100, 1.0)',
    'opacity': 1.0,
  },
  'bivot-loading-image': {
    'display': 'block',
    'position': 'absolute',
    'top': '0px',
    'left': '0px',
    'width': '100%',
    'height': 'auto',
  },
};


function injectStyle(elem, style) {
  if (elem) {
    for (const [key, value] of Object.entries(style)) {
      if (String(value).includes('!important')) {
        elem.style.setProperty(key, value.split(' !important')[0], 'important');
      } else {
        elem.style.setProperty(key, value);
      }
    }
  }
}

const crosshairsCursor = 'https://bandicoot-hosted.s3.ap-southeast-2.amazonaws.com/assets/cursor/Crossdot.cur';

// Define dimensions of overlay texture
const overlayTexW = 2048;
const overlayTexH = 2048;

// Size factors for drawing lines and points on overlay
const lineThicknessFactor = 1.0;
const pointSizeFactor = 5;

export const defaultSize = [792, 528];
export const initialRepeatFactorX = 1.5;

export const DirtyFlag = {
  Background:   0x00000001,
  Lighting:     0x00000002,
  MeshRotation: 0x00000004,  // Before Mesh, to avoid flicker when changing meshes for rotated Shimmer
  Mesh:         0x00000008,
  Canvas:       0x00000010,
  Zoom:         0x00000020,
  Color:        0x00000040,
  Overlay:      0x00000080,
  Stretch:      0x00000100,
  TextureLayer: 0x00000200,
  Textures:     0x00000400,
  Controls:     0x00000800,
  ControlsPan:  0x00001000,
  All:          0x00001FFF
};

/*
  The options object is optional and can include the following:
    canvasID: ID for the HTML canvas element that Bivot should use for rendering
    configPath: relative or absolute URL for the JSON configuration file
    renderPath: relative or absolute URL for the JSON render file
    texturePath: relative or absolute URL for the folder containing the texture folders
*/
class bivotJs {
  DirtyFlagFuncs = [
    this.updateBackground.bind(this),
    this.updateLightingGrid.bind(this),
    this.updateMeshRotation.bind(this),
    this.updateMesh.bind(this),
    this.updateCanvas.bind(this),
    this.updateZoom.bind(this),
    this.updateColor.bind(this),
    this.updateOverlay.bind(this),
    this.updateStretch.bind(this),
    this.updateTextureLayer.bind(this),
    this.updateTextures.bind(this),
    this.updateControls.bind(this),
    this.updateControlsPan.bind(this)
  ];

  constructor(options) {
    this.controlModes = {
      FULL: 'full',
      QA: 'qa',
      MANAGE: 'manage',
      NONE: 'none',
    };

    const { uniforms, vertexShader, fragmentShader } = getShaders();
    this.uniforms = uniforms;
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;

    let defaultOptions = {
      canvasID: 'bivot-canvas',
      configPath: 'bivot-config.json',
      renderPath: 'bivot-renders.json',
      texturePath: 'textures',
      config: null,
      material: null,
      thumbnail: null,
      textures: null,
      materialSet: null,
      controlMode: this.controlModes.FULL,
      useTouch: null,
      featured: false,
      responsive: true,
      adaptFps: 30,
      state: null,
      stateLoadCallback: null,
      loadingCompleteCallback: null,
      setZoomCallback: null,
      onClick: null,
      onGridSelect: null,
      onPointSelect: null,
      onDrawing: null,
    };
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
      bloom: 0.0,
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
      meshOverride: false,
      meshesToCache: undefined,
      brdfModel: 1,
      brdfVersion: 2,
      displacementOffset: 0.0,
      displacementUnits: 0.0,
      texDims: undefined,
      tileBoundary: undefined,
      aoStrength: 1.0,
      colorTemperature: 6500,
      colorTransform: new THREE.Matrix3(),
      hue: 0.0,
      saturation: 0.0,
      yFlip: true,          // Legacy field
      yFlipped: undefined,  // New field
      size: defaultSize, // Initial size and aspect ratio (canvas logical size) in display pixels
      background: 0x05, // Legacy grayscale background
      backgroundColor: '#050505', // RGB background colour string
      meshRotateZDegrees: 0,
      dragControlsRotation: undefined,  // 0/null: disabled; 1: enabled; 2: enabled only via ctrl modified
      dragControlsPanning: undefined,
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
      autoRotateCamFactor: 0.5,
      autoRotateLightFactor: 0.9,
      currentZoom: 0.9,
      pixellated: false,
      showSeams: false,
      boundary: false,
      subBoundary: false,
      stretch: null,
      userScale: null,
      enableKeypress: false,
      textureLayer: 0,
      // zoom: [0.4, 0.9, 2.0],  // No default, to allow legacy galleries to keep working
      cameraPan: new THREE.Vector3(0.0, 0.0, 0.0),
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
      useTouch: false,
      initCamZ: 0.9,
      minCamZ: 0.4, // Initial value, state is changed via controls object.
      maxCamZ: 2.0, // Initial value, state is changed via controls object.
      linearFilter: true, // Applied during texture loading.
      initialState: {},
    };

    this.gridSelectionState = {
      state: 'none',
      p0: null,
      p1: null
    };

    this.dragState = {
      state: 'none',
      addingNew: null,
      group: null,
      point: null
    };

    // Record default size before anything changes it
    this.defaultSize = this.state.size.slice();

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
      "lightPositionOffset": THREE.Vector2,
      "cameraPan": THREE.Vector3,
    };

    // Store initial state in the config
    copyStatesCloneVectors(this.state, this.config.initialState, this.vectorKeys);

    this.canvas = document.getElementById(this.opts.canvasID);
    this.insertContainerAndOverlay();
    injectStyle(this.canvas, styles['bivot-canvas']);
    injectStyle(this.container, styles['bivot-container']);
    injectStyle(this.overlay, styles['bivot-overlay']);

    this.loadingElem = null;
    this.progressBarElem = null;

    this.meshLoadingFailed = false;
    this.loadCompleteButMeshMissing = false;

    this.scans = {};
    this.materials = {};
    this.exposureGain = 1/10000; // Texture intensities in camera count scale (e.g. 14 bit).
    this.renderRequested = false;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.camera = null;
    this.lights = null;
    this.lights45 = null;
    this.brdfTextures = null;
    this.overlayTexture = null;
    this.mesh = null;           // The mesh object currently in use
    this.meshPathUsed = false;  // The path of the mesh object currently in use
    this.meshOrig = null;       // Default mesh associated with viewer
    this.meshOrigLow = null;
    this.meshMaterial = null;   // Original mesh associated with material
    this.meshMaterialLow = null;
    this.meshCache = {};        // Cache of loaded mesh objects
    this.useDispMap = null;     // True if displacement map is in use
    this.useAlphaMap = null;    // True if alpha map is in use
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
    this.wheelInProgress = false;
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.isVisible = false;
    this.seamsShowing = false;
    this.gridShowing = false;
    this.diag = null;
    this.untiledImDims = [1, 1]; // Texture image dimensions derived from texDims
    this.areaLightSetupDone = false;

    this.needsResize = false;
    this.inFullScreen = false;

    this.stats = null;
    this.statsVisible = false;

    this.firstRenderLoaded = false;
    this.iOSDetected = false;
    this.userAgent = undefined;
    this.uaData = undefined;

    this.adaptFramerate = {
      // Configuration
      targetFps: 30,          // The target framerate
      framesCollected: 30,    // Number of frames to measure framerate over
      outliersDropped: 10,    // Number of frame time outliers to drop
      underSpeedRatio: 1.0,   // Threshold of target framerate below which render size will be adapted

      // Measurement
      measuring: true,        // Setting to true to begin measurement; will automatically reset to false when done
      frameTimes: [],         // Storage for measured frame times

      // Output
      renderedPixels: 0,      // 0 if not yet determined.  Once determined, the number of pixels
                              // to render per frame which meets framerate target
    }

    // Tracking to handle cleanup
    this.shutdownRequested = false;
    this.shutdownStarted = false;
    this.timeouts = [];
    this.listeners = [];
    this.elements = [];

    const imagesToPreload = [crosshairsCursor, ];
    // Preload images
    imagesToPreload.forEach(im => {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = im;
      document.head.appendChild(link);
    });
  }

  async getUserAgentData() {
    if (navigator.userAgentData !== undefined) {
      try {
        return await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion']);
      } catch(e) {
        if (!(e instanceof NotAllowedError)) {
          // NotAllowedError means the broswer has declined to give the needed info.
          // Any other error is re-thrown.
          throw e;
        }
      }
    }
    // Unable to determine the needed info
    return null;
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
    let gui = null;

    let subtitleElem = null;
    let subtitleTextElem = null;

    let raycaster = new THREE.Raycaster();

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
    this.iOSDetected = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (this.iOSDetected) {
      iOSVersion = navigator.userAgent.match(/OS [\d_]+/i)[0].substr(3).split('_').map(n => parseInt(n));
      iOSVersionOrientBlocked = (iOSVersion[0] == 12 && iOSVersion[1] >= 2);
    }
    let zoomHelpTimeoutID = null;

    let urlFlags = getUrlFlags(); // Get options from URL

    if (Object.values(this.controlModes).indexOf(urlFlags.controls) > -1) {
      this.opts.controlMode = urlFlags.controls;
    }

    if (this.opts.adaptFps !== undefined) {
      if (this.opts.adaptFps == 0) {
        this.adaptFramerate['measuring'] = false;
        this.adaptFramerate['frameTimes'] = [];
        this.adaptFramerate['renderedPixels'] = 0;
      } else if (this.opts.adaptFps > 0) {
        this.adaptFramerate['targetFps'] = this.opts.adaptFps;
        this.adaptFramerate['measuring'] = true;
      } else {
        console.warn('Invalid value for adaptFps option, ignoring');
      }
    }

    this.stats = new Stats();
    this.stats.showPanel(0);

    initConfig().then(() => {
      if (!this.overlay || this.shutdownRequested) {
        return;
      }

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

      // TODO: Log unstringifiable content too, like callbacks
      console.debug('Options:', JSON.parse(JSON.stringify(this.opts)));
      console.debug('Config:', JSON.parse(JSON.stringify(this.config)));
      console.debug('State:', JSON.parse(JSON.stringify(this.state)));
      console.debug('Renders:', JSON.parse(JSON.stringify(this.scans)));

      orientPermWanted = (this.state.camTiltWithDeviceOrient != 0.0 || this.state.lightTiltWithDeviceOrient != 0.0);

      initialiseOverlays(this.overlay);
      initialiseLighting(this.getBgColorFromState(this.state), this.scene);
      this.camera = initialiseCamera(this.state.focalLength);
      this.controls = initialiseControls(this.camera, this.overlay, this.config, this.config.initCamZ);
      if (this.config.showInterface) {
        addControlPanel();
      }
      this.initialiseCanvas(this.canvas, this.state.size[0], this.state.size[1]);

      loadScan();

      this.renderer = this.initialiseRenderer();
      RectAreaLightUniformsLib.init(); // Initialise LTC look-up tables for area lighting
      this.composer = this.initialiseComposer(this.renderer, updateToneMapParams);

      this.updateCanvas();
      this.updateBackground();
      this.updateControls();
      this.updateControlsPan();
      this.updateZoom();
      this.updateCamTiltLimit(this.controls, this.state.camTiltLimitDegrees);

      // Add listeners after finishing config and initialisation
      if (orientPermWanted) {
        this.registerEventListener(window, 'deviceorientation', detectGyro, false);
      }
      this.registerEventListener(window, 'resize', this.requestRender);
      this.registerEventListener(document, 'keydown', onKeyDown, false);
      this.registerEventListener(document, 'keyup', onKeyUp, false);
      this.registerEventListener(document, 'wheel', onWheel, false);
      this.registerEventListener(this.overlay, 'wheel', onOverlayWheel, false);

      if (this.opts.useTouch === true || this.opts.useTouch === false) {
        this.config.useTouch = this.opts.useTouch;
      }
    });
    // ========== End mainline; functions follow ==========

    function nextPowerOf2(n) {
      if (n && !(n & (n - 1))) {
        return n;
      }

      var p = 1;
      while (p < n) {
        p <<= 1;
      }
      return p;
    }

    function calcImDims(texDims) {
      if (texDims) {
        const maxDim = Math.max(texDims[0], texDims[1]);
        const powerOf2 = nextPowerOf2(maxDim);
        return [powerOf2, powerOf2];
      } else {
        return [1, 1];
      }
    }

    function showStats(show) {
      if (show) {
        _self.overlay.appendChild(_self.stats.dom);
      } else {
        _self.overlay.removeChild(_self.stats.dom);
      }
      _self.statsVisible = show;
    }
    function toggleStats() {
      showStats(!_self.statsVisible);
    }

    function setLoadingImage() {
      if (!_self.opts.materialSet && !_self.opts.thumbnail) {
        return; // No loading image available
      }

      if (_self.overlay) {
        var img = document.createElement('img');

        const aspectRatio = _self.state.size[0] / _self.state.size[1];
        const pixelRatio = window.devicePixelRatio || 1;

        if (_self.opts.thumbnail) {
          img.src = _self.opts.thumbnail;
        } else if (_self.opts.materialSet) {
          var loc = _self.scans[_self.scan].location;
          if (!loc.endsWith('/')) {
            loc += '/';
          }
          const parts = loc.split('/');
          const filename = parts[parts.length - 2];
          img.src = getBasePath(_self.opts.materialSet) + `/images/${filename}.jpg`;
        }

        // We assume that the loading image was created in the same aspect ratio as the state.size. If not,
        // then the following assignments will produce anamorphic distortion of the loading image. An
        // alternative approach might be to show the whole image at the correct aspect ratio and size when the
        // aspect ratio matches, and when the aspect ratio does not match, to keep the aspect ratio from
        // state.size but crop or pad the loading image slightly to fit instead of distorting it.
        if (_self.opts.responsive) {
          injectStyle(img, { width: '100%', height: 'auto' });
        } else {
          img.width = _self.state.size[0];
          img.height = _self.state.size[1];
        }

        var content = document.createElement('div');
        content.appendChild(img);
        injectStyle(content, styles['bivot-loading-image']);
        content.id = 'bivotLoadingImage';
        _self.overlay.insertBefore(content, _self.loadingElem);
        _self.loadingDomElement = content;
      }
    }

    function unsetLoadingImage() {
      if (_self.loadingDomElement) {
        _self.loadingDomElement.setAttribute('style', 'display: none');
      }
    }

    function convertLegacyState(scans) {
      Object.keys(scans).forEach(key => {
        var stateDict = null;
        if (scans[key].state) {
          stateDict = scans[key].state;
        } else if (
          scans[key].config &&
          scans[key].config.renders &&
          scans[key].config.renders[key] &&
          scans[key].config.renders[key].state
        ) {
          stateDict = scans[key].config.renders[key].state;
        }

        // Extract initial zoom value from 3-element zoom array
        if (stateDict !== null && stateDict.zoom) {
          stateDict.currentZoom = stateDict.zoom[1];
          stateDict.zoom[1] = stateDict.zoom[2];
        }
      });
    }

    async function initConfig() {
      // Determine basic user agent info, required to work around OS-specific browser bugs
      const parser = new UAParser();
      _self.userAgent = parser.getResult();
      console.debug('userAgent:', _self.userAgent);

      if (_self.opts.materialSet) {
        _self.scans = await loadMaterialSet(_self.opts.materialSet);
      }
      if (!_self.scans || isEmpty(_self.scans)) {
        // materials not provided or failed to load
        console.debug('(Unsetting materialSet option)');
        _self.opts.materialSet = null;
        if (!_self.opts.material) {
          // Load legacy config.json file
          await loadConfig(_self.opts.configPath, _self.config, _self.state, _self.opts.config, _self.vectorKeys);
        }
        _self.scans = await loadRender(_self.opts.renderPath, _self.opts.material);
      }
      convertLegacyState(_self.scans);
      if (_self.opts.hasOwnProperty('show')) {
        var s = _self.opts.show;
        const n = Number(s);
        if (Number.isInteger(n)) {
          const keys = Object.keys(_self.scans);
          if (n >= 0 && n < keys.length) {
            s = keys[n];
          }
        }
        console.debug(`Setting starting scan to ${s}`)
        // Set starting scan based on the options, if provided
        _self.scan = s;
      }
      // Use the first scan in the list if no valid starting scan has been provided
      if (!_self.scans.hasOwnProperty(_self.scan)) {
        _self.scan = Object.keys(_self.scans)[0];
      }
    }

    function onLoad() {
      // Workaround for three.js bug.  If a duplicate load request is made via
      // the same mesh URL from two Shimmers on the same web page, the three.js
      // LoadingManager fails to register the second request as a request in
      // progress.  Depending on timing, that sometimes causes onLoad() to be
      // called while we are still waiting for the mesh.  In that case, the
      // LoadingManager won't call onLoad once the mesh is actually loaded.
      // This scenario is detected below, and handled by re-calling onLoad()
      // manually from the loadMesh() callback when the mesh finishes loading.
      // See also: https://github.com/mrdoob/three.js/issues/16311
      if (_self.mesh === null && !_self.meshLoadingFailed) {
        console.debug('Mesh pending');
        _self.loadCompleteButMeshMissing = true;
        return;
      } else if (_self.shutdownRequested) {
        console.debug('onLoad: Bailing out (shutdown requested)');
        return;
      }
      _self.meshLoadingFailed = false;
      _self.loadCompleteButMeshMissing = false;

      unsetLoadingImage();

      // Run post-texture-load operations
      _self.loadingElem.style.display = 'none';
      _self.uniforms.diffuseMap.value = _self.brdfTextures.get('diffuse');
      _self.uniforms.normalMap.value = _self.brdfTextures.get('normals');
      _self.uniforms.specularMap.value = _self.brdfTextures.get('specular');
      if (_self.brdfTextures.get('displacement') !== undefined) {
        _self.useDispMap = true;
        _self.uniforms.displacementMap.value = _self.brdfTextures.get('displacement');
        if (_self.state.displacementUnits) {
          // BIS displacementOffset is not the same as three.js displacementBias, so it is converted here
          _self.uniforms.displacementScale.value = _self.state.displacementUnits;
          _self.uniforms.displacementBias.value = -_self.state.displacementOffset * _self.state.displacementUnits;
        }
      } else {
        _self.useDispMap = false;
      }
      if (_self.brdfTextures.get('alpha') !== undefined) {
        _self.useAlphaMap = true;
        _self.uniforms.alphaMap.value = _self.brdfTextures.get('alpha');
      } else {
        _self.useAlphaMap = false;
      }

      if (_self.config.dual8Bit) {
        _self.uniforms.diffuseMapLow.value = _self.brdfTextures.get('diffuse_low');
        _self.uniforms.normalMapLow.value = _self.brdfTextures.get('normals_low');
        _self.uniforms.specularMapLow.value = _self.brdfTextures.get('specular_low');
        if (_self.useDispMap) {
          _self.uniforms.displacementMapLow.value = _self.brdfTextures.get('displacement_low');
        }
        if (_self.useAlphaMap) {
          _self.uniforms.alphaMapLow.value = _self.brdfTextures.get('alpha_low');
        }
      }

      // Run post-mesh-load operations
      _self.activateLoadedMesh(_self);

      // Call loading complete callback, if provided
      if (_self.opts.loadingCompleteCallback) {
        _self.opts.loadingCompleteCallback(true, true);
      }

      // The deviceorientation event has been restricted for privacy reasons.
      // A work around on iOS >= 12.2 is for the user to enable it in iOS Settings > Safari (off by default).
      // The web page also has to be served over https.
      // iOS 13 introduced a permissions API so that we can ask the user more directly. The request has to be in
      // response to a "user gesture", e.g. in response to the user tapping on the canvas.
      if (orientPermWanted && !_self.firstRenderLoaded && (iOSVersionOrientBlocked || orientPermNeeded) && !gyroDetected) {
        setTiltWarning();
      }
      _self.firstRenderLoaded = true;
      baselineTiltSet = false;
    };

    // Merge state from three input state objects (first, second, third in precedence order) into the supplied
    // ouput state object (out), for all keys in the supplied keys list, with a subset of the keys in the
    // vectorKeys list which need special handling during the merge.
    function mergeDictKeys(first, second, third, keys, vectorKeys, out) {
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
      console.debug('loadMaterialSet(): Loading material set file:', filename);
      const materialSet = {};
      if (filename) {
        const jsonMaterialSet = await loadJsonFile(filename);
        if (jsonMaterialSet) {
          const numMaterials = jsonMaterialSet.materials.length;
          for (var i = 0; i < numMaterials; i++) {
            // General construction of config data
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

            // Handle the case where the material set file has no state.zoom field
            // but it does have zoom settings in config
            if (!render['state'].zoom &&
              bivotMatRender.hasOwnProperty('cameraPositionZ') &&
              bivotMatRender.hasOwnProperty('controlsMinDistance') &&
              bivotMatRender.hasOwnProperty('controlsMaxDistance')) {
              render['state'].zoom = [
                bivotMatRender['controlsMinDistance'],
                bivotMatRender['controlsMaxDistance'],
                bivotMatRender['controlsMaxDistance']
              ];
              render['state'].currentZoom = bivotMatRender['cameraPositionZ'];
            }

            // Finalise the state structures
            jsonToState(render['state'], bivotMatRender['state']);
            materialSet[bivotMat.name] = bivotMat;
          }
        }
      }

      if (Object.keys(materialSet).length === 0) {
        console.debug('Failed to load materialSet file: ', filename);
        return null;
      } else {
        console.debug('materialSet loaded: ', JSON.parse(JSON.stringify(materialSet)));
        return materialSet;
      }
    }

    async function loadConfig(configFilename, config, state, optsConfig, vectorKeys) {
      if (configFilename) {
        const jsonConfig = await loadJsonFile(configFilename);
        if (jsonConfig) {
          console.debug('Loaded:', configFilename);

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
          console.debug('Error: Failed to load ' + configFilename);
        }
      } else if (optsConfig) {
        console.debug('Using provided config object');
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
          console.debug(`Loaded ${renderFilename}:`, JSON.parse(JSON.stringify(jsonRender)));
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
          console.debug('Error: Failed to load ' + renderFilename);
        }
      } else if (material) {
        scans = material.config.renders;
        console.debug('Using provided material object:', scans);

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
        textureFormat: ['JPG', 'PNG', 'EXR'],
        bivotFps: ['1'],
        adaptFps: 'NON_NEG_INT',
        // adaptFpsCount: 'NON_NEG_INT',  // Debugging
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
          } else if (validValues == 'NON_NEG_INT') {
            const n = Number(decodeValue);
            if (Number.isInteger(n) && n >= 0) {
              dict[key] = n;
            } else {
              console.warn('Invalid non-negative integer value for key:', key);
            }
          } else if (validValues == 'FLOAT') {
            const n = Number(decodeValue);
            if (!isNaN(n)) {
              dict[key] = n;
            } else {
              console.warn('Invalid float value for key:', key);
            }
          }
        } else {
          console.debug('Invalid keys found in query parameters');
        }
      }

      console.debug('URL flags:', JSON.parse(JSON.stringify(dict)));
      return dict;
    }

    function processUrlFlags() {
      if (urlFlags.hasOwnProperty('show')) {
        _self.scan = urlFlags.show;
      }
      if (urlFlags.hasOwnProperty('textureFormat')) {
        _self.config.textureFormat = urlFlags.textureFormat;
      }
      if (urlFlags.hasOwnProperty('bivotFps')) {
        showStats(true);
      }
      if (urlFlags.hasOwnProperty('adaptFps')) {
        if (urlFlags['adaptFps'] == 0) {
          // Disable adaptive FPS
          _self.adaptFramerate['measuring'] = false;
          _self.adaptFramerate['frameTimes'] = [];
          _self.adaptFramerate['renderedPixels'] = 0;
        } else if (urlFlags['adaptFps'] == 1) {
          // Enable adaptive FPS, use default framerate
          _self.adaptFramerate['measuring'] = true;
        } else {
          // Enable adaptive FPS, use given framerate
          _self.adaptFramerate['measuring'] = true;
          _self.adaptFramerate['targetFps'] = urlFlags['adaptFps'];
        }
      }
      // Debugging options, disabled for now
      // if (urlFlags.hasOwnProperty('adaptFpsCount')) {
      //   _self.adaptFramerate['framesCollected'] = urlFlags['adaptFpsCount'];
      //   _self.adaptFramerate['outliersDropped'] = urlFlags['adaptFpsCount'] / 2;
      // }
    }

    function onIntersection(entries, observer) {
      if (observer == _self.intersectionObserver) {
        entries.forEach(entry => {
          if (entry.target == _self.overlay) {
            _self.isVisible = entry.isIntersecting;
            if (_self.isVisible) {
              // Render a single frame when crossing threshold into visibility.
              // This will restart the animation loop, if animating.
              _self.requestRender();
            }
          }
        });
      }
    }

    function initialiseOverlays(overlay) {
      if (overlay) {
        _self.registerEventListener(overlay, 'mousedown', onMouseDown, false);
        _self.registerEventListener(overlay, 'pointerdown', onMouseDown, false);
        _self.registerEventListener(overlay, 'mouseup', onMouseUp, false);
        _self.registerEventListener(overlay, 'pointerup', onMouseUp, false);
        _self.registerEventListener(overlay, 'mousemove', onMouseDrag, false);
        _self.registerEventListener(overlay, 'pointermove', onMouseDrag, false);
        // FIXME: On some browsers (Firefox), some of the time (button not held down),
        // this may fire two events for each mouse move
        if (_self.opts.onClick) {
          _self.registerEventListener(overlay, 'click', _self.opts.onClick, false);
        }

        let loadingDiv = _self.registerElement(document, 'div');
        let progressDiv = _self.registerElement(document, 'div');
        let progressBarDiv = _self.registerElement(document, 'div');
        injectStyle(loadingDiv, styles['bivot-loading']);
        injectStyle(progressDiv, styles['bivot-progress']);
        injectStyle(progressBarDiv, styles['bivot-progressbar']);
        overlay.appendChild(loadingDiv);
        loadingDiv.appendChild(progressDiv);
        progressDiv.appendChild(progressBarDiv);

        let subtitleDiv = _self.registerElement(document, 'div');
        let subtitleTextP = _self.registerElement(document, 'p');
        injectStyle(subtitleDiv, styles['bivot-subtitle']);
        injectStyle(subtitleTextP, styles['bivot-subtitle-text']);
        overlay.appendChild(subtitleDiv);
        subtitleDiv.appendChild(subtitleTextP);

        _self.loadingElem = loadingDiv;
        _self.progressBarElem = progressBarDiv;
        subtitleElem = subtitleDiv;
        subtitleTextElem = subtitleTextP;

        _self.intersectionObserver = new IntersectionObserver(onIntersection, {});
        _self.intersectionObserver.observe(overlay);
      }
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

      const ambientColour = 0xFFFFFF;
      const ambientIntensity = 1.0;
      ambientLight = new THREE.AmbientLight(ambientColour, ambientIntensity);
      scene.add(ambientLight);
    }

    function initialiseCamera(focalLength) {
      // Physical distance units are in metres.
      const sensorHeight = 0.024;
      fov = fieldOfView(focalLength, sensorHeight);
      const aspect = 2;  // the canvas default
      const near = 0.01;
      const far = 50;
      var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      return camera;
    }

    function controlsChange(event) {
      if (_self.opts.setZoomCallback) {
        _self.opts.setZoomCallback(_self.camera.position.length());
        _self.state.cameraPan = _self.controls.getTarget();
      }
      _self.requestRender();
    }

    function initialiseControls(camera, elem, config, initZ) {
      var controls = new CameraControls(camera, elem);

      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.panSpeed = 1.0;
      controls.truckSpeed = 2.0;
      controls.rotateSpeed = 1.0;
      controls.dollySpeed = 1.0;
      controls.zoomSpeed = (touchDetected ? 0.25 : 1.0);
      controls.setTarget(_self.state.cameraPan.x, _self.state.cameraPan.y, _self.state.cameraPan.z);
      controls.mouseButtons.wheel = (_self.opts.featured === true) ? CameraControls.ACTION.DOLLY : CameraControls.ACTION.NONE;
      controls.mouseButtons.left = (config.mouseCamControlsRotate) ? CameraControls.ACTION.ROTATE : CameraControls.ACTION.NONE;
      controls.mouseButtons.right = (config.mouseCamControlsPan) ? CameraControls.ACTION.TRUCK : CameraControls.ACTION.NONE;
      controls.minDistance = config.minCamZ;
      controls.maxDistance = config.maxCamZ;
      controls.setPosition(0, 0, initZ);
      controls.verticalDragToForward = false;
      // Dolly to cursor if the mouse position isn't controlling tilt
      controls.dollyToCursor = (_self.state.camTiltWithMousePos === 0.0);
      controls.update();

      if (touchDetected && !config.useTouch) {
        controls.dispose();
      }

      _self.updateControls(controls);
      _self.registerEventListener(controls, 'update', controlsChange);

      return controls;
    }

    function detectGyro(event) {
      // This can be called at a different point in the config and texture loading sequence, depending on
      // whether we are waiting for the user to grant permission, or if the browser already has permission.
      if (event.alpha || event.beta || event.gamma) {
        console.info('Gyro detected');
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

    function setZoomHelp() {
      clearZoomHelp();
      _self.state._statusText = 'Use ctrl + scroll to zoom';
      updateStatusTextDisplay();
      zoomHelpTimeoutID = setTimeout(clearZoomHelp, 2500);
      _self.timeouts.push(zoomHelpTimeoutID);
    }

    function clearZoomHelp() {
      clearTimeout(zoomHelpTimeoutID);
      _self.state._statusText = '';
      updateStatusTextDisplay();
    }

    function updateStatusTextDisplay() {
      // Trying to add this button while also displaying status text sends iOS Safari into a reload loop. So the
      // button takes precedence.
      if (orientPermWanted && orientPermNeeded && !orientPermObtained) {
        subtitleElem.style.display = 'flex';
        let requestButton = _self.registerElement(document, 'button');
        injectStyle(requestButton, styles['bivot-button']);
        requestButton.innerHTML = 'Tap for tilt control';
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
        _self.registerEventListener(_self.overlay, 'mousemove', onDocumentMouseMove, false);
        _self.registerEventListener(_self.overlay, 'mouseout', onDocumentMouseOut, false);
        _self.registerEventListener(_self.overlay, 'mouseover', onCanvasMouseOver, false);
        _self.registerEventListener(_self.overlay, 'mouseout', onCanvasMouseOut, false);
      } else if (_self.state.lightMotion == 'gyro') {
        _self.registerEventListener(window, 'deviceorientation', onDeviceOrientation, false);
        document.removeEventListener('mousemove', onDocumentMouseMove, false);
        document.removeEventListener('mouseout', onDocumentMouseOut, false);
        _self.overlay.removeEventListener('mouseover', onCanvasMouseOver, false);
        _self.overlay.removeEventListener('mouseout', onCanvasMouseOut, false);
      } else {
        console.assert(_self.state.lightMotion == 'animate');
        window.removeEventListener('deviceorientation', onDeviceOrientation, false);
        document.removeEventListener('mousemove', onDocumentMouseMove, false);
        document.removeEventListener('mouseout', onDocumentMouseOut, false);
        _self.overlay.removeEventListener('mouseover', onCanvasMouseOver, false);
        _self.overlay.removeEventListener('mouseout', onCanvasMouseOut, false);
      }
    }

    function getNdc(x, y) {
      // Get normalised device co-ordinates
      return {
        x: (x / _self.renderer.domElement.clientWidth) * 2 - 1,
        y: -(y / _self.renderer.domElement.clientHeight) * 2 + 1
      };
    }

    function mouseToTexCoords(x, y, texDimsUnstretched) {
      const ndc = getNdc(x, y);
      raycaster.setFromCamera(ndc, _self.camera);
      const intersects = raycaster.intersectObjects(_self.scene.children);
      if (intersects.length > 0 && texDimsUnstretched !== undefined) {
        const stretchedUv = _self.stretchUv(intersects[0].uv);
        // TODO: Consider _self.state.yFlip here to determine UV Y-flip in these calculations
        if (_self.state.stretch) {
          // Stretched texture
          return [
            stretchedUv.x * texDimsUnstretched[0],
            (1 - stretchedUv.y) * texDimsUnstretched[1]
          ];
        } else {
          // Map from useful texture to full texture image
          const uv = {
            x: (stretchedUv.x - 0.5) * _self.untiledImDims[0] / texDimsUnstretched[0] + 0.5,
            y: ((1 - stretchedUv.y) - 0.5) * _self.untiledImDims[1] / texDimsUnstretched[1] + 0.5
          };
          return [uv.x * texDimsUnstretched[0], uv.y * texDimsUnstretched[1]];
        }
      }
      return null;
    }

    function texToGridCoords(uv, texDimsUnstretched, phaseIn=null) {
      const grid = _self.state.grid;
      if (grid) {
        const x = Math.floor(uv[0] / grid[0]);
        const y = Math.floor(uv[1] / grid[1]);
        const numGridRepeats = [
          Math.round(texDimsUnstretched[0] / grid[0]),
          Math.round(texDimsUnstretched[1] / grid[1])
        ];
        var xMod = ((x % numGridRepeats[0]) + numGridRepeats[0]) % numGridRepeats[0];
        var yMod = ((y % numGridRepeats[1]) + numGridRepeats[1]) % numGridRepeats[1];
        const phase = [
          Math.round((x - xMod) / numGridRepeats[0]),
          Math.round((y - yMod) / numGridRepeats[1])
        ];

        if (phaseIn) {
          // Clamp to the given input phase
          if (phase[0] > phaseIn[0]) {
            xMod = Math.round(texDimsUnstretched[0] / grid[0]) - 1;
          } else if (phase[0] < phaseIn[0]) {
            xMod = 0;
          }
          if (phase[1] > phaseIn[1]) {
            yMod = Math.round(texDimsUnstretched[1] / grid[1]) - 1;
          } else if (phase[1] < phaseIn[1]) {
            yMod = 0;
          }
        }

        return { coords: [xMod, yMod], phase };
      } else {
        return { coords: uv, phase: [0, 0] };
      }
    }

    function unstretchedDims(dims) {
      const inDims = dims ? dims : [1, 1];
      const stretch = _self.state.stretch ?? [1, 1];
      return [
        inDims[0] * stretch[0],
        inDims[1] * stretch[1]
      ];
    }

    function pointsDist(x0, y0, x1, y1, sx=null, sy=null) {
      var sxi = sx;
      var syi = sy;
      if (sx === null || sy === null) {
        const [absLineWidthX, absLineWidthY] = _self.getLineWidths();
        const [ex, ey] = _self.getPointRadii(absLineWidthX, absLineWidthY);
        const td = _self.untiledImDims;
        const maxDim = Math.max(td[0], td[1]);
        sxi = (overlayTexW / maxDim) / ex;
        syi = (overlayTexH / maxDim) / ey;
      }
      const dx = (x0 - x1) * sxi;
      const dy = (y0 - y1) * syi;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function findNearestDraggablePoint(u, v) {
      const [absLineWidthX, absLineWidthY] = _self.getLineWidths();
      const [ex, ey] = _self.getPointRadii(absLineWidthX, absLineWidthY);
      const td = _self.untiledImDims;
      const maxDim = Math.max(td[0], td[1]);
      const sx = overlayTexW / maxDim;
      const sy = overlayTexH / maxDim;
      var minDist = null;
      var minHitGroup = null;
      var minHitPoint = null;
      _self.state.pointsControl.forEach((pc, gi) => {
        if (pc.draggable) {
          pc.points.forEach((p, pi) => {
            const dist = pointsDist(u, v, p.x, p.y, sx / ex, sy / ey);
            if (minDist === null || dist < minDist) {
              minDist = dist;
              minHitGroup = gi;
              minHitPoint = pi;
            }
          });
        }
      });
      return {
        dist: minDist,
        group: minHitGroup,
        point: minHitPoint
      };
    }

    function deletePoint(points, group, point) {
      const length = points.length;
      points.splice(point, 1);

      if (length === 1) {
        // No more points to select
        return null;
      }
      if (group === 0 && length === 4 && (point === 1 || point === 2)) {
        // Delete non-final point of 4; cycle points beyond this one to front
        for (var i = 0; i < (3 - point); i++) {
          points.unshift(points[2]);
          points.splice(3, 1);
        }
      }
      if (group === 1 && Math.floor((length - 1) / 2) !== Math.floor(point / 2)) {
        // Delete a point not in the final group; move its partner to the end of the array and select it
        const movedIndex = 2 * Math.floor(point / 2);
        points.push(points[movedIndex]);
        points.splice(movedIndex, 1);
        return length - 2;
      }
      // Next point becomes selected if there is one, otherwise previous point
      return (point >= length - 1) ? point - 1 : point;
    }

    function onMouseDown(event) {
      event.preventDefault();
      if (event.button === 0) {  // Primary button
        var captured = false;
        if (_self.state.enableGridSelect || _self.state.pointsControl) {
          if (_self.state.enableGridSelect) {
            captured = true;
            _self.gridSelectionState.state = 'selecting';
            const texDimsUnstretched = unstretchedDims(_self.state.texDims);
            const texCoords = mouseToTexCoords(event.layerX, event.layerY, texDimsUnstretched);
            if (texCoords) {
              const { coords, phase } = texToGridCoords(texCoords, texDimsUnstretched);
              _self.gridSelectionState.p0 = coords;
              _self.gridSelectionState.p1 = coords;
              _self.gridSelectionState.tilingPhase = phase;
              if (_self.opts.onGridSelect) {
                _self.opts.onGridSelect(_self.gridSelectionState.p0, _self.gridSelectionState.p1);
              }
            }
          } else if (_self.state.pointsControl) {
            const anyInteractable = _self.state.pointsControl.some((pc) => (pc.draggable || pc.addNew));
            if (anyInteractable) {
              captured = true;
              const texCoords = mouseToTexCoords(event.layerX, event.layerY, _self.state.texDims);
              if (texCoords) {
                const { dist, group, point } = findNearestDraggablePoint(texCoords[0], texCoords[1]);
                if (dist !== null && dist < 1) {
                  document.body.style.cursor = `url('${crosshairsCursor}'), auto`;
                  _self.dragState.state = 'draggingPoint';
                  _self.dragState.group = group;
                  _self.dragState.point = point;
                  _self.updateOverlay();
                  _self.requestRender();
                }
                if (_self.dragState.state !== 'draggingPoint') {
                  var addable = null;
                  for (var i = 0; i < _self.state.pointsControl.length; i++) {
                    if (_self.state.pointsControl[i].addNew) {
                      addable = i;
                      break;
                    }
                  }
                  if (addable !== null) {
                    document.body.style.cursor = `url('${crosshairsCursor}'), auto`;
                    const pointNum = _self.state.pointsControl[addable].points.length ?? 0;
                    _self.controls.enabled = false;
                    _self.dragState.state = 'draggingPoint';
                    _self.dragState.group = addable;
                    _self.dragState.point = pointNum;
                    _self.dragState.addingNew = pointNum;
                    _self.dragState.clickPos = texCoords;
                    onMouseDrag(event);
                  } else {
                    // Deselect any currently selected point
                    _self.dragState.state = 'none';
                    _self.updateOverlay();
                    _self.requestRender();
                  }
                }
              }
            }
          }
        }
        if (captured) {
          _self.overlay.setPointerCapture(event.pointerId);
          _self.controls.enabled = false;
        } else if (_self.state.dragControlsRotation === 2 && !event.ctrlKey) {
          // Disable drag-rotate without ctrl key
          _self.controls.enabled = false;
        } else {
          // Allow regular controls.
          // Must phase azimuth into -PI -> PI range to avoid rotation control
          // flipping the rotation suddenly from the PI -> 2.PI range due to
          // azimuth limit
          if (_self.controls.azimuthAngle > Math.PI) {
            _self.controls.rotateAzimuthTo(_self.controls.azimuthAngle - 2 * Math.PI);
          }
        }
      }
    }

    function onMouseUp(event) {
      event.preventDefault();
      _self.controls.enabled = true;
      if (event.button === 0) {  // Primary button
        if (_self.state.enableGridSelect) {
          _self.overlay.releasePointerCapture(event.pointerId);
          _self.gridSelectionState.state = 'selected';
          _self.updateOverlay();
        } else if (['draggingPoint', 'draggingRect'].includes(_self.dragState.state)) {
          document.body.style.cursor = 'auto';
          _self.overlay.releasePointerCapture(event.pointerId);
          const uv = mouseToTexCoords(event.layerX, event.layerY, _self.state.texDims);
          const pcg = _self.state.pointsControl[_self.dragState.group];
          if (_self.dragState.state === 'draggingRect' && pcg.lines === 'closed4') {
            const pos0 = pcg.points[0];
            pcg.points.push({ 'x': uv[0], 'y': uv[1] });
            pcg.points.push({ 'x': pos0.x, 'y': uv[1] });
            pcg.points[1] = { 'x': uv[0], 'y': pos0.y };
            _self.dragState.point = 2;
          }
          if (uv) {
            if (_self.opts.onDrawing) {
              _self.opts.onDrawing(_self.dragState.group, _self.dragState.point, uv[0], uv[1]);
            }
            if (_self.opts.onPointSelect) {
              _self.opts.onPointSelect(_self.dragState.group, _self.dragState.point);
            }
          }
          _self.dragState.state = 'selected';
          _self.dragState.addingNew = null;
        }
      }
    }

    function onMouseDrag(event) {
      event.preventDefault();
      if (_self.state.enableGridSelect && _self.gridSelectionState.state === 'selecting') {
        const texDimsUnstretched = unstretchedDims(_self.state.texDims);
        const uv = mouseToTexCoords(event.layerX, event.layerY, texDimsUnstretched);
        if (uv) {
          const { coords, _phase } = texToGridCoords(uv, texDimsUnstretched, _self.gridSelectionState.tilingPhase);
          if (_self.gridSelectionState.p1 === null || coords[0] !== _self.gridSelectionState.p1[0] || coords[1] !== _self.gridSelectionState.p1[1]) {
            _self.gridSelectionState.p1 = coords;
            if (_self.opts.onGridSelect) {
              _self.opts.onGridSelect(_self.gridSelectionState.p0, _self.gridSelectionState.p1);
            }
          }
        }
      } else if (['draggingPoint', 'draggingRect'].includes(_self.dragState.state)) {
        const uv = mouseToTexCoords(event.layerX, event.layerY, _self.state.texDims);
        if (uv) {
          _self.state.pointsControl[_self.dragState.group].points[_self.dragState.point] = { 'x': uv[0], 'y': uv[1] };

          const pos0 = _self.dragState.clickPos;
          if (_self.dragState.addingNew === 0 && _self.dragState.point === 0 && pos0) {
            const dist = pointsDist(uv[0], uv[1], pos0[0], pos0[1]);
            if (dist > 1) {
              if (['rect', 'closed4'].includes(_self.state.pointsControl[_self.dragState.group].lines)) {
                _self.state.pointsControl[_self.dragState.group].points[0] = { 'x': pos0[0], 'y': pos0[1] };
                _self.state.pointsControl[_self.dragState.group].points.push({ 'x': uv[0], 'y': uv[1] });
                _self.dragState.point = 1;
                _self.dragState.state = 'draggingRect';
              }
            }
          }
          _self.updateOverlay();
          _self.requestRender();
        }
      } else {
        // Drag is part of regular mouse controls
        _self.requestRender();
      }
    }

    function onDocumentMouseMove(event) {
      event.preventDefault();
      // Update cams and lights using relative mouse co-ords between -1 and 1 within the canvas
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

      if (_self.camera && _self.controls && _self.state.tiltZeroOnMouseOut && _self.state.camTiltWithMousePos != 0.0) {
        _self.controls.setPosition(0, 0, _self.camera.position.length());
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

    function jumpToPoint(group, point) {
      const points = _self.state.pointsControl[group].points;
      const pMap = _self.coordsToWorld([points[point]]);
      _self.controls.setPosition(pMap[0].x, pMap[0].y, _self.camera.position.z);
      _self.controls.setTarget(pMap[0].x, pMap[0].y, 0);
      _self.updateOverlay();
      _self.requestRender();
      if (_self.opts.onPointSelect) {
        _self.opts.onPointSelect(group, point);
      }
    }

    function tryJumpToFirstPoint(group) {
      if (_self.dragState.state === 'none') {
        if (_self.state.pointsControl && group < _self.state.pointsControl.length) {
          if (_self.state.pointsControl[group] && _self.state.pointsControl[group].points && _self.state.pointsControl[group].points.length > 0) {
            _self.dragState.group = group;
            _self.dragState.point = 0;
            _self.dragState.state = 'selected';
            jumpToPoint(group, 0);
          }
        }
      }
    }

    function findNearestPoint(points, i0, candidates) {
      var nearestDist2;
      var nearestIndex = null;
      const p0 = points[i0];
      candidates.forEach(i1 => {
        const p1 = points[i1];
        const dist2 = Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2);
        if (nearestIndex === null || dist2 < nearestDist2) {
          nearestIndex = i1;
          nearestDist2 = dist2;
        }
      });
      return nearestIndex;
    }

    function onKeyDown(event) {
      if (_self.mouseInCanvas) {
        switch (event.keyCode) {
          case 17: // Ctrl
            if (_self.controls && _self.config.mouseCamControlsZoom) {
              _self.controls.enableZoom = true;
            }
            break;
          case 70: // F
            if (event.ctrlKey) {
              toggleStats();
            }
            break;
        }
      }
      switch (event.keyCode) {
        case 188: // Comma - Jump to prev point or point pair
          if (_self.dragState.state === 'selected') {
            const group = _self.dragState.group;
            const points = _self.state.pointsControl[group].points;
            const p = _self.dragState.point;
            if (_self.state.pointsControl[group].lines === 'pairs') {
              if (points.length == 1) {
                newP = 0;
              } else {
                var newP1 = 2 * Math.floor(p / 2) - 2;
                var newP2 = newP1 + 1;
                if (newP2 < 0) {
                  if (points.length % 2 === 1) {
                    newP1 = points.length - 1;
                    newP2 = newP1;
                  } else {
                    newP1 = points.length - 2;
                    newP2 = newP1 + 1;
                  }
                }
                if (newP1 < 0) {
                  newP = newP2;
                } else {
                  newP = findNearestPoint(points, p, [newP1, newP2]);
                }
              }
            } else {
              newP = (p + points.length - 1) % points.length;
            }
            _self.dragState.point = newP;
            jumpToPoint(group, newP);
          } else {
            tryJumpToFirstPoint(0);
          }
          break;

        case 190: // Full stop - Jump to next point or point pair
          if (_self.dragState.state === 'selected') {
            const group = _self.dragState.group;
            const points = _self.state.pointsControl[group].points;
            const p = _self.dragState.point;
            var newP;
            if (_self.state.pointsControl[group].lines === 'pairs') {
              if (points.length == 1) {
                newP = 0;
              } else {
                var newP1 = 2 * Math.floor(p / 2) + 2;
                var newP2 = newP1 + 1;
                if (newP1 >= points.length) {
                  newP1 = 0;
                  newP2 = 1;
                }
                if (newP2 >= points.length) {
                  newP = newP1;
                } else {
                  newP = findNearestPoint(points, p, [newP1, newP2]);
                }
              }
            } else {
              newP = (p + 1) % points.length;
            }
            _self.dragState.point = newP;
            jumpToPoint(group, newP);
          } else {
            tryJumpToFirstPoint(0);
          }
          break;

        case 77: // M - Jump to matching pair
          if (_self.dragState.state === 'selected') {
            const group = _self.dragState.group;
            const points = _self.state.pointsControl[group].points;
            if (_self.state.pointsControl[group].lines === 'pairs') {
              const p = _self.dragState.point;
              const newP = 2 * Math.floor(p / 2) + (1 - p % 2);
              if (newP < points.length) {
                _self.dragState.point = newP;
                jumpToPoint(group, newP);
              }
            }
          } else {
            tryJumpToFirstPoint(1);
          }
          break;

        case 46: // Delete
          if (_self.state.enableKeypress || true) {
            if (_self.dragState.state === 'selected') {
              const group = _self.dragState.group;
              const point = _self.dragState.point;
              const newSelection = deletePoint(_self.state.pointsControl[group].points, group, point);
              if (newSelection !== null) {
                _self.dragState.point = newSelection;
              } else {
                _self.dragState.state = 'none';
              }
              if (_self.opts.onDrawing) {
                _self.opts.onDrawing(group, point, null, null);
              }
              if (_self.opts.onPointSelect && _self.dragState.state !== 'none') {
                if (_self.dragState.state === 'selected') {
                  _self.opts.onPointSelect(_self.dragState.group, _self.dragState.point);
                } else {
                  _self.opts.onPointSelect(_self.dragState.group, null);
                }
              }
              _self.updateOverlay();
              _self.requestRender();
            }
          }
      }
    }

    function onKeyUp(event) {
      if (_self.mouseInCanvas) {
        switch(event.keyCode) {
          case 17: // Ctrl
            if (_self.controls && _self.config.mouseCamControlsZoom) {
              if (_self.opts.featured !== true && !_self.isFullScreen()) {
                _self.controls.enableZoom = false;
              }
            }
            break;
        }
      }
    }

    function onOverlayWheel(event) {
      _self.updateOverlay();  // Update overlay to preserve apparent line thicknesses
    }

    function onWheel(event) {
      if (_self.mouseInCanvas && _self.config.mouseCamControlsZoom) {
        // Wheel is part of regular mouse controls
        _self.wheelInProgress = true;
        _self.requestRender();

        if (!(event.ctrlKey || _self.opts.featured === true || _self.isFullScreen())) {
          setZoomHelp();
          return;
        } else {
          // TODO: Clear help immediately when ctrl + scroll is used (currently,
          //       onWheel() doesn't fire in these circumstances)
          clearZoomHelp();
        }
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
      const currentTilt = getOrientation(event);
      if (!baselineTiltSet) {
        baselineTilt.copy(currentTilt);
        baselineTiltSet = true;
      }
      const deltaTilt = currentTilt.clone().sub(baselineTilt);
      const xy = new THREE.Vector2(
        Math.sin(THREE.MathUtils.degToRad(deltaTilt.y)),
        Math.sin(THREE.MathUtils.degToRad(deltaTilt.x))
      );
      const elevationLimit = Math.max(_self.state.camTiltLimitDegrees, _self.state.lightTiltLimitDegrees);
      const qLimit = Math.cos(THREE.MathUtils.degToRad(elevationLimit));
      if (xy.length() > qLimit) {
        const surplus = xy.length() - xy.clone().clampLength(0.0, qLimit).length();
        baselineTilt.addScaledVector(deltaTilt, surplus * _self.state.tiltDriftSpeed);
      }
      if (_self.isVisible) {
        _self.updateCamsAndLightsFromXY(xy, _self.state.lightTiltWithDeviceOrient, _self.state.camTiltWithDeviceOrient);
      }
    }

    function loadScansImpl(brdfTexturePaths, meshPath, meshPathLow, loadManager) {
      updateControlPanel(gui);

      _self.disposeTextures();
      _self.brdfTextures = new Map();

      // If a materialSet was provided, set the texture format directly from the texture file extensions
      if (_self.opts.material || _self.opts.materialSet) {
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
      //console.debug(JSON.parse(JSON.stringify(brdfTexturePaths)));
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
            const flipped = _self.state.yFlipped ?? _self.state.yFlip;
            texture.flipY = (flipped == (_self.config.textureFormat == 'EXR'));
            // EXRLoader sets the format incorrectly for single channel textures.
            texture.format = value.format;
            // iOS does not support WebGL2
            // Textures need to be square powers of 2 for WebGL1
            // texture.repeat.set(matxs/padxs, matxs/padys);
            //console.debug('Loaded:', key, value.path);

            _self.setTexRepeat(texture);

            if (_self.brdfTextures) {
              _self.brdfTextures.set(key, texture);
            } else {
              console.debug(`Failed to set new texture in _self.brdfTextures: ${key}`)
            }
          },
          function (xhr) {},
          function (error) {
            console.debug('Failed to load texture:', key);
          }
        );
      }

      _self.meshOrig = meshPath;
      _self.meshOrigLow = meshPathLow;
      _self.meshMaterial = meshPath;
      _self.meshMaterialLow = meshPathLow;
      // Load the override mesh if set, otherwise use given textures mesh
      var loadedMeshPath = meshPath;
      var loadedMeshPathLow = meshPathLow;
      if (_self.state.meshOverride) {
        console.debug('Using meshOverride:', _self.state.meshOverride);
        _self.meshMaterial = _self.state.meshOverride;
        _self.meshMaterialLow = null;
        loadedMeshPath = _self.state.meshOverride;
        loadedMeshPathLow = null;
      }
      _self.loadMesh(_self, loadedMeshPath, loadedMeshPathLow, loadManager);
    }

    function loadScan() {
      const loadManager = new THREE.LoadingManager();
      loadManager.onLoad = onLoad;
      loadManager.onProgress = onProgress;
      loadManager.onStart = onStart;
      loadManager.onError = (url) => {
        console.debug(`LoadingManager: There was an error loading ${url}`);
      }

      // List of keys to merge between the 3 states.
      const keys = Object.keys(_self.config.initialState);
      keys.push('zoom'); // Necessary because zoom is omitted from initialState to support legacy galleries
      if (_self.opts.materialSet) {
        const material = _self.scans[_self.scan];
        var location = ''
        if (material.location.startsWith('http')) {
          location = material.location;
        } else {
          location = getBasePath(_self.opts.materialSet) + '/' + material.location;
        }
        loadScanFromMaterial(loadManager, material, keys, location);
      } else if (_self.opts.textures && _self.opts.material) {
        loadScanFromTextures(loadManager, _self.opts.textures, _self.opts.material, keys);
      } else {
        const tex_dir = _self.opts.texturePath + '/' + _self.scan + '/';
        loadScanMetadata(loadManager, tex_dir, keys);
      }

      _self.untiledImDims = calcImDims(_self.state.texDims);
    }

    function loadScanFromMaterial(loadManager, material, keys, location) {
      if (!location.endsWith('/')) {
        location += '/';
      }
      const textures = {};
      for (var key in material.textures) {
        if (material.textures[key]) {
          if (material.textures[key]) {
            if (material.textures[key].startsWith('http')) {
              textures[key] = material.textures[key];
            } else {
              textures[key] = location + material.textures[key];
            }
          }
        }
      }
      return loadScanFromTextures(loadManager, textures, material, keys);
    }

    function loadScanFromTextures(loadManager, textures, material, keys) {
      let paths = new Map();
      paths.set('diffuse', {path: textures.basecolor, format: THREE.RGBAFormat});
      paths.set('normals', {path: textures.normals, format: THREE.RGBAFormat});
      paths.set('specular', {path: textures.specular, format: THREE.RGBAFormat});
      if (textures.displacement) {
        paths.set('displacement', {path: textures.displacement, format: THREE.RGBAFormat});
      }
      if (textures.alpha) {
        paths.set('alpha', {path: textures.alpha, format: THREE.RGBAFormat});
      }

      let scanState = [];
      const metadata = material.config.renders[_self.scan];
      if (metadata.hasOwnProperty('state')) {
        jsonToState(metadata.state, scanState, _self.vectorKeys);
      }
      if (metadata.hasOwnProperty('version')) {
        scanState.brdfVersion = metadata.version;
      }

      var overrideSize = null;
      if (
        _self.config.initialState.size[0] > 0 &&
        _self.config.initialState.size[1] > 0 &&
        (_self.config.initialState.size[0] != _self.defaultSize[0] ||
          _self.config.initialState.size[1] != _self.defaultSize[1])
      ) {
        // Size update has occurred during loading.  Retain the update after merging state
        overrideSize = _self.config.initialState.size.slice();
      }
      mergeMetadata(scanState, keys);
      if (overrideSize) {
        _self.state.size = overrideSize.slice();
      }

      setLoadingImage();

      // Note: meshLow might not exist as a member of textures in which case
      // it will be passed here as undefined.  Alternatively, it may exist
      // but have a null value, if the caller determined that no low mesh
      // file exists.
      loadScansImpl(paths, textures.mesh, textures.meshLow, loadManager);
    }

    function loadScanMetadata(loadManager, texturePath, keys) {
      const jsonFilename = texturePath + 'render.json';

      getJSON(jsonFilename,
        function(err, data) {
          let scanState = [];
          if (!err) {
            try {
              const metadata = JSON.parse(data);
              console.debug('Loaded metadata from ' + jsonFilename + ':', metadata);

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
            console.debug('Render metadata (' + jsonFilename + ') not loaded: ' + err);
          }

          mergeMetadata(scanState, keys);
          loadScanFilenames(loadManager, texturePath);
        }
      );
    }

    function mergeMetadata(scanState, keys) {
      let bivotState = [];

      // Read valid bivot-renders.json parameters, if present
      const curScan = _self.scans[_self.scan];
      var curPosition = _self.camera.position.clone();
      if (curScan.hasOwnProperty('cameraPositionX')) {
        curPosition.x = curScan.cameraPositionX;
      }
      if (curScan.hasOwnProperty('cameraPositionY')) {
        curPosition.y = curScan.cameraPositionY;
      }
      if (curScan.hasOwnProperty('cameraPositionZ')) {
        curPosition.z = curScan.cameraPositionZ;
      }
      _self.controls.setPosition(curPosition.x, curPosition.y, curPosition.z);

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

      mergeDictKeys(bivotState, scanState, _self.config.initialState, keys, _self.vectorKeys, _self.state);

      console.debug('  BRDF model: ', _self.state.brdfModel);
      console.debug('  BRDF version: ', _self.state.brdfVersion);

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
        texNames.set('displacement', 'displacement');
        texNames.set('alpha', 'alpha');
      } else {
        texNames.set('diffuse', 'diffuse');
        texNames.set('normals', 'normals');
        texNames.set('specular', 'specular-srt');
      }

      let paths = new Map();
      console.assert(['JPG', 'PNG', 'EXR'].includes(_self.config.textureFormat));
      if (_self.config.textureFormat == 'EXR') {
        paths.set('diffuse', {path: texDir + 'brdf-' + texNames.get('diffuse') + '_cropf16.exr', format:THREE.RGBAFormat});
        paths.set('normals', {path: texDir + 'brdf-' + texNames.get('normals') + '_cropf16.exr', format:THREE.RGBAFormat});
        paths.set('specular', {path: texDir + 'brdf-' + texNames.get('specular') + '_cropf16.exr', format: THREE.RGBAFormat});
        paths.set('displacement', {path: texDir + 'brdf-' + texNames.get('displacement') + '_cropf16.exr', format: THREE.RGBAFormat});
        paths.set('alpha', {path: texDir + 'brdf-' + texNames.get('alpha') + '_cropf16.exr', format: THREE.RGBAFormat});
      }
      else if (_self.config.textureFormat == 'JPG') {
        paths.set('diffuse', {path: texDir + 'brdf-' + texNames.get('diffuse') + '_cropu8_hi.jpg', format:THREE.RGBAFormat});
        paths.set('normals', {path: texDir + 'brdf-' + texNames.get('normals') + '_cropu8_hi.jpg', format:THREE.RGBAFormat});
        paths.set('specular', {path: texDir + 'brdf-' + texNames.get('specular') + '_cropu8_hi.jpg', format: THREE.RGBAFormat});
        paths.set('displacement', {path: texDir + 'brdf-' + texNames.get('displacement') + '_cropu8_hi.jpg', format: THREE.RGBAFormat});
        paths.set('alpha', {path: texDir + 'brdf-' + texNames.get('alpha') + '_cropu8_hi.jpg', format: THREE.RGBAFormat});
      } else {
        paths.set('diffuse', {path: texDir + 'brdf-' + texNames.get('diffuse') + '_cropu8_hi.png', format:THREE.RGBAFormat});
        paths.set('normals', {path: texDir + 'brdf-' + texNames.get('normals') + '_cropu8_hi.png', format:THREE.RGBAFormat});
        paths.set('specular', {path: texDir + 'brdf-' + texNames.get('specular') + '_cropu8_hi.png', format: THREE.RGBAFormat});
        paths.set('displacement', {path: texDir + 'brdf-' + texNames.get('displacement') + '_cropu8_hi.png', format: THREE.RGBAFormat});
        paths.set('alpha', {path: texDir + 'brdf-' + texNames.get('alpha') + '_cropu8_hi.png', format: THREE.RGBAFormat});
        if (_self.config.dual8Bit) {
          paths.set('diffuse_low', {path: texDir + 'brdf-' + texNames.get('diffuse') + '_cropu8_lo.png', format:THREE.RGBAFormat});
          paths.set('normals_low', {path: texDir + 'brdf-' + texNames.get('normals') + '_cropu8_lo.png', format:THREE.RGBAFormat});
          paths.set('specular_low', {path: texDir + 'brdf-' + texNames.get('specular') + '_cropu8_lo.png', format: THREE.RGBAFormat});
          paths.set('displacement_low', {path: texDir + 'brdf-' + texNames.get('displacement') + '_cropu8_lo.png', format: THREE.RGBAFormat});
          paths.set('alpha_low', {path: texDir + 'brdf-' + texNames.get('alpha') + '_cropu8_lo.png', format: THREE.RGBAFormat});
        }
      }

      loadScansImpl(paths, texDir + 'brdf-mesh.obj', texDir + 'brdf-mesh_low.obj', loadManager);
    }

    function onStart(url, itemsLoaded, itemsTotal) {
      //console.debug('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    function onProgress(url, itemsLoaded, itemsTotal) {
      if (itemsLoaded > 0) {
        console.debug(`${itemsLoaded}/${itemsTotal} Loaded ${url}`);
      }
      const progress = itemsLoaded / itemsTotal;
      _self.progressBarElem.style.transform = `scaleX(${progress})`;
    };

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

    if (!width || !height) {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
    } else {
      w = width;
      h = height;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = w * pixelRatio;
    canvas.height = h * pixelRatio;

    this.resizeObserver = new ResizeObserver(entries => {
      this.updateCanvasOnResize();
    });
    this.resizeObserver.observe(this.canvas);
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
    if (this.lights && light_sensitivity !== 0.0) {
      this.state.lightPosition.copy(
        this.xyTo3dDirection(xy, this.state.lightPositionOffset, light_sensitivity, this.state.lightTiltLimitDegrees)
      );
      this.updateLightingGrid();
    }

    // Avoid tilt on mouseover if mouse wheel is occurring, otherwise the zoom gets clobbered
    if (this.camera && cam_sensitivity !== 0.0 && !this.wheelInProgress) {
      // Retain existing camera distance
      let camVec = this.xyTo3dDirection(xy, this.state._camPositionOffset, cam_sensitivity,
        this.state.camTiltLimitDegrees);
      camVec.multiplyScalar(this.camera.position.length());
      this.controls.setPosition(camVec.x, camVec.y, camVec.z);
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

  meshValToPath(val) {
    var meshPath;
    var meshPathLow = undefined;
    if (val === null || val === '') {
      meshPath = this.meshMaterial;
      meshPathLow = this.meshMaterialLow;
    } else if (val === false) {
      meshPath = this.meshOrig;
      meshPathLow = this.meshOrigLow;
    } else {
      // New custom mesh
      meshPath = val;
      meshPathLow = val.replace('.obj', '_low.obj');
    }
    return { meshPath, meshPathLow };
  }

  updateMesh() {
    // Only update the mesh if the new path is different to the current path in use
    const { meshPath, meshPathLow } = this.meshValToPath(this.state.meshOverride);
    if (this.meshPathUsed !== meshPath) {
      const _self = this;
      function onLoadUpdateMesh() {
        // Hide progress bar and activate the loaded mesh
        _self.loadingElem.style.display = 'none';
        _self.activateLoadedMesh(_self);
        // Call loading complete callback, if provided
        if (_self.opts.loadingCompleteCallback) {
          _self.opts.loadingCompleteCallback(false, true);
        }
      };

      // Reset and show progress bar, then load the mesh
      this.loadingElem.style.display = 'flex';
      this.progressBarElem.style.transform = 'scaleX(0)';
      const loadManager = new THREE.LoadingManager();
      loadManager.onLoad = onLoadUpdateMesh;
      this.loadMesh(this, meshPath, meshPathLow, loadManager);
    }

    if (this.state.meshesToCache) {
      const loadManager = new THREE.LoadingManager();
      this.state.meshesToCache.forEach(val => {
        const { meshPath, meshPathLow } = this.meshValToPath(val);
        this.loadMesh(this, meshPath, meshPathLow, loadManager, true);
      });
    }
  }

  getMeshElemFromObject(object) {
    var meshElem = null;
    object.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        meshElem = child;
      }
    });
    return meshElem;
  }

  loadMesh(_self, meshPath, meshPathLow, loadManager, cacheOnly=false) {
    // If we fetch userAgentData during startup then the render on Chrome
    // becomes blank, for reasons unknown.  So it's retrieved here, just
    // before it's needed, if not already cached.
    if (_self.uaData !== undefined) {
      _self.loadMeshInternal(_self, meshPath, meshPathLow, loadManager, cacheOnly);
    } else {
      _self.getUserAgentData().then((res) => {
        if (_self.uaData === undefined) {
          console.debug('userAgentData:', res);
          _self.uaData = res;
        }
        _self.loadMeshInternal(_self, meshPath, meshPathLow, loadManager, cacheOnly);
      })
    }
  }

  loadMeshInternal(_self, meshPath, meshPathLow, loadManager, cacheOnly=false) {
    // On some MacOS 12 machines running Chrome, the render has major glitches in
    // the form of the first 64k/3 faces rendering correctly, then every second
    // mesh face after that being only half rendered.  This may also depend on
    // graphics card (some MacOS 12 Chrome environments do not trigger the bug.)
    // As a workaround, we detect the OS version and browser, and if it's MacOS 12
    // with Chrome, use a low res mesh (less than 64k/3 faces) if available instead
    // of the usual mesh.
    //
    // In some MacOS versions and browsers, including the ones we need to detect
    // to work around this rendering bug, the browser falsely and deliberately caps
    // the userAgent Mac OS version at 10.15.7 even though the true version may be 11
    // or 12.  To work around this, we also fetch the userAgentData and look for the
    // version number there.  Users may be able to tell their browser not to provide
    // this info, in which case we don't have a way to know whether to serve them with
    // the rendering glitch workaround.
    const preferLowMesh = (
      _self.userAgent.os.name === 'Mac OS' &&
      _self.userAgent.browser.name.startsWith('Chrome')
    ) && (
      _self.userAgent.os.version.startsWith('12.') ||
      (
        _self.userAgent.os.version === '10.15.7' &&
        _self.uaData &&
        _self.uaData.platformVersion.startsWith('12.')
      )
    );
    if (
      !preferLowMesh &&
      _self.userAgent.os.name === 'Mac OS' &&
      _self.userAgent.browser.name.startsWith('Chrome') &&
      _self.userAgent.os.version === '10.15.7' &&
      _self.uaData === null
    ) {
      console.warn('Unable to determine OS version due to user browser settings.  Cannot apply browser rendering issue workaround even though it may be required (MacOS + Chrome).');
    }

    var tryMeshPath;
    var tryingLowMesh;
    if (preferLowMesh && meshPathLow) {
      tryMeshPath = meshPathLow;
      tryingLowMesh = true;
      console.debug('Trying preferred low mesh:', tryMeshPath);
    } else {
      if (preferLowMesh) {
        console.debug('Low mesh is preferred but unavailable');
      }
      tryMeshPath = meshPath;
      tryingLowMesh = false;
    }
    if (cacheOnly) {
      if (_self.meshCache.hasOwnProperty(meshPath)) {
        // Mesh has already been cached
        return;
      }
      var objLoader = new OBJLoader(loadManager);
      objLoader.load(tryMeshPath,
        function(object) {
          const meshElem = _self.getMeshElemFromObject(object);
          _self.meshCache[meshPath] = meshElem;  // Add to mesh cache
        },
        function (xhr) {},
        function (error) {
          if (tryingLowMesh) {
            // Couldn't load low-res mesh.  Retry loading, this time using the standard mesh
            console.debug('Mesh cache: Low mesh not loaded, falling back to standard mesh:', meshPath);
            _self.loadMesh(_self, meshPath, null, loadManager, true);
          } else {
            console.debug('Mesh cache: Error loading mesh ', tryMeshPath);
          }
        }
      );
    } else {
      _self.meshPathUsed = meshPath;
      if (_self.meshCache.hasOwnProperty(meshPath)) {
        // Mesh cache hit.  Switch to the requested mesh which is already loaded.
        _self.meshPathUsed = meshPath;
        _self.changeMesh(_self.meshCache[meshPath]);
        loadManager.onLoad();
      } else {
        // Mesh cache miss.  Load the mesh from the given path.
        var objLoader = new OBJLoader(loadManager);
        objLoader.load(tryMeshPath,
          function(object) {
            const meshElem = _self.getMeshElemFromObject(object);
            _self.meshCache[meshPath] = meshElem;  // Add to mesh cache
            _self.changeMesh(meshElem);

            // Workaround for three.js LoadingManager bug (see onLoad())
            if (_self.loadCompleteButMeshMissing) {
              loadManager.onLoad();
            }
          },
          function (xhr) {},
          function (error) {
            if (tryingLowMesh) {
              // Couldn't load low-res mesh.  Retry loading, this time using the standard mesh
              console.debug('Mesh load: Low mesh not loaded, falling back to standard mesh:', meshPath);
              _self.loadMesh(_self, meshPath, null, loadManager, false);
            } else {
              _self.meshLoadingFailed = true;
              console.debug('Mesh load: Error loading mesh ', tryMeshPath);
            }
          }
        );
      }
    }
  }

  changeMesh(newMesh) {
    if (this.mesh != null) {
      // Reset rotation to 0, for correct rotation handling in case mesh is cached and reused
      this.mesh.rotateZ((-this.state._meshRotateZDegreesPrevious)*Math.PI/180);
      this.state._meshRotateZDegreesPrevious = 0;

      // Remove old mesh from scene and clean up memory
      this.scene.remove(this.mesh);
      this.disposeMesh();
    }
    this.mesh = newMesh;
  }

  activateLoadedMesh(_self) {
    if (_self.mesh === null) {
      console.warn('Mesh unavailable; using planar geometry');
      _self.mesh = new THREE.Mesh(_self.getPlaneGeometry());
      // Use mesh cache purely to register for disposal (we never retrieve this mesh from the cache)
      _self.meshCache[`plane-${_self.mesh.uuid}`] = _self.mesh;
    }

    // Set initial Z rotation for loaded mesh
    _self.updateMeshRotation();

    var geom = _self.mesh.geometry;
    geom.computeBoundingBox();

    // START: work around for https://github.com/mrdoob/three.js/issues/20492
    // TODO: Remove after upgrading to future Three.js release (r122) that will include a fix.
    if (!geom.attributes.hasOwnProperty('normal')) {
      console.debug('Computing vertex normals...');
      geom.computeVertexNormals();
    }
    // END work around.

    // TODO: This only works on a mesh with indexed geometry.
    //       Our loaded OBJ meshes don't have indexed geometry.
    // if (_self.useDispMap) {
    //   console.debug('Computing tangents...')
    //   BufferGeometryUtils.computeTangents(geom);
    // }
    _self.geometry = geom;
    _self.setDiag(); // Calculate diag after setting geometry

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
      COLOR_TRANSFORM: 1,
      HUE_SATURATION: 1,
    };
    if (_self.useDispMap) {
      console.debug('Displacement map enabled');
      material.defines['USE_DISPLACEMENTMAP'] = 1;
      material.defines['TANGENTSPACE_NORMALMAP'] = 1;
      // TODO: Define when tangents can be computed in the geometry
      //       (which requires loading a mesh with indexed geometry)
      //material.defines['USE_TANGENT'] = 1;
    } else {
      material.defines['OBJECTSPACE_NORMALMAP'] = 1;
    }
    if (_self.useAlphaMap) {
      console.debug('Alpha map enabled');
      material.defines['USE_ALPHAMAP'] = 1;
      material.transparent = true;
      material.side = THREE.DoubleSide;
    }

    material.extensions.derivatives = true;
    _self.mesh.traverse(function(child) {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
    _self.scene.add(_self.mesh);

    _self.updateLightingGrid();
    _self.requestRender();
  }

  updateMeshRotation() {
    if (this.mesh) {
      this.mesh.rotateZ((this.state.meshRotateZDegrees - this.state._meshRotateZDegreesPrevious) * Math.PI/180);
      this.state._meshRotateZDegreesPrevious = this.state.meshRotateZDegrees;
    }
  }

  updateCanvas() {
    this.needsResize = true;
  }

  updateCanvasOnResize() {
    if (this.opts.responsive) {
      this.needsResize = true;
    }
    // In non-responsive mode, no need to update the canvas
    // logical size when the canvas client size changes.
  }

  isFullScreen() {
    return getDocumentFullScreenElement();
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

  updateRenderSize(width, height) {
    // Update resolution of the rendered pixel buffer (not the canvas).
    //console.log('updateRenderSize:', width, height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(width, height);
    this.setFxaaResolution();
  }

  getClientSize() {
    // Get the size of the container to render within, or a hard-coded size if specified.
    var pixelWidth, pixelHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    if (this.opts.responsive) {
      const aspectRatio = this.state.size[0] / this.state.size[1];
      pixelWidth = this.canvas.clientWidth * pixelRatio;
      pixelHeight = pixelWidth / aspectRatio;
    } else {
      pixelWidth = this.state.size[0] * pixelRatio;
      pixelHeight = this.state.size[1] * pixelRatio;
    }
    //console.log('getClientSize:', pixelWidth, pixelHeight);
    return { pixelWidth, pixelHeight };
  }

  // Update the canvas sizing.  Only call from within the render loop,
  // to time the resize immediately prior to the next frame render.
  renderLoopUpdateCanvas() {
    if (this.canvas && this.needsResize) {
      this.needsResize = false;

      var { pixelWidth, pixelHeight } = this.getClientSize();
      if (this.opts.responsive) {
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.width = undefined;
        this.canvas.height = undefined;
        if (this.overlay) {
          this.overlay.style.width = '100%';
          this.overlay.style.height = '100%';
        }
      } else {
        this.canvas.style.width = this.state.size[0] + 'px';
        this.canvas.style.height = this.state.size[1] + 'px';
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
        if (this.overlay) {
          this.overlay.style.width = this.canvas.style.width;
          this.overlay.style.height = this.canvas.style.height;
        }
      }
      var targetPixelCount = this.adaptFramerate['renderedPixels'];
      var ratio = targetPixelCount <= 0.0 ? 1.0 : Math.sqrt(targetPixelCount / (pixelWidth * pixelHeight));
      if (ratio > 1.0) {
        ratio = 1.0;  // Avoid oversampling
      }
      const renderWidth = Math.floor(pixelWidth * ratio);
      const renderHeight = Math.floor(pixelHeight * ratio);
      this.updateRenderSize(renderWidth, renderHeight);

      this.updateOverlay();
      this.requestRender();
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
    // Convert to linear sRGB to cancel out the shader adding sRGB gamma back in again
    this.scene.background = new THREE.Color(this.getBgColorFromState(this.state)).convertSRGBToLinear();
    this.requestRender();
  }

  updateControls(controls=null) {
    const iControls = controls ? controls : this.controls;
    if (iControls) {
      if (this.state.dragControlsRotation !== null) {
        iControls.mouseButtons.left = (this.state.dragControlsRotation) ? CameraControls.ACTION.ROTATE : CameraControls.ACTION.NONE;
      }
      if (this.state.dragControlsPanning !== null) {
        iControls.mouseButtons.right = (this.state.dragControlsPanning) ? CameraControls.ACTION.TRUCK : CameraControls.ACTION.NONE;
      }
      if (this.state.camTiltLimitDegrees !== null) {
        this.updateCamTiltLimit(iControls, this.state.camTiltLimitDegrees);
      }
      iControls.dollyToCursor = (this.state.camTiltWithMousePos === 0.0);
    }
  }

  updateControlsPan() {
    if (this.controls) {
      if (this.state.cameraPanArray) {
        this.controls.setTarget(this.state.cameraPanArray[0], this.state.cameraPanArray[1], this.state.cameraPanArray[2]);
      } else {
        this.controls.setTarget(this.state.cameraPan.x, this.state.cameraPan.y, this.state.cameraPan.z);
      }
    }
  }

  updateZoom() {
    if (this.controls) {
      this.controls.minDistance = this.state.zoom[0];
      this.controls.maxDistance = this.state.zoom[2];

      // Retain existing camera angle, changing the distance
      const position = this.controls.getPosition();
      position.multiplyScalar(this.state.currentZoom / position.length());
      this.controls.setPosition(position.x, position.y, position.z);

      this.requestRender();
    }
  }

  updateColor() {
    this.state.colorTransform.copy(getWhiteBalanceMatrix(this.state.colorTemperature));
    // console.log('colorTransform:', JSON.parse(JSON.stringify(this.state.colorTransform)));
  }

  updateCamTiltLimit(controls, limitDeg) {
    if (controls) {
      let tiltLimitRadians = Math.PI * limitDeg / 180;
      controls.minPolarAngle = tiltLimitRadians;
      controls.maxPolarAngle = Math.PI - tiltLimitRadians;
      controls.minAzimuthAngle = -Math.PI/2 + tiltLimitRadians;
      controls.maxAzimuthAngle = +Math.PI/2 - tiltLimitRadians;
    }
  }

  getPlaneGeometry() {
    const dpi = 300;
    const pixelsPerMetre = dpi / 0.0254;
    const textureWidthPixels = 2048;
    const textureHeightPixels = 2048;
    const planeWidth = textureWidthPixels / pixelsPerMetre;
    const planeHeight = textureHeightPixels / pixelsPerMetre;
    return new THREE.PlaneBufferGeometry(planeWidth, planeHeight);
  }

  updateAnimation(timeMs, frameElapsedMs) {
    if (this.adaptFramerate['measuring'] && this.firstRenderLoaded) {
      var diffs = this.adaptFramerate['frameTimes'];
      diffs.push(frameElapsedMs);
      if (diffs.length >= this.adaptFramerate['framesCollected']) {
        for (var i = 0; i < this.adaptFramerate['outliersDropped']; i++) {
          const sum = diffs.reduce((a, b) => a + b, 0);
          const avg = (sum / diffs.length);
          var maxDiff = 0;
          var maxDiffIndex = 0;
          diffs.forEach((val, i) => {
            if (Math.abs(val - avg) > maxDiff) {
              maxDiff = Math.abs(val - avg);
              maxDiffIndex = i;
            }
          });
          diffs.splice(maxDiffIndex, 1);
        }

        const sum = diffs.reduce((a, b) => a + b, 0);
        const avg = (sum / diffs.length);
        const fr = 1000 / avg;
        if (fr < this.adaptFramerate['underSpeedRatio'] * this.adaptFramerate['targetFps']) {
          var factor = Math.sqrt(fr / this.adaptFramerate['targetFps']);
          var { pixelWidth, pixelHeight } = this.getClientSize();
          if (this.adaptFramerate['renderedPixels'] > 0) {
            factor *= Math.sqrt(this.adaptFramerate['renderedPixels'] / (pixelWidth * pixelHeight));
          }
          console.debug('FPS target:', this.adaptFramerate['targetFps'], '; Scaling render dims by factor:', factor);
          const width = Math.floor(pixelWidth * factor);
          const height = Math.floor(pixelHeight * factor);
          this.updateRenderSize(width, height);
          this.adaptFramerate['renderedPixels'] = width * height;
        }
        this.adaptFramerate['measuring'] = false;
      }
    }

    // Request wait until next frame start time to be equal to
    //   frame period (1 / targetFps)
    //     minus time since start of current frame to now (frameElapsedMs)
    const waitTime = Math.max(1000 / this.adaptFramerate['targetFps'] - frameElapsedMs, 0);
    var updated = false;
    if (
      this.state.autoRotatePeriodMs &&
      (this.state.lightMotion == 'mouse' || this.state.lightMotion == 'animate')
    ) {
      updated = this.updateAutoRotate(timeMs, waitTime);
    }

    // Request another rendered frame if one wasn't requested via updateAutoRotate.
    if (this.adaptFramerate['measuring'] && !updated) {
      this.timeouts.push(setTimeout(() => this.requestRender(), waitTime));
    }
  }

  updateAutoRotate(timeMs, waitTime) {
    if (this.isVisible && (!this.mouseInCanvas || this.state.lightMotion == 'animate') && this.state.autoRotatePeriodMs) {
      this.timeouts.push(
        setTimeout(
          () => {
            var xy = new THREE.Vector2(0, 0);
            if (this.state.autoRotatePeriodMs) {
              const loopValue = (timeMs % this.state.autoRotatePeriodMs) / this.state.autoRotatePeriodMs;
              const angle = 2 * Math.PI * loopValue;
              xy.set(
                -Math.sin(angle),
                Math.cos(angle)
              );
            }
            const camSensitivity = -0.3 * this.state.autoRotateCamFactor;
            const lightSensitivity = 1.0 * this.state.autoRotateLightFactor;
            this.updateCamsAndLightsFromXY(xy, lightSensitivity, camSensitivity);
          },
          waitTime
        )
      );
      return true;
    }
    return false;
  }

  updateOverlay() {
    // Only update the texture if seams are already showing or need to be shown
    const update = (
      (this.state.showSeams || this.seamsShowing) ||
      (this.state.showGrid || this.gridShowing) ||
      (this.state.pointsControl)
    );
    if (update) {
      const prevTexture = this.uniforms.overlayMap.value;
      this.uniforms.overlayMap.value = this.createOverlayTexture(this.state.showSeams, this.state.showGrid);
      if (prevTexture) {
        prevTexture.dispose();
      }
    }
    this.overlayTexture = this.uniforms.overlayMap.value;
    this.seamsShowing = this.state.showSeams;
    this.gridShowing = this.state.showGrid;
  }

  updateStretch() {
    const texture = this.uniforms.diffuseMap.value;
    if (texture) {
      this.setTexRepeat(texture);
    }
  }

  stretchUv(uv) {
    var stretchedUv;
    const texture = this.uniforms.diffuseMap.value;
    if (texture) {
      stretchedUv = {
        x: uv.x * texture.repeat.x + texture.offset.x,
        y: uv.y * texture.repeat.y + texture.offset.y
      };
    }
    return stretchedUv ?? uv;
  }

  unstretchUv(uv) {
    var unstretchedUv;
    const texture = this.uniforms.diffuseMap.value;
    if (texture) {
      unstretchedUv = {
        x: (uv.x - texture.offset.x) / texture.repeat.x,
        y: (uv.y - texture.offset.y) / texture.repeat.y
      };
    }
    return unstretchedUv ?? uv;
  }

  updateTextureLayer() {
    this.uniforms.textureLayer.value = this.state.textureLayer;
  }

  updateTextures() {
    const magFilter = this.state.pixellated ? THREE.NearestFilter : THREE.LinearFilter;
    if (this.brdfTextures) {
      for (const tex of this.brdfTextures.values()) {
        if (tex.magFilter !== magFilter) {
          tex.magFilter = magFilter;
          tex.needsUpdate = true;
        }
      }
    }
  }

  drawDashedSegment(ctx, x0, y0, x1, y1, length, phase=1) {
    // phase: Determine starting point of dash sequence
    //   phase = 0:     Start at the start of a full dash
    //   phase [0..1):  Start with part of a dash
    //   phase = 1:     Start at the start of a full gap
    //   phase [1..2):  Start with part of a gap
    const xLen = (x1 - x0);
    const yLen = (y1 - y0);
    const lineLength = Math.sqrt(xLen * xLen + yLen * yLen);
    const step = length / lineLength;
    const dx = step * (x1 - x0);
    const dy = step * (y1 - y0);

    var strokeOn = true;
    var phase1 = phase;
    if (phase < 1) {
      ctx.moveTo(x0, y0);
    } else {
      phase1 -= 1;
      ctx.moveTo(x0 + phase1 * dx, y0 + phase1 * dy);
      strokeOn = false;
    }
    for (i = phase1 * step; i <= 1; i += step) {
      var x = x0 + (x1 - x0) * i;
      var y = y0 + (y1 - y0) * i;
      if (strokeOn) {
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
      }
      strokeOn = !strokeOn;
    }
    if (strokeOn && i > 1) {
      ctx.lineTo(x1, y1);
    }
    const phaseOut = (i - 1) * lineLength / length + (strokeOn ? 0 : 1);
    return phaseOut;
  }

  drawSeams(ctx, texDims, stretch) {
    const w = overlayTexW;
    const h = overlayTexH;
    const texSize = Math.max(texDims[0], texDims[1]); // Texture image is a square fitting texDims

    var x1, x2, y1, y2;
    if (stretch) {
      x1 = 0;
      x2 = w - 1;
      y1 = 0;
      y2 = h - 1;
    } else {
      // Seams are 1/4 and 3/4 of the way across preview textures
      const tc = texSize / 2
      const dx = texDims[0] / 4;
      const dy = texDims[1] / 4;
      x1 = Math.floor((tc - dx) * w / texSize);
      x2 = Math.ceil((tc + dx - 1) * w / texSize);
      y1 = Math.floor((tc - dy) * h / texSize);
      y2 = Math.ceil((tc + dy - 1) * h / texSize);
    }

    this.drawDashedLine(ctx, [{x: 0, y: y1}, {x: w-1, y: y1}], true);
    this.drawDashedLine(ctx, [{x: 0, y: y2}, {x: w-1, y: y2}], true);
    this.drawDashedLine(ctx, [{x: x1, y: 0}, {x: x1, y: h-1}], true);
    this.drawDashedLine(ctx, [{x: x2, y: 0}, {x: x2, y: h-1}], true);
  }


  drawDashedLine(ctx, points, wholeDashes=false, stretchFactors=[1, 1], relThickness=1.0, colour1='#FFFF', colour2='#000F') {
    const relDashLength = 8;
    var [absLineWidthX, absLineWidthY] = this.getLineWidths();
    absLineWidthX *= relThickness;
    absLineWidthY *= relThickness;
    const [ex, ey] = this.getPointRadii(absLineWidthX, absLineWidthY);
    const absDashLengthX = absLineWidthX * relDashLength / relThickness;
    const absDashLengthY = absLineWidthY * relDashLength / relThickness;
    const pMap = this.coordsToOverlay(points, stretchFactors);
    if (pMap === null) {
      return;
    }

    var dashPhase = 0;
    for (var i = 1; i < points.length; i++) {
      const x0 = pMap[i - 1].x;
      const y0 = pMap[i - 1].y;
      const x1 = pMap[i].x;
      const y1 = pMap[i].y;
      const angle = Math.atan2((y1 - y0) / ey, (x1 - x0) / ex);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const dashWidth = Math.sqrt(Math.pow(absLineWidthX * c, 2) + Math.pow(absLineWidthY * s, 2));
      var length = Math.sqrt(Math.pow(absDashLengthX * s, 2) + Math.pow(absDashLengthY * c, 2));
      if (wholeDashes) {
        const segLength = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        length = segLength / (2 * Math.round(segLength / (length * 2)));
      }

      ctx.beginPath();
      ctx.strokeStyle = colour2;
      ctx.lineWidth = dashWidth;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = colour1;
      ctx.lineWidth = dashWidth;
      dashPhase = this.drawDashedSegment(ctx, x0, y0, x1, y1, length, dashPhase);
      ctx.stroke();
    }
  }

  drawGrid(ctx, texDims, cellDims, cellOffset, stretch, color='#777F', thickness=1) {
    const stretchFactors = [
      (overlayTexW / texDims[0]) / stretch[0],
      (overlayTexH / texDims[1]) / stretch[1]
    ];
    const gridDimsStretch = [
      cellDims[0] * stretchFactors[0],
      cellDims[1] * stretchFactors[1]
    ];

    const [xs, ys] = this.getTexRepeat();
    const absLineWidthX = ys * thickness;
    const absLineWidthY = xs * thickness;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = absLineWidthX;
    var x0 = cellOffset ? cellOffset[0] * stretchFactors[0] : 0;
    var y0 = cellOffset ? cellOffset[1] * stretchFactors[1] : 0;
    x0 -= Math.floor(x0 / gridDimsStretch[0]) * gridDimsStretch[0];
    y0 -= Math.floor(y0 / gridDimsStretch[1]) * gridDimsStretch[1];
    for (var y = y0; y <= overlayTexW - 1; y += gridDimsStretch[1]) {
      ctx.moveTo(0, y); ctx.lineTo(overlayTexW - 1, y);
    }
    ctx.stroke();
    ctx.lineWidth = absLineWidthY;
    for (var x = x0; x <= overlayTexH - 1; x += gridDimsStretch[0]) {
      ctx.moveTo(x, 0); ctx.lineTo(x, overlayTexH - 1);
    }
    ctx.stroke();
  }

  drawRect(ctx, texDims, cellDims, p0, p1, stretch, color='#FFFF', thickness=1) {
    const p0Stretch = [
      cellDims[0] * overlayTexW / texDims[0] * Math.min(p0[0], p1[0]) / stretch[0],
      cellDims[1] * overlayTexH / texDims[1] * Math.min(p0[1], p1[1]) / stretch[1]
    ];
    const p1Stretch = [
      cellDims[0] * overlayTexW / texDims[0] * (Math.max(p0[0], p1[0]) + 1) / stretch[0] - 1,
      cellDims[1] * overlayTexH / texDims[1] * (Math.max(p0[1], p1[1]) + 1) / stretch[1] - 1
    ];

    const [xs, ys] = this.getTexRepeat();
    const absLineWidthX = ys * thickness;
    const absLineWidthY = xs * thickness;

    ctx.fillStyle = '#EFE2';
    ctx.fillRect(p0Stretch[0], p0Stretch[1], p1Stretch[0] - p0Stretch[0], p1Stretch[1] - p0Stretch[1]);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = absLineWidthX;
    ctx.moveTo(p0Stretch[0], p0Stretch[1]); ctx.lineTo(p1Stretch[0], p0Stretch[1]);
    ctx.moveTo(p0Stretch[0], p1Stretch[1]); ctx.lineTo(p1Stretch[0], p1Stretch[1]);
    ctx.stroke();
    ctx.lineWidth = absLineWidthY;
    ctx.moveTo(p0Stretch[0], p0Stretch[1]); ctx.lineTo(p0Stretch[0], p1Stretch[1]);
    ctx.moveTo(p1Stretch[0], p0Stretch[1]); ctx.lineTo(p1Stretch[0], p1Stretch[1]);
    ctx.stroke();
  }

  getLineWidths() {
    const diag = this.getDiag();
    if (this.camera && diag) {
      const windowFactor = 2048 / window.innerWidth;
      const distFactor = 2.5 * Math.sqrt(this.camera.position.length() / diag);
      const [xs, ys] = this.getTexRepeat();
      var texFactor = 1;
      if (this.state.texDims) {
        const maxDim = Math.max(this.state.texDims[0], this.state.texDims[1]);
        texFactor = Math.sqrt(this.untiledImDims[0] / maxDim);
      }
      const absLineWidthX = windowFactor * ys * distFactor * lineThicknessFactor * texFactor;
      const absLineWidthY = windowFactor * xs * distFactor * lineThicknessFactor * texFactor;
      return [absLineWidthX, absLineWidthY];
    } else {
      return [0, 0];
    }
  }

  getPointRadii(absLineWidthX, absLineWidthY) {
    return [pointSizeFactor * absLineWidthY, pointSizeFactor * absLineWidthX];
  }

  coordsToOverlay(points, stretchFactors=[1, 1]) {
    if (this.state.texDims && points && this.untiledImDims) {
      const td = this.state.texDims;
      var pMap = [];
      for (var i = 0; i < points.length; i++) {
        var x = ((points[i].x - td[0] / 2) / this.untiledImDims[0] + 0.5) * overlayTexW * stretchFactors[0];
        var y = ((points[i].y - td[1] / 2) / this.untiledImDims[1] + 0.5) * overlayTexH * stretchFactors[1];
        pMap.push({ x, y });
      }
      return pMap;
    } else {
      return null;
    }
  }

  coordsToWorld(points) {
    if (this.state.texDims && points && this.geometry) {
      const box = this.geometry.boundingBox;
      const uv = this.mesh.geometry.getAttribute('uv');
      const coords = this.mesh.geometry.getAttribute('position');
      if (box && uv && coords) {
        const i0 = 0;             // First UV index (assuming has minimum X,Y and U,V)
        const i1 = uv.count - 1;  // Final UV index (assuming has minimum X,Y and U,V)

        // UV min, max, and lengths
        const u0 = uv.array[i0 * uv.itemSize];
        const v0 = uv.array[i0 * uv.itemSize + 1];
        const u1 = uv.array[i1 * uv.itemSize];
        const v1 = uv.array[i1 * uv.itemSize + 1];
        const us = u1 - u0;
        const vs = v1 - v0;

        // Actual vertex min, max, and lengths
        const x0 = coords.array[i0 * coords.itemSize];
        const y0 = coords.array[i0 * coords.itemSize + 1];
        const x1 = coords.array[i1 * coords.itemSize];
        const y1 = coords.array[i1 * coords.itemSize + 1];
        const xs = x1 - x0;
        const ys = y1 - y0;

        // Three.js computed bounding box lengths
        const bxs = box.max.x - box.min.x;
        const bys = box.max.y - box.min.y;

        // Assumption: The UV space of the mesh is ~1 in the long direction,
        // and less than 1 in the short direction
        var factorX, factorY;   // X and Y scaling factors for precise mapping
        var td;                 // Effective texture dimensions for co-ordinate mapping
        if (us > vs) {
          factorX = us;
          factorY = factorX * (bxs / bys) / (xs / ys);
          td = [
            this.untiledImDims[0] * factorX,
            this.untiledImDims[1] * this.state.texDims[1] / this.state.texDims[0] * factorY
          ];
        } else {
          factorY = vs;
          factorX = factorY * (bys / bxs) / (ys / xs);
          td = [
            this.untiledImDims[0] * this.state.texDims[0] / this.state.texDims[1] * factorX,
            this.untiledImDims[1] * factorY
          ];
        }

        // Map points and return
        var pMap = [];
        for (var i = 0; i < points.length; i++) {
          var x = (points[i].x / td[0]) * xs + x0;
          var y = (1 - (points[i].y / td[1])) * ys + y0;
          pMap.push({ x, y });
        }
        return pMap;
      }
    }
    return null;
  }


  drawPoints(ctx, p, groupSelected, anySelected) {
    // groupSelected: True if the group containing p is selected
    // anySelected: True if any group is selected
    if (!p || !p.points) {
      return;
    }
    const alphaStr = (!groupSelected && anySelected) ? '7f' : 'ff';
    const numPoints = p.points.length;
    if (p.visible && numPoints > 0 && this.state.texDims) {
      const pMap = this.coordsToOverlay(p.points);
      if (pMap === null) {
        return;
      }
      const [absLineWidthX, absLineWidthY] = this.getLineWidths();
      const [ex, ey] = this.getPointRadii(absLineWidthX, absLineWidthY);

      function drawPoint(ctx, arr, i, selectedPoint=-1) {
        ctx.beginPath();
        const pointSelected = (groupSelected && i === selectedPoint);
        ctx.strokeStyle = ((pointSelected ? p.selectedColor : p.color) ?? '#ffffff') + alphaStr;
        ctx.lineWidth = (absLineWidthX + absLineWidthY) / 2;
        ctx.ellipse(arr[i].x, arr[i].y, ex, ey, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }

      function drawLineSegment(ctx, x0, y0, x1, y1, endPoints=[1, 1]) {
        const angle = Math.atan2((y1 - y0) / ey, (x1 - x0) / ex);
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const p0 = [x0 + c * ex * endPoints[0], y0 + s * ey * endPoints[0]];
        const p1 = [x1 - c * ex * endPoints[1], y1 - s * ey * endPoints[1]];
        ctx.beginPath();
        ctx.lineWidth = Math.sqrt(Math.pow(absLineWidthX * c, 2) + Math.pow(absLineWidthY * s, 2));
        ctx.strokeStyle = (p.color ?? '#ffffff') + alphaStr;
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }

      if (p.lines === 'rect' || (p.lines === 'closed4' && this.dragState.state === 'draggingRect')) {
        drawPoint(ctx, pMap, 0, this.dragState.point)
        if (numPoints > 1) {
          drawPoint(ctx, pMap, 1, this.dragState.point)
          drawLineSegment(ctx, pMap[0].x, pMap[0].y, pMap[1].x, pMap[0].y, [1, 0]);
          drawLineSegment(ctx, pMap[1].x, pMap[0].y, pMap[1].x, pMap[1].y, [0, 1]);
          drawLineSegment(ctx, pMap[1].x, pMap[1].y, pMap[0].x, pMap[1].y, [1, 0]);
          drawLineSegment(ctx, pMap[0].x, pMap[1].y, pMap[0].x, pMap[0].y, [0, 1]);
        }
      } else if (p.lines === 'closed4') {
        for (var i = 0; i < numPoints; i++) {
          drawPoint(ctx, pMap, i, this.dragState.point)
        }
        for (var i = 1; i < numPoints; i++) {
          drawLineSegment(ctx, pMap[i-1].x, pMap[i-1].y, pMap[i].x, pMap[i].y);
        }
        if (numPoints >= 4) {
          drawLineSegment(ctx, pMap[3].x, pMap[3].y, pMap[0].x, pMap[0].y);
        }
      } else if (p.lines === 'pairs') {
        for (var i = 0; i < numPoints; i++) {
          drawPoint(ctx, pMap, i, this.dragState.point)
        }
        for (var i = 0; i < Math.floor(numPoints / 2); i++) {
          drawLineSegment(ctx, pMap[i * 2].x, pMap[i * 2].y, pMap[i * 2 + 1].x, pMap[i * 2 + 1].y);
        }
      }
    }
  }

  createOverlayTexture(showSeams, showGrid) {
    const texDims = this.state.texDims; // Useful texture region

    const canvas = document.createElement('canvas');
    canvas.width = overlayTexW;
    canvas.height = overlayTexH;
    const ctx = canvas.getContext('2d');

    if (this.state.texDims && this.state.stretch) {
      if (showSeams) {
        this.drawSeams(ctx, texDims, this.state.stretch);
      }
      if (showGrid && this.state.grid) {
        if (this.state.grid) {
          this.drawGrid(ctx, texDims, this.state.grid, null, this.state.stretch, '#009F', 1);
        }
        if (this.state.gridSelection) {
          const single = (this.state.gridSelection[0] === 1 && this.state.gridSelection[1] === 1);
          if (!single || this.gridSelectionState.state === 'selecting') {
            var selectPoints = this.state.gridSelection;
            const gridPixels = [
              selectPoints[0] * this.state.grid[0],
              selectPoints[1] * this.state.grid[1]
            ]
            var gridOffset = null;
            if (this.state.gridSelection.length >= 4) {
              gridOffset = [
                selectPoints[2] * this.state.grid[0],
                selectPoints[3] * this.state.grid[1]
              ];
            }
            this.drawGrid(ctx, texDims, gridPixels, gridOffset, this.state.stretch, '#090F', 2);
          }
        }
        if (this.gridSelectionState.state !== 'none') {
          const { p0, p1 } = this.gridSelectionState;
          this.drawRect(ctx, texDims, this.state.grid, p0, p1, this.state.stretch, '#0F0F', 3);
        }
      }
    }
    if (this.state.boundary) {
      this.drawDashedLine(ctx, this.state.boundary);
    }
    if (this.state.subBoundary) {
      var stretchFactors = [1, 1];
      const { path, stretched } = this.state.subBoundary;
      if (stretched) {
        stretchFactors = [
          (overlayTexW / texDims[0]) / this.state.stretch[0],
          (overlayTexH / texDims[1]) / this.state.stretch[1]
        ];
      }
      this.drawDashedLine(ctx, path, false, stretchFactors, 0.7, '#FF0F');
    }
    if (this.state.pointsControl) {
      this.state.pointsControl.forEach((p, i) => {
        const groupSelected = ['draggingPoint', 'draggingRect', 'selected'].includes(this.dragState.state) && this.dragState.group === i;
        const anySelected = ['draggingPoint', 'draggingRect', 'selected'].includes(this.dragState.state);
        this.drawPoints(ctx, p, groupSelected, anySelected);
      });
    }

    const canvasTexture = new THREE.Texture(canvas);
    canvasTexture.flipX = false;
    canvasTexture.flipY = true;
    canvasTexture.wrapS = THREE.RepeatWrapping;
    canvasTexture.wrapT = THREE.RepeatWrapping;
    canvasTexture.needsUpdate = true;

    return canvasTexture;
  }

  getTexRepeat() {
    if (this.state.stretch) {
      var xs = initialRepeatFactorX;
      var ys = initialRepeatFactorX * this.state.stretch[0] / this.state.stretch[1];
      if (this.state.userScale) {
        xs *= this.state.userScale;
        ys *= this.state.userScale;
      }
      return [xs, ys];
    } else {
      return [1, 1];
    }
  }

  setTexRepeat(texture) {
    // Set texture repeat
    if (this.state.stretch) {
      const [xs, ys] = this.getTexRepeat();
      texture.repeat.set(xs, ys);
      texture.offset.set((1 - xs) / 2, (1 - ys) / 2);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.updateMatrix();
    }
  }

  updateUniforms() {
    this.uniforms.uExposure.value = this.exposureGain * this.state.exposure;
    this.uniforms.uBrightness.value = this.state.brightness;
    this.uniforms.uContrast.value = this.state.contrast;
    this.uniforms.uDiffuse.value = this.state.diffuse;
    this.uniforms.uSpecular.value = this.state.specular;
    this.uniforms.uRoughness.value = this.state.roughness;
    this.uniforms.uTint.value = this.state.tint;
    this.uniforms.uFresnel.value = this.state.fresnel;
    this.uniforms.uColorTransform.value = this.state.colorTransform;
    this.uniforms.uHue.value = this.state.hue;
    this.uniforms.uSaturation.value = this.state.saturation;
    this.uniforms.uThreeJsShader.value = this.state.threeJsShader;
    this.uniforms.uBrdfModel.value = this.state.brdfModel;
    this.uniforms.uBrdfVersion.value = this.state.brdfVersion;
    this.uniforms.uLoadExr.value = (this.config.textureFormat == 'EXR');
    this.uniforms.uDual8Bit.value = this.config.dual8Bit;

    // Set up look-up tables for area lighting.  Do it once for the first frame,
    // regardless of whether area lights are in use yet.
    if (!this.areaLightSetupDone) {
      // If a browser doesn't support OES_texture_float_linear, but it does support
      // OES_texture_half_float_linear, then we can grab LTC_HALF_[1|2] here instead
      // of full floats.  Currently no such devices are known; previously iOS 14 had
      // this problem.
      this.uniforms.ltc_1.value = THREE.UniformsLib.LTC_FLOAT_1;
      this.uniforms.ltc_2.value = THREE.UniformsLib.LTC_FLOAT_2;
      THREE.UniformsLib.LTC_FLOAT_1.needsUpdate = true;
      THREE.UniformsLib.LTC_FLOAT_2.needsUpdate = true;
      this.areaLightSetupDone = true;
    }

    const uvScaleMap = this.uniforms.diffuseMap.value;
    if (uvScaleMap) {
      this.uniforms.uvTransform.value.copy(uvScaleMap.matrix);
    }
    // Turn on ambient occlusion only if viewing full render (not an individual texture layer)
    this.uniforms.uAoStrength.value = (this.uniforms.textureLayer.value === 0) ? this.state.aoStrength : 0;
  }

  render(timeMs) {
    if (this.shutdownRequested) {
        this.doShutdown();
    } else if (this.controls && this.composer) {
      if (this.stats) {
        this.stats.begin();
      }
      const frameStartTimeMs = Date.now();

      // Call update functions according to which dirty flag bits are set
      if (this.state.dirty !== 0) {
        Object.values(DirtyFlag).forEach((b, i) => {
          if (this.state.dirty & b) {
            this.state.dirty &= ~b;
            this.DirtyFlagFuncs[i]();
          }
        });
      }

      this.renderLoopUpdateCanvas();

      this.controls._targetEnd.z = 0 // Avoid centre of rotation floating above or below the shimmer
      const delta = this.clock.getDelta();
      const controlsUpdate = this.controls.update(delta);
      this.wheelInProgress = false;

      this.updateUniforms();
      this.composer.render();

      this.renderRequested = false;

      if (
        controlsUpdate && this.isVisible &&
        !((!this.mouseInCanvas || this.state.lightMotion == 'animate') && this.state.autoRotatePeriodMs)
      ) {
        this.requestRender();
      }

      if (this.stats) {
        this.stats.end();
      }

      const frameEndTimeMs = Date.now();
      const frameTimeMs = frameEndTimeMs - frameStartTimeMs;
      this.updateAnimation(frameEndTimeMs, frameTimeMs);
    }
  }

  // Request a render frame only if a request is not already pending.
  requestRender() {
    // Note that requestRender can be called as an event handler in which case
    // some methods might not be attached to 'this'.  In the event handler case,
    // the full screen check is not required.
    if (this.checkChangeFullScreen) {
      this.checkChangeFullScreen();
    }

    if (!this.renderRequested && this.render) {
      this.renderRequested = true;
      requestAnimationFrame(this.render.bind(this));
    }
  }

  checkChangeFullScreen() {
    if (this.controls && this.config.mouseCamControlsZoom) {
      if (this.isFullScreen() && !this.inFullScreen) {
        // Entering full screen
        this.inFullScreen = true;
        this.controls.enableZoom = true;
        // TODO: Clear help immediately when exiting full screen
        //       (difficult with current code structure)
      } else if (!this.isFullScreen() && this.inFullScreen) {
        // Exiting full screen
        this.inFullScreen = false;
        if (this.opts.featured !== true) {
          this.controls.enableZoom = false;
        }
      }
    }
  }

  checkWebGL() {
    if (WebGL.isWebGLAvailable() === false) {
      document.body.appendChild(WebGL.getWebGLErrorMessage());
    }
  }

  setDiag() {
    var diag = 0;
    if (this.geometry) {
      const box = this.geometry.boundingBox;
      if (box) {
        const x = box.max.x - box.min.x;
        const y = box.max.y - box.min.y;
        diag = Math.sqrt(x * x + y * y);
      }
    }
    this.diag = diag;
  }

  getDiag() {
    return this.diag;
  }

  getMeshPathUsed() {
    return this.meshPathUsed;
  }

  resetCameraAngle() {
    if (this.camera && this.state && this.controls) {
      const target = this.controls.getTarget();
      this.controls.setPosition(target.x, target.y, this.camera.position.z);

      // FIXME: fitToBox() produces NaNs in the position
      // if (this.geometry) {
      //   this.controls.fitToBox(this.geometry.boundingBox);
      // }

      this.requestRender();
    }
  }

  insertContainerAndOverlay() {
    if (this.canvas !== null) {
      this.canvasParent = this.canvas.parentElement;
      this.container = document.createElement('div');
      this.overlay = document.createElement('div');
      this.container.appendChild(this.canvas);
      this.container.appendChild(this.overlay);  // Overlay goes on top (for visibility, and because mouse listeners attach to overlay)
      this.canvasParent.appendChild(this.container);
    } else {
      console.warn('canvas element ID not found:', this.opts.canvasID);
    }
  }

  removeContainerAndOverlay() {
    this.container.removeChild(this.overlay);
    this.canvasParent.removeChild(this.container);
    this.canvasParent.appendChild(this.canvas);
  }

  registerEventListener(object, type, listener, ...args) {
    if (object) {
      object.addEventListener(type, listener, ...args);
      this.listeners.push({ object, type, listener });
    }
  }

  registerElement(document, tagName) {
    const element = document.createElement(tagName);
    this.elements.push(element);
    return element;
  }

  disposeTextures() {
    if (this.brdfTextures) {
      for (const tex of this.brdfTextures.values()) {
        if (tex) {
          tex.dispose();
        }
      }
      this.brdfTextures = null;
    }
    if (this.overlayTexture) {
      this.overlayTexture.dispose();
      this.overlayTexture = null;
    }
  }

  disposeMesh() {
    if (this.mesh) {
      this.mesh.traverse(
        function(child) {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        }
      );
      this.mesh = null;
    }
  }

  disposeMeshCache() {
    if (this.meshCache) {
      for (const [key, mesh] of Object.entries(this.meshCache)) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.meshCache = {};
    }
  }

  shutdown(shutdownCompleteCallback) {
    // console.debug(`shutdown() ${this.opts.canvasID}`);
    this.shutdownRequested = true;
    this.shutdownCompleteCallback = shutdownCompleteCallback;
    setTimeout(() => {
      this.doShutdown();
    }, 1000);
  }

  doShutdown() {
    if (!this.shutdownStarted) {
      console.debug(`doShutdown() ${this.opts.canvasID}`);
      if (this.renderer) {
        // console.debug(`doShutdown() START renderer.info.memory ${JSON.stringify(this.renderer.info.memory)}`);
      }

      this.shutdownStarted = true;
      this.controls.dispose();

      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

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

      this.disposeTextures();
      this.disposeMesh();
      this.disposeMeshCache();
      this.scene = null;
      this.camera = null;
      if (this.renderer) {
        console.debug(`doShutdown() END renderer.info.memory ${JSON.stringify(this.renderer.info.memory)}`);
        this.renderer.dispose();
        this.renderer = null;
      }

      this.removeContainerAndOverlay();
      this.canvas = null;
      this.overlay = null;
      this.container = null;

      if (this.shutdownCompleteCallback) {
        // console.debug('Calling shutdownCompleteCallback()');
        this.shutdownCompleteCallback();
        this.shutdownCompleteCallback = null;
      }
    }
  }
}


export default bivotJs;
