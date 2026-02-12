// Parser type definition
// All parsers must convert their input to this standard format
export type ParsedData = {
  [key: string]: Array<any>;
};

// Parser function signature
export type ParserFunction = (url: string, signal?: AbortSignal) => Promise<ParsedData>;

// Parser reference types
export type ParserReference =
  | 'json' // Built-in JSON parser
  | `${string}.${string}` // Local parser: namespace.name (e.g., ascii.rockstarCatalogue)
  | `custom:${string}#${string}`; // External parser: custom:url#functionName
