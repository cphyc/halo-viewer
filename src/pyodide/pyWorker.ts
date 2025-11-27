/* eslint-disable no-restricted-globals */
// renders matplotlib PNGs, and can run custom Python code on a cutout using a local wheel.

let pyodide: any = null;
let wheelInstalled: Record<string, boolean> = {};
let initialized = false;

function post(type: string, payload: any = {}) {
  // @ts-ignore
  self.postMessage({ type, ...payload });
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  post('status', { status: 'loading pyodide' });
  // @ts-ignore
  self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');
  // @ts-ignore
  pyodide = await self.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
  return pyodide;
}

// async function ensureWheel(url: string) {
//   if (wheelInstalled[url]) return;
//   post('status', { status: `installing ${url}` });
//   console.log(`THERE with url ${url}`);
//   const micropip = pyodide.pyimport('micropip');
//   // Install from URL (should point to a pyodide-compatible wheel)
//   await micropip.install(url);
//   wheelInstalled[url] = true;
// }

// @ts-ignore
self.onmessage = async (e: MessageEvent) => {
  const { cmd } = e.data || {};
  try {
    if (cmd === 'initialize') {
      const { wheelUrls } = e.data;

      await ensurePyodide();

      post('status', { status: 'loading base packages' });

      const packages = ['micropip', 'yt', 'lzma'];
      for (const pkg of packages) {
        if (wheelInstalled[pkg]) continue;
        post('status', { status: `Installing package: ${pkg}` });
        await pyodide.loadPackage(pkg);
        wheelInstalled[pkg] = true;
      }

      if (wheelUrls) {
        const micropip = pyodide.pyimport('micropip');
        for (const wheelUrl of wheelUrls) {
          if (wheelInstalled[wheelUrl]) continue;
          post('status', { status: `Installing wheel: ${wheelUrl}` });
          await micropip.install(wheelUrl);
          wheelInstalled[wheelUrl] = true;
        }
      }
      initialized = true;
      post('initialized', { value: initialized });
    }
    if (cmd === 'isInitialized') {
      post('initialized', { value: initialized });
    }
    if (cmd === 'runCutout') {
      const { cutoutUrl, pyCode = '' } = e.data;
      const fullUrl = new URL(cutoutUrl, self.location.href).href;
      post('status', { status: `starting downloading dataset from ${fullUrl}` });
      const fetchPromise = fetch(fullUrl, { headers: { Accept: 'application/octet-stream' } });

      // Skeleton code: converts JS Uint8Array → Python bytes for user code
      const importsCode = `
import numpy as np
import yt
from yt_derived_fields.cutouts.loader import load_cutout
`;

      // After wheels are installed, import necessary modules
      post('status', { status: `importing code for loading dataset...` });
      await pyodide.runPythonAsync(importsCode);

      // Write directly to Pyodide FS
      post('status', { status: `waiting for dataset download to finish...` });
      const res = await fetchPromise;

      if (!res.ok) throw new Error(`Fetch ${res.status}: ${fullUrl}`);

      // Get the binary data as an ArrayBuffer
      const arrayBuffer = await res.arrayBuffer();

      // Write the cutout binary to Pyodide FS
      if (pyodide.FS.analyzePath('/cutout.bin').exists) {
        pyodide.FS.unlink('/cutout.bin'); // Remove if exists
      }
      pyodide.FS.writeFile('/cutout.bin', new Uint8Array(arrayBuffer));

      // User code to run on the cutout
      const loadDatasetCode = `
yt.mylog.error("load_cutout")
ds = load_cutout("/cutout.bin")

ad = ds.all_data().exclude_nan(("gas", "density"))

["__".join(_) for _ in ds.derived_field_list]`;

      post('status', { status: 'loading cutout data' });
      const fields = await pyodide.runPythonAsync(loadDatasetCode);
      post('status', { status: 'ready' });
      const field_names = fields.toJs() as string[];

      // Some fields cause issues: blacklist them
      const blacklist = new Set([
        'gas__baroclinic_vorticity_magnitude',
        'gas__baroclinic_vorticity_x',
        'gas__baroclinic_vorticity_y',
        'gas__baroclinic_vorticity_z',
        'gas__pressure_gradient_magnitude',
        'gas__pressure_gradient_x',
        'gas__pressure_gradient_y',
        'gas__pressure_gradient_z',
        'gas__density_gradient_magnitude',
        'gas__density_gradient_x',
        'gas__density_gradient_y',
        'gas__density_gradient_z',
        'index__virial_radius_fraction',
        'gas__averaged_density',
      ]);
      const filtered_field_names: string[] = field_names.filter((fname) => {
        return !blacklist.has(fname);
      });
      post('set-fields', { fields: filtered_field_names });
      post('loaded', {});
    }

    if (cmd == 'getQuadTree') {
      const { field, axis } = e.data;
      const getQuadCode = `
field_js = "${field}"
field = tuple(field_js.split("__"))

# Create quad mesh plot
proj = ds.proj(field, "${axis}", data_source=ad, weight_field=("gas", "density"))
center = list(ds.domain_center.value)

iaxis = "xyz".index("${axis}")
center = (*center[:iaxis], *center[iaxis+1:])
width = float(max(
  (ad["x"].max() - ad["x"].min()).to("code_length").value,
  (ad["y"].max() - ad["y"].min()).to("code_length").value,
  (ad["z"].max() - ad["z"].min()).to("code_length").value,
))
value = proj[field].value
yt.mylog.info("%s", width)

mask = np.isfinite(value)

px = proj["px"].value[mask]
py = proj["py"].value[mask]
pdx = proj["pdx"].value[mask]
pdy = proj["pdy"].value[mask]
value = value[mask]

(px, py, pdx, pdy, value, center, width)`;

      post('status', { status: 'getting quad mesh…' });
      const result = await pyodide.runPythonAsync(getQuadCode);
      post('status', { status: 'done' });
      const [px, py, pdx, pdy, data, center, width] = result.toJs() as [
        Float64Array,
        Float64Array,
        Float64Array,
        Float64Array,
        Float64Array,
        [number, number],
        number,
      ];

      post('quadtree-data', { px, py, pdx, pdy, value: data, center, width });
    }
  } catch (err: any) {
    // Replace newlines with html breaks for better display in browser
    const errorMessage = String(err && err.message ? err.message : err);
    post('error', { error: errorMessage });
  }
};
