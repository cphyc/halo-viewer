import { ResourceConfig, StructureConfig, SelectionState } from '../types';

// Check if all required selections are available for a resource
export function canDisplayResource(resource: ResourceConfig, selections: SelectionState): boolean {
  if (!resource.requires || resource.requires.length === 0) {
    return true;
  }

  return resource.requires.every((reqId) => selections[reqId] !== undefined);
}

// Get the level of a resource (how many requirements it has)
export function getResourceLevel(resource: ResourceConfig): number {
  return resource.requires?.length || 0;
}

// Filter resources that can be displayed at current selection state
export function filterResourcesByLevel(
  resources: ResourceConfig[],
  selections: SelectionState
): ResourceConfig[] {
  return resources.filter((resource) => canDisplayResource(resource, selections));
}

// Group resources by their level
export function groupResourcesByLevel(resources: ResourceConfig[]): Map<number, ResourceConfig[]> {
  const grouped = new Map<number, ResourceConfig[]>();

  for (const resource of resources) {
    const level = getResourceLevel(resource);
    if (!grouped.has(level)) {
      grouped.set(level, []);
    }
    grouped.get(level)!.push(resource);
  }

  return grouped;
}

// Build dependency tree for structure items
export function buildDependencyTree(structure: StructureConfig[]): Map<string, StructureConfig> {
  const tree = new Map<string, StructureConfig>();

  for (const item of structure) {
    tree.set(item.id, item);
  }

  return tree;
}

// Get ordered list of structure items (topologically sorted by dependencies)
export function getOrderedStructure(structure: StructureConfig[]): StructureConfig[] {
  const tree = buildDependencyTree(structure);
  const visited = new Set<string>();
  const result: StructureConfig[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;

    const item = tree.get(id);
    if (!item) return;

    // Visit dependencies first
    if (item.requires) {
      for (const depId of item.requires) {
        visit(depId);
      }
    }

    visited.add(id);
    result.push(item);
  }

  for (const item of structure) {
    visit(item.id);
  }

  return result;
}

// Get the level (depth) of a structure item in the hierarchy
export function getStructureLevel(item: StructureConfig, structure: StructureConfig[]): number {
  if (!item.requires || item.requires.length === 0) {
    return 0;
  }

  const tree = buildDependencyTree(structure);
  let maxDepth = 0;

  for (const reqId of item.requires) {
    const reqItem = tree.get(reqId);
    if (reqItem) {
      const depth = getStructureLevel(reqItem, structure) + 1;
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}
