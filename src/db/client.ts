import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { halos, metadata } from './schema';
import type { HaloCatalogData } from '../types';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize sql.js library
 */
async function initSqlJs_(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      // Load the wasm binary from the CDN
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }
  return SQL;
}

/**
 * Load database from a URL
 */
export async function loadDatabase(dbUrl: string): Promise<void> {
  const sqlJs = await initSqlJs_();

  // Fetch the database file
  const response = await fetch(dbUrl);
  if (!response.ok) {
    throw new Error(`Failed to load database: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  // Create database instance
  db = new sqlJs.Database(uint8Array);
  drizzleDb = drizzle(db);
}

/**
 * Create a new empty database (for testing or initialization)
 */
export async function createDatabase(): Promise<void> {
  const sqlJs = await initSqlJs_();
  db = new sqlJs.Database();
  drizzleDb = drizzle(db);

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS halos (
      id INTEGER PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      mass REAL NOT NULL,
      r200b REAL NOT NULL,
      rc REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

/**
 * Get the Drizzle database instance
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (!drizzleDb) {
    throw new Error('Database not initialized. Call loadDatabase() or createDatabase() first.');
  }
  return drizzleDb;
}

/**
 * Get the raw sql.js database instance
 */
export function getRawDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call loadDatabase() or createDatabase() first.');
  }
  return db;
}

/**
 * Export database to binary for saving
 */
export function exportDatabase(): Uint8Array {
  const rawDb = getRawDb();
  return rawDb.export();
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null && drizzleDb !== null;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    drizzleDb = null;
  }
}
