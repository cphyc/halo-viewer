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


export type SpectrumJSON =
    | { lambda: number[]; flux: number[] } // common format
    | { pairs: [number, number][] }; // alternative format


export type Manifest = {
    halos: { id: string; name?: string }[];
};