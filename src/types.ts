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

// Generic 1D data (replaces SpectrumJSON for bundled format)
export type Data1DJSON = {
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

// Legacy alias for backward compatibility
export type SpectrumJSON = Data1DJSON;

export type Manifest = {
  halos: { id: string; name?: string }[];
};

// Generic 1D data structure
export type Data1D = {
  x: Float64Array | number[]; // x-axis values (e.g., wavelength, time, etc.)
  y: Float64Array | number[]; // y-axis values (e.g., flux, intensity, etc.)
};

// Legacy format for spectrum data (backward compatibility)
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

// Resource configuration types
export type AxisConfig = {
  label: string;
  unit: string;
  key?: string;
};

export type ResourceConfig = {
  id: string;
  name: string;
  type: '1D' | '2D' | '3D';
  bundled: boolean;
  pathTemplate: string;
  dataKey?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  downloadable?: boolean;
};

export type ResourcesConfig = {
  resources: ResourceConfig[];
};
