#!/usr/bin/env python3
# Copyright (C) Bandicoot Imaging Sciences 2019.
"""
Given raw BRDF textures produced by bach, produce textures for bivot rendering:
- Trim the texture pixel dimensions to an even number;
- Make textures a square power of 2 (as required by WebGL1);
- Clip the pixel value range as required by the output format;
- Scale the values to the output format range.

The textures are added to the list of renders for a target bivot directory.
"""
import os
import glob
import numpy as np
import pyexr
import imageio
# import png  # Used for 16-bit PNG writing (currently disabled)
import argparse


def clip_warn(im, clip_min, clip_max, verbose=False):
    """Clip an image's values using the given minimum and maximum values.
    A warning is produced on the console if any clipping was performed.
    Non-numerical values (nan) are set to 1.0, also with a warning.

    Args:
        im          The image to clip channel values.

        clip_min    The minimum channel value to clip to.

        clip_max    The maximum channel value to clip to.

        verbose     True to produce verbose console output; False for errors and warnings only.
                    (Default: False)

    Returns:
        The clipped image.
    """
    (im_min, im_max) = (im.min(), im.max())
    if verbose:
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

    if verbose:
        print('    Output:', im.min(), im.max())
    return im


def pad_crop(im, target_x, target_y, verbose=False):
    """Given an input image and target size, produce an image with the given
    X and Y size using padding or cropping (no scaling or resampling).

    If the image has odd number of pixels in X or Y, the final pixel in that dimension
    will be dropped.

    Padding and cropping is applied symmetrically to each side, in each of the X and Y dimensions.

    Args:
        im          The input image as a 3D numpy array (X, Y, chans).

        target_x    The target X size of the image in pixels.

        target_y    The target Y size of the image in pixels.

        verbose     True to produce verbose console output; False for errors and warnings only.
                    (Default: False)

    Returns:
        The cropped and/or padded image.
    """
    (ys, xs, zs) = im.shape
    if verbose:
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

    if verbose:
        print('    Output:', cropped_im.shape)

    return cropped_im


def tex_process(textype, im, format='u8', tex_size=(2048, 2048), verbose=False):
    """Process a BRDF texture to produce a render-ready texture image.

    Args:
        textype     The type of texture to process ('diffuse', 'normals', or 'specular').

        im          The raw BRDF texture to process as a floating point numpy array.

        format      The format of the image to produce ('u8', 'u8x2', or 'f16').

        tex_size    The X and Y size of the texture to produce.
                    (Default: (2048, 2048))

        verbose     True to produce verbose console output; False for errors and warnings only.
                    (Default: False)

    Returns:
        The processed texture image, as a numpy array whose type corresponds to format.
    """
    im_out = im.copy()

    if textype == 'normals':
        # Rescale normals from -1:1 range to 0->1 range.
        im_out = im_out / 2 + 0.5
        if format == 'u8' or format == 'u8x2':
            # Scale from 0->1 range to 0->64k range.
            im_out *= 65535
    elif textype == 'specular':
        if format == 'u8' or format == 'u8x2':
            # Scale from 0->1 range to 0->64k range.
            im_out *= 65535

    # Clip to the specified range and convert to the specified data type
    if format == 'f16':
        clip_min = np.finfo(np.float16).min
        clip_max = np.finfo(np.float16).max
        data_type = np.float16
    elif format == 'u8' or format == 'u8x2':
        clip_min = 0
        clip_max = 65535
        data_type = np.uint16
    im_out = clip_warn(im_out, clip_min, clip_max)

    # Pad and/or crop to power of 2 dimensions
    (padxs, padys) = tex_size
    im_out = pad_crop(im_out, padxs, padys)

    return im_out.astype(data_type)


def write_im_exr_f16(im, path, suffix='_cropf16'):
    """Write a floating point image to a 16-bit floating point EXR file.

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
    """Write a 16-bit image to a pair of high byte and low byte 8-bit JPGs

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


def write_im_png8(im, path, suffix='_cropu8'):
    """Write a 16-bit image to an 8-bit PNG

    Args:
        im          The image to write, as a uint16 numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropu8')
    """
    out_name = path.replace('.exr', suffix + '_hi.png')

    im = im / 256
    print('  Writing image: ' + out_name)
    imageio.imwrite(out_name, im.astype(np.uint8))


def write_im_dual_png8(im, path, suffix='_cropu8'):
    """Write a 16-bit image to a pair of high byte and low byte 8-bit PNGs

    Args:
        im          The image to write, as a uint16 numpy array.

        path        The path of the image when it was read from file.

        suffix      The suffix to add to the input filename when writing the file.
                    (Default: '_cropu8')
    """
    out_name_lo = path.replace('.exr', suffix + '_lo.png')
    out_name_hi = path.replace('.exr', suffix + '_hi.png')

    im_hi, im_lo = np.divmod(im, 256)

    print('  Writing image: ' + out_name_lo)
    imageio.imwrite(out_name_lo, im_lo.astype(np.uint8))

    print('  Writing image: ' + out_name_hi)
    imageio.imwrite(out_name_hi, im_hi.astype(np.uint8))


def write_im_png16(im, path, suffix='_cropu16'):
    """Write a 16-bit image to a 16-bit PNG.

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


def update_json(dataset_name, bivot_dir):
    """Update a bivot-renders.json file in a bivot directory to insert the new dataset.
    No change is made if the dataset is already present.  The previous json file is
    backed up as bivot-renders-OLD.json.

    Args:
        dataset_name    The name of the dataset to insert.

        bivot_dir       The directory of the bivot instance to update.
    """
    json_path = os.path.join(bivot_dir, 'bivot-renders.json')
    bak_path = os.path.join(bivot_dir, 'bivot-renders-OLD.json')

    present = False
    with open(json_path, 'r') as f:
        rows = f.readlines()
        # Check if the dataset name is already present.
        present = False
        for r in rows:
            if '"' + dataset_name + '"' in r:
                present = True
                break

        if not present:
            index = -1
            while True:
                if rows[index].strip() == '}' and rows[index - 1].strip() == '}':
                    index -= 1
                    break
                else:
                    index -= 1

            # Add comma to previous final entry
            rows[index - 1] = rows[index - 1].replace('}\n', '},\n')

            # Add new entry
            entry = '    "' + dataset_name + '": {"version": 2}\n'
            rows.insert(index, entry)

    if present:
        print('(Dataset "' + dataset_name + '" already present in ' + json_path + '; not re-adding)')
    else:
        # Back up old JSON file
        if os.path.exists(bak_path):
            os.remove(bak_path)
        os.rename(json_path, bak_path)

        # Write new JSON file
        print('Adding dataset "' + dataset_name + '" to ' + json_path)
        with open(json_path, 'w') as f:
            f.writelines(rows)


def parseargs():
    """Define and execute parser for command line arguments.
    """
    parser = argparse.ArgumentParser(description='Prepare BRDF textures for bivot rendering.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('bach_dir',             metavar='PATH',                                    help='Path of the input Bach textures to process.')
    parser.add_argument("-bivot_dir",           metavar='PATH',   dest='bivot_dir', required=True, help='Directory containing the bivot instance to update')
    parser.add_argument("-format",   nargs='+', metavar='FORMAT', dest='format',    default='u8',  help='Output image format for textures: u8 or f16.  Multiple formats may be selected.')
    parser.add_argument("-name",                metavar='NAME',   dest='name',      default=None,    help='Name of the bivot render dataset.  If unspecified, a default name will be set based on bach_dir.')
    parser.add_argument("-clobber",             action="store_true", dest='clobber',               help='Allow clobbering an existing bivot dataset.')

    # parse command line args
    args = parser.parse_args()
    return args


if __name__ == "__main__":
    in_paths = {
        'diffuse': 'brdf-diffuse.exr',
        'normals': 'brdf-normals.exr',
        'specular': 'brdf-specular-srt.exr',
    }

    args  = parseargs()

    dataset_name = args.name
    if dataset_name is None:
        brdf_path = os.path.basename(os.path.abspath(os.path.join(args.bach_dir)))
        if '-' in brdf_path:
            brdf_path = (brdf_path.split('-'))[-1]
        dataset_path = os.path.basename(os.path.abspath(os.path.join(args.bach_dir, '..')))
        dataset_name = dataset_path + ' ' + brdf_path

    print('Generating dataset:     ', dataset_name)
    print('Target bivot location:  ', args.bivot_dir)

    # Determine and create the path for the texture in the bivot directory
    tex_out_path = os.path.join(args.bivot_dir, 'textures', dataset_name)
    if os.path.exists(tex_out_path):
        if not args.clobber:
            print('  *** Error: Target bivot texture path "' + tex_out_path + '" already exists.')
            print('             (Invoke with "-clobber" to force overwrite.)')
            exit(0)
        else:
            print('  *** Warning: Target bivot texture path "' + tex_out_path + '" already exists.')
            print('               Overwriting...')
    else:
        os.mkdir(tex_out_path)

    images = []
    for (textype, filename) in in_paths.items():
        path = os.path.join(args.bach_dir, filename)
        print('  Reading image:', path)
        images.append(pyexr.read(path))

    # Process and output the textures
    for (textype, filename, im) in zip(in_paths.keys(), in_paths.values(), images):
        if textype == 'specular':
            out_fn = os.path.join(tex_out_path, 'brdf-' + textype + '-srt.exr')
        else:
            out_fn = os.path.join(tex_out_path, 'brdf-' + textype + '.exr')

        if 'u8' in args.format:
            tex_out = tex_process(textype, im, format='u8')
            write_im_png8(tex_out, out_fn)
        if 'u8x2' in args.format:
            tex_out = tex_process(textype, im, format='u8x2')
            write_im_dual_png8(tex_out, out_fn)
        if 'f16' in args.format:
            tex_out = tex_process(textype, im, format='f16')
            write_im_exr_f16(tex_out, out_fn)

    # Append render to list of available renders
    update_json(dataset_name, args.bivot_dir)
