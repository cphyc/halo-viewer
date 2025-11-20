/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import {
  SpectrumJSON,
  Data1DJSON,
  HaloCatalog,
  HaloCatalogData,
  ResourcesConfig,
  ResourceConfig,
} from './types';

export const BASE = import.meta.env.VITE_DATA_BASE_URL as string | undefined;

// Cache for halo catalog data
let haloCatalogCache: HaloCatalog | null = null;
let haloCatalogPromise: Promise<HaloCatalog> | null = null;

export function resolve(urlOrPath: string): string {
  // If absolute, return; else join with BASE or local fallback.
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  if (BASE && BASE.length > 0) return `${BASE.replace(/\/$/, '')}/${urlOrPath.replace(/^\//, '')}`;
  return `/${urlOrPath.replace(/^\//, '')}`; // fallback to public/
}

export async function fetchJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(resolve(path), { signal });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function spectrumPath(id: number) {
  // If a path is given, return as-is. If an ID is provided, map to default demo path.
  const bucket_id = Math.floor(id / 1000);
  return `demo-halos/spectra/output_00100/halos_${bucket_id}.json.gz`;
}

export async function getHalo(id: string, signal?: AbortSignal): Promise<HaloCatalogData | null> {
  return getHaloFromCatalog(parseInt(id), signal);
}

export async function getSpectrum(
  specPath: string,
  haloId: number,
  signal?: AbortSignal
): Promise<SpectrumJSON> {
  // Check if it's a gz-compressed file
  const response = await fetch(resolve(specPath), { signal });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${specPath}`);

  const jsonData = (await response.json()) as SpectrumJSON;

  // Extract data for the specific halo ID
  const haloData = jsonData.data[haloId.toString()];
  if (!haloData) {
    throw new Error(`Halo ${haloId} not found in spectrum file`);
  }

  // Convert arrays to Float64Arrays
  const convertedHaloData: any = {};
  for (const [key, value] of Object.entries(haloData)) {
    if (Array.isArray(value)) {
      convertedHaloData[key] = Float64Array.from(value);
    } else {
      convertedHaloData[key] = value;
    }
  }

  // Return in the format with wavelength and data for this specific halo
  return {
    output: jsonData.output,
    wavelength: Float64Array.from(jsonData.wavelength),
    data: {
      [haloId.toString()]: convertedHaloData,
    },
  };
}

export async function getHalos(
  catalogUrl: string = 'demo-halos/cutouts/halos_00100.ascii',
  signal?: AbortSignal
): Promise<HaloCatalog> {
  // Return cached data if available
  if (haloCatalogCache) {
    return haloCatalogCache;
  }

  // If there's already a pending request, return that promise to avoid duplicate requests
  if (haloCatalogPromise) {
    return haloCatalogPromise;
  }

  // Create and cache the promise to prevent duplicate requests
  haloCatalogPromise = (async () => {
    try {
      const resolvedUrl = resolve(catalogUrl);

      const response = await fetch(resolvedUrl, { signal });

      if (!response.ok) {
        throw new Error(
          `Failed to load halo catalog: ${response.status} ${response.statusText} from ${resolvedUrl}`
        );
      }

      const text = await response.text();
      const lines = text.split('\n');
      const haloData: HaloCatalogData[] = [];
      let h0 = 1;

      // Parse first line for column headers
      const headerLine = lines.shift();

      const headers = headerLine ? headerLine.slice(1).trim().split(/\s+/) : [];

      for (const line of lines) {
        // Parse Hubble parameter from header comments
        if (line.startsWith('#Om')) {
          const match = line.match(/#h0\s*=\s*([\d.]+)/);
          if (match) {
            h0 = parseFloat(match[1]);
          }
        }

        // Skip comments and empty lines
        if (line.startsWith('#') || line.trim() === '') continue;

        const columns = line.trim().split(/\s+/);
        if (columns.length !== headers.length) {
          console.warn('Skipping line with unexpected number of columns:', line);
          continue;
        }

        const id = parseInt(columns[headers.indexOf('id')]);
        const mass = parseFloat(columns[headers.indexOf('m200b')]) / h0;
        const x = (parseFloat(columns[headers.indexOf('x')]) - 25) / h0;
        const y = (parseFloat(columns[headers.indexOf('y')]) - 25) / h0;
        const z = (parseFloat(columns[headers.indexOf('z')]) - 25) / h0;
        const rc = parseFloat(columns[headers.indexOf('Rs')]) / 1000 / h0;
        const r200b = parseFloat(columns[headers.indexOf('r200b')]) / 1000 / h0;

        // Skip invalid data
        if (
          isNaN(id) ||
          isNaN(mass) ||
          isNaN(x) ||
          isNaN(y) ||
          isNaN(z) ||
          isNaN(rc) ||
          isNaN(r200b)
        ) {
          continue;
        }

        haloData.push({ id, x, y, z, mass, r200b, rc });
      }

      if (haloData.length === 0) {
        throw new Error('No valid halo data found in catalog');
      }

      // Calculate statistics
      const masses = haloData.map((h) => h.mass);
      const xs = haloData.map((h) => h.x);
      const ys = haloData.map((h) => h.y);
      const zs = haloData.map((h) => h.z);

      const catalog: HaloCatalog = {
        halos: haloData,
        h0,
        stats: {
          total: haloData.length,
          massRange: [Math.min(...masses), Math.max(...masses)],
          positionRange: {
            x: [Math.min(...xs), Math.max(...xs)],
            y: [Math.min(...ys), Math.max(...ys)],
            z: [Math.min(...zs), Math.max(...zs)],
          },
        },
      };

      // Cache the successful result
      haloCatalogCache = catalog;
      return catalog;
    } catch (error) {
      console.error('Error in getHalos:', error);
      // Clear the promise cache on error so retries can happen
      haloCatalogPromise = null;
      throw error;
    }
  })();

  return haloCatalogPromise;
}

export async function getHaloFromCatalog(
  haloId: number,
  signal?: AbortSignal
): Promise<HaloCatalogData | null> {
  console.log('Fetching halo from catalog:', haloId);
  const catalog = await getHalos('demo-halos/cutouts/halos_00100.ascii', signal);
  return catalog.halos.find((h) => h.id === haloId) || null;
}

// Resources configuration cache
let resourcesConfigCache: ResourcesConfig | null = null;

export async function getResourcesConfig(signal?: AbortSignal): Promise<ResourcesConfig> {
  if (resourcesConfigCache) {
    return resourcesConfigCache;
  }

  try {
    const config = await fetchJSON<ResourcesConfig>('resources.json', signal);
    resourcesConfigCache = config;
    return config;
  } catch (error) {
    console.warn('Failed to load resources.json, using empty config:', error);
    return { resources: [] };
  }
}

// Generic function to get data path for a resource
export function getResourcePath(resource: ResourceConfig, haloId: number): string {
  const bucketId = Math.floor(haloId / 1000);
  return resource.pathTemplate
    .replace('{haloId}', haloId.toString().padStart(6, '0'))
    .replace('{bucketId}', bucketId.toString());
}

// Generic function to load 1D data from a resource
export async function getData1D(
  resource: ResourceConfig,
  haloId: number,
  signal?: AbortSignal
): Promise<Data1DJSON> {
  const path = getResourcePath(resource, haloId);

  const response = await fetch(resolve(path), { signal });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${path}`);

  const jsonData = (await response.json()) as Data1DJSON;

  if (resource.bundled) {
    // Extract data for the specific halo ID
    const haloData = jsonData.data[haloId.toString()];
    if (!haloData) {
      throw new Error(`Halo ${haloId} not found in bundled resource file`);
    }

    // Convert arrays to Float64Arrays
    const convertedHaloData: any = {};
    for (const [key, value] of Object.entries(haloData)) {
      if (Array.isArray(value)) {
        convertedHaloData[key] = Float64Array.from(value);
      } else {
        convertedHaloData[key] = value;
      }
    }

    // Return in the format with wavelength and data for this specific halo
    return {
      output: jsonData.output,
      wavelength: Float64Array.from(jsonData.wavelength),
      data: {
        [haloId.toString()]: convertedHaloData,
      },
    };
  } else {
    // Non-bundled: entire file is for this halo
    // Convert arrays to Float64Arrays
    const convertedData: any = { ...jsonData };
    if (Array.isArray(jsonData.wavelength)) {
      convertedData.wavelength = Float64Array.from(jsonData.wavelength);
    }
    return convertedData;
  }
}
