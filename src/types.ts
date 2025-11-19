export type HaloGlobalInfo = {
  id: string; // e.g., "000001"
  name?: string;
  dm_mass: number; // Msun
  stellar_mass: number; // Msun
  r_vir: number; // kpc
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

export type SpectrumJSON = {
  // gz-compressed multi-halo format
  output: string;
  wavelength: Float64Array;
  data: {
    [haloId: string]: {
      total?: Float64Array;
      popIII?: Float64Array;
      popII?: Float64Array;
      nebc?: Float64Array;
      two_phot_cool?: Float64Array;
    };
  };
};

export type Manifest = {
  halos: { id: string; name?: string }[];
};

export type SpecData = {
  lambda: Float64Array | number[];
  flux: Float64Array | number[];
};

export type QuadData = {
  px: Float64Array;
  py: Float64Array;
  pdx: Float64Array;
  pdy: Float64Array;
  value: Float64Array;
};
