# Bivot material viewer

## Install

* Clone the bivot repository.
* Copy the folders `textures` and `third_party` from **OneDrive - Documents - Bandicoot - Data - bivot** into
  the checked out folder `bivot`.
* Install local web server, e.g. webfs if using Windows Subsystem for Linux / Ubuntu Linux:
  * `$ sudo apt install webfs`

## Usage

* Start a local web server in the `bivot` folder:
  * `webfsd -l - -F -f index.html [-p 8000 -i 192.168.0.11 -b user:pwd]`
* Open the local web server address in your browser (default address is `localhost:8000`).