import React, { useState, useRef, useEffect } from 'react';
import { Paper, Grid, CircularProgress } from '@material-ui/core';

import Bivot from './bivot-js/bivot';
import { jsonToState, copyStateFields } from './bivot-js/stateUtils';

import IntensityControl from './controls/IntensityControl';
import BrightnessControl from './controls/BrightnessControl';
import ContrastControl from './controls/ContrastControl';
import LightTypeControl from './controls/LightTypeControl';
import MaterialRotationControl from './controls/MaterialRotationControl';
import OrientationControl from './controls/OrientationControl';
import ZoomControl from './controls/ZoomControl';
import SaveButton from './controls/SaveButton';
import ResetButton from './controls/ResetButton';
import FullscreenButton from './controls/FullscreenButton';
import LightColorControl from './controls/LightColorControl';
import BackgroundColorControl from './controls/BackgroundColorControl';
import AutoRotateControl from './controls/AutoRotateControl';
import DragControl from './controls/DragControl';

import { useWindowSize } from './utils/hooksLib';
import { loadJsonFile } from './utils/jsonLib';
import { getDelta } from './utils/arrayLib';
import { rgbArrayToColorObj, rgbArrayToHexString } from './utils/colorLib';


const styles = {
  bivotGridOverlay: {
    textAlign: 'center',
    margin: '0.5em',
  },
  loadingGridOverlay: {
    position: 'absolute',
    bottom: '50%',
    left: '50%',
    zIndex: '999',
  },
  controlPanel: {
    width: 325,
    padding: '0.5em',
  },
  grow: {
    flexGrow: 1,
  },
};

var zoomIndex = -1; // Index of the current zoom slider being moved
var zoomInitialVal = [0, 0, 0]; // [min, initial, max] zoom at the beginning of the current slider move

function BivotReact(props) {
  const {
    id,
    width,
    height,
    material,
    thumbnail,
    config,
    showEditor,
    showAdvancedControls,
    fetchFiles,
    writeState,
    onClick,
    onSaveScreenshot,
    autoRotate
  } = props;

  const canvasRef = useRef();
  const overlayRef = useRef();
  const bivot = useRef(null);

  const canvasID = `${id}-canvas`;
  const overlayID = `${id}-overlay`;

  const propsPortrait = height >= width;
  const windowLongLength = propsPortrait ? height : width;
  const windowShortLength = propsPortrait ? width : height;

  const referenceAreaLightWidth = 5;
  const referenceAreaLightHeight = 0.2;

  // FIXME: Find a sensible way to not have to duplicate the initial / default state object
  const defaultState = {
    exposure: 1.0,
    brightness: 0.5,
    contrast: 0.5,
    lightType: 'point',
    areaLightWidth: referenceAreaLightWidth,
    areaLightHeight: referenceAreaLightHeight,
    meshRotateZDegrees: 0,
    portrait: propsPortrait,
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.3, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',

    // State to be saved for the bivot render for which there aren't controls
    dragControlsRotation: false,
    dragControlsPanning: false,
    camTiltWithMousePos: -0.2,
    camTiltWithDeviceOrient: 0.6,
    camTiltLimitDegrees: 0.0,
    lightTiltWithMousePos: 1.0,
    lightTiltWithDeviceOrient: 1.0,
    lightTiltLimitDegrees: 0.0,
    autoRotatePeriodMs: 8000,
    autoRotateFps: 30,
    autoRotateCamFactor: 0.5,
    autoRotateLightFactor: 0.9,
  };
  const [state, _setState] = useState({
    exposure: 1.0,
    brightness: 0.5,
    contrast: 0.5,
    lightType: 'point',
    areaLightWidth: referenceAreaLightWidth,
    areaLightHeight: referenceAreaLightHeight,
    meshRotateZDegrees: 0,
    portrait: propsPortrait,
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.3, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',

    // State to be saved for the bivot render for which there aren't controls
    dragControlsRotation: false,
    dragControlsPanning: false,
    camTiltWithMousePos: -0.2,
    camTiltWithDeviceOrient: 0.6,
    camTiltLimitDegrees: 0.0,
    lightTiltWithMousePos: 1.0,
    lightTiltWithDeviceOrient: 1.0,
    lightTiltLimitDegrees: 0.0,
    autoRotatePeriodMs: 8000,
    autoRotateFps: 30,
    autoRotateCamFactor: 0.5,
    autoRotateLightFactor: 0.9,
  });
  const [checkpointState, _setCheckpointState] = useState({});

  if (config) {
    jsonToState(config.initialState, defaultState);
  }

  // If autoRotate is set in props, then override state after loading config
  if (autoRotate === true) {
    state.autoRotatePeriodMs = 8000;
  } else if (autoRotate === false) {
    state.autoRotatePeriodMs = 0;
  }

  const windowSize = useWindowSize(onWindowSizeChanged);

  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [materialSet, setMaterialSet] = useState({});
  const [loading, setLoading] = useState(true);
  const [diag, setDiag] = useState(0.25);

  // Set up GUI state.  Each control has a corresponding useState declaration,
  // and a corresponding assignment into the state object.
  const [exposure, setExposure] = useState(state.exposure);
  const [brightness, setBrightness] = useState(state.brightness);
  const [contrast, setContrast] = useState(state.contrast);
  const [lightType, setLightType] = useState(state.lightType);
  const [areaLightWidth, setAreaLightWidth] = useState(state.areaLightWidth);
  const [areaLightHeight, setAreaLightHeight] = useState(state.areaLightHeight);
  const [rotation, setRotation] = useState(state.meshRotateZDegrees);
  const [portrait, setPortrait] = useState(propsPortrait);
  const [zoom, setZoom] = useState(state.zoom);
  const [currentZoom, setCurrentZoom] = useState(state.currentZoom);
  // Bivot state expects 3-value array for light colour, but the control needs an object or hex value.
  // So we have to track bivot light colour and control light colour in separate values.
  const [lightColorBivot, setLightColorBivot] = useState(state.lightColor);
  const [lightColorControls, setLightColorControls] = useState(rgbArrayToHexString(state.lightColor));
  const [backgroundColor, setBackgroundColor] = useState(state.backgroundColor);
  const [autoRotatePeriodMs, setAutoRotatePeriodMs] = useState(state.autoRotatePeriodMs);
  const [dragControlsRotation, setDragControlsRotation] = useState(state.dragControlsRotation);
  const [dragControlsPanning, setDragControlsPanning] = useState(state.dragControlsPanning);

  state.exposure = exposure;
  state.brightness = brightness;
  state.contrast = contrast;
  state.lightType = lightType;
  state.areaLightWidth = areaLightWidth;
  state.areaLightHeight = areaLightHeight;
  state.meshRotateZDegrees = rotation;
  state.portrait = portrait;
  state.zoom = zoom;
  state.currentZoom = currentZoom;
  state.lightColor = lightColorBivot;
  state.backgroundColor = backgroundColor;
  state.autoRotatePeriodMs = autoRotatePeriodMs;
  state.dragControlsRotation = dragControlsRotation;
  state.dragControlsPanning = dragControlsPanning;

  async function onLoad() {
    loadBivot();
    if (onClick) {
      canvasRef.current.addEventListener('click', onClick, false);
    }
  }

  // Load bivot
  useEffect(() => {
    onLoad();
  }, []);

  // Update bivot when the whole material changes
  useEffect(() => {
    // FIXME: Test whether this succeeds in the scenario where
    //        bivot has started loading but not finished loading
    async function onChangeMaterial() {
      if (bivot.current) {
        bivot.current.shutdown();
        updateStateFields(defaultState);
        onLoad();
      }
    }
    onChangeMaterial();
  }, [material]);

  useEffect(() => {
    // Todo: Update canvas size
  }, [width, height]);


  // Shut down bivot when the component closes
  useEffect(() => {
    return () => {
      if (bivot.current) {
        bivot.current.shutdown();
        bivot.current = null;
      }
    };
  }, []);

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
      if (!ms) {
        return false;
      }
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

    // Pre-check portrait flag, to avoid sizing issues while loading
    var initWidth = width;
    var initHeight = height;
    if (galleryMat.config.renders[galleryMat.name].state.portrait) {
      initWidth = height;
      initHeight = width;
      updatePortrait(true);
    }

    const options = {
      width: initWidth,
      height: initHeight,
      configPath,
      renderPath,
      texturePath,
      textures,
      material: galleryMat,
      thumbnail,
      config,
      state,
      stateLoadCallback,
      loadingCompleteCallback,
      setZoomCallback: setCurrentZoom,
      canvasID,
      overlayID
    }
    //console.log(options);
    bivot.current = new Bivot(options);
    bivot.current.checkWebGL();
    bivot.current.startRender();

    copyStateFields(state, checkpointState);
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
      areaLightWidth,
      //areaLightHeight,
      zoom,
      lightColor,
      backgroundColor,
      autoRotatePeriodMs,
      dragControlsRotation,
      dragControlsPanning
    } = stateFields;

    updateExposure(exposure);
    updateBrightness(brightness);
    updateContrast(contrast);
    updateLightType(lightType, areaLightWidth / referenceAreaLightWidth);
    updateRotation(meshRotateZDegrees);
    updatePortrait(portrait);
    setZoom(zoom);
    setCurrentZoom(zoom[1]);
    updateLightColor(rgbArrayToColorObj(lightColor));
    updateBackgroundColor({ hex: backgroundColor });
    updateAutoRotate(autoRotatePeriodMs);
    updateDragControl('rotate', dragControlsRotation);
    updateDragControl('pan', dragControlsPanning);

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
    copyStateFields(loadedState, checkpointState);
  }

  // Called when bivot finishes loading the material.
  async function loadingCompleteCallback() {
    if (bivot.current) {
      console.log('Bivot loading complete');
      setDiag(bivot.current.getDiag());
    }
  }

  async function stateSave(callback) {
    if (callback) {
      // Grab a capture of the canvas and send it to the callback
      await canvasRef.current.toBlob(callback, 'image/jpeg');
    }

    const { gallery } = materialSet.materials[0]
    const galleryMat = gallery[gallery.length - 1];
    const config = galleryMat.config.renders['0'];

    const {
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor,
     } = state;

    const savedState = {
      exposure, brightness, contrast, portrait, zoom, backgroundColor, autoRotatePeriodMs,
      lightType, areaLightWidth, areaLightHeight,
      meshRotateZDegrees: rotation,
      lightColor: lightColorBivot,
      dragControlsRotation, dragControlsPanning,
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor,
    }

    config.state = { ...config.state, ...savedState };

    const { userId, materialId } = material;
    const success = await writeState(userId, materialId, materialSet);
    if (success) {
      copyStateFields(config.state, checkpointState);
    }
  }

  function stateReset() {
    updateStateFields(checkpointState);
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

  function updateLightType(type, size) {
    setLightType(type);
    setAreaLightWidth(referenceAreaLightWidth * size);
    setAreaLightHeight(referenceAreaLightHeight * size);
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
    const canvas = canvasRef.current;
    const canvasPortrait = (canvas.height > canvas.width);
    if (toPortrait != canvasPortrait) {
      setPortrait(toPortrait);
      canvas.width = pixelRatio * orientationAwareWidth(toPortrait);
      canvas.height = pixelRatio * orientationAwareHeight(toPortrait);
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

  function updateAutoRotate(val) {
    setAutoRotatePeriodMs(val);
    renderFrame(true);
  }

  function updateDragControl(field, val) {
    if (field == 'rotate') {
      setDragControlsRotation(val);
    } else if (field == 'pan') {
      setDragControlsPanning(val);
    }
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
      style={styles.bivotGridOverlay}
    >
      <Grid container spacing={2}>
        {showEditor && (
          <Grid item>
            <Paper style = {styles.controlPanel}>
              <IntensityControl value={exposure} onChange={updateExposure} />
              <BrightnessControl value={brightness} onChange={updateBrightness} />
              <ContrastControl value={contrast} onChange={updateContrast} />
              <LightTypeControl type={lightType} size={areaLightWidth / referenceAreaLightWidth} onChange={updateLightType} />
              <MaterialRotationControl value={rotation} onChange={addRotation} />
              <OrientationControl value={portrait} onChange={updatePortrait} />
              <ZoomControl value={zoom} max={diag * 4} onChange={updateZoom} onChangeCommitted={updateZoomFinished} />
              <LightColorControl value={lightColorControls} onChange={updateLightColor} />
              <BackgroundColorControl value={backgroundColor} onChange={updateBackgroundColor} />
              <AutoRotateControl value={autoRotatePeriodMs} onChange={updateAutoRotate} />
              {showAdvancedControls && (
                <DragControl
                  value={{
                    rotate: dragControlsRotation,
                    pan: dragControlsPanning
                  }}
                  onChange={updateDragControl}
                />
              )}
              <Grid container spacing={2}>
                <SaveButton onChange={() => stateSave(onSaveScreenshot)} />
                <ResetButton onChange={stateReset} />
                <div style={styles.grow} />
                <FullscreenButton fullscreenElement={canvasRef.current} />
              </Grid>
            </Paper>
          </Grid>
        )}
        <Grid item>
          {loading && (
            <div style={styles.loadingGridOverlay}><CircularProgress /></div>
          )}
          <div id={overlayID} className="bivot-overlay" style={styles.bivotOverlay}>
            <canvas
              ref={canvasRef}
              id={canvasID}
              className='bivot-canvas'
              width={pixelRatio * orientationAwareWidth(state.portrait)}
              height={pixelRatio * orientationAwareHeight(state.portrait)}
            />
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

export default BivotReact;
