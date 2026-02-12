import { ParserReference } from './parsers/types';

export type TableColumnConfig = {
  key: string;
  label: string;
  sortable?: boolean;
  defaultSort?: 'asc' | 'desc';
};

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
  rvir: number; // virial radius in Mpc (h-corrected)
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

// TODO: Define proper structure for 1D data JSON
export type Data1DJSON =
  | any
  | {
      [key: string]: Float64Array;
    };

export type Data1D = {
  x: Float64Array;
  y: Float64Array;
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

export type StructureConfig = {
  id: string;
  name: string;
  requires?: string[];
  derived_from?: string;
  pathTemplate?: string;
  idKey?: string;
  valueKey?: string;
  parser?: ParserReference;
  selectionType?: 'dropdown' | 'table';
  tableColumns?: TableColumnConfig[];
};

export type StructureOption = {
  id: string | number;
  label: string;
};

export type SelectionState = {
  [structureId: string]: string | number;
};

export type ResourceConfig = {
  id: string;
  name: string;
  type: '1D' | '2D' | '3D' | 'table';
  bucket_size: number;
  pathTemplate: string;
  dataKey?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  downloadable?: boolean;
  requires?: string[];
  parser?: ParserReference;
};

export type ResourcesConfig = {
  root: string;
  structure: StructureConfig[];
  resources: ResourceConfig[];
};
