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
import imageio
# import png  # Used for 16-bit PNG writing (currently disabled)

def clip_warn(im, clip_min, clip_max):
    """Clip an image's values using the given minimum and maximum values.
    A warning is produced on the console if any clipping was performed.
    Non-numerical values (nan) are set to 1.0, also with a warning.

    Args:
        im          The image to clip channel values.

        clip_min    The minimum channel value to clip to.

        clip_max    The maximum channel value to clip to.

    Returns:
        The clipped image.
    """
    (im_min, im_max) = (im.min(), im.max())
    print('  Value range')
    print('    Input: ', im_min, im_max)

    nans = np.isnan(im)
    num_nans = np.count_nonzero(nans)
    if num_nans > 0:
        print('      *** Warning: input image contains %g nan values (setting to 1.0)' % num_nans)
        im[nans] = 1.0

    if im_min < clip_min:
        print('      *** Warning: input image %g < minimum %g (clipping)' % (im_min, clip_min))
    if im_max > clip_max:
        print('      *** Warning: input image %g > maximum %g (clipping)' % (im_max, clip_max))

    im = np.clip(im, clip_min, clip_max)

    print('    Output:', im.min(), im.max())
    return im


def pad_crop(im, target_x, target_y):
    """Given an input image and target size, produce an image with the given
    X and Y size using padding or cropping (no scaling or resampling).

    If the image has odd number of pixels in X or Y, the final pixel in that dimension
    will be dropped.

    Padding and cropping is applied symmetrically to each side, in each of the X and Y dimensions.

    Args:
        im          The input image as a 3D numpy array (X, Y, chans).

        target_x    The target X size of the image in pixels.

        target_y    The target Y size of the image in pixels.

    Returns:
        The cropped and/or padded image.
    """
    (ys, xs, zs) = im.shape
    print('  Dimensions')
    print('    Input: ', im.shape)

    (txs, tys) = (xs, ys)
    if xs % 2 == 1:
        txs = xs - 1
    if ys % 2 == 1:
        tys = ys - 1
    im = im[:tys, :txs, :]

    half_x = max((target_x - txs) // 2, 0)
    half_y = max((target_y - tys) // 2, 0)
    padded_im = np.pad(im, ((half_y, half_y), (half_x, half_x), (0, 0)), mode='constant', constant_values=0)

    (pys, pxs, _) = padded_im.shape
    if pxs > target_x or pys > target_y:
        x1 = (pxs - target_x) // 2
        x2 = (pxs - target_x) // 2 + target_x
        y1 = (pys - target_y) // 2
        y2 = (pys - target_y) // 2 + target_y
        cropped_im = padded_im[y1:y2, x1:x2, :]
    else:
        cropped_im = padded_im

    print('    Output:', cropped_im.shape)
    return cropped_im


def write_im_exr_f16(im, path, suffix='_cropf16'):
    """Write an image to a 16-bit floating point EXR file.

    Args:
        im          The image to write, as a floating point numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropf16')
    """
    out_name = path.replace('.exr', suffix + '.exr')
    print('  Writing image: ' + out_name)

    exr_precision = pyexr.HALF
    exr_compression = pyexr.PIZ_COMPRESSION

    pyexr.write(out_name, im, precision=exr_precision, compression=exr_compression)


def write_im_dual_jpg8(im, path, suffix='_cropu8'):
    """Write an image to a pair of high byte and low byte 8-bit JPGs

    Args:
        im          The image to write, as a uint16 numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropf16')
    """
    out_name_lo = path.replace('.exr', suffix + '_lo.jpg')
    out_name_hi = path.replace('.exr', suffix + '_hi.jpg')

    im_hi, im_lo = np.divmod(im, 256)
    q = 100

    print('  Writing image: ' + out_name_lo)
    imageio.imwrite(out_name_lo, im_lo.astype(np.uint8), quality=q)

    print('  Writing image: ' + out_name_hi)
    imageio.imwrite(out_name_hi, im_hi.astype(np.uint8), quality=q)


def write_im_dual_png8(im, path, suffix='_cropu8'):
    """Write an image to a pair of high byte and low byte 8-bit PNGs

    Args:
        im          The image to write, as a uint16 numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropf16')
    """
    out_name_lo = path.replace('.exr', suffix + '_lo.png')
    out_name_hi = path.replace('.exr', suffix + '_hi.png')

    im_hi, im_lo = np.divmod(im, 256)

    print('  Writing image: ' + out_name_lo)
    imageio.imwrite(out_name_lo, im_lo.astype(np.uint8))

    print('  Writing image: ' + out_name_hi)
    imageio.imwrite(out_name_hi, im_hi.astype(np.uint8))


def write_im_png16(im, path, suffix='_cropu16'):
    """Write an image to a 16-bit PNG.

    Args:
        im          The image to write, as a uint16 numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropf16')
    """
    out_name = path.replace('.exr', suffix + '.png')

    print('  Writing image: ' + out_name)
    with open(out_name, 'wb') as f:
        writer = png.Writer(width=im.shape[1], height=im.shape[0], bitdepth=16, greyscale=False)
        im_rows = im.reshape((-1, im.shape[1] * im.shape[2])).astype(np.uint16)
        writer.write(f, im_rows.tolist())


if __name__ == "__main__":
    paths = {
        'diffuse': 'brdf-diffuse.exr',
        'normals': 'brdf-normals.exr',
        'specular': 'brdf-specular-srt.exr',
    }

    #
    # If True, dump floating point EXR textures.
    # If False, dump integer PNG textures.
    #
    dump_float = True

    if dump_float:
        clip_min = np.finfo(np.float16).min
        clip_max = np.finfo(np.float16).max
        data_type = np.float16
    else:
        clip_min = 0
        clip_max = 65535
        data_type = np.uint16

    for (textype, path) in paths.items():
        print('Reading image:', path)
        im = pyexr.read(path)

        if textype == 'normals':
            # Rescale normals from -1:1 range to 0->1 range.
            im = im / 2 + 0.5
            if not dump_float:
                # Scale from 0->1 range to 0->64k range.
                im *= 65535
        elif textype == 'specular':
            if not dump_float:
                # Scale from 0->1 range to 0->64k range.
                im *= 65535

        # Clip to the specified range and convert to the specified data type
        im_clipped = clip_warn(im, clip_min, clip_max)

        # Pad and/or crop to power of 2 dimensions
        (padxs, padys) = (2048, 2048)
        im_cropped = pad_crop(im_clipped, padxs, padys)

        if dump_float:
            # Dump 16-bit float EXRs
            write_im_exr_f16(im_cropped, path)
        else:
            # Dump dual 8-bit PNGs
            write_im_dual_png8(im_cropped.astype(data_type), path)
            # Dump 16-bit PNGs (currently unused)
            #write_im_png16(im_cropped.astype(data_type), path)


    # TODO: Merge all channels into 2 x 4-channel images:
    # - RGB + Specular tint
    # - Normals (XY) + Specular amplitude + Specular roughness
    #   Assuming the XYZ normals are components of a unit vector, we can calculate the Z component from the XY
    #   components in the shader.

    # TODO: Encode in browser friendly format, e.g. PNG with RGBM16 encoding.

