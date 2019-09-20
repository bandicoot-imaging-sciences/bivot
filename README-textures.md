# Texture format for Bivot

Bivot uses a modified Disney Principled BRDF [1] shader to render material appearance.

Materials are stored in a `textures` folder, with sub-folders for each material. Each material sub-folder
contains the following files:

1. `brdf-diffuse_cropf16.exr` - Diffuse RGB colour in linear sRGB (sensor counts divided by 2^14, 0 to 1 range)
2. `brdf-normals_cropf16.exr` - Normal map in object space (3 channel, unit vectors in XYZ, OpenGL convention, scaled to 0 to 1 range, with 0.5 being zero-length component)
3. `brdf-specular-srt_cropf16.exr` - Three-channel specular image:
    1. Channel 1: Specular amplitude (0 to 1 nominal range, but some values are larger)
    2. Channel 2: Specular roughness (0 to 1 range)
    3. Channel 3: Specular tint (0 to 1 range, where 1 means the specular reflection is tinted by the colour
       from the diffuse map; behaves a bit like "metalness")
4. `brdf-mesh.obj` - Mesh (decimated, distances are in metres)

The texture file format is 16 bit half float EXR. Textures are 2k square.

# References

[1] B. Burley, "Physically-Based Shading at Disney", SIGGRAPH course, 2012.
https://disney-animation.s3.amazonaws.com/library/s2012_pbs_disney_brdf_notes_v2.pdf

