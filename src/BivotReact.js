import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Paper, Grid, CircularProgress, makeStyles } from '@material-ui/core';

import { AppBar, Tabs, Tab, Tooltip, Typography } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import LightingIcon from '@material-ui/icons/WbSunny';
import ColourIcon from '@material-ui/icons/Palette';
import LayoutIcon from '@material-ui/icons/SquareFoot';

import Bivot, { defaultSize, initialRepeatFactorX, DirtyFlag } from './bivot-js/bivot';
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
import ShowSeamsControl from './controls/ShowSeamsControl';

import { loadJsonFile } from './utils/jsonLib';
import { getDelta } from './utils/arrayLib';
import { rgbArrayToColorObj, rgbArrayToHexString } from './utils/colorLib';
import { isFullScreenAvailable, getDocumentFullScreenElement, openFullScreen, closeFullScreen } from './utils/displayLib';

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
    // Keep this width in sync with any CSS widths in parent components that have their own control panels.
    width: 350,
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

    // ========== Synchronisation props ==========
    // The caller may provide these controls to lift them up for improved
    // synchronisation between multiple Bivot components viewing the same
    // material.

    // Size state [ width, height ] of the live Shimmer View. Use defaultSize to
    // initialise in the parent component.
    size,
    setSize,

    // Exposure state of the live Shimmer View.
    exposure,
    setExposure,

    // Ambient occlusion strength state of the live Shimmer View.
    aoStrength,
    setAoStrength,

    // Background colour of the live Shimmer View, for example '#FFFFFF' for white.
    backgroundColor,
    setBackgroundColor,

    // ========== Advanced props ==========
    // When fullScreen becomes true or false, Bivot will correspondingly enter or
    // exit full screen mode.  NOTE: fullScreen is not yet supported for iOS devices.
    fullScreen,

    // DEPRECATION WARNING: onExitFullScreen is deprecated.  Recommended approach is
    // to add a 'fullscreenchange' event listener to detect when full screen changes.
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

    // If provided, a callback function which Bivot will call according to the
    // status of Bivot.  1: Loading; 2: Loaded; 0: Other
    statusCallback,

    // If set, the URL for an object mesh to render the Shimmer on.  Can also
    // set to null or an empty string for the shimmer's mesh, or false for a
    // default (flat) mesh.
    // NOTE: This should only be used for Flat mode scans.
    objectMesh,

    // If true, textures will be pixellated when zoomed in rather than smoothed.
    pixellated,

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

    // If set, an object containing the following members:
    //   grid: The X,Y spacing of a base grid (in units of pixels).
    //   source: A string describing the source of these values
    // (Currently only supported for internal use)
    userGrid,

    // If set, an object containing the following members:
    //   grid: The X,Y size and offset of a highlighted selection grid (in units of userGrid).
    //   source: A string describing the source of these values
    // (Currently only supported for internal use)
    userGridSelection,

    // True to display any given userGrid.
    // (Currently only supported for internal use)
    showUserGrid,

    // True to display any given userGridSelection.
    // (Currently only supported for internal use)
    showUserGridSelection,

    // True to enable mouse-driven selection of a grid region.
    // (Currently only supported for internal use)
    userGridSelectionEnabled,

    // If set, a callback function to be called whenever the grid selection changes.
    // (Currently only supported for internal use)
    userGridOnSelect,

    // An optional points control structure for drawing on the textures.
    // (Currently only supported for internal use)
    userPointsControl,

    // Optional callback functions called when drawing on the textures is performed.
    // (Currently only supported for internal use)
    userPointsOnSet,
    userPointsOnSelect,

    // If set, repeated indicators are drawn along tiling seams in a tiled view.
    // (Currently only supported for internal use)
    tilingSeams,

    // If set, a list of points to draw as a boundary path.
    // (Currently only supported for internal use)
    tilingBoundary,

    // If set, a list of points to draw as a secondary boundary path.
    // (Currently only supported for internal use)
    tilingSubBoundary,

    // If set, a multiplier to the scale of the tiling.
    // (Currently only supported for internal use)
    tilingScale,

    // If set, indicates a single texture to render as the basecolor, with
    // other texture channels unused, for debugging purposes.  Values are
    // 1 (basecolor), 2 (roughness), 3 (metallic), 4 (normals), 5 (displacement),
    // or any other value for regular rendering.
    textureDebug,

    // Hover controls are disabled while this is true, including light
    // position and material tilt.  While hover controls are disabled,
    // drag rotation is only enabled via a keyboard modifier (e.g. ctrl).
    hoverDisabled,

    // Defer loading as long as this is true.  Can be useful to control
    // loading sequences.
    deferLoading,

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

    // A list of meshes which may be a subset of meshChoices, which Bivot will
    // pre-cache upon loading.
    // (Currently only supported for internal use)
    cachedMeshes,

    // True to enable key presses which affect the Bivot editor.
    enableKeypress,

  } = props;

  const canvasRef = useRef();
  const overlayRef = useRef();
  const bivot = useRef(null);
  const theme = useTheme();

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
    size: defaultSize,
    cameraPanArray: [0, 0, 0],
    zoom: [0.2, 0.36, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,
    meshOverride: false,
    meshesToCache: null,
    aoStrength: 1.0,
    colorTemperature: 6500,
    hue: 0.0,
    saturation: 0.0,
    showSeams: false,
    boundary: false,
    subBoundary: false,
    showGrid: false,
    showGridSelection: false,
    grid: null,
    gridSelection: null,
    enableGridSelect: false,
    onSelectGrid: null,
    pointsControl: null,
    stretch: null,
    userScale: 1,
    pixellated: false,

    // For bivot internal use only, no controls and not saved
    dirty: 0,
    textureLayer: 0,
    enableKeypress: false,
    overlayRepeats: true,

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
    texDims: undefined,
    metresPerPixelTextures: undefined,
  };

  const [state, _setState] = useState({
    exposure: 1.0,
    brightness: 0.5,
    contrast: 0.5,
    lightType: 'point',
    areaLightWidth: referenceAreaLightWidth,
    areaLightHeight: referenceAreaLightHeight,
    meshRotateZDegrees: 0,
    size: defaultSize,
    cameraPanArray: [0, 0, 0],
    zoom: [0.2, 0.36, 0.36],
    currentZoom: 0.3,
    lightColor: [255, 255, 255],
    backgroundColor: '#FFFFFF',
    dragControlsRotation: false,
    dragControlsPanning: false,
    meshOverride: false,
    meshesToCache: null,
    aoStrength: 1.0,
    colorTemperature: 6500,
    hue: 0.0,
    saturation: 0.0,
    showSeams: false,
    boundary: false,
    subBoundary: false,
    showGrid: false,
    showGridSelection: false,
    grid: null,
    gridSelection: null,
    enableGridSelect: false,
    onSelectGrid: null,
    pointsControl: null,
    stretch: null,
    userScale: 1,
    pixellated: false,

    // For bivot internal use only, no controls and not saved
    dirty: 0,
    textureLayer: 0,
    enableKeypress: false,
    overlayRepeats: true,

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
    texDims: undefined,
    metresPerPixelTextures: undefined,
  });
  const [checkpointState, _setCheckpointState] = useState({});

  function updateAutoRotateOverride(val) {
    if (val === true) {
      setAutoRotatePeriodMs(8000);
    } else if (val === false) {
      setAutoRotatePeriodMs(0);
    }
  }

  function updateHoverDisabledOverride(val) {
    if (val === true) {
      setCamTiltWithMousePos(0);
      setCamTiltWithDeviceOrient(0);
      setCamTiltLimitDegrees(0);
      setLightTiltWithMousePos(0);
      setLightTiltWithDeviceOrient(0);
      setLightTiltLimitDegrees(0);
      setDragControlsRotation(2);
      setDragControlsPanning(true);
      if (bivot.current) {
        bivot.current.resetCameraAngle();
      }
    } else if (val === false) {
      setCamTiltWithMousePos(defaultState.camTiltWithMousePos);
      setCamTiltWithDeviceOrient(defaultState.camTiltWithDeviceOrient);
      setCamTiltLimitDegrees(defaultState.camTiltLimitDegrees);
      setLightTiltWithMousePos(defaultState.lightTiltWithMousePos);
      setLightTiltWithDeviceOrient(defaultState.lightTiltWithDeviceOrient);
      setLightTiltLimitDegrees(defaultState.lightTiltLimitDegrees);
      setDragControlsRotation(defaultState.dragControlsRotation);
      setDragControlsPanning(defaultState.dragControlsPanning);
    }
    renderFrame(DirtyFlag.Controls);
  }

  // // If autoRotate is set in props, then override state
  // updateAutoRotateOverride(autoRotate);

  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
  const [materialSetInternal, setMaterialSetInternal] = useState({});
  const [loading, setLoading] = useState(true);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isLoadPending, setIsLoadPending] = useState(true);
  const [diag, setDiag] = useState(0.25);
  const [meshScaling, setMeshScaling] = useState(1.0);
  const [tabValue, setTabValue] = useState(0);

  const sizeRef = useRef(sizeBivot); // Use a reference to access within event listener
  const setSizeAndRef = (s) => {sizeRef.current = s; setSizeBivot(s);}
  const savedSizeRef = useRef(null);

  // Set up GUI state.  Each control has a corresponding useState declaration,
  // and a corresponding assignment into the state object.
  const [brightness, setBrightness] = useState(state.brightness);
  const [contrast, setContrast] = useState(state.contrast);
  const [lightType, setLightType] = useState(state.lightType);
  const [areaLightWidth, setAreaLightWidth] = useState(state.areaLightWidth);
  const [areaLightHeight, setAreaLightHeight] = useState(state.areaLightHeight);
  const [rotation, setRotation] = useState(state.meshRotateZDegrees);
  const [cameraPanArray, setCameraPanArray] = useState(state.cameraPanArray);
  const [zoom, setZoom] = useState(state.zoom);
  const [currentZoom, setCurrentZoom] = useState(state.currentZoom);
  // Bivot state expects 3-value array for light colour, but the control needs an object or hex value.
  // So we have to track bivot light colour and control light colour in separate values.
  const [lightColorBivot, setLightColorBivot] = useState(state.lightColor);
  const [lightColorControls, setLightColorControls] = useState(rgbArrayToHexString(state.lightColor));
  const [autoRotatePeriodMs, setAutoRotatePeriodMs] = useState(state.autoRotatePeriodMs);
  const [dragControlsRotation, setDragControlsRotation] = useState(state.dragControlsRotation);
  const [dragControlsPanning, setDragControlsPanning] = useState(state.dragControlsPanning);
  const [camTiltLimitDegrees, setCamTiltLimitDegrees] = useState(state.camTiltLimitDegrees);
  const [lightTiltLimitDegrees, setLightTiltLimitDegrees] = useState(state.lightTiltLimitDegrees);
  const [meshOverride, setMeshOverride] = useState(state.meshOverride);
  const [meshesToCache, setMeshesToCache] = useState(state.meshesToCache);
  const [colorTemperature, setColorTemperature] = useState(state.colorTemperature);
  const [hue, setHue] = useState(state.hue);
  const [saturation, setSaturation] = useState(state.saturation);
  const [showSeams, setShowSeams] = useState(state.showSeams);
  const [boundary, setBoundary] = useState(state.boundary);
  const [subBoundary, setSubBoundary] = useState(state.subBoundary);
  const [grid, setGrid] = useState(state.grid);
  const [gridSelection, setGridSelection] = useState(state.gridSelection);
  const [showGrid, setShowGrid] = useState(state.showGrid);
  const [showGridSelection, setShowGridSelection] = useState(state.showGridSelection);
  const [enableGridSelect, setEnableGridSelect] = useState(state.enableGridSelect);
  const [onSelectGrid, setOnSelectGrid] = useState(state.onSelectGrid);
  const [pointsControl, setPointsControl] = useState(state.pointsControl);
  const [userEnableKeypress, setUserEnableKeypress] = useState(state.enableKeypress);
  const [stretch, setStretch] = useState(state.stretch);
  const [userScale, setUserScale] = useState(1);
  const [userPixellated, setUserPixellated] = useState(state.pixellated);
  const [camTiltWithMousePos, setCamTiltWithMousePos] = useState(state.camTiltWithMousePos);
  const [camTiltWithDeviceOrient, setCamTiltWithDeviceOrient] = useState(state.camTiltWithDeviceOrient);
  const [lightTiltWithMousePos, setLightTiltWithMousePos] = useState(state.lightTiltWithMousePos);
  const [lightTiltWithDeviceOrient, setLightTiltWithDeviceOrient] = useState(state.lightTiltWithDeviceOrient);

  // Local state for when synchronisation props aren't provided
  const [sizeLocal, setSizeLocal] = useState(state.size);
  const [exposureLocal, setExposureLocal] = useState(state.exposure);
  const [aoStrengthLocal, setAoStrengthLocal] = useState(state.aoStrength);
  const [backgroundColorLocal, setBackgroundColorLocal] = useState(state.backgroundColor);

  // Switching between local and caller-provided synchronisation props
  var sizeBivot = size ?? sizeLocal;
  var setSizeBivot = setSize ?? setSizeLocal;
  var exposureBivot = exposure ?? exposureLocal;
  var setExposureBivot = setExposure ?? setExposureLocal;
  var aoStrengthBivot = aoStrength ?? aoStrengthLocal;
  var setAoStrengthBivot = setAoStrength ?? setAoStrengthLocal;
  var backgroundColorBivot = backgroundColor ?? backgroundColorLocal;
  var setBackgroundColorBivot = setBackgroundColor ?? setBackgroundColorLocal;

  // Hook up state, used in bivotJs, so that it updates when our useState values update
  state.brightness = brightness;
  state.contrast = contrast;
  state.lightType = lightType;
  state.areaLightWidth = areaLightWidth;
  state.areaLightHeight = areaLightHeight;
  state.meshRotateZDegrees = rotation;
  state.cameraPanArray = cameraPanArray;
  state.zoom = zoom;
  state.currentZoom = currentZoom;
  state.lightColor = lightColorBivot;
  state.autoRotatePeriodMs = autoRotatePeriodMs;
  state.dragControlsRotation = dragControlsRotation;
  state.dragControlsPanning = dragControlsPanning;
  state.camTiltLimitDegrees = camTiltLimitDegrees;
  state.lightTiltLimitDegrees = lightTiltLimitDegrees;
  state.meshOverride = meshOverride;
  state.meshesToCache = meshesToCache;
  state.colorTemperature = colorTemperature;
  state.hue = hue;
  state.saturation = saturation;
  state.showSeams = showSeams;
  state.boundary = boundary;
  state.subBoundary = subBoundary;
  state.showGrid = showGrid;
  state.showGridSelection = showGridSelection;
  state.grid = grid;
  state.gridSelection = gridSelection;
  state.enableGridSelect = enableGridSelect;
  state.onSelectGrid = onSelectGrid;
  state.pointsControl = pointsControl;
  state.enableKeypress = userEnableKeypress;
  state.stretch = stretch;
  state.userScale = userScale;
  state.pixellated = userPixellated;
  state.camTiltWithMousePos = camTiltWithMousePos;
  state.camTiltWithDeviceOrient = camTiltWithDeviceOrient;
  state.lightTiltWithMousePos = lightTiltWithMousePos;
  state.lightTiltWithDeviceOrient = lightTiltWithDeviceOrient;

  state.size = sizeBivot;
  state.exposure = exposureBivot;
  state.aoStrength = aoStrengthBivot;
  state.backgroundColor = backgroundColorBivot;

  // Load bivot (if not waiting for shutdown and not deferred)
  useEffect(() => {
    // console.debug(`Load Bivot useEffect ${id} -- isLoadPending: ${isLoadPending} isShuttingDown: ${isShuttingDown} deferLoading: ${deferLoading}`);
    if (isLoadPending && !isShuttingDown && deferLoading !== true) {
      console.debug(`All clear ${id}: proceeding with loadBivot()`);
      setIsLoadPending(false);
      loadBivot();
    }
  }, [isLoadPending, isShuttingDown, deferLoading]);

  const shutdownCompleteCallback = useCallback(() => {
    // console.debug(`shutdownCompleteCallback ${id}`);
    setIsShuttingDown(false);
  }, []);

  // Shut down bivot when the whole material changes and get ready to load a new bivot after shutdown
  useEffect(() => {
    async function onChangeMaterial() {
      if (bivot.current) {
        // console.debug(`Initiating Bivot shutdown sequence... ${id}`);
        setIsShuttingDown(true);
        setIsLoadPending(true);
        bivot.current.shutdown(shutdownCompleteCallback);
        setDiag(undefined);
        setMeshScaling(1.0);
      }
    }
    onChangeMaterial();
  }, [material]);

  // Shut down bivot when the component closes
  useEffect(() => {
    return () => {
      // console.debug(`Component closing ${id}`);
      if (bivot.current) {
        // console.debug(`Component closing ${id} - shutting down Bivot`);
        bivot.current.shutdown();
        bivot.current = null;
      }
    };
  }, []);

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
    if (state && diag) {
      const mPerPix = state['metresPerPixelTextures'];
      const texDims = state['texDims'];
      var scaling = 1.0;
      if (mPerPix !== undefined && texDims !== undefined) {
        var dx = texDims[0];
        var dy = texDims[1];
        if (state['stretch']) {
          dx *= initialRepeatFactorX;
          dy *= initialRepeatFactorX * state['stretch'][0] / state['stretch'][1];
        }
        const diagTexPix = Math.sqrt(dx * dx + dy * dy);
        const diagTexM = diagTexPix * mPerPix;
        scaling = diagTexM / diag;  // diag: the mesh diagonal
      }
      const ratio = meshScaling / scaling;

      setMeshScaling(scaling);
      setZoom([zoom[0] * ratio, zoom[1] * ratio, zoom[2] * ratio]);
      setCurrentZoom(currentZoom * ratio);
      renderFrame(DirtyFlag.Zoom);
    }
  }, [state, diag]);

  useEffect(() => {
    async function onChangeFullScreen() {
      if (isFullScreenAvailable()) {
        if (fullScreen === true) {
          if (!getDocumentFullScreenElement()) {
            openFullScreen(getFullScreenElement());
          }
        } else if (fullScreen === false) {
          if (getDocumentFullScreenElement()) {
            closeFullScreen();
          }
        }
      }
    }
    onChangeFullScreen();
  }, [fullScreen]);

  useEffect(() => {
    if (objectMesh !== undefined) {
      updateMeshOverride(objectMesh);
    }
  }, [objectMesh]);

  useEffect(() => {
    if (cachedMeshes) {
      updateMeshesToCache(cachedMeshes);
    }
  }, [cachedMeshes]);

  useEffect(() => {
    setUserEnableKeypress(enableKeypress);
  }, [enableKeypress]);

  useEffect(() => {
    updateShowSeams(Boolean(tilingSeams));
  }, [tilingSeams]);

  useEffect(() => {
    updateBoundary(tilingBoundary);
  }, [tilingBoundary]);

  useEffect(() => {
    updateSubBoundary(tilingSubBoundary);
  }, [tilingSubBoundary]);

  useEffect(() => {
    const update = {};
    if (userGrid) {
      const { grid, source } = userGrid; // userGridSelection
      const { grid: selectionGrid, source: selectionSource } = userGridSelection; // userGridSelection
      updateGrid(grid, selectionGrid, Boolean(showUserGrid), Boolean(showUserGridSelection), Boolean(userGridSelectionEnabled), source, selectionSource);
    } else {
      updateGrid(null, null, Boolean(showUserGrid), Boolean(showUserGridSelection), Boolean(userGridSelectionEnabled), null, null);
    }
  }, [userGrid, userGridSelection, showUserGrid, showUserGridSelection, userGridSelectionEnabled]);

  useEffect(() => {
    updatePointsControl(userPointsControl);
  }, [userPointsControl]);

  useEffect(() => {
    sizeRef.current = sizeBivot;
    renderFrame(DirtyFlag.Canvas);
  }, [sizeBivot]);

  useEffect(() => {
    updateBackgroundColor({ hex: backgroundColorBivot });
  }, [backgroundColorBivot]);

  useEffect(() => {
    updateUserScale(tilingScale);
  }, [tilingScale]);

  useEffect(() => {
    updateHoverDisabledOverride(hoverDisabled);
  }, [hoverDisabled]);

  useEffect(() => {
    updateAutoRotateOverride(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    updateTextureLayer(textureDebug);
  }, [textureDebug]);

  useEffect(() => {
    setUserPixellated(pixellated);
    renderFrame(DirtyFlag.Textures);
  }, [pixellated]);

  // Watch for full screen change
  useEffect(() => {
    document.addEventListener('fullscreenchange', fullScreenChanged);
    return () => {
      document.removeEventListener('fullscreenchange', fullScreenChanged);
    }
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
    if (statusCallback !== undefined) {
      statusCallback(1); // Loading
    }
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
      onGridSelect: userGridOnSelect,
      onPointSelect: userPointsOnSelect,
      onDrawing: userPointsOnSet,
    };
    console.debug('Options:', options);
    console.debug(`new Bivot ${canvasID}`);
    bivot.current = new Bivot(options);
    bivot.current.checkWebGL();
    bivot.current.startRender();

    copyStateFields(state, checkpointState);
    setLoading(false);

    updateAutoRotateOverride(autoRotate);
    updateHoverDisabledOverride(hoverDisabled);
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
      cameraPan,
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
      stretch,
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
    updateCameraPan(cameraPan);
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
    updateStretch(stretch);

    // Update initial zoom value after loading state
    zoomInitialVal = zoom;

    if (bivot.current) {
      renderFrame(DirtyFlag.All);
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
  async function loadingCompleteCallback(shimmerLoaded, meshLoaded) {
    if (bivot.current) {
      renderFrame(DirtyFlag.Overlay);

      console.debug('Bivot loading complete.  Shimmer:', shimmerLoaded, '  Mesh:', meshLoaded);
      if (statusCallback !== undefined) {
        statusCallback(2); // Loaded
      }

      if (meshLoaded) {
        try {
          setDiag(bivot.current.getDiag());
        } catch(e) {
          console.debug('bivot.current.getDiag() unavailable');
        }
        const meshPath = bivot.current.getMeshPathUsed();
        if (meshChoices && Object.values(meshChoices).includes(meshPath)) {
          setMeshOverride(meshPath);
        }
      }
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
      brightness, contrast,
      zoom: [zoom[0] * meshScaling, currentZoom * meshScaling, zoom[2] * meshScaling],
      currentZoom: currentZoom * meshScaling,
      size: sizeBivot,
      exposure: exposureBivot,
      aoStrength: aoStrengthBivot,
      backgroundColor: backgroundColorBivot,
      autoRotatePeriodMs, lightType, areaLightWidth, areaLightHeight,
      meshRotateZDegrees: rotation,
      lightColor: lightColorBivot,
      dragControlsRotation, dragControlsPanning,
      meshOverride, colorTemperature, hue, saturation,
      camTiltWithMousePos, camTiltWithDeviceOrient, camTiltLimitDegrees,
      lightTiltWithMousePos, lightTiltWithDeviceOrient, lightTiltLimitDegrees,
      autoRotateFps, autoRotateCamFactor, autoRotateLightFactor, bloom,
      cameraPan,
    }
    // cameraPan is an array in file
    const savedStateFile = { ...savedState, ...{ cameraPan: cameraPanArray } };
    config.state = { ...config.state, ...savedStateFile };
    delete config.state.portrait; // Strip out legacy portrait flag, if present

    const { userId, materialId } = material;
    const success = await writeState(userId, materialId, materialSetInternal);
    if (success) {
      copyStateFields(savedState, checkpointState);
    }
  }

  function stateReset() {
    updateStateFields(checkpointState);
  }

  function renderFrame(stateDirty=0) {
    state.dirty |= stateDirty;
    if (bivot.current) {
      bivot.current.requestRender();
    }
  }

  function updateExposure(val) {
    setExposureBivot(val);
    renderFrame();
  }

  function updateBrightness(val) {
    setBrightness(val);
    renderFrame();
  }

  function updateContrast(val) {
    setContrast(val);
    renderFrame();
  }

  function updateLightType(type, size) {
    setLightType(type);
    setAreaLightWidth(referenceAreaLightWidth * size);
    setAreaLightHeight(referenceAreaLightHeight * size);
    renderFrame(DirtyFlag.Lighting);
  }

  function updateCameraPan(pan) {
    setCameraPanArray([pan.x, pan.y, pan.z]);
    renderFrame(DirtyFlag.ControlsPan);
  }

  function updateRotation(degrees) {
    setRotation(degrees);
    renderFrame(DirtyFlag.MeshRotation);
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
    setSizeAndRef(val);
    renderFrame(DirtyFlag.Canvas);
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
      renderFrame(DirtyFlag.Zoom);
    }
  }

  function updateZoomFinished() {
    zoomIndex = -1;
  }

  function updateLightColor(val) {
    setLightColorControls(val.hex); // Controls: needs a hex value
    setLightColorBivot([val.rgb.r, val.rgb.g, val.rgb.b]); // Bivot state: needs RGB array
    renderFrame(DirtyFlag.Lighting);
  }

  function updateBackgroundColor(val) {
    setBackgroundColorBivot(val.hex);
    renderFrame(DirtyFlag.Background);
  }

  function updateColorTemperature(val) {
    setColorTemperature(val);
    renderFrame(DirtyFlag.Color);
  }

  function updateHue(val) {
    setHue(val);
    renderFrame();
  }

  function updateSaturation(val) {
    setSaturation(val);
    renderFrame();
  }

  function updateStretch(val) {
    setStretch(val ? val : null);
    renderFrame(DirtyFlag.Stretch);
  }

  function updateUserScale(val) {
    setUserScale(val);
    renderFrame(DirtyFlag.Stretch | DirtyFlag.Overlay);
  }

  function updateAutoRotate(val) {
    setAutoRotatePeriodMs(autoRotate === false ? 0 : val);
    renderFrame();
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
    renderFrame(DirtyFlag.Controls);
  }

  function updateMeshOverride(path) {
    if (meshOverride !== path) {
      setMeshOverride(path);
      renderFrame(DirtyFlag.Mesh);
    }
  }

  function updateMeshesToCache(meshes) {
    setMeshesToCache(meshes);
    renderFrame(DirtyFlag.Mesh);
  }

  function updateAoStrength(val) {
    setAoStrengthBivot(val);
    renderFrame();
  }

  function updateShowSeams(val) {
    setShowSeams(val);
    renderFrame(DirtyFlag.Overlay);
  }

  function updateBoundary(path) {
    setBoundary(path);
    renderFrame(DirtyFlag.Overlay);
  }

  function updateSubBoundary(path) {
    setSubBoundary(path);
    renderFrame(DirtyFlag.Overlay);
  }

  function updateGrid(grid, selection, gridVisible, selectionVisible, selectEnabled, source, selectionSource) {
    //console.log('updateGrid():', grid, selection, gridVisible, selectionVisible, selectEnabled, source, selectionSource)
    state.overlayRepeats = !selectionVisible;
    setGrid(grid);
    setGridSelection(selection);
    setShowGrid(gridVisible);
    setShowGridSelection(selectionVisible);
    setEnableGridSelect(selectEnabled);
    // Only call Bivot's updateGrid method if the source of the grid update was external to Bivot
    if (selectionSource === 'external' && bivot.current) {
      bivot.current.updateGrid(selection);
    }
    renderFrame(DirtyFlag.Overlay);

  }

  function updatePointsControl(userPointsControl) {
    setPointsControl(userPointsControl);
    renderFrame(DirtyFlag.Overlay);
  }

  function updateTextureLayer(val) {
    if ([1, 2, 3, 4, 5, 6].includes(val)) {
      state.textureLayer = val;
    } else {
      state.textureLayer = 0;
    }
    renderFrame(DirtyFlag.TextureLayer);
  }

  function fullScreenChanged() {
    const fsElt = getDocumentFullScreenElement();
    if (fsElt && fsElt === getFullScreenElement()) {
      // My full screen opened
      savedSizeRef.current = sizeRef.current;
      setSizeAndRef([window.screen.width, window.screen.height]);
      renderFrame(DirtyFlag.Canvas);
    } else if (!fsElt && savedSizeRef.current) {
      // My full screen closed
      setSizeAndRef(savedSizeRef.current);
      renderFrame(DirtyFlag.Canvas);
      savedSizeRef.current = undefined;
      if (onExitFullScreen) {
        onExitFullScreen();
      }
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
            <Paper style={styles.controlPanel} elevation={0} variant='outlined'>
              <AppBar
                position='static'
                style={{
                  backgroundColor: theme.palette.accent.main,
                  boxShadow: 'none',
                  marginBottom: '1em',
                }}
              >
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  indicatorColor='secondary'
                  textColor='secondary'
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
                      <Grid item xs={1}>{decorators && decorators['exposure'] || ''}</Grid>
                      <Grid item xs={11}>
                        <IntensityControl value={exposureBivot} onChange={updateExposure} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['lightWidth'] || ''}</Grid>
                      <Grid item xs={11}>
                        <LightTypeControl type={lightType} size={areaLightWidth / referenceAreaLightWidth} onChange={updateLightType} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['lightColor'] || ''}</Grid>
                      <Grid item xs={11}>
                        <LightColorControl value={lightColorControls} onChange={updateLightColor} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['aoStrength'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AmbientOcclusionControl value={aoStrengthBivot} onChange={updateAoStrength} />
                      </Grid>
                      {/* <Grid item xs={1}>{decorators && decorators['showSeams'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ShowSeamsControl value={showSeams} onChange={updateShowSeams} />
                      </Grid> */}
                    </ React.Fragment>)}
                    {tabValue === 1 && (<React.Fragment>
                      <Grid item xs={1}>{decorators && decorators['colorTemperature'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ColorTemperatureControl value={colorTemperature} onChange={updateColorTemperature} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['hue'] || ''}</Grid>
                      <Grid item xs={11}>
                        <HueControl value={hue} onChange={updateHue} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['saturation'] || ''}</Grid>
                      <Grid item xs={11}>
                        <SaturationControl value={saturation} onChange={updateSaturation} />
                      </Grid>
                      <Grid item xs={1}></Grid>
                      <Grid item xs={11}>
                        <BackgroundColorControl value={backgroundColorBivot} onChange={updateBackgroundColor} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['brightness'] || ''}</Grid>
                      <Grid item xs={11}>
                        <BrightnessControl value={brightness} onChange={updateBrightness} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['contrast'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ContrastControl value={contrast} onChange={updateContrast} />
                      </Grid>
                    </React.Fragment>)}
                    {tabValue === 2 && (<React.Fragment>
                      <Grid item xs={1}>{decorators && decorators['aspectRatio'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AspectControl value={sizeBivot} onChange={updateAspect} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['zoom'] || ''}</Grid>
                      <Grid item xs={11}>
                        <ZoomControl value={zoom} max={diag * 4} onChange={updateZoom} onChangeCommitted={updateZoomFinished} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['rotation'] || ''}</Grid>
                      <Grid item xs={11}>
                        <MaterialRotationControl value={rotation} onChange={addRotation} />
                      </Grid>
                      <Grid item xs={1}>{decorators && decorators['autoRotate'] || ''}</Grid>
                      <Grid item xs={11}>
                        <AutoRotateControl value={autoRotatePeriodMs} onChange={updateAutoRotate} />
                      </Grid>
                      {meshChoices && (
                        <React.Fragment>
                          <Grid item xs={1}>{decorators && decorators['objectMesh'] || ''}</Grid>
                          <Grid item xs={11}>
                            <MeshOverrideControl
                              overrides={meshChoices}
                              value={meshOverride}
                              onChange={updateMeshOverride}
                            />
                          </Grid>
                        </ React.Fragment>
                      )}
                      <Grid item xs={1}>{decorators && decorators['dragControl'] || ''}</Grid>
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
                  <Grid container direction='row' wrap='nowrap' justifyContent='space-between'>
                    <Grid item>
                    <Grid container spacing={1}>
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
