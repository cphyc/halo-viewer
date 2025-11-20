# Halo Database SQLite Implementation

This directory contains the SQLite database implementation for halo catalogues using sql.js and Drizzle ORM.

## Overview

The implementation replaces ASCII-based halo catalogue loading with SQLite databases that run in the browser via sql.js (SQLite compiled to WebAssembly).

## Architecture

- **schema.ts**: Database schema definition using Drizzle ORM
- **client.ts**: Database initialization and connection management
- **queries.ts**: Type-safe query functions using Drizzle ORM
- **index.ts**: Public API exports

## Features

- **Type-safe queries**: All queries are type-safe using Drizzle ORM
- **Browser compatibility**: Runs entirely in the browser using sql.js
- **Backwards compatibility**: Falls back to ASCII parsing if SQLite database is not available
- **Caching**: Database is loaded once and cached in memory
- **Efficient querying**: Uses indexed queries for fast lookups

## Database Schema

### halos table
- `id` (INTEGER PRIMARY KEY): Halo ID
- `x` (REAL): Position X in Mpc/h
- `y` (REAL): Position Y in Mpc/h
- `z` (REAL): Position Z in Mpc/h
- `mass` (REAL): Mass (m200b) in solar masses (h-corrected)
- `r200b` (REAL): Virial radius in Mpc (h-corrected)
- `rc` (REAL): Core radius in Mpc (h-corrected)

### metadata table
- `key` (TEXT PRIMARY KEY): Metadata key
- `value` (TEXT): Metadata value

The metadata table stores catalog-level information like the Hubble parameter (h0).

## Converting ASCII to SQLite

Use the provided script to convert existing ASCII halo catalogues to SQLite:

```bash
npm run convert-catalog <input.ascii> <output.sqlite>
```

For example:
```bash
npm run convert-catalog public/demo-halos/cutouts/halos_00100.ascii public/demo-halos/cutouts/halos_00100.sqlite
```

## Usage

The SQLite implementation is integrated into the existing API in `src/api.ts`:

1. When `getHalos()` is called, it first tries to load a SQLite database
2. If the SQLite database is not available (404), it falls back to ASCII parsing
3. The SQLite database is loaded once and kept in memory for fast queries
4. Individual halo lookups use the ORM for efficient indexed queries

## Performance

SQLite offers several advantages over ASCII parsing:

- **Faster loading**: Binary format is faster to parse than text
- **Smaller file size**: SQLite files are typically more compact
- **Indexed queries**: Fast lookups by halo ID without loading all data
- **Better scaling**: Can handle larger catalogues efficiently

## Dependencies

- **sql.js**: SQLite compiled to WebAssembly
- **drizzle-orm**: Modern, type-safe ORM
- **@types/sql.js**: TypeScript types for sql.js
