import { ParsedData, ParserFunction } from './types';
import { resolve } from '../api';

/**
 * Built-in JSON parser
 * Simply fetches and parses JSON, returning the data as-is
 */
export const jsonParser: ParserFunction = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(resolve(url), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Ensure the data is in the expected format
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Parser output must be an object, got ${typeof data}`);
  }

  return data as ParsedData;
};
