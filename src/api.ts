/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import {
  Data1DJSON,
  HaloCatalog,
  HaloCatalogData,
  ResourcesConfig,
  ResourceConfig,
  StructureConfig,
  StructureOption,
  SelectionState,
} from './types';
import { validateResources } from './validation';
import { parseData } from './parsers';

export const BASE = import.meta.env.VITE_DATA_BASE_URL as string | undefined;

// Cache for halo catalog requests - stores promises by URL
const haloCatalogCache = new Map<string, Promise<HaloCatalog>>();

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

export async function getHalo(
  simulationId: string,
  outputId: number,
  id: string,
  signal?: AbortSignal
): Promise<HaloCatalogData | null> {
  return getHaloFromCatalog(simulationId, outputId, parseInt(id), signal);
}

export async function getHalos(catalogUrl: string, signal?: AbortSignal): Promise<HaloCatalog> {
  // Check if we already have a cached promise for this URL
  const cached = haloCatalogCache.get(catalogUrl);
  if (cached) {
    return cached;
  }

  // Create a new promise for this URL
  const promise = (async () => {
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
        const match = line.match(/h\s*=\s*([\d.]+)/);
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
      const rvir = parseFloat(columns[headers.indexOf('rvir')]) / 1000 / h0;

      // Skip invalid data
      if (
        isNaN(id) ||
        isNaN(mass) ||
        isNaN(x) ||
        isNaN(y) ||
        isNaN(z) ||
        isNaN(rc) ||
        isNaN(rvir)
      ) {
        continue;
      }

      haloData.push({ id, x, y, z, mass, rvir: rvir, rc });
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

    return catalog;
  })();

  // Cache the promise before returning it
  haloCatalogCache.set(catalogUrl, promise);

  // If the promise fails, remove it from cache so retries can happen
  promise.catch(() => {
    haloCatalogCache.delete(catalogUrl);
  });

  return promise;
}

export async function getHaloFromCatalog(
  simulationId: string,
  outputId: number,
  haloId: number,
  signal?: AbortSignal
): Promise<HaloCatalogData | null> {
  console.log(`Fetching halo ${simulationId}/${outputId}/halo#${haloId}`);
  const url = `data/catalogues/${simulationId}/halos_${outputId}.0.ascii`;
  const catalog = await getHalos(url, signal);
  console.log('Catalog length is', catalog.halos.length);
  return catalog.halos.find((h) => h.id === haloId) || null;
}

// Resources configuration cache
let resourcesConfigCache: ResourcesConfig | null = null;

export async function getResourcesConfig(signal?: AbortSignal): Promise<ResourcesConfig> {
  if (resourcesConfigCache) {
    return resourcesConfigCache;
  }

  try {
    const data = await fetchJSON<unknown>('resources.json', signal);

    // Validate the data against the schema
    const config = validateResources(data);

    resourcesConfigCache = config;
    return config;
  } catch (error) {
    console.error('Failed to load or validate resources.json:', error);
    throw error;
  }
}

// Evaluate derived value from expression
export function evaluateDerivedValue(
  expression: string,
  selections: SelectionState
): string | number {
  try {
    // Create a function with selections as parameters
    const func = new Function(...Object.keys(selections), `return ${expression}`);
    return func(...Object.values(selections));
  } catch (error) {
    console.error('Failed to evaluate derived expression:', expression, error);
    throw error;
  }
}

// Replace placeholders in a template string with values from selections
export function replacePlaceholders(template: string, selections: SelectionState): string {
  let result = template;
  for (const [key, value] of Object.entries(selections)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value));
  }
  return result;
}

// Get available options for a structure item
export async function getStructureOptions(
  structure: StructureConfig,
  selections: SelectionState,
  signal?: AbortSignal
): Promise<StructureOption[]> {
  // If it's derived, compute the value (but we don't return options for derived items)
  if (structure.derived_from) {
    return [];
  }

  // If no pathTemplate, we can't fetch options
  if (!structure.pathTemplate) {
    return [];
  }

  // Replace placeholders in pathTemplate
  const path = replacePlaceholders(structure.pathTemplate, selections);

  // Use parser to load data
  const parser = structure.parser || 'json';
  const data = await parseData(path, parser, signal);

  // Extract options using idKey and valueKey
  const idKey = structure.idKey || 'id';
  const valueKey = structure.valueKey || 'name';

  const ids = data[idKey];
  const values = data[valueKey];

  if (!Array.isArray(ids)) {
    console.error('idKey does not point to an array:', idKey, data);
    return [];
  }

  // If valueKey exists and is an array, pair them; otherwise use ids as labels
  if (Array.isArray(values) && values.length === ids.length) {
    return ids.map((id, index) => ({
      id,
      label: String(values[index]),
    }));
  } else {
    return ids.map((id) => ({
      id,
      label: String(id),
    }));
  }
}

// Generic function to get data path for a resource
export function getResourcePath(resource: ResourceConfig, selections: SelectionState): string {
  let path = resource.pathTemplate;

  // Replace all placeholders
  path = replacePlaceholders(path, selections);

  return path;
}

// Generic function to load 1D data from a resource
export async function getData1D(
  resource: ResourceConfig,
  selections: SelectionState,
  signal?: AbortSignal
): Promise<Data1DJSON> {
  const path = getResourcePath(resource, selections);
  const haloId = selections.haloId as number;

  // Use parser to load data
  const parser = resource.parser || 'json';
  const jsonData = await parseData(path, parser, signal);

  if (resource.bucket_size > 0) {
    // Extract data for the specific halo ID
    const dataObj = jsonData.data as any;
    const haloData = dataObj[haloId.toString()];
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
