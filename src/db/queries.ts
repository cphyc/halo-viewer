import { eq, sql, and, gte } from 'drizzle-orm';
import { getDb } from './client';
import { halos, metadata } from './schema';
import type { HaloCatalogData, HaloCatalog } from '../types';

/**
 * Get a single halo by ID
 */
export async function getHaloById(haloId: number): Promise<HaloCatalogData | null> {
  const db = getDb();
  const result = await db.select().from(halos).where(eq(halos.id, haloId)).limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0] as HaloCatalogData;
}

/**
 * Get all halos with optional mass threshold
 */
export async function getAllHalos(massThreshold: number = 0): Promise<HaloCatalogData[]> {
  const db = getDb();
  const query =
    massThreshold > 0
      ? db.select().from(halos).where(gte(halos.mass, massThreshold))
      : db.select().from(halos);

  const result = await query;
  return result as HaloCatalogData[];
}

/**
 * Get catalog statistics
 */
export async function getCatalogStats(): Promise<HaloCatalog['stats']> {
  const db = getDb();

  // Get aggregate statistics using SQL
  const statsResult = await db
    .select({
      total: sql<number>`count(*)`,
      minMass: sql<number>`min(mass)`,
      maxMass: sql<number>`max(mass)`,
      minX: sql<number>`min(x)`,
      maxX: sql<number>`max(x)`,
      minY: sql<number>`min(y)`,
      maxY: sql<number>`max(y)`,
      minZ: sql<number>`min(z)`,
      maxZ: sql<number>`max(z)`,
    })
    .from(halos);

  const stats = statsResult[0];

  return {
    total: stats.total,
    massRange: [stats.minMass, stats.maxMass],
    positionRange: {
      x: [stats.minX, stats.maxX],
      y: [stats.minY, stats.maxY],
      z: [stats.minZ, stats.maxZ],
    },
  };
}

/**
 * Get the full catalog with statistics
 */
export async function getFullCatalog(): Promise<HaloCatalog> {
  const [haloData, stats, h0Value] = await Promise.all([
    getAllHalos(),
    getCatalogStats(),
    getMetadata('h0'),
  ]);

  return {
    halos: haloData,
    h0: h0Value ? parseFloat(h0Value) : 1.0,
    stats,
  };
}

/**
 * Get metadata value by key
 */
export async function getMetadata(key: string): Promise<string | null> {
  const db = getDb();
  const result = await db.select().from(metadata).where(eq(metadata.key, key)).limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].value;
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(metadata)
    .values({ key, value })
    .onConflictDoUpdate({ target: metadata.key, set: { value } });
}
