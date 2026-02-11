# Schema Validation

This project uses [AJV](https://ajv.js.org/) to validate data against JSON Schema on the client side.

## Resources Configuration Validation

The `resources.json` file is automatically validated when loaded through `getResourcesConfig()` in `api.ts`.

### Schema Rules

The validation enforces:

1. **Required fields**: `id`, `name`, `type`
2. **Type constraints**: `type` must be one of `'1D'`, `'2D'`, `'3D'`, or `'metadata'`
3. **Bucket size restrictions**:
   - Only `1D` resources can have `bucket_size > 0`
   - `2D` and `3D` resources must have `bucket_size = 0`
4. **Conditional requirements**:
   - If `bucket_size > 0`, `dataKey` is required
   - `1D` and `2D` resources require `xAxis` and `yAxis` configurations
5. **Unique IDs**: All resource IDs must be unique across the configuration

### Usage

The validation happens automatically when you fetch resources:

```typescript
import { getResourcesConfig } from './api';

// This will throw an error if validation fails
const config = await getResourcesConfig();
```

If validation fails, the error message will include details about what's wrong:

```
Resources config validation failed: /resources/0/bundle_size must be equal to constant
```

### Manual Validation

You can also validate data manually using the validation utilities:

```typescript
import { validateResources, tryValidateResources } from './validation';

// Throws on validation failure
const config = validateResources(unknownData);

// Returns result object without throwing
const result = tryValidateResources(unknownData);
if (result.valid) {
  console.log('Valid config:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

## Schema Definition

The schema is defined in `public/resources.schema.json` following JSON Schema Draft 07 specification.
