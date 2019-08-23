# Bivot material viewer

Bivot renders a Bandicoot dynamic material image in a web browser window.

Features:
* View fine material texture and gloss with diffuse colour, specular amplitude, specular roughness, specular tint, and normals.
* Control lighting using mouse position or device tilt.
* Supports most modern browsers and devices (rendering is implemented using WebGL).

## Install

* Clone the bivot repository.
* Inside the `bivot` folder:
  * Create a folder called `textures`.
  * Create a folder called `third_party`.
  * Download [ThreeJS](http://threejs.org) and unpack into the `third_party` folder.
* Install local web server, e.g. webfs if using Windows Subsystem for Linux / Ubuntu Linux:
  * `$ sudo apt install webfs`

## Usage

* Start a local web server in the `bivot` folder:
  * `webfsd -l - -F -f index.html [-p 8000 -i 192.168.0.x -b user:pwd]`
* Open the local web server address in your browser (default address is `localhost:8000`).

## Adding a new dataset

* Create EXR floating point texture maps which use the Disney-Bandicoot BRDF
  model:
  * `brdf-diffuse.exr`: Diffuse colour (RGB)
  * `brdf-normals.exr`: Tangent-space unit normals (XYZ), with X and Y in the range -1 to 1
  * `brdf-specular-srt.exr`: Specular amplitude, roughness and tint (3 channels)
* Run the texture map conversion script `tex_deploy.py` to create texture files that are ready to use with
  Bivot (run with `python3 tex_deploy.py --help` for help).
* Copy the output EXR files to a new folder `<texture-name>` inside the `bivot/textures` folder.
* Edit `bivot-renders.json` to add the new `<texture-name>` to the `scans` variable.

## Tilt control on iOS

Tilt control in Safari was disabled for all web pages by default in iOS 12.2 (released March 2019). To work
around this issue:
* make sure Bivot is being served over HTTPS (not HTTP),
* switch on Settings > Safari > Motion & Orientation Access, and then
* reload the page.

After iOS 13 is released (expected in September 2019) this will get easier as Safari will allow web pages to ask the user for permission to access tilt controls.