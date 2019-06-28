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

(padxs, padys) = (512, 512)
paths = glob.glob('*.exr')
suffix = '_cropf16'
paths = [pp for pp in paths if suffix not in pp and '_padf16' not in pp]
padpaths = [pp.replace('.exr', suffix + '.exr') for pp in paths]
specular = None
roughness = None
for (path, padpath) in zip(paths, padpaths):
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
    print('Writing cropped/padded image:', padpath)
    pyexr.write(padpath, imf16crop, precision=pyexr.HALF, compression=pyexr.PIZ_COMPRESSION)
    if 'specular' in path:
        specular = imf16crop
        specpath = path
    if 'roughness' in path:
        roughness = imf16crop
(ys, xs, zs) = specular.shape
imboth = np.zeros((ys, xs, 3))
imboth[..., 0] = specular[..., 0]
imboth[..., 1] = roughness[..., 0]
bothpath = specpath.replace('specular', 'specrough').replace('.exr', suffix + '.exr')
print('Writing merged cropped/padded image:', bothpath)
pyexr.write(bothpath, imboth, precision=pyexr.HALF, compression=pyexr.PIZ_COMPRESSION)
