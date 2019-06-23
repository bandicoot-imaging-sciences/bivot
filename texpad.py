#!/usr/bin/env python3
# Copyright (C) Bandicoot Imaging Sciences 2019.
"""
Pad EXR material textures to square power of 2.

iOS only has WebGL1, not WebGL2. WebGL1 requires textures to be a square power of 2.

This script also:
- trims the texture pixel dimensions to an even number,
- clips the pixel value range to fit in float16 (if needed, with a warning), and
- converts the EXR to float16.
"""
import glob

import numpy as np
import pyexr

(padxs, padys) = (4096, 4096)
paths = glob.glob('*.exr')
paths = [pp for pp in paths if '_padf16' not in pp]
padpaths = [pp.replace('.exr', '_padf16.exr') for pp in paths]
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
    halfpadx = (padxs - txs)//2
    halfpady = (padxs - tys)//2

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
    print('Writing padded image:', padpath)
    pyexr.write(padpath, imf16pad, precision=pyexr.HALF)
