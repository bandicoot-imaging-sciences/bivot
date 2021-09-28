import React, { useState, useRef, useEffect } from 'react';
import { Paper, Grid, CircularProgress } from '@material-ui/core';

import { AppBar, Tabs, Tab, Tooltip, Typography } from '@material-ui/core';
import LightingIcon from '@material-ui/icons/WbSunny';
import ColourIcon from '@material-ui/icons/Palette';
import LayoutIcon from '@material-ui/icons/SquareFoot';

import Bivot from './bivot-js/bivot';
import { jsonToState, copyStateFields } from './bivot-js/stateUtils';

import IntensityControl from './controls/IntensityControl';
import BrightnessControl from './controls/BrightnessControl';
import ContrastControl from './controls/ContrastControl';
import LightTypeControl from './controls/LightTypeControl';
import MaterialRotationControl from './controls/MaterialRotationControl';
import AspectControl from './controls/AspectControl';
import ZoomControl from './controls/ZoomControl';
import SaveButton from './controls/SaveButton';
import ResetButton from './controls/ResetButton';
import FullscreenButton from './controls/FullscreenButton';
import LightColorControl from './controls/LightColorControl';
import BackgroundColorControl from './controls/BackgroundColorControl';
import AutoRotateControl from './controls/AutoRotateControl';
import DragControl from './controls/DragControl';
import MeshOverrideControl from './controls/MeshOverrideControl';
import AmbientOcclusionControl from './controls/AmbientOcclusionControl';
import ColorTemperatureControl from './controls/ColorTemperatureControl';
import HueControl from './controls/HueControl';
import SaturationControl from './controls/SaturationControl';

import { loadJsonFile } from './utils/jsonLib';
import { getDelta } from './utils/arrayLib';
import { rgbArrayToColorObj, rgbArrayToHexString } from './utils/colorLib';
import { isFullScreenAvailable, openFullScreen } from './utils/displayLib';

const tabHeight = '48px';

const styles = {
  bivotGridOverlay: {
    textAlign: 'center',
  },
  bivotGridCanvas: {
    width: '100%',
    height: 'auto',
  },
  progressContainer: {
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
    top: '20px',
    left: '20px',
  },
  controlPanel: {
    width: 325,
    height: '100%',
  },
  controlContents: {
    padding: '1em',
    paddingLeft: '0.3em',
    height: `calc(100% - ${tabHeight})`,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'column',
  },
  tabs: {
    marginBottom: '1em',
  },
  tab: {
    height: tabHeight,
    minWidth: 100,
  },
};

var zoomIndex = -1; // Index of the current zoom slider being moved
var zoomInitialVal = [0, 0, 0]; // [min, unused, max] zoom at the beginning of the current slider move

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

    // Updates the width and height of the live Shimmer View.  If unset, the
    // width and height are taken from the materialSet file.  When responsive
    // is true, it's the aspect ratio of the responsively sized view.  When
    // responsive is false, it's the absolute width and height.
    // NOTE: If width and height are overridden on the initial Bivot component
    //       while loading, the loading image may be inconsistently scaled.
    width,
    height,

    // If true, Bivot renders with a fixed aspect ratio, with canvas width
    // changing responsively to fit the width of the parent element.  If false,
    // Bivot sets the canvas size directly from the width and height.
    // (Default: true)
    responsive,

    // ========== Advanced props ==========
    // When fullScreen is set to true, Bivot will enter full screen mode.  Bivot
    // calls back into onExitFullScreen when full screen is exited.  This callback
    // should reset fullScreen to false, and may additionally perform any other
    // user action desired.
    // NOTE: fullScreen is not yet supported for iOS devices.
    fullScreen,
    onExitFullScreen,

    // If set to true, the Shimmer View is embedded as the featured element of
    // the web page.  This allows scroll wheel to zoom the Shimmer directly,
    // rather than requiring the ctrl key to be held down to zoom.
    featured,

    // If set, this function will be called when a user clicks on the Bivot viewer.
    onClick,

    // If set to true or false, overrides the autoRotate setting in the
    // material set definition.
    autoRotate,

    // If > 0, a minimum target frames per second value which the render
    // resolution of the Shimmer will be adapted to meet.  Set to 0 to always
    // produce one one rendered pixel for each display pixel, regardless of
    // framerate.
    adaptFps,

    // If set, the URL for an object mesh to render the Shimmer on.
    // Set to false to revert the the default mesh for the Shimmer.
    // NOTE: This should only be used for Flat mode scans.
    objectMesh,

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

    // Set to true to show the Bivot editor.
    // (Currently only supported for internal use)
    showEditor,

    // Set to true to show advanced controls in the Bivot editor.
    // (Currently only supported for internal use)
    showAdvancedControls,

    // A dictionary of decorators to display beside each control.
    // (Currently only supported for internal use)
    decorators,

    // If supplied, this callback is called upon pressing "Save" in the editor.
    // (Currently only supported for internal use)
    writeState,

    // If supplied, this callback is called when a screenshot is saved during
    // the "save" operation of the editor.
    // (Currently only supported for internal use)
    onSaveScreenshot,

    // If supplied, a list of absolute paths to OBJ mesh files over which the
    // textures can be rendered.
    // (Currently only supported for internal use)
    meshChoices,

  } = props;

  const canvasRef = useRef();
  const overlayRef = useRef();
  const bivot = useRef(null);

  const canvasID = `${id}-canvas`;

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
    size: [792, 528],
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.36, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,
    meshOverride: false,
    aoStrength: 1.0,
    colorTemperature: 6500,
    hue: 0.0,
    saturation: 0.0,

    // State to be saved for the bivot render for which there aren't controls
    camTiltWithMousePos: -0.3,
    camTiltWithDeviceOrient: 0.6,
    camTiltLimitDegrees: 70.0,
    lightTiltWithMousePos: 1.0,
    lightTiltWithDeviceOrient: 2.8,
    lightTiltLimitDegrees: 50.0,
    autoRotatePeriodMs: 8000,
    autoRotateFps: 30, // Deprecated
    autoRotateCamFactor: 0.5,
    autoRotateLightFactor: 0.9,
    bloom: 0.0,
  };
  const [state, _setState] = useState({
    exposure: 1.0,
    brightness: 0.5,
    contrast: 0.5,
    lightType: 'point',
    areaLightWidth: referenceAreaLightWidth,
    areaLightHeight: referenceAreaLightHeight,
    meshRotateZDegrees: 0,
    size: [792, 528],
    dirty: false, // For bivot internal only, to know when to update render
    zoom: [0.2, 0.36, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,
    meshOverride: false,
    aoStrength: 1.0,
    colorTemperature: 6500,
    hue: 0.0,
    saturation: 0.0,

    // State to be saved for the bivot render for which there aren't controls
    camTiltWithMousePos: -0.3,
    camTiltWithDeviceOrient: 0.6,
    camTiltLimitDegrees: 70.0,
    lightTiltWithMousePos: 1.0,
    lightTiltWithDeviceOrient: 2.8,
    lightTiltLimitDegrees: 50.0,
    autoRotatePeriodMs: 8000,
    autoRotateFps: 30, // Deprecated
    autoRotateCamFactor: 0.5,
    autoRotateLightFactor: 0.9,
    bloom: 0.0,
  });
  const [checkpointState, _setCheckpointState] = useState({});

  // If autoRotate is set in props, then override state
  if (autoRotate === true) {
    state.autoRotatePeriodMs = 8000;
  } else if (autoRotate === false) {
    state.autoRotatePeriodMs = 0;
  }

  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [materialSetInternal, setMaterialSetInternal] = useState({});
  const [loading, setLoading] = useState(true);
  const [diag, setDiag] = useState(0.25);
  const savedSize = useRef(null);

  const [tabValue, setTabValue] = useState(0);

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
  const [camTiltLimitDegrees, setCamTiltLimitDegrees] = useState(state.camTiltLimitDegrees);
  const [lightTiltLimitDegrees, setLightTiltLimitDegrees] = useState(state.lightTiltLimitDegrees);
  const [meshOverride, setMeshOverride] = useState(state.meshOverride);
  const [aoStrength, setAoStrength] = useState(state.aoStrength);
  const [colorTemperature, setColorTemperature] = useState(state.colorTemperature);
  const [hue, setHue] = useState(state.hue);
  const [saturation, setSaturation] = useState(state.saturation);

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
  state.camTiltLimitDegrees = camTiltLimitDegrees;
  state.lightTiltLimitDegrees = lightTiltLimitDegrees;
  state.meshOverride = meshOverride;
  state.aoStrength = aoStrength;
  state.colorTemperature = colorTemperature;
  state.hue = hue;
  state.saturation = saturation;

  async function onLoad() {
    loadBivot();
  }

  // Load bivot
  useEffect(() => {
    onLoad();
  }, []);

  // Update bivot when the whole material changes
  useEffect(() => {
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

  useEffect(() => {
    if (isFullScreenAvailable() && fullScreen) {
      openFullScreen(getFullScreenElement(), handleEnterFullScreen, handleExitFullScreen);
    }
  }, [fullScreen]);

  useEffect(() => {
    if (objectMesh !== undefined) {
      updateMeshOverride(objectMesh);
    }
  }, [objectMesh]);

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
        if (materialUserPath.startsWith('material-sets')) {
          // Shopfront-specific materialUserPath with assumed split directory layout
          basePath = `gallery/${materialId}/biv_gallery`;
          filename = url['ms'];
          context = userId;
        } else {
          // General materialUserPath with material assumed to be in same directory as material set
          var parts = materialUserPath.split('/');
          parts.pop();
          basePath = parts.join('/');
          filename = url['ms'];
          context = userId;
        }
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

    // Pre-check size, to avoid sizing issues while loading
    var initSize = galleryMat.config.renders[galleryMat.name].state.size;
    if (width != null && height != null) {
      initSize = [width, height];
      // Handle legacy portrait flag
      if (galleryMat.config.renders[galleryMat.name].state.portrait) {
        initSize = [initSize[1], initSize[0]];
      }
      updateSize(initSize);
    }

    const options = {
      renderPath,
      texturePath,
      textures,
      material: galleryMat,
      thumbnail,
      state,
      featured,
      responsive,
      adaptFps,
      stateLoadCallback,
      loadingCompleteCallback,
      setZoomCallback: setCurrentZoom,
      canvasID,
      onClick,
    };
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
      currentZoom,
      lightColor,
      backgroundColor,
      autoRotatePeriodMs,
      dragControlsRotation,
      dragControlsPanning,
      camTiltLimitDegrees,
      lightTiltLimitDegrees,
      meshOverride,
      aoStrength,
      colorTemperature,
      hue,
      saturation,
    } = stateFields;

    updateExposure(exposure);
    updateBrightness(brightness);
    updateContrast(contrast);
    updateLightType(lightType, areaLightWidth / referenceAreaLightWidth);
    updateRotation(meshRotateZDegrees);
    // Only update size if not overridden via props
    if (!width && !height) {
      updateSize(size);
    }
    setZoom(zoom);
    setCurrentZoom(currentZoom);
    updateLightColor(rgbArrayToColorObj(lightColor));
    updateBackgroundColor({ hex: backgroundColor });
    updateAutoRotate(autoRotatePeriodMs);
    updateDragControl('rotate', dragControlsRotation);
    updateDragControl('pan', dragControlsPanning);
    updateDragControl('limits', camTiltLimitDegrees > 0);
    updateMeshOverride(meshOverride);
    updateAoStrength(aoStrength);
    updateColorTemperature(colorTemperature);
    updateHue(hue);
    updateSaturation(saturation);

    // Update initial zoom value after loading state
    zoomInitialVal = zoom;

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
      camTiltWithMousePos, camTiltWithDeviceOrient,
      lightTiltWithMousePos, lightTiltWithDeviceOrient,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor, bloom,
      cameraPan,
    } = state;

    // Convert from THREE.Vector3 to array, discarding Z
    const cameraPanArray = [cameraPan.x, cameraPan.y, 0.0];

    const savedState = {
      exposure, brightness, contrast, size,
      zoom: [zoom[0], currentZoom, zoom[2]], // Backwards compatibility for deprecated middle zoom value
      currentZoom, backgroundColor, autoRotatePeriodMs, lightType, areaLightWidth, areaLightHeight,
      meshRotateZDegrees: rotation,
      lightColor: lightColorBivot,
      dragControlsRotation, dragControlsPanning,
      meshOverride, aoStrength, colorTemperature, hue, saturation,
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor, bloom,
      cameraPan: cameraPanArray,
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

  function updateAspect(val) {
    const canvas = canvasRef.current;
    if (val[0] != canvas.width || val[1] != canvas.height) {
      updateSize([val[0], val[1]]);
    }
  }

  function updateSize(val) {
    setSize(val);
    renderFrame(true);
  }

  function updateZoom(val) {
    var index = getDelta(zoom, val);
    if (zoomIndex === -1) {
      if (index >= 0) {
        zoomIndex = index;
        zoomInitialVal = val.slice();
      }
    } else if (zoomIndex >= 1 && index >= 1) {
      // Knobs 2 and 3 are interchangeable (to keep them in tandom)
      zoomIndex = index;
    }

    if (zoomIndex !== -1) {
      // Don't let the min and max sliders pass through each other.
      // Keep other slider values the same.  Keep 1 and 2 in tandem.
      if (zoomIndex === 0) {
        val[0] = Math.min(val[0], val[2]);
        val[1] = zoomInitialVal[1];
        val[2] = zoomInitialVal[2];
      } else if (zoomIndex === 1) {
        val[1] = Math.max(val[1], val[0]);
        val[2] = val[1]
        val[0] = zoomInitialVal[0];
      } else if (zoomIndex === 2) {
        val[2] = Math.max(val[2], val[0]);
        val[1] = val[2]
        val[0] = zoomInitialVal[0];
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

  function updateColorTemperature(val) {
    setColorTemperature(val);
    renderFrame(true);
  }

  function updateHue(val) {
    setHue(val);
    renderFrame(false);
  }

  function updateSaturation(val) {
    setSaturation(val);
    renderFrame(false);
  }

  function updateAutoRotate(val) {
    setAutoRotatePeriodMs(val);
    renderFrame(true);
  }

  function updateDragControl(field, val) {
    if (field == 'rotate') {
      setDragControlsRotation(val);
      state.camTiltWithMousePos = (val ? 0.0: defaultState.camTiltWithMousePos);
    } else if (field == 'pan') {
      setDragControlsPanning(val);
    } else if (field == 'limits') {
      if (val) {
        setCamTiltLimitDegrees(defaultState.camTiltLimitDegrees);
        setLightTiltLimitDegrees(defaultState.lightTiltLimitDegrees);
      } else {
        setCamTiltLimitDegrees(0);
        setLightTiltLimitDegrees(0);
      }
    }
    renderFrame(true);
  }

  function updateMeshOverride(path) {
    if (meshOverride !== path) {
      setMeshOverride(path);
      renderFrame(true);
    }
  }

  function updateAoStrength(val) {
    setAoStrength(val);
    renderFrame(false);
  }

  function handleEnterFullScreen() {
    savedSize.current = size;
    setSize([window.screen.width, window.screen.height]);
    renderFrame(true);
  }

  function handleExitFullScreen() {
    setSize(savedSize.current);
    renderFrame(true);
    if (onExitFullScreen) {
      onExitFullScreen();
    }
  }

  function getFullScreenElement() {
    if (canvasRef.current) {
      // If the overlay div exists yet, select it as the full screen element
      return canvasRef.current.parentNode;
    } else {
      return canvasRef.current;
    }
  }

  function handleTabChange(event, newValue) {
    setTabValue(parseInt(newValue));
  }

  return (
    <div
      ref={overlayRef}
      style={styles.bivotGridOverlay}
    >
      <Grid container spacing={2} wrap='nowrap'>
        {showEditor && (
          <Grid item>
            <Paper style={styles.controlPanel}>
              <AppBar position='static' style={styles.tabs}>
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  indicatorColor='secondary'
                  textColor='inherit'
                  variant='fullWidth'
                >
                  <Tooltip title='Lighting'>
                    <Tab style={styles.tab} icon={<LightingIcon />} />
                  </Tooltip>
                  <Tooltip title='Colour'>
                    <Tab style={styles.tab} icon={<ColourIcon />} />
                  </Tooltip>
                  <Tooltip title='Layout'>
                    <Tab style={styles.tab} icon={<LayoutIcon />} />
                  </Tooltip>
                </Tabs>
              </AppBar>
              <Grid container spacing={2} style={styles.controlContents} wrap='nowrap' >
                <Grid item>
                  <Grid container spacing={2}>
                    {tabValue === 0 && (<React.Fragment>
                      <Grid item xs={1}>{decorators['exposure'] || ''}</Grid>
                      <Grid item xs={11}>
                        <IntensityControl value={exposure} onChange={updateExposure} />
                      </Grid>
                      <Grid item xs={1}>{decorators['lightWidth'] || ''}</Grid>
                      <Grid item xs={11}>
                        <LightTypeControl type={lightType} size={areaLightWidth / referenceAreaLightWidth} onChange={updateLightType} />
                      </Grid>
                      <Grid item xs={1}>{decorators['lightColor'] || ''}</Grid>
                      <Grid item xs={11}>
                        <LightColorControl value={lightColorControls} onChange={updateLightColor} />
                      </Grid>
                      <Grid item xs={1}>{decorators['aoStrength'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AmbientOcclusionControl value={aoStrength} onChange={updateAoStrength} />
                      </Grid>
                    </ React.Fragment>)}
                    {tabValue === 1 && (<React.Fragment>
                      <Grid item xs={1}>{decorators['colorTemperature'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ColorTemperatureControl value={colorTemperature} onChange={updateColorTemperature} />
                      </Grid>
                      <Grid item xs={1}>{decorators['hue'] || ''}</Grid>
                      <Grid item xs={11}>
                        <HueControl value={hue} onChange={updateHue} />
                      </Grid>
                      <Grid item xs={1}>{decorators['saturation'] || ''}</Grid>
                      <Grid item xs={11}>
                        <SaturationControl value={saturation} onChange={updateSaturation} />
                      </Grid>
                      <Grid item xs={1}></Grid>
                      <Grid item xs={11}>
                        <BackgroundColorControl value={backgroundColor} onChange={updateBackgroundColor} />
                      </Grid>
                      <Grid item xs={1}>{decorators['brightness'] || ''}</Grid>
                      <Grid item xs={11}>
                        <BrightnessControl value={brightness} onChange={updateBrightness} />
                      </Grid>
                      <Grid item xs={1}>{decorators['contrast'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ContrastControl value={contrast} onChange={updateContrast} />
                      </Grid>
                    </React.Fragment>)}
                    {tabValue === 2 && (<React.Fragment>
                      <Grid item xs={1}>{decorators['aspectRatio'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AspectControl value={size} onChange={updateAspect} />
                      </Grid>
                      <Grid item xs={1}>{decorators['zoom'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ZoomControl value={zoom} max={diag * 4} onChange={updateZoom} onChangeCommitted={updateZoomFinished} />
                      </Grid>
                      <Grid item xs={1}>{decorators['rotation'] || ''}</Grid>
                      <Grid item xs={11}>
                        <MaterialRotationControl value={rotation} onChange={addRotation} />
                      </Grid>
                      <Grid item xs={1}>{decorators['autoRotate'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AutoRotateControl value={autoRotatePeriodMs} onChange={updateAutoRotate} />
                      </Grid>
                      {meshChoices && (
                        <React.Fragment>
                          <Grid item xs={1}>{decorators['objectMesh'] || ''}</Grid>
                          <Grid item xs={11}>
                            <MeshOverrideControl
                              overrides={meshChoices}
                              value={meshOverride}
                              onChange={updateMeshOverride}
                            />
                          </Grid>
                        </ React.Fragment>
                      )}
                      <Grid item xs={1}>{decorators['dragControl'] || ''}</Grid>
                      <Grid item xs={11}>
                        <DragControl
                          value={{
                            rotate: dragControlsRotation,
                            pan: dragControlsPanning,
                            limits: (camTiltLimitDegrees > 0)
                          }}
                          onChange={updateDragControl}
                          advancedMode={showAdvancedControls}
                        />
                      </Grid>
                    </React.Fragment>)}
                  </Grid>
                </Grid>
                <Grid item>
                  <Grid container direction='row' wrap='nowrap' justify='space-between'>
                    <Grid item>
                    <Grid container spacing={0}>
                    <Grid item>
                      {onSaveScreenshot && (
                        <SaveButton onChange={() => stateSave(onSaveScreenshot)} />
                      )}
                    </Grid>
                    <Grid item>
                      <ResetButton onChange={stateReset} />
                    </Grid>
                    </Grid>
                    </Grid>
                    <Grid item>
                      <FullscreenButton
                        getFullscreenElement={getFullScreenElement}
                        onEnterFullScreen={handleEnterFullScreen}
                        onExitFullScreen={handleExitFullScreen}
                        fullScreen={fullScreen}
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
        <Grid item style={styles.bivotGridCanvas}>
          <div style={styles.progressContainer}>
            <canvas ref={canvasRef} id={canvasID} />
            {loading && (
              <div style={styles.progressOverlay}>
                <CircularProgress />
              </div>
            )}
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

export default BivotReact;
