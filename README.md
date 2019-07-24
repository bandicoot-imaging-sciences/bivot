# Bivot material viewer

## Install

* Clone the bivot repository.
* Copy the folders `textures` and `third_party` from **OneDrive - Documents - Bandicoot - Data - bivot** into
  the checked out folder `bivot`.
* Install local web server, e.g. webfs if using Windows Subsystem for Linux / Ubuntu Linux:
  * `$ sudo apt install webfs`

## Usage

* Start a local web server in the `bivot` folder:
  * `webfsd -l - -F -f index.html [-p 8000 -i 192.168.0.x -b user:pwd]`
* Open the local web server address in your browser (default address is `localhost:8000`).

## Adding a new dataset

* Change directory to a folder containing EXR floating point texture maps which use the Disney-Bandicoot BRDF
  model:
  * `brdf-diffuse.exr`: Diffuse colour (RGB)
  * `brdf-normals.exr`: Tangent-space unit normals (XYZ), with X and Y in the range -1 to 1
  * `brdf-specular-srt.exr`: Specular amplitude, roughness and tint (3 channels)
* Run texture map conversion script:
  * `$ python3 texpad.py`
* Copy the output EXR files to a new folder `<texture-name>` inside the `bivot/textures` folder
* Edit `bivot.js` to add the new `<texture-name>` to the `scans` variable.