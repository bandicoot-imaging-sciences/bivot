# Bivot material viewer

Bivot renders a Bandicoot dynamic material image in a web browser window.

Features:
* View fine material texture and gloss with diffuse colour, specular roughness, metalness, normals and a mesh.
* Control lighting using mouse position or device tilt.
* Supports most modern browsers and devices (rendering is implemented using WebGL).

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

## Tilt control on iOS

In iOS 13, Safari allows web pages to ask the user for permission to access tilt controls. When Bivot detects
iOS 13 (or higher), a button is displayed to enable tilt control. When the user presses the button, iOS will
then request access to the motion sensor. If the user clicks Allow, then tilt control is activated. Bivot must
be served over HTTPS for this to work.

Tilt control in Safari was disabled for all web pages by default in iOS 12.2 - 12.4 (starting March 2019). To
work around this issue:
* make sure Bivot is being served over HTTPS (not HTTP),
* switch on Settings > Safari > Motion & Orientation Access, and then
* reload the page.

## License

Bivot is released under the MIT license (see the `LICENSE` file). Licenses for additional code adapted into
Bivot are in the `THIRD-PARTY.md` file.
