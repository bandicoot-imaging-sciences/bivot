# Texture format for Bivot

Bivot uses the Disney Principled BRDF [1] shader to render material appearance. There are 2 variants
supported:
1. Metal/roughness model
2. BIS model

Materials are stored in a `textures` folder, with sub-folders for each material. The texture file format is 16
bit half float EXR. Textures are 1k, 2k or 4k square.

## Metal/roughness model

This model is intended to match the common physically-based rendering (PBR) metal/roughness model used in
visual effects and rendering tools such as Substance, Redshift, Maya, KeyShot, Three.js and Blender.

Each material sub-folder contains the following files:

1. `brdf-basecolor_cropf16.exr` - RGB basecolour in linear sRGB (scaled so that a white diffuse object is
   approximately 1.0, nominal 0 to 1 range, channel names RGB)
2. `brdf-normals_cropf16.exr` - Normal map in object space (3 channel, unit vectors in XYZ, OpenGL convention,
   scaled to 0 to 1 range, with 0.5 being zero-length component, channel names RGB)
3. `brdf-roughness-metallic_cropf16.exr` - Three-channel specular image (channel names RGB):
    1. Channel 1: Specular roughness (0 to 1 range)
    2. Channel 2: Metallic (0 to 1 range)
    3. Channel 3: Empty
4. `brdf-mesh.obj` - Mesh (decimated, distances are in metres)

## BIS model

This model is a modified version of the Disney BRDF, designed by Bandicoot Imaging Sciences (BIS) for use with
our material scanning technology. Key differences compared to standard implementations are:
* Uses 3 maps to describe the specular behaviour: specular amplitude, roughness and tint.
* The diffuse colour is used when tint is high, however the diffuse colours tend to have quite low values for
  tinted pixels, which are then scaled up in the shader.

Each material sub-folder contains the following files:

1. `brdf-diffuse_cropf16.exr` - Diffuse RGB colour in linear sRGB (sensor counts divided by 2^14, 0 to 1 range)
2. `brdf-normals_cropf16.exr` - Normal map in object space (3 channel, unit vectors in XYZ, OpenGL convention,
   scaled to 0 to 1 range, with 0.5 being zero-length component)
3. `brdf-specular-srt_cropf16.exr` - Three-channel specular image:
    1. Channel 1: Specular amplitude (0 to 1 nominal range, but some values are larger)
    2. Channel 2: Specular roughness (0 to 1 range)
    3. Channel 3: Specular tint (0 to 1 range, where 1 means the specular reflection is tinted by the colour
       from the diffuse map; behaves a bit like "metalness")
4. `brdf-mesh.obj` - Mesh (decimated, distances are in metres)

# References

[1] B. Burley, "Physically-Based Shading at Disney", SIGGRAPH course, 2012.
https://disney-animation.s3.amazonaws.com/library/s2012_pbs_disney_brdf_notes_v2.pdf

