#!/usr/bin/env node

/**
 * Script to convert ASCII halo catalog to SQLite database
 * Usage: node scripts/convert-ascii-to-sqlite.js <input.ascii> <output.sqlite>
 */

import fs from 'fs';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertAsciiToSqlite(inputPath, outputPath) {
  console.log(`Converting ${inputPath} to ${outputPath}...`);

  // Read the ASCII file
  const asciiContent = fs.readFileSync(inputPath, 'utf-8');
  const lines = asciiContent.split('\n');

  // Initialize sql.js
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE halos (
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
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Parse ASCII file
  let h0 = 1;
  const headerLine = lines.shift();
  const headers = headerLine ? headerLine.slice(1).trim().split(/\s+/) : [];

  console.log(`Found ${headers.length} columns: ${headers.join(', ')}`);

  let insertedCount = 0;
  let skippedCount = 0;

  // Prepare insert statement
  const stmt = db.prepare(
    'INSERT INTO halos (id, x, y, z, mass, r200b, rc) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const line of lines) {
    // Parse Hubble parameter from header comments
    if (line.startsWith('#Om')) {
      const match = line.match(/#h0\s*=\s*([\d.]+)/);
      if (match) {
        h0 = parseFloat(match[1]);
        console.log(`Found h0 = ${h0}`);
      }
    }

    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') continue;

    const columns = line.trim().split(/\s+/);
    if (columns.length !== headers.length) {
      console.warn('Skipping line with unexpected number of columns:', line);
      skippedCount++;
      continue;
    }

    try {
      const id = parseInt(columns[headers.indexOf('id')]);
      const mass = parseFloat(columns[headers.indexOf('m200b')]) / h0;
      const x = (parseFloat(columns[headers.indexOf('x')]) - 25) / h0;
      const y = (parseFloat(columns[headers.indexOf('y')]) - 25) / h0;
      const z = (parseFloat(columns[headers.indexOf('z')]) - 25) / h0;
      const rc = parseFloat(columns[headers.indexOf('Rs')]) / 1000 / h0;
      const r200b = parseFloat(columns[headers.indexOf('r200b')]) / 1000 / h0;

      // Skip invalid data
      if (
        isNaN(id) ||
        isNaN(mass) ||
        isNaN(x) ||
        isNaN(y) ||
        isNaN(z) ||
        isNaN(rc) ||
        isNaN(r200b)
      ) {
        skippedCount++;
        continue;
      }

      stmt.run([id, x, y, z, mass, r200b, rc]);
      insertedCount++;
    } catch (error) {
      console.error('Error processing line:', line, error);
      skippedCount++;
    }
  }

  stmt.free();

  // Insert metadata
  db.run('INSERT INTO metadata (key, value) VALUES (?, ?)', ['h0', h0.toString()]);

  console.log(`Inserted ${insertedCount} halos, skipped ${skippedCount} lines`);

  // Export database to file
  const data = db.export();
  fs.writeFileSync(outputPath, data);

  // Clean up
  db.close();

  console.log(`Database saved to ${outputPath}`);
  console.log(`File size: ${(data.length / 1024).toFixed(2)} KB`);
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: node convert-ascii-to-sqlite.js <input.ascii> <output.sqlite>');
  process.exit(1);
}

const [inputPath, outputPath] = args;

convertAsciiToSqlite(inputPath, outputPath).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
