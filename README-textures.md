# Texture format for Bivot

Bivot uses the Disney Principled BRDF [1] shader to render material appearance. There are 2 variants
supported:
1. Metal/roughness model
2. BIS model (deprecated)

Materials are stored in a `textures` folder, with sub-folders for each material. Textures are 1k, 2k or 4k
square. The texture file formats supported are:
* 8 bit PNG, RGB channels
* 8 bit JPEG, RGB channels
* 16 bit half float stored in a pair of 8 bit PNG images, RGB channels (one image each for low 8 and high 8
  bits)
* 16 bit half float EXR, RGB channel names

## Metal/roughness model

This model is intended to match the common physically-based rendering (PBR) metal/roughness model used in
visual effects and rendering tools such as Substance, Redshift, KeyShot, Three.js and Blender.

Each material sub-folder contains the following files (EXR format):

1. `brdf-basecolor_cropf16.exr` - RGB basecolour in linear sRGB (scaled so that a white diffuse object is
   approximately 1.0, nominal 0 to 1 range, channel names RGB)
2. `brdf-normals_cropf16.exr` - Normal map in object space (3 channel, unit vectors in XYZ, DirectX
   convention, scaled to 0 to 1 range, with 0.5 being zero-length component, channel names RGB)
3. `brdf-roughness-metallic_cropf16.exr` - Three-channel specular image (channel names RGB):
    1. Channel 1: Specular roughness (0 to 1 range)
    2. Channel 2: Metallic (0 to 1 range)
    3. Channel 3: Empty
4. `brdf-mesh.obj` - Mesh in Wavefront OBJ format (decimated, distances are in metres)

For other file formats, the filenames are in the following forms:

* 8 bit PNG: `brdf-basecolor_cropu8_hi.png`
* 8 bit JPEG: `brdf-basecolor_cropu8_hi.jpg`
* 16 bit PNG: `brdf-basecolor_cropu8_lo.png` and `brdf-basecolor_cropu8_hi.png`

## Texture render settings

Each texture folder also contains a `render.json` file, which includes key parameters from texture generation,
including:

* `brdfModel`: BRDF model (integer: `0` for BIS, `1` for metal/roughness, `2` for PBR)
* `brdfVersion`: version of model (float)
* `illumL`: detected scan illumination level in sensor counts (float)
* `yFlip`: y-axis flipping (boolean, default is `false`)


# References

[1] B. Burley, "Physically-Based Shading at Disney", SIGGRAPH course, 2012.
https://disney-animation.s3.amazonaws.com/library/s2012_pbs_disney_brdf_notes_v2.pdf
