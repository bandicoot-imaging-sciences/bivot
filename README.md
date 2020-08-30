# Bivot material viewer

Bivot renders a Bandicoot dynamic material image in a web browser window.

Features:
* View fine material texture and gloss with diffuse colour, specular roughness, metalness, normals and a mesh.
* Control lighting using mouse position or device tilt.
* Supports most modern browsers and devices (rendering is implemented using WebGL).

## Embedding

You can embed Bivot into a web page, if the viewer is hosted on another site, for example:
```
<iframe width="600" height ="400" scrolling="no" 
  src="https://www.bandicootimaging.com.au/retail/biv_wallet/index.html">
</iframe>

```

However, there are [limitations on using iframes with titlt control on iOS](#Tilt-control-on-iOS).

## Install

* Clone the bivot repository.
* Create a folder called `textures` inside the `bivot` folder, and put your texture folders inside that (see
  "Adding a new dataset" below).
* Copy `bivot-config-sample.json` to `bivot-config.json` and modify to suit your needs.
* Copy `bivot-renders-sample.json` to `bivot-renders.json` and modify to suit your needs.
* Serve `index.html` using HTTPS to ensure tilt control works on mobile devices (see below).

## Use with local web server
* Set up a local web server:
  * Install local web server, e.g. webfs if using Windows Subsystem for Linux / Ubuntu Linux:
    * `$ sudo apt install webfs`
* Start a local web server in the `bivot` folder:
  * `webfsd -l - -F -f index.html [-p 8000 -i 192.168.0.x -b user:pwd]`
* Open the local web server address in your browser (default address is `localhost:8000`).

## Adding a new dataset

* Copy textures to a new folder `<texture-name>` inside the `bivot/textures`
  folder. 
  * See `README-textures.md` for details on the texture folder format.
  * You can download a working Bivot folder including a sample texture folder from
    https://www.bandicootimaging.com.au/samples/bandicoot-sample-kimono-j.zip
* Edit `bivot-renders.json` to add the new `<texture-name>` to the `scans` variable.

## Configuration

Bivot has several variables that control initialisation and display:

1. `config`: Global configuration applied before the first texture is loaded
2. `state`: Display state, set when each texture is loaded and updated using the viewer controls
3. `camera`: Camera position, updated using the viewer controls
4. `controls`: Additional camera controls

See the source code for the default values for the parameters in each variable.

Bivot has a multiple level configuration and control system:

1. `Bivot()` function parameters: set file paths and HTML element IDs
2. `bivot-config.json`: Intialise `config` and set the initial `state`
3. `bivot-renders.json`: List of textures to render, with `camera`, `controls` and `state` parameters to use
   when each texture is loaded
4. `render.json`: subset of `state` parameters derived from texture generation
5. Interface: slider controls for `state` and `camera`, only displayed if `config.showInterface` is `true`
6. Mouse control and device tilt: control camera and light positions

## Tilt control on iOS

In iOS 13, Safari allows web pages to ask the user for permission to access tilt controls. When Bivot detects
iOS 13 (or higher), a button is displayed to enable tilt control. When the user presses the button, iOS will
then request access to the motion sensor. If the user clicks Allow, then tilt control is activated. Bivot must
be served over HTTPS for this to work. Tilt control is blocked by iOS in cross-domain iframes.

Tilt control in Safari was disabled for all web pages by default in iOS 12.2 - 12.4 (starting March 2019). To
work around this issue:
* make sure Bivot is being served over HTTPS (not HTTP),
* switch on Settings > Safari > Motion & Orientation Access, and then
* reload the page.

## License

Bivot is released under the MIT license (see the `LICENSE` file). Licenses for additional code adapted into
Bivot are in the `THIRD-PARTY.md` file.
