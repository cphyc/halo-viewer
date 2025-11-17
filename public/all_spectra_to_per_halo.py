import argparse
import gzip
import json
import os
from collections import defaultdict

import numpy as np


def dump_data(output, wvls, data, ichunk, output_dir):
    # Write out the per-halo spectrum files
    new_data = {
        "output": output,
        "wavelength": wvls,
        "data": data,
    }

    this_output_dir = os.path.join(output_dir, output)
    os.makedirs(this_output_dir, exist_ok=True)
    output_file = os.path.join(this_output_dir, f"halos_{ichunk}.json.gz")
    print(f"Writing {output_file} with {len(data)} halos")
    with gzip.open(output_file, "wt") as out_f:
        json.dump(new_data, out_f)


def main():
    parser = argparse.ArgumentParser(description="Convert all halo spectra from a single file to per-halo files.")
    parser.add_argument(
        "input_file",
        type=str,
        help="Path to the input all_spectra.json file.",
    )
    parser.add_argument(
        "output_dir",
        type=str,
        help="Directory to save per-halo spectrum files.",
    )
    parser.add_argument(
        "--bucket_size",
        type=int,
        default=1000,
        help="Maximum number of halos per output file.",
    )
    args = parser.parse_args()

    # Load the all_spectra.json file
    with open(args.input_file, "r") as f:
        all_spectra = json.load(f)

    output_dir = args.output_dir
    bucket_size = args.bucket_size

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Iterate over outputs
    for output, values in sorted(all_spectra.items(), key=lambda _: _[0], reverse=True):
        wvls = None

        # Put the halos in buckets
        new_data = defaultdict(dict)
        for halo_id, data in sorted(values.items(), key=lambda x: int(x[0])):
            halo_id_int = int(halo_id)

            # Read in the wavelength, total, popIII, popII, nebular continuum
            # and two-photon data
            if wvls is None:
                wvls = data["wvls"]
            else:
                np.testing.assert_array_equal(wvls, data["wvls"])

            ibucket = halo_id_int // bucket_size

            # Remove wavelengths from data to save space
            del data["wvls"]

            new_data[ibucket][halo_id] = data

        for bucket, halo_data in new_data.items():
            dump_data(output, wvls, halo_data, bucket, output_dir)
