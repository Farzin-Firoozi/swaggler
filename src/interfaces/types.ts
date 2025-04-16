export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: any;
  queryParams: Record<string, string>;
  contentType?: string;
}

export interface OpenAPISchema {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  properties?: Record<string, any>;
  required?: string[];
  items?: OpenAPISchema;
  example?: any;
  nullable?: boolean;
  $ref?: string;
}

export interface OpenAPIOptions {
  operationName?: string;
  urlTemplate?: string;
  tags?: string[];
  outputPath?: string;
  appendPath?: string;
  version?: "2.0" | "3.0" | "3.1";
}
