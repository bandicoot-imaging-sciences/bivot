import React, { useState, useRef, useEffect } from 'react'
import { Paper, Grid, CircularProgress } from '@material-ui/core';

import Bivot from './bivot-js/bivot';
import IntensityControl from './controls/IntensityControl';
import BrightnessControl from './controls/BrightnessControl';
import ContrastControl from './controls/ContrastControl';
import LightTypeControl from './controls/LightTypeControl';
import MaterialRotationControl from './controls/MaterialRotationControl';
import OrientationControl from './controls/OrientationControl';
import ZoomControl from './controls/ZoomControl';
import SaveButton from './controls/SaveButton';
import ResetButton from './controls/ResetButton';
import LightColorControl from './controls/LightColorControl';
import BackgroundColorControl from './controls/BackgroundColorControl';

import { useWindowSize, useScripts } from './utils/hooksLib';
import { jsonToState, copyStateFields } from './utils/stateUtils';
import { loadJsonFile } from './utils/jsonLib';
import { getDelta } from './utils/arrayLib';
import { rgbArrayToColorObj, rgbArrayToHexString, rgbHexValToColorObj } from './utils/colorLib';


const styles = {
  bivotOverlay: {
    textAlign: "center",
    margin: "0.5em",
  },
  loadingOverlay: {
    position: "absolute",
    bottom: "50%",
    left: "50%",
    zIndex: "999",
  },
  controlPanel: {
    width: 320,
    padding: "0.5em",
  },
};

export const externalScripts = [
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/build/three.min.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/controls/OrbitControls.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/loaders/EXRLoader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/loaders/OBJLoader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/WebGL.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/libs/stats.min.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/postprocessing/EffectComposer.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/postprocessing/RenderPass.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/postprocessing/ShaderPass.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/postprocessing/UnrealBloomPass.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/postprocessing/AdaptiveToneMappingPass.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/CopyShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/FXAAShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/ToneMapShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/LuminosityShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/LuminosityHighPassShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/shaders/GammaCorrectionShader.js",
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r108/examples/js/lights/RectAreaLightUniformsLib.js",
  "https://cdn.jsdelivr.net/gh/dataarts/dat.gui@v0.7.6/build/dat.gui.min.js",
];

var zoomIndex = -1; // Index of the current zoom slider being moved
var zoomInitialVal = [0, 0, 0]; // [min, initial, max] zoom at the beginning of the current slider move

function BivotReact(props) {
  const {
    id,
    width,
    height,
    material,
    config,
    showEditor,
    fetchFiles,
    writeState,
    scriptsLoaded,
    onClick,
    autoRotate
  } = props;

  const canvasRef = useRef();
  const overlayRef = useRef();
  const bivot = useRef(null);

  const canvasID = `${id}-canvas`;
  const overlayID = `${id}-overlay`;

  const windowLongLength = width > height ? width : height;
  const windowShortLength = width <= height ? width : height;

  const [initialState, _setInitialState] = useState({});
  const [state, _setState] = useState({
    exposure: 1.0,
    brightness: 0.5,
    contrast: 0.5,
    lightType: 'point',
    meshRotateZDegrees: 0,
    portrait: false,
    canvasWidth: 0,
    canvasHeight: 0,
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.3, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    // focalLength: 85,
    // diffuse: 1.0,
    // specular: 1.0,
    // roughness: 1.0,
    // tint: true,
    // fresnel: false,
    // ambient: 1.0,
    // fxaa: true,
    // bloom: 0.1,
    // adaptiveToneMap: false,
    // toneMapDarkness: 0.04,
    // gammaCorrect: true,
    // threeJsShader: true,
    // areaLightWidth: 5.0,
    // areaLightHeight: 0.2,
    // lightMotion: 'mouse',
    // lightColor: new THREE.Color(1, 1, 1),
    // lightPosition: new THREE.Vector3(0, 0, 1),
    // // Offset light controls by this vector. In screen co-ords: x-axis points right and y-axis points up.
    // lightPositionOffset: new THREE.Vector2(0, 0),
    // lightNumber: 1,
    // lightSpacing: 0.5,
    // light45: false,
    // scan: 'kimono 2k',
    // brdfModel: 1,
    // brdfVersion: 2,
    // yFlip: true,
    // background: 0x05,
    // camTiltWithMousePos: 0.0,  // Factor to tilt camera based on mouse position (-0.1 is good)
    // camTiltWithDeviceOrient: 0.0,  // Factor to tilt camera based on device orientation (0.6 is good)
    // camTiltLimitDegrees: 0.0, // Lowest elevation angle (in degrees) that the camera can tilt to.
    // lightTiltWithMousePos: 1.0,  // Factor to tilt light based on mouse position
    // lightTiltWithDeviceOrient: 1.0,  // Factor to tilt light based on device orientation
    // lightTiltLimitDegrees: 0.0, // Lowest elevation angle (in degrees) that the light can tilt to.
    // // Speed of device baseline drift towards current tilt, when current tilt elevation is lower than
    // // camTiltLimitDegrees or lightTiltLimitDegrees.
    // tiltDriftSpeed: 1.0,
    // tiltZeroOnMouseOut: false, // If true, reset the tilt to zero when the mouse moves out of the window.
    // _camPositionOffset: new THREE.Vector2(0, 0),
    // _meshRotateZDegreesPrevious: 0,
    // _statusText: ''
  });

  if (config) {
    jsonToState(config.initialState, state);
  }

  if (autoRotate) {
    state['autoRotatePeriodMs'] = 8000;
  }

  const windowSize = useWindowSize(onWindowSizeChanged);

  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [materialSet, setMaterialSet] = useState({});
  const [scriptsLoadedInternal, setScriptsLoadedInternal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Set up GUI state.  Each control has a corresponding useState declaration,
  // and a corresponding assignment into the state object.
  const [exposure, setExposure] = useState(state.exposure);
  const [brightness, setBrightness] = useState(state.brightness);
  const [contrast, setContrast] = useState(state.contrast);
  const [lightType, setLightType] = useState(state.lightType);
  const [rotation, setRotation] = useState(state.meshRotateZDegrees);
  const [portrait, setPortrait] = useState(false); // Only update portrait after bivot loads
  const [zoom, setZoom] = useState(state.zoom);
  const [currentZoom, setCurrentZoom] = useState(state.currentZoom);
  // Bivot state expects 3-value array for light colour, but the control needs an object or hex value.
  // So we have to track bivot light colour and control light colour in separate values.
  const [lightColorBivot, setLightColorBivot] = useState(state.lightColor);
  const [lightColorControls, setLightColorControls] = useState(rgbArrayToHexString(state.lightColor));
  const [backgroundColor, setBackgroundColor] = useState(state.backgroundColor);

  state.exposure = exposure;
  state.brightness = brightness;
  state.contrast = contrast;
  state.lightType = lightType;
  state.meshRotateZDegrees = rotation;
  state.portrait = portrait;
  state.zoom = zoom;
  state.currentZoom = currentZoom;
  state.lightColor = lightColorBivot;
  state.backgroundColor = backgroundColor;

  async function onLoad() {
    loadBivot();
    if (onClick) {
      const context = canvasRef.current.getContext('webgl');
      context.canvas.addEventListener('click', onClick, false);
    }
  }

  useEffect(() => {
    // Load bivot once script dependencies are loaded externally or externally
    if (scriptsLoaded || scriptsLoadedInternal) {
      onLoad();
    }
  }, [scriptsLoaded, scriptsLoadedInternal]);

  useEffect(() => {
    return () => {
      if (bivot.current) {
        bivot.current.shutdown();
        bivot.current = null;
      }
    };
  }, []);

  if (scriptsLoaded !== true && scriptsLoaded !== false) {
    console.log('Loading scripts internally');
    useScripts(externalScripts, () => setScriptsLoadedInternal(true));
  }

  function getMatFromMatSet(materialSet, materialIndex=0) {
    const gallery = materialSet.materials[materialIndex].gallery;
    return gallery[gallery.length - 1]; // Only use last gallery Material in the array
  }

  function getIdFromMatSet(materialSet, materialIndex=0) {
    return materialSet.materials[materialIndex].materialId;
  }

  async function loadBivot() {
    var configPath;
    var renderPath;
    var texturePath;
    var galleryMat;
    var textures;

    if (material && fetchFiles) {
      const { userId, materialUserPath } = material;

      // Fetch the MaterialSet file and isolate the GalleryMaterial from it
      const fileUserPaths = { 'ms': materialUserPath };
      const url = await fetchFiles(userId, fileUserPaths);
      const ms = await loadJsonFile(url['ms']);
      galleryMat = getMatFromMatSet(ms)
      setMaterialSet(ms);

      // Fetch texture files
      var texUserPaths = {};
      const materialId = getIdFromMatSet(ms);
      for (var k in galleryMat.textures) {
        texUserPaths[k] = `gallery/${materialId}/biv_gallery/textures/0/${galleryMat.textures[k]}`;
      }
      textures = await fetchFiles(userId, texUserPaths);
    } else {
      // material + callback not provided; expect local textures
      renderPath = 'bivot-renders.json';
      texturePath = 'textures';
    }

    if (!config) {
      configPath = 'bivot-config.json';
    }

    const options = {
      width,
      height,
      configPath,
      renderPath,
      texturePath,
      textures,
      material: galleryMat,
      config,
      state,
      stateLoadCallback,
      setZoomCallback: setCurrentZoom,
      canvasID,
      overlayID
    }
    //console.log(options);
    bivot.current = new Bivot(options);
    bivot.current.checkWebGL();
    bivot.current.startRender();
    copyStateFields(state, initialState);
    setLoading(false);
  }

  async function updateStateFields(stateFields) {
    // Take the values out of stateFields before setting them in state.
    const {
      exposure,
      brightness,
      contrast,
      portrait,
      meshRotateZDegrees,
      lightType,
      zoom,
      lightColor,
      backgroundColor
    } = stateFields;

    updateExposure(exposure);
    updateBrightness(brightness);
    updateContrast(contrast);
    updateLightType(lightType);
    updateRotation(meshRotateZDegrees);
    updatePortrait(portrait);
    setZoom(zoom);
    setCurrentZoom(zoom[1]);
    updateLightColor(rgbArrayToColorObj(lightColor));
    updateBackgroundColor({ hex: backgroundColor });

    if (bivot.current) {
      renderFrame(true);
    }
  }

  //
  // Called when bivot loads config from a file not known to BivotReact,
  // for the purpose of updating the BivotReact GUI state.
  //
  async function stateLoadCallback(loadedState) {
    updateStateFields(loadedState);
    copyStateFields(loadedState, initialState);
  }

  function stateSave() {
    const { gallery } = materialSet.materials[0]
    const galleryMat = gallery[gallery.length - 1];
    const config = galleryMat.config.renders['0'];

    config.state.exposure = exposure;
    config.state.brightness = brightness;
    config.state.contrast = contrast;
    config.state.lightType = lightType;
    config.state.meshRotateZDegrees = rotation;
    config.state.portrait = portrait;
    config.state.zoom = zoom;
    config.state.lightColor = lightColorBivot;
    config.state.backgroundColor = backgroundColor;

    const { userId, materialId } = material;
    const success = writeState(userId, materialId, materialSet);
    if (success) {
      alert("Material saved");
      copyStateFields(config.state, initialState);
    } else {
      alert("Something went wrong.  The Material might not have been saved.");
    }
  }

  function stateReset() {
    updateStateFields(initialState);
  }

  function renderFrame(stateDirty) {
    if (stateDirty) {
      state.dirty = true;
    }
    if (bivot.current) {
      bivot.current.requestRender();
    }
  }

  function updateExposure(val) {
    setExposure(val);
    renderFrame(false);
  }

  function updateBrightness(val) {
    setBrightness(val);
    renderFrame(false);
  }

  function updateContrast(val) {
    setContrast(val);
    renderFrame(false);
  }

  function updateLightType(val) {
    setLightType(val);
    renderFrame(true);
  }

  function updateRotation(degrees) {
    setRotation(degrees);
    renderFrame(true);
  }

  function addRotation(degrees) {
    updateRotation((rotation + degrees + 360) % 360);
  }

  function updatePortrait(event) {
    var toPortrait;
    if (event === true || event === false) {
      toPortrait = event;
    } else {
      toPortrait = event.target.checked;
    }

    if (toPortrait != portrait) {
      setPortrait(toPortrait);
      let context = canvasRef.current.getContext('webgl');
      context.canvas.width = pixelRatio * orientationAwareWidth(toPortrait);
      context.canvas.height = pixelRatio * orientationAwareHeight(toPortrait);
      renderFrame(true);
    }
  }

  function updateZoom(val) {
    if (zoomIndex == -1) {
      const index = getDelta(zoom, val);
      if (index >= 0) {
        // Set the index being moved
        zoomIndex = index;
        zoomInitialVal = val.slice();
      }
    }

    if (zoomIndex != -1) {
      // Don't let any slider move except the active one
      for (i = 0; i < val.length; i++) {
        if (i != zoomIndex) {
          val[i] = zoomInitialVal[i];
        }
      }
      // Don't let the active slider overtake an adjacent slider
      if (zoomIndex < val.length - 1) {
        val[zoomIndex] = Math.min(val[zoomIndex], val[zoomIndex + 1]);
      }
      if (zoomIndex > 0) {
        val[zoomIndex] = Math.max(val[zoomIndex], val[zoomIndex - 1]);
      }

      setZoom(val);
      setCurrentZoom(val[zoomIndex]);
      renderFrame(true);
    }
  }

  function updateZoomFinished() {
    zoomIndex = -1;
  }

  function updateLightColor(val) {
    setLightColorControls(val.hex); // Controls: needs a hex value
    setLightColorBivot([val.rgb.r, val.rgb.g, val.rgb.b]); // Bivot state: needs RGB array
    renderFrame(true);
  }

  function updateBackgroundColor(val) {
    setBackgroundColor(val.hex);
    renderFrame(true);
  }

  function orientationAwareWidth(isPortrait) {
    return isPortrait ? windowShortLength : windowLongLength;
  }

  function orientationAwareHeight(isPortrait) {
    return isPortrait ? windowLongLength : windowShortLength;
  }

  function onWindowSizeChanged(size) {
    console.log('Window was resized:', size);
    // TODO:  Conditionally resize the bivot canvas on this event
  }

  return (
    <div
      ref={overlayRef}
      id={overlayID}
      style={styles.bivotOverlay}
    >
      <Grid container spacing={2}>
        {showEditor && (
          <Grid item>
            <Paper style = {styles.controlPanel}>
              <IntensityControl value={exposure} onChange={updateExposure} />
              <BrightnessControl value={brightness} onChange={updateBrightness} />
              <ContrastControl value={contrast} onChange={updateContrast} />
              <LightTypeControl value={lightType} onChange={updateLightType} />
              <MaterialRotationControl value={rotation} onChange={addRotation} />
              <OrientationControl value={portrait} onChange={updatePortrait} />
              <ZoomControl value={zoom} onChange={updateZoom} onChangeCommitted={updateZoomFinished} />
              <LightColorControl value={lightColorControls} onChange={updateLightColor} />
              <BackgroundColorControl value={backgroundColor} onChange={updateBackgroundColor} />
              <Grid container spacing={2}>
                <SaveButton onChange={stateSave} />
                <ResetButton onChange={stateReset} />
              </Grid>
            </Paper>
          </Grid>
        )}
        <Grid item>
          {loading && (
            <div style={styles.loadingOverlay}><CircularProgress /></div>
          )}
          <canvas
            ref={canvasRef}
            id={canvasID}
            className='bivot-canvas'
            width={pixelRatio * orientationAwareWidth(state.portrait)}
            height={pixelRatio * orientationAwareHeight(state.portrait)}
          />
        </Grid>
      </Grid>
    </div>
  );
}

export default BivotReact;
