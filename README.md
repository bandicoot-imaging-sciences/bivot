# Bivot material viewer

Bivot is a web component for embedding Bandicoot Shimmer View images.

Example:

    <Bivot
      materialSet = 'https://publish.bandicootimaging.com.au/b1ec2d90/biv_gallery/material-set.json'
    />

Bivot is provided as a React component.  Bivot is also JavaScript embeddable.

Shimmer View content for Bivot can be created easily using the [Bandicoot web app](https://app.bandicootimaging.com.au).

Features:
*	Show how light plays over a material, including fine texture and gloss
*	Control the view and lighting angle using mouse position or device tilt
*	Wide support across browsers and devices (mobile and desktop)
*	Embed local Shimmers or remotely hosted Shimmers
*	Physically based rendering on GPU via WebGL
*	Fine-tune the Shimmer appearance using the Bandicoot web app editor

## Demo

Examples of Bivot being used on the web can be found in the [Bandicoot material gallery](https://bandicootimaging.com.au/retail/gallery.html).

## Installing

To install the Bivot React NPM package, run the following:

    npm install @bandicoot/bivot

Bivot React has two peer dependencies: `react`, and `@material-ui/core`.  If not already present, these also need to be installed in your local or global NPM environment, for example via the following command:

    npm install react @material-ui/core

## Embedding - React

A `<Bivot>` element embeds a single Shimmer View, specified via the `materialSet` property.  The materialSet can be local or on the web.

Multiple `<Bivot>` components can be embedded on the same page, if different `id` properties are set.

The `width` and `height` of a `<Bivot>` component can be overridden responsively.

An example showing these concepts is below.
  
    import { Bivot } from '@bandicoot/bivot';
    
    export default function ViewerExample({ width, height, mat1, mat2 }) {
      return (<>
        <Bivot
          id={1}
          materialSet={mat1}
          width={width}
          height={height}
        />
        <Bivot
          id={2}
          materialSet={mat2}
          width={width}
          height={height}
        />
      </>);
    }

A complete example app is provided in the `example` directory of the source repo.

### <Bivot> Props

    {
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
    
      // If true, Bivot renders with a fixed aspect ratio, with canvas width
      // changing responsively to fit the width of the parent element.  If false,
      // Bivot sets the canvas size directly from the width and height.
      // (Default: true)
      responsive,

      // ========== Advanced props ==========
    
      // If set to True, the Shimmer View is embedded as the featured element of
      // the web page.  This allows scroll wheel to zoom the Shimmer directly,
      // rather than requiring the ctrl key to be held down to zoom.
      featured,

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
    }

## Embedding - JavaScript

You can also embed Bivot into a web page using JavaScript.  For example:
<pre><code>&lt;canvas id="bivot-canvas">&lt;/canvas>
&lt;script type="module">
  const bivSrc = 'https://cdn.jsdelivr.net/gh/bandicoot-imaging-sciences/bivot<b>@v3.8.10</b>/src/bivot-js/dist/index.js';
  const materialSet = '<b>https://publish.bandicootimaging.com.au/b1ec2d90/biv_gallery/material-set.json</b>';
  import(bivSrc).then(m => {const bivot = new m.newBivot({materialSet}); bivot.checkWebGL(); bivot.startRender();});
&lt;/script></code></pre>

By default, the Shimmer is responsive, and fills the width of its container at a fixed aspect ratio.

Customisable parts of the embed snippet include:
*	**`@v3.8.10`** - The version of Bivot JS to use
*	**`https://publish.bandicootimaging.com.au/b1ec2d90/biv_gallery/material-set.json`** - Specify the Shimmer to embed

A complete example page with responsive layout is provided at `src/bivot-js/example/embed-bivot-js.html` in the source repo.

## License

Bivot is released under the MIT license (see the `LICENSE` file). Licenses for additional code adapted into
Bivot are in the `THIRD-PARTY.md` file.
