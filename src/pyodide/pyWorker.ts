/* eslint-disable no-restricted-globals */
// Classic worker that loads Pyodide from CDN, fetches spectrum JSON or binary cutouts,
// renders matplotlib PNGs, and can run custom Python code on a cutout using a local wheel.

let pyodide: any = null;
let wheelInstalled: Record<string, boolean> = {};

function post(type: string, payload: any = {}) {
  // @ts-ignore
  self.postMessage({ type, ...payload });
}

function toBase64(u8: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk) as any);
  }
  // @ts-ignore
  return btoa(binary);
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  post('status', { status: 'loading pyodide' });
  // @ts-ignore
  self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');
  // @ts-ignore
  pyodide = await self.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
  post('status', { status: 'loading base packages' });
  await pyodide.loadPackage(['micropip']);
  return pyodide;
}

async function ensureWheel(url: string) {
  await ensurePyodide();
  if (wheelInstalled[url]) return;
  post('status', { status: `installing ${url}` });
  const micropip = pyodide.pyimport('micropip');
  // Install from URL (should point to a pyodide-compatible wheel)
  await micropip.install(url);
  wheelInstalled[url] = true;
}

// @ts-ignore
self.onmessage = async (e: MessageEvent) => {
  const { cmd } = e.data || {};
  try {
    if (cmd === 'plot') {
      const { specUrl, width = 800, height = 400 } = e.data;
      await ensurePyodide();

      post('status', { status: 'fetching spectrum' });
      const res = await fetch(specUrl, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`Fetch ${res.status}: ${specUrl}`);
      const spec = await res.json();

      const lambdaArr: number[] = Array.isArray(spec.lambda)
        ? spec.lambda
        : (spec.pairs || []).map((p: [number, number]) => p[0]);
      const fluxArr: number[] = Array.isArray(spec.flux)
        ? spec.flux
        : (spec.pairs || []).map((p: [number, number]) => p[1]);

      pyodide.globals.set('lambda_js', lambdaArr);
      pyodide.globals.set('flux_js', fluxArr);
      pyodide.globals.set('W', width);
      pyodide.globals.set('H', height);

      post('status', { status: 'plotting with matplotlib' });
      await pyodide.loadPackage(['matplotlib']);
      const py = `
import io
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

lam = np.array(lambda_js, dtype=float)
f = np.array(flux_js, dtype=float)
fig = plt.figure(figsize=(W/100, H/100), dpi=100)
ax = fig.add_subplot(111)
ax.plot(lam, f, linewidth=1.0)
ax.set_xlabel('Wavelength')
ax.set_ylabel('Flux')
ax.grid(True, alpha=0.3)
fig.tight_layout()
buf = io.BytesIO()
fig.savefig(buf, format='png')
plt.close(fig)
png_bytes = buf.getvalue()
`;
      const png = await pyodide.runPythonAsync(py + `
png_bytes`);
      const u8 = png.toJs() as Uint8Array;
      const dataUrl = 'data:image/png;base64,' + toBase64(u8);
      post('image', { dataUrl });
      return;
    }

    if (cmd === 'runCutout') {
      const { cutoutUrl, wheelUrls, pyCode = '' } = e.data;
      await ensurePyodide();

      // Optional: install the wheel if provided
      if (wheelUrls) {
        for (const wheelUrl of wheelUrls) {
          console.log('Installing wheel:', wheelUrl);
          await ensureWheel(wheelUrl);
        }
      }

      const fullUrl = new URL(cutoutUrl, self.location.href).href;
      post('status', { status: `fetching cutout from ${fullUrl}` });
     
      // Skeleton code: converts JS Uint8Array → Python bytes for user code
      const loadCode = `
import numpy as np
import yt
from scipy.io import FortranFile
from yt_experiments.octree.converter import OctTree
import pooch
from enum import Enum
import unyt
from pathlib import Path
import io

url = "${fullUrl}"

class Scale(Enum):
    LINEAR = 0
    LOG = 1


header: list[tuple[str, Scale, str]] = [
    ("redshift", Scale.LINEAR, "1"),
    ("dx", Scale.LOG, "cm"),
    ("x", Scale.LINEAR, "Mpccm/h"),
    ("y", Scale.LINEAR, "Mpccm/h"),
    ("z", Scale.LINEAR, "Mpccm/h"),
    ("vx", Scale.LINEAR, "cm/s"),
    ("vy", Scale.LINEAR, "cm/s"),
    ("vz", Scale.LINEAR, "cm/s"),
    ("density", Scale.LOG, "mp/cm**3"),
    ("temperature", Scale.LOG, "K"),
    ("pressure", Scale.LINEAR, "dyne/cm**2"),
    ("iron_number_density", Scale.LOG, "1/cm**3"),
    ("oxygen_number_density", Scale.LOG, "1/cm**3"),
    ("nitrogen_number_density", Scale.LOG, "1/cm**3"),
    ("magnesium_number_density", Scale.LOG, "1/cm**3"),
    ("neon_number_density", Scale.LOG, "1/cm**3"),
    ("silicon_number_density", Scale.LOG, "1/cm**3"),
    ("calcium_number_density", Scale.LOG, "1/cm**3"),
    ("carbon_number_density", Scale.LOG, "1/cm**3"),
    ("sulfur_number_density", Scale.LOG, "1/cm**3"),
    ("carbon_monoxide_number_density", Scale.LOG, "1/cm**3"),
    ("oxygen_01", Scale.LINEAR, "1"),
    ("oxygen_02", Scale.LINEAR, "1"),
    ("oxygen_03", Scale.LINEAR, "1"),
    ("oxygen_04", Scale.LINEAR, "1"),
    ("oxygen_05", Scale.LINEAR, "1"),
    ("oxygen_06", Scale.LINEAR, "1"),
    ("oxygen_07", Scale.LINEAR, "1"),
    ("oxygen_08", Scale.LINEAR, "1"),
    ("nitrogen_01", Scale.LINEAR, "1"),
    ("nitrogen_02", Scale.LINEAR, "1"),
    ("nitrogen_03", Scale.LINEAR, "1"),
    ("nitrogen_04", Scale.LINEAR, "1"),
    ("nitrogen_05", Scale.LINEAR, "1"),
    ("nitrogen_06", Scale.LINEAR, "1"),
    ("nitrogen_07", Scale.LINEAR, "1"),
    ("carbon_01", Scale.LINEAR, "1"),
    ("carbon_02", Scale.LINEAR, "1"),
    ("carbon_03", Scale.LINEAR, "1"),
    ("carbon_04", Scale.LINEAR, "1"),
    ("carbon_05", Scale.LINEAR, "1"),
    ("carbon_06", Scale.LINEAR, "1"),
    ("magnesium_01", Scale.LINEAR, "1"),
    ("magnesium_02", Scale.LINEAR, "1"),
    ("magnesium_03", Scale.LINEAR, "1"),
    ("magnesium_04", Scale.LINEAR, "1"),
    ("magnesium_05", Scale.LINEAR, "1"),
    ("magnesium_06", Scale.LINEAR, "1"),
    ("magnesium_07", Scale.LINEAR, "1"),
    ("magnesium_08", Scale.LINEAR, "1"),
    ("magnesium_09", Scale.LINEAR, "1"),
    ("magnesium_10", Scale.LINEAR, "1"),
    ("silicon_01", Scale.LINEAR, "1"),
    ("silicon_02", Scale.LINEAR, "1"),
    ("silicon_03", Scale.LINEAR, "1"),
    ("silicon_04", Scale.LINEAR, "1"),
    ("silicon_05", Scale.LINEAR, "1"),
    ("silicon_06", Scale.LINEAR, "1"),
    ("silicon_07", Scale.LINEAR, "1"),
    ("silicon_08", Scale.LINEAR, "1"),
    ("silicon_09", Scale.LINEAR, "1"),
    ("silicon_10", Scale.LINEAR, "1"),
    ("silicon_11", Scale.LINEAR, "1"),
    ("sulfur_01", Scale.LINEAR, "1"),
    ("sulfur_02", Scale.LINEAR, "1"),
    ("sulfur_03", Scale.LINEAR, "1"),
    ("sulfur_04", Scale.LINEAR, "1"),
    ("sulfur_05", Scale.LINEAR, "1"),
    ("sulfur_06", Scale.LINEAR, "1"),
    ("sulfur_07", Scale.LINEAR, "1"),
    ("sulfur_08", Scale.LINEAR, "1"),
    ("sulfur_09", Scale.LINEAR, "1"),
    ("sulfur_10", Scale.LINEAR, "1"),
    ("sulfur_11", Scale.LINEAR, "1"),
    ("iron_01", Scale.LINEAR, "1"),
    ("iron_02", Scale.LINEAR, "1"),
    ("iron_03", Scale.LINEAR, "1"),
    ("iron_04", Scale.LINEAR, "1"),
    ("iron_05", Scale.LINEAR, "1"),
    ("iron_06", Scale.LINEAR, "1"),
    ("iron_07", Scale.LINEAR, "1"),
    ("iron_08", Scale.LINEAR, "1"),
    ("iron_09", Scale.LINEAR, "1"),
    ("iron_10", Scale.LINEAR, "1"),
    ("iron_11", Scale.LINEAR, "1"),
    ("neon_01", Scale.LINEAR, "1"),
    ("neon_02", Scale.LINEAR, "1"),
    ("neon_03", Scale.LINEAR, "1"),
    ("neon_04", Scale.LINEAR, "1"),
    ("neon_05", Scale.LINEAR, "1"),
    ("neon_06", Scale.LINEAR, "1"),
    ("neon_07", Scale.LINEAR, "1"),
    ("neon_08", Scale.LINEAR, "1"),
    ("neon_09", Scale.LINEAR, "1"),
    ("neon_10", Scale.LINEAR, "1"),
    ("hydrogen_01", Scale.LINEAR, "1"),
    ("hydrogen_02", Scale.LINEAR, "1"),
    ("helium_02", Scale.LINEAR, "1"),
    ("helium_03", Scale.LINEAR, "1"),
    ("Habing", Scale.LOG, "erg/s/cm**2"),
    ("Lyman_Werner", Scale.LOG, "erg/s/cm**2"),
    ("HI_Ionising", Scale.LOG, "erg/s/cm**2"),
    ("H2_Ionising", Scale.LOG, "erg/s/cm**2"),
    ("HeI_Ionising", Scale.LOG, "erg/s/cm**2"),
    ("HeII_ionising", Scale.LOG, "erg/s/cm**2"),
]


def load_cutout(filename: str | Path, boxsize: float = 50, h0: float = 0.6727, verbose: bool = True):
    """Load a Megatron cutout file as a yt dataset.

    Parameters
    ----------
    filename : str | Path | url
        Path to the cutout file. If a URL, it will be downloaded using pooch.
    boxsize : boxsize in Mpccm/h
        The boxsize of the original simulation in comoving Mpc/h. Default is 50.
    h0 : float
        The Hubble constant of the original simulation. Default is 0.6727.
    verbose : bool
        Whether to show a progress bar when loading the data. Default is True.
    """
    original_path = path = Path(filename)

    if not path.exists():
        path = Path(pooch.retrieve(str(filename), known_hash=None))

    data = {}
    with FortranFile(path, "r") as ff:
        for name, scale, _unit in header:
            # Read in the quantity
            raw_data = ff.read_reals("float64")
            if scale == Scale.LOG:
                raw_data = 10 ** raw_data

            if name == "density":
                raw_data /= 0.76  # Convert from nH to rho in Python side
            data[name] = raw_data

    redshift = data.pop("redshift")[0]
    aexp = 1 / (1 + redshift)

    # Create a unyt registry
    boxsize_physical = boxsize * unyt.Mpc * aexp / h0
    registry = unyt.UnitRegistry()

    # Get xc (no need for unit conversion thus)
    xc = np.stack([data.pop(_) for _ in "xyz"], axis=-1)

    center = (xc.max(axis=0) + xc.min(axis=0)) / 2

    # Special case for dx (needs precise conversion from pc)
    dx = data.pop("dx") / 3.08e18 * unyt.pc / boxsize_physical

    # Convert everything else
    for name, _, unit in header:
        if name not in data:
            continue
        data[name] = unyt.unyt_array(data[name], unit, registry=registry)

    # Get level
    level = np.round(np.log2(1 / dx)).astype(int)

    yt.mylog.debug("Building octree")
    oct = OctTree.from_list(xc, level)

    yt.mylog.debug("Depth-first traversal")
    ref_mask, leaf_order = oct.get_refmask()

    nan_mask = np.where(leaf_order < 0, np.nan, 1)

    def reorder(dt):
        tmp = dt[leaf_order] * nan_mask
        return tmp[:, None]

    yt.mylog.debug("Reordering data according to octree leaf order")
    data = {("gas", k): reorder(v) for k, v in data.items()}

    left_edge = [0, 0, 0]
    right_edge = [1, 1, 1]

    params = {
        "cosmological_simulation": True,
        "current_redshift": redshift,
        "hubble_constant": h0,
    }

    yt.mylog.debug("Loading octree dataset")
    ds = yt.load_octree(
        octree_mask=ref_mask,
        data=data,
        bbox=np.array([left_edge, right_edge]).T,
        num_zones=1,
        dataset_name=original_path.name,
        parameters=params,
        length_unit=boxsize_physical,
    )
    ds.domain_center = ds.arr(center, "code_length")

    return ds

fname = pooch.retrieve(url, known_hash=None)

ds = load_cutout(fname)
ad = ds.all_data().exclude_nan(("gas", "density"))

["__".join(_) for _ in ds.derived_field_list]`;
      post('status', { status: 'loading dataset…' });
      const fields = await pyodide.runPythonAsync(loadCode);
      post('status', { status: 'ready' });
      const field_names = fields.toJs() as string[];
      console.log('Available fields:', field_names);
      post('set-fields', { fields: field_names });
      post('loaded', {});
   }

   if (cmd == 'plotCutout') {
     const { field, axis, width } = e.data;
     const plotCode = `
field_js = "${field}"
axis = "${axis}"
width = ${width} * unyt.kpc
field = tuple(field_js.split("__"))


# Create projection plot
p = yt.ProjectionPlot(
   ds,
   axis,
   field,
   center=ds.domain_center,
   width=width,
   data_source=ad
)
p.save("tmp.png")

# Read back PNG and send as data URL
with open("tmp.png", "rb") as f:
    png_bytes = f.read()
`;

      post('status', { status: 'plotting…' });
      const png = await pyodide.runPythonAsync(plotCode + `
png_bytes`);

      await pyodide.runPythonAsync("print(p)");
      const u8 = png.toJs() as Uint8Array;
      const dataUrl = 'data:image/png;base64,' + toBase64(u8);
      post('image', { dataUrl });
      // You can extend this to return structured results (e.g., images, numbers)
      post('plotting-done', { ok: true });
      return;
    }
  } catch (err: any) {
    post('error', { error: String(err && err.message ? err.message : err) });
  }
};