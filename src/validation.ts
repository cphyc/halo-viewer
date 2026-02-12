// Schema validation utilities
import Ajv from 'ajv';
import resourcesSchema from '../public/resources.schema.json';
import { ResourcesConfig } from './types';

// Create AJV instance
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  useDefaults: true, // Apply default values from schema
});

// Compile the schema
const validateResourcesConfig = ajv.compile(resourcesSchema);

/**
 * Validates that data conforms to the ResourcesConfig schema
 * @param data - Unknown data to validate
 * @returns The validated data with proper typing
 * @throws Error if validation fails
 */
export function validateResources(data: unknown): ResourcesConfig {
  const valid = validateResourcesConfig(data);

  if (!valid) {
    const errors = validateResourcesConfig.errors || [];
    const errorMessages = errors.map((err) => `${err.instancePath} ${err.message}`).join('\n');
    throw new Error(`Resources config validation failed: ${errorMessages}`);
  }

  // Additional check for unique IDs (not supported by JSON Schema Draft 07)
  const config = data as ResourcesConfig;
  const ids = new Set<string>();
  const structureIds = new Set<string>();
  const duplicates: string[] = [];

  config.resources.forEach((resource) => {
    if (ids.has(resource.id)) {
      duplicates.push(resource.id);
    }
    ids.add(resource.id);
  });

  config.structure.forEach((metadata) => {
    if (structureIds.has(metadata.id)) {
      duplicates.push(metadata.id);
    }
    structureIds.add(metadata.id);
  });

  if (duplicates.length > 0) {
    throw new Error(`Duplicate resource IDs found: ${duplicates.join(', ')}`);
  }

  // Additional check for valid resource ID references in "requires" field
  const invalidReferences: string[] = [];
  config.resources.forEach((resource) => {
    if (resource.requires) {
      resource.requires.forEach((requiredId) => {
        if (!structureIds.has(requiredId)) {
          invalidReferences.push(
            `Resource "${resource.id}" requires non-existent resource "${requiredId}"`
          );
        }
      });
    }
  });

  if (invalidReferences.length > 0) {
    throw new Error(`Invalid resource references: ${invalidReferences.join('; ')}`);
  }

  // Check for circular dependencies in structure
  function hasCircularDependency(
    itemId: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(itemId);
    recursionStack.add(itemId);

    const item = config.structure.find((s) => s.id === itemId);
    if (item && item.requires) {
      for (const reqId of item.requires) {
        if (!visited.has(reqId)) {
          if (hasCircularDependency(reqId, visited, recursionStack)) {
            return true;
          }
        } else if (recursionStack.has(reqId)) {
          return true;
        }
      }
    }

    recursionStack.delete(itemId);
    return false;
  }

  const visited = new Set<string>();
  for (const item of config.structure) {
    if (!visited.has(item.id)) {
      if (hasCircularDependency(item.id, visited, new Set())) {
        throw new Error(`Circular dependency detected in structure starting from "${item.id}"`);
      }
    }
  }

  return config;
}

/**
 * Validates resources config and returns validation result without throwing
 * @param data - Unknown data to validate
 * @returns Object with valid flag and either data or errors
 */
export function tryValidateResources(
  data: unknown
): { valid: true; data: ResourcesConfig } | { valid: false; errors: string[] } {
  try {
    const validated = validateResources(data);
    return { valid: true, data: validated };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
