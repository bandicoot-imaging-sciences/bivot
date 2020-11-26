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
  //
  // Props:
  //
  const {
    // ========== Basic props ==========

    // The pathname of a material set defining a Shimmer View to display in
    // the Bivot viewer.  May be a local path relative to the public html
    // directory, or a URL.
    materialSet,

    // The pathname of an image to display while the Shimmer View is loading.
    // May be a local path relative to the public html directory, or a URL.
    // If unset, a thumbnail image relative to the material set path is
    // automatically used.
    // If false, then a blank canvas is shown while loading.
    loadingImage,

    // An ID of this Bivot instance, needed if multiple Bivots are used in
    // the same page.
    id,

    // Override the width and height of the Shimmer View.  Bivot resizes
    // responsively if width or height changes on a live Bivot component.
    // If unset, the width and height are taken from the materialSet file.
    width,
    height,

    // ========== Advanced props ==========

    // If set, this function will be called when a user clicks on the Bivot viewer.
    onClick,

    // If set to True or False, overrides the autoRotate setting in the
    // material set definition.
    autoRotate,

    // An object containing a material object defining a Shimmer View to
    // display in the Bivot viewer, as an alternative to the materialSet
    // filename.
    // (Currently only supported for internal use)
    material,

    // An optional callback to use when loading paths in the material set.  Only
    // required if paths in the material set aren't directly accessible.   For
    // example, if the material set contains private S3 paths, fetchFiles can
    // be provided to receive those paths and return temporary signed URLs, if
    // authorised.
    // (Currently only supported for internal use)
    fetchFiles,

    // ========== Editor props ==========

    // Set to True to show the Bivot editor.
    // (Currently only supported for internal use)
    showEditor,

    // Set to True to show advanced controls in the Bivot editor.
    // (Currently only supported for internal use)
    showAdvancedControls,

    // If supplied, this callback is called upon pressing "Save" in the editor.
    // (Currently only supported for internal use)
    writeState,

    // If supplied, this callback is called when a screenshot is saved during
    // the "save" operation of the editor.
    // (Currently only supported for internal use)
    onSaveScreenshot,
  } = props;

  const canvasRef = useRef();
  const overlayRef = useRef();
  const bivot = useRef(null);

  const canvasID = `${id}-canvas`;
  const overlayID = `${id}-overlay`;

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
    size: [590, 400],
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.3, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,

    // State to be saved for the bivot render for which there aren't controls
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
    size: [590, 400],
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.3, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,

    // State to be saved for the bivot render for which there aren't controls
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

  // If autoRotate is set in props, then override state
  if (autoRotate === true) {
    state.autoRotatePeriodMs = 8000;
  } else if (autoRotate === false) {
    state.autoRotatePeriodMs = 0;
  }

  const windowSize = useWindowSize(onWindowSizeChanged);

  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [materialSetInternal, setMaterialSetInternal] = useState({});
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
  const [size, setSize] = useState(state.size);
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
  state.size = size;
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
    // Update width/height
    var w, h;
    const galleryMat = getMatFromMatSet(materialSetInternal);
    if (galleryMat) {
      const initSize = galleryMat.config.renders[galleryMat.name].state.size;
      w = (width != null) ? width : initSize[0];
      h = (height != null) ? height : initSize[1];
    } else {
      w = width;
      h = height;
    }
    if (w && h) {
      updateSize([w, h]);
    }
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
    if (materialSet && materialSet.materials) {
      const gallery = materialSet.materials[materialIndex].gallery;
      return gallery[gallery.length - 1]; // Only use last gallery Material in the array
    }
    return null;
  }

  function getIdFromMatSet(materialSet, materialIndex=0) {
    return materialSet.materials[materialIndex].materialId;
  }

  async function fetchFilesWrapper(paths, context) {
    if (fetchFiles) {
      return await fetchFiles(paths, context);
    } else {
      return paths;
    }
  }

  async function fetchTextures(ms, basePath, context=null) {
    var texUserPaths = {};
    const galleryMat = getMatFromMatSet(ms);
    var path;
    const loc = galleryMat.location.toLowerCase();
    if (loc.startsWith('/') || loc.startsWith('http://') || loc.startsWith('https://')) {
      path = `${galleryMat.location}/`;
    } else if (loc.startsWith('s3://')) {
      path = `${basePath}/textures/0/`;
    } else {
      path = `${basePath}/${galleryMat.location}/`;
    }
    for (var k in galleryMat.textures) {
      texUserPaths[k] = path + galleryMat.textures[k];
    }
    return await fetchFilesWrapper(texUserPaths, context);
  }

  async function loadBivot() {
    var configPath;
    var renderPath;
    var texturePath;
    var galleryMat;
    var textures;
    var thumbnail = loadingImage;

    if (material || materialSet) {
      var context;
      var filename;
      var basePath;
      if (material) {
        const { userId, materialId, materialUserPath } = material;
        const fileUserPaths = { 'ms': materialUserPath };
        const url = await fetchFilesWrapper(fileUserPaths, userId);
        basePath = `gallery/${materialId}/biv_gallery`;
        filename = url['ms'];
        context = userId;
      } else if (materialSet) {
        var parts = materialSet.split('/');
        parts.pop();
        basePath = parts.join('/');
        filename = materialSet;
        context = null;

        if (!thumbnail && thumbnail != false) {
          // Loading image not specified by caller.
          // Automatically set loading image path relative to material set.
          thumbnail = `${basePath}/images/0.jpg`;
        }
      }

      const ms = await loadJsonFile(filename);
      if (!ms) {
        return false;
      }
      galleryMat = getMatFromMatSet(ms);
      setMaterialSetInternal(ms);
      textures = await fetchTextures(ms, basePath, context);
    } else {
      // Neither material or materialSet was provided; try local textures
      renderPath = 'bivot-renders.json';
      texturePath = 'textures';
    }

    // Auto-set config path for legacy use
    configPath = 'bivot-config.json';

    // Pre-check size, to avoid sizing issues while loading
    var initSize = galleryMat.config.renders[galleryMat.name].state.size;
    if (!initSize) {
      initSize = [590, 400];
    }
    if (width != null) {
      initSize[0] = width;
    }
    if (height != null) {
      initSize[1] = height;
    }
    if (galleryMat.config.renders[galleryMat.name].state.portrait) {
      // Handle legacy portrait flag
      initSize = [initSize[1], initSize[0]];
    }
    updateSize(initSize);

    const options = {
      width: initSize[0],
      height: initSize[1],
      configPath,
      renderPath,
      texturePath,
      textures,
      material: galleryMat,
      thumbnail,
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
      //portrait,
      size,
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
    updateSize(size);
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

    const { gallery } = materialSetInternal.materials[0]
    const galleryMat = gallery[gallery.length - 1];
    const config = galleryMat.config.renders['0'];

    const {
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor,
     } = state;

    const savedState = {
      exposure, brightness, contrast, size, zoom, backgroundColor, autoRotatePeriodMs,
      lightType, areaLightWidth, areaLightHeight,
      meshRotateZDegrees: rotation,
      lightColor: lightColorBivot,
      dragControlsRotation, dragControlsPanning,
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor,
    }

    config.state = { ...config.state, ...savedState };
    delete config.state.portrait; // Strip out legacy portrait flag, if present

    const { userId, materialId } = material;
    const success = await writeState(userId, materialId, materialSetInternal);
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
    const canvasPortrait = canvas ? (canvas.height > canvas.width) : false;
    if (toPortrait != canvasPortrait) {
      updateSize([size[1], size[0]]);
    }
  }

  function updateSize(val) {
    setSize(val);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = pixelRatio * val[0];
      canvas.height = pixelRatio * val[1]
    }
    renderFrame(true);
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

  function onWindowSizeChanged(size) {
    //console.log('Window was resized:', size);
    // TODO:  Conditionally resize the bivot canvas on this event
  }

  function onEnterFullScreen() {
    if (canvasRef.current) {
      canvasRef.current.width = pixelRatio * window.screen.width;
      canvasRef.current.height = pixelRatio * window.screen.height;
      renderFrame(true);
    }
  }

  function onExitFullScreen() {
    if (canvasRef.current) {
      canvasRef.current.width = pixelRatio * size[0];
      canvasRef.current.height = pixelRatio * size[1];
      renderFrame(true);
    }
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
              <OrientationControl value={size[0] < size[1]} onChange={updatePortrait} />
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
                <FullscreenButton
                  fullscreenElement={canvasRef.current}
                  onEnterFullScreen={onEnterFullScreen}
                  onExitFullScreen={onExitFullScreen}
                />
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
              width={pixelRatio * size[0]}
              height={pixelRatio * size[1]}
            />
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

export default BivotReact;
