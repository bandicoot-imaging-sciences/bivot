#!/usr/bin/env python3
# Copyright (C) Bandicoot Imaging Sciences 2019.
"""
Pad or crop EXR material textures to square power of 2.

iOS only has WebGL1, not WebGL2. WebGL1 requires textures to be a square power of 2.

This script also:
- trims the texture pixel dimensions to an even number,
- clips the pixel value range to fit in float16 (if needed, with a warning),
- converts the EXR to float16, and
- combines the specular amplitude and roughness into a single 3-channel image (third channel is zero).
"""
import glob

import numpy as np
import pyexr

# (padxs, padys) = (512, 512)
(padxs, padys) = (2048, 2048)
paths = {
    'diffuse': 'brdf-diffuse.exr',
    'normals': 'brdf-normals.exr',
    'specular': 'brdf-specular.exr',
    'roughness': 'brdf-roughness.exr',
}
suffix = '_cropf16'
adjpaths = dict([(tt, pp.replace('.exr', suffix + '.exr')) for (tt, pp) in paths.items()])
adjusted = {}
for (textype, path) in paths.items():
    print('Reading image:', path)
    im = pyexr.read(path)
    (ys, xs, zs) = im.shape
    if xs % 2 == 1:
        txs = xs - 1
    else:
        txs = xs - 1
    if ys % 2 == 1:
        tys = ys - 1
    else:
        tys = ys - 1
    im = im[:tys, :txs, :]
    halfpadx = max((padxs - txs)//2, 0)
    halfpady = max((padxs - tys)//2, 0)

    imin = im.min()
    fmin = np.finfo(np.float16).min
    if imin <= fmin:
        print('*** Warning: image test failed: min %g >= np.finfo(np.float16).min %g (clipping)' % (imin, fmin))
    imax = im.max()
    fmax = np.finfo(np.float16).max
    if imax >= fmax:
        print('*** Warning: image test failed: max %g <= np.finfo(np.float16).max %g (clipping)' % (imax, fmax))
    imclip = np.clip(im, fmin, fmax)

    imf16 = imclip.astype(np.float16)
    imf16pad = np.pad(imf16, ((halfpady, halfpady),(halfpadx, halfpadx), (0, 0)), 
                'constant', constant_values=0)
    (pys, pxs, _) = imf16pad.shape
    if (pxs > padxs or pys > padys):
        x1 = (pxs - padxs)//2
        x2 = (pxs - padxs)//2 + padxs
        y1 = (pys - padys)//2
        y2 = (pys - padys)//2 + padys
        imf16crop = imf16pad[y1:y2, x1:x2, :]
    else:
        imf16crop = imf16pad
    adjusted[textype] = imf16crop

# TODO: Merge all channels into 2 x 4-channel images:
# - RGB + Specular amplitude
# - Normals (XYZ) + Specular roughness
#   Or even just save 2D normals, and put those together with both specular channels (we can normalise the
#   normals in the shader).

# TODO: Encode in browser friendly format, e.g. PNG with RGBM16 encoding.

exr_precision = pyexr.HALF
exr_compression = pyexr.PIZ_COMPRESSION

print('Writing diffuse image:', adjpaths['diffuse'])
pyexr.write(adjpaths['diffuse'], adjusted['diffuse'], precision=exr_precision, compression=exr_compression)

print('Writing normals image:', adjpaths['normals'])
# Rescale normals from -1:1 range to the 0:1 range expected by Three.js shaders.
normscaled = adjusted['normals']/2 + 0.5
pyexr.write(adjpaths['normals'], normscaled, precision=exr_precision, compression=exr_compression)

# Merging specular channels into a single image with 3 channels (third channel is zero).
# EXRLoader only accepts 3-channel or 4-channel images.
specular = adjusted['specular']
roughness = adjusted['roughness']
(ys, xs, zs) = specular.shape
specrough = np.zeros((ys, xs, 3))
specrough[..., 0] = specular[..., 0]
specrough[..., 1] = roughness[..., 0]
path = adjpaths['specular'].replace('specular', 'specrough')
print('Writing specular/roughness image:', path)
pyexr.write(path, specrough, precision=exr_precision, compression=exr_compression)
