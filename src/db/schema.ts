import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

/**
 * Halo catalog table schema
 * Stores halo data with positions, masses, and radii
 */
export const halos = sqliteTable('halos', {
  id: integer('id').primaryKey(),
  x: real('x').notNull(), // Position in Mpc/h
  y: real('y').notNull(), // Position in Mpc/h
  z: real('z').notNull(), // Position in Mpc/h
  mass: real('mass').notNull(), // m200b in solar masses (h-corrected)
  r200b: real('r200b').notNull(), // Virial radius in Mpc (h-corrected)
  rc: real('rc').notNull(), // Core radius in Mpc (h-corrected)
});

/**
 * Metadata table to store catalog-level information
 */
export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type HaloSchema = typeof halos.$inferSelect;
export type HaloInsert = typeof halos.$inferInsert;
