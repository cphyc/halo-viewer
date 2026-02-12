import { ParsedData, ParserFunction } from '../types';
import { resolve } from '../../api';

/**
 * Parser for Rockstar ASCII halo catalogs
 * Converts ASCII catalog format to standard ParsedData format
 */
export const rockstarCatalogue: ParserFunction = async (
  url: string,
  signal?: AbortSignal
): Promise<ParsedData> => {
  const resolvedUrl = resolve(url);
  const response = await fetch(resolvedUrl, { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to load halo catalog: ${response.status} ${response.statusText} from ${resolvedUrl}`
    );
  }

  const text = await response.text();
  const lines = text.split('\n');

  const ids: number[] = [];
  const labels: string[] = [];
  const masses: number[] = [];
  const positions_x: number[] = [];
  const positions_y: number[] = [];
  const positions_z: number[] = [];
  const rvirs: number[] = [];
  const rcs: number[] = [];

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
    if (isNaN(id) || isNaN(mass) || isNaN(x) || isNaN(y) || isNaN(z) || isNaN(rc) || isNaN(rvir)) {
      continue;
    }

    ids.push(id);
    labels.push(`Halo ${id} (M=${mass.toExponential(2)} M☉)`);
    masses.push(mass);
    positions_x.push(x);
    positions_y.push(y);
    positions_z.push(z);
    rvirs.push(rvir);
    rcs.push(rc);
  }

  if (ids.length === 0) {
    throw new Error('No valid halo data found in catalog');
  }

  // Return in standard ParsedData format
  return {
    ids,
    labels,
    masses,
    positions_x,
    positions_y,
    positions_z,
    rvirs,
    rcs,
    h0: [h0], // Single value as array
  };
};
