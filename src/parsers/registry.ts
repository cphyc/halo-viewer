import { ParserFunction, ParserReference } from './types';
import { jsonParser } from './json';
import * as ascii from './ascii/rockstarCatalogue';

/**
 * Registry of local parsers
 * Format: namespace.name -> parser function
 */
const localParsers: Record<string, ParserFunction> = {
  'ascii.rockstarCatalogue': ascii.rockstarCatalogue,
};

/**
 * Cache for dynamically loaded custom parsers
 */
const customParserCache = new Map<string, ParserFunction>();

/**
 * Resolve a parser reference to a parser function
 * @param reference - Parser reference (json, namespace.name, or custom:url#fn)
 * @returns Parser function
 */
export async function resolveParser(reference: ParserReference): Promise<ParserFunction> {
  // Built-in JSON parser
  if (reference === 'json') {
    return jsonParser;
  }

  // Custom external parser: custom:url#functionName
  if (reference.startsWith('custom:')) {
    const match = reference.match(/^custom:(.+)#(.+)$/);
    if (!match) {
      throw new Error(
        `Invalid custom parser reference: ${reference}. Expected format: custom:url#functionName`
      );
    }

    const [, url, functionName] = match;
    const cacheKey = reference;

    // Check cache first
    if (customParserCache.has(cacheKey)) {
      return customParserCache.get(cacheKey)!;
    }

    // Load the external script
    try {
      // Use dynamic import for external JS files
      const module = await import(/* @vite-ignore */ url);
      const parserFn = module[functionName];

      if (typeof parserFn !== 'function') {
        throw new Error(`Function "${functionName}" not found or not a function in ${url}`);
      }

      customParserCache.set(cacheKey, parserFn);
      return parserFn;
    } catch (error) {
      throw new Error(
        `Failed to load custom parser from ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Local parser: namespace.name
  if (reference in localParsers) {
    return localParsers[reference];
  }

  throw new Error(
    `Unknown parser reference: ${reference}. Must be "json", a local parser (namespace.name), or custom parser (custom:url#functionName)`
  );
}

/**
 * Parse data from a URL using the specified parser
 * @param url - URL to fetch data from
 * @param parserRef - Parser reference
 * @param signal - Abort signal
 * @returns Parsed data in standard format
 */
export async function parseData(url: string, parserRef: ParserReference, signal?: AbortSignal) {
  const parser = await resolveParser(parserRef);
  return parser(url, signal);
}
