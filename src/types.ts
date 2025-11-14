export type HaloGlobalInfo = {
  id: string; // e.g., "000001"
  name?: string;
  dm_mass: number; // Msun
  stellar_mass: number; // Msun
  r_vir: number; // kpc
  // Map of label → image relative path (PNG/AVIF/JPG), e.g., { gas: "...", stars: "..." }
  images: Record<string, string>;
  // Path to spectrum JSON (relative or absolute)
  spectrum: string;
};

export type HaloCatalogData = {
  id: number;
  x: number;
  y: number;
  z: number;
  mass: number; // m200b column in Msun (h-corrected)
  r200b: number; // virial radius in Mpc (h-corrected)
  rc: number; // core radius in Mpc (h-corrected)
};

export type HaloCatalog = {
  halos: HaloCatalogData[];
  h0: number; // Hubble parameter
  stats: {
    total: number;
    massRange: [number, number];
    positionRange: {
      x: [number, number];
      y: [number, number];
      z: [number, number];
    };
  };
};

export type SpectrumJSON =
  | { lambda: number[]; flux: number[] } // common format
  | { pairs: [number, number][] }; // alternative format

export type Manifest = {
  halos: { id: string; name?: string }[];
};

export type SpecData = {
  lambda: Float64Array | number[];
  flux: Float64Array | number[];
};
