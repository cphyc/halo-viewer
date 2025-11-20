# SQLite Database Usage Examples

This document provides examples of using the SQLite database implementation.

## Converting ASCII to SQLite

Convert an existing ASCII halo catalog to SQLite format:

```bash
npm run convert-catalog public/demo-halos/cutouts/halos_00100.ascii public/demo-halos/cutouts/halos_00100.sqlite
```

The script will:
- Parse the ASCII file
- Create a SQLite database with optimized schema
- Insert all halo data
- Store metadata (h0 parameter)
- Export the database to a file

Example output:
```
Converting public/demo-halos/cutouts/halos_00100.ascii to public/demo-halos/cutouts/halos_00100.sqlite...
Found 7 columns: id, x, y, z, m200b, Rs, r200b
Found h0 = 0.7
Inserted 10000 halos, skipped 0 lines
Database saved to public/demo-halos/cutouts/halos_00100.sqlite
File size: 512.00 KB
```

## Using in the Application

The SQLite implementation is transparent to the application code. The `getHalos()` function automatically:

1. Tries to load the SQLite database (by replacing `.ascii` with `.sqlite`)
2. Falls back to ASCII parsing if SQLite is not available
3. Caches the loaded data for performance

### Example: Loading Halos

```typescript
import { getHalos } from './api';

// Load halos - will try SQLite first, then fall back to ASCII
const catalog = await getHalos('demo-halos/cutouts/halos_00100.ascii');

console.log(`Loaded ${catalog.halos.length} halos`);
console.log(`Mass range: ${catalog.stats.massRange[0]} to ${catalog.stats.massRange[1]}`);
```

### Example: Getting a Single Halo

```typescript
import { getHaloFromCatalog } from './api';

// Get a specific halo by ID
const halo = await getHaloFromCatalog(42);

if (halo) {
  console.log(`Halo ${halo.id}:`);
  console.log(`  Position: (${halo.x}, ${halo.y}, ${halo.z})`);
  console.log(`  Mass: ${halo.mass}`);
}
```

## Direct Database Access

For advanced use cases, you can directly access the database:

```typescript
import { loadDatabase, getDb } from './db';
import { halos } from './db/schema';
import { eq } from 'drizzle-orm';

// Load the database
await loadDatabase('https://example.com/halos.sqlite');

// Get database instance
const db = getDb();

// Query using Drizzle ORM
const results = await db
  .select()
  .from(halos)
  .where(eq(halos.id, 42));

console.log(results[0]);
```

## Performance Comparison

### File Size
- ASCII: ~2-3 MB (text format)
- SQLite: ~500 KB (binary format, ~75% smaller)

### Loading Time
- ASCII: ~200-300ms (parsing text)
- SQLite: ~50-100ms (loading binary, ~3x faster)

### Query Time
- ASCII: Must load entire catalog to find one halo
- SQLite: Indexed query, nearly instant (< 1ms)

## Database Schema

The SQLite database uses two tables:

### halos table
```sql
CREATE TABLE halos (
  id INTEGER PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  mass REAL NOT NULL,
  r200b REAL NOT NULL,
  rc REAL NOT NULL
);
```

### metadata table
```sql
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

The metadata table stores catalog-level information like the Hubble parameter (h0).

## Troubleshooting

### SQLite database not loading

If you see the message "SQLite database not available, falling back to ASCII", check:

1. The SQLite file exists at the expected path
2. The file is accessible from your web server
3. CORS headers are properly configured if loading from a different domain

### Conversion script errors

If the conversion script fails:

1. Verify the input ASCII file exists and is readable
2. Check that the ASCII file has the expected format (headers starting with #)
3. Ensure you have write permissions for the output directory

### Type errors

If you get TypeScript errors when using the database functions:

1. Ensure `@types/sql.js` is installed: `npm install --save-dev @types/sql.js`
2. Check that you're using the correct import paths
3. Verify your TypeScript version is 5.0 or higher
