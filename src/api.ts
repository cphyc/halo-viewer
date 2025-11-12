import { HaloGlobalInfo, Manifest, SpectrumJSON } from './types';

export const BASE = import.meta.env.VITE_DATA_BASE_URL as string | undefined;

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

export function haloPath(id: string) {
  return `demo-halos/halo_${id}.json`;
}

export function spectrumPath(idOrPath: string) {
  // If a path is given, return as-is. If an ID is provided, map to default demo path.
  if (/\.(json)$/i.test(idOrPath) || /\//.test(idOrPath)) return idOrPath;
  return `demo-halos/halo_${idOrPath}_spectrum.json`;
}

export async function getManifest(signal?: AbortSignal): Promise<Manifest> {
  // Optional manifest for ID listing. If missing, synthesize a small list.
  try {
    return await fetchJSON<Manifest>('manifest.json', signal);
  } catch {
    return { halos: [
      { id: '000001', name: 'Demo Halo 1' },
      { id: '000002', name: 'Demo Halo 2' }
    ]};
  }
}

export async function getHalo(id: string, signal?: AbortSignal): Promise<HaloGlobalInfo> {
  return fetchJSON<HaloGlobalInfo>(haloPath(id), signal);
}

export async function getSpectrum(specPath: string, signal?: AbortSignal): Promise<SpectrumJSON> {
  return fetchJSON<SpectrumJSON>(specPath, signal);
}