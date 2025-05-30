import { ParsedCurl, OpenAPISchema, OpenAPIOptions } from "../interfaces/types";
import { SwagglerException } from "../errors/SwagglerException";

import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";
import { capitalizeFirstLetter } from "../utils";

export class OpenAPIGenerator {
  private static getOpenAPIType(
    value: any
  ): "string" | "number" | "integer" | "boolean" | "array" | "object" {
    if (Array.isArray(value)) return "array";
    if (value === null) return "object";
    if (typeof value === "object") return "object";
    if (typeof value === "number")
      return Number.isInteger(value) ? "integer" : "number";
    if (typeof value === "boolean") return "boolean";
    return "string";
  }

  private static generateSchema(
    data: any,
    prefix: string,
    depth: number = 0,
    schemas: Record<string, OpenAPISchema> = {}
  ): OpenAPISchema {
    // Prevent infinite recursion for circular references
    if (depth > 100) {
      return {
        type: "object",
        properties: {},
      };
    }

    if (Array.isArray(data)) {
      const itemSchemaName = `${prefix}Item`;
      if (data.length > 0) {
        const itemSchema = this.generateSchema(
          data[0],
          itemSchemaName,
          depth + 1,
          schemas
        );
        schemas[itemSchemaName] = itemSchema;
        return {
          type: "array",
          items: {
            $ref: `#/components/schemas/${itemSchemaName}`,
          },
        };
      }
      return {
        type: "array",
        items: {
          type: "object",
          properties: {},
          required: [],
        },
      };
    }

    if (typeof data === "object" && data !== null) {
      const schema: OpenAPISchema = {
        type: "object",
        properties: {},
      };

      Object.entries(data).forEach(([key, value]) => {
        if (value === null) {
          schema.properties![key] = {
            type: "string",
            nullable: true,
          };
        } else if (Array.isArray(value)) {
          const itemSchemaName = `${prefix}${
            key.charAt(0).toUpperCase() + key.slice(1)
          }Item`;
          if (value.length > 0) {
            const itemSchema = this.generateSchema(
              value[0],
              itemSchemaName,
              depth + 1,
              schemas
            );
            schemas[itemSchemaName] = itemSchema;
            schema.properties![key] = {
              type: "array",
              items: {
                $ref: `#/components/schemas/${itemSchemaName}`,
              },
            };
          } else {
            schema.properties![key] = {
              type: "array",
              items: {
                type: "object",
                properties: {},
              },
            };
          }
        } else if (typeof value === "object") {
          const nestedSchemaName = `${prefix}${
            key.charAt(0).toUpperCase() + key.slice(1)
          }`;
          const nestedSchema = this.generateSchema(
            value,
            nestedSchemaName,
            depth + 1,
            schemas
          );
          schemas[nestedSchemaName] = nestedSchema;
          schema.properties![key] = {
            $ref: `#/components/schemas/${nestedSchemaName}`,
          };
        } else {
          schema.properties![key] = {
            type: this.getOpenAPIType(value),
            example: value,
          };
        }
      });

      return schema;
    }

    return {
      type: this.getOpenAPIType(data),
      example: data,
      properties: {},
    };
  }

  private static generateOperationId(method: string, path: string): string {
    const cleanPath = path.replace(/[{}]/g, "").replace(/\//g, "_");
    return `${method.toLowerCase()}_${cleanPath}`.replace(/^_+|_+$/g, "");
  }

  private static generateParameters(
    curl: ParsedCurl,
    pathName: string,
    urlTemplate?: string
  ): any[] {
    const parameters: any[] = [];

    // Add path parameters
    const pathParams = urlTemplate
      ? urlTemplate.match(/{([^}]+)}/g)?.map((param) => param.slice(1, -1)) ||
        []
      : pathName.match(/{([^}]+)}/g)?.map((param) => param.slice(1, -1)) || [];

    pathParams.forEach((param: string) => {
      parameters.push({
        name: param,
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      });
    });

    // Add query parameters
    Object.entries(curl.queryParams).forEach(([key, value]) => {
      // Skip if this key is already a path parameter
      if (pathParams.includes(key)) {
        return;
      }

      let example = value;
      let schemaType: "string" | "number" | "boolean" | "array" | "object" =
        typeof value as "string" | "number" | "boolean";

      // Try to parse JSON strings
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          example = parsed;
          schemaType = Array.isArray(parsed)
            ? "array"
            : typeof parsed === "object"
            ? "object"
            : schemaType;
        } catch {
          // If parsing fails, keep the original string
        }
      }

      const parameter: any = {
        name: key,
        in: "query",
        required: false,
        schema: {
          type: schemaType,
        },
        example: example,
      };

      // Add items schema for array type
      if (schemaType === "array") {
        parameter.schema.items = {
          type: "string",
        };
      }

      // Add properties schema for object type
      if (schemaType === "object") {
        parameter.schema.properties = {};
      }

      parameters.push(parameter);
    });

    // Add header parameters
    Object.entries(curl.headers).forEach(([key, value]) => {
      parameters.push({
        name: key,
        in: "header",
        required: false,
        schema: {
          type: "string",
        },
        example: value,
      });
    });

    return parameters;
  }

  private static parseFormData(formData: string): Record<string, string> {
    const result: Record<string, string> = {};
    const params = new URLSearchParams(formData);
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private static getContentType(contentType: string | undefined): string {
    if (!contentType) return "application/json";

    // Ensure we're using the standard content type for form data
    if (contentType === "application/x-www-form-urlencoded") {
      return "application/x-www-form-urlencoded";
    }

    return contentType;
  }

  public static generate(
    curl: ParsedCurl,
    response: any,
    options: OpenAPIOptions = {}
  ): any {
    const pathName =
      options.urlTemplate ||
      curl.url.split("?")[0].replace(/^https?:\/\/[^\/]+/, "");
    const operationId =
      options.operationName || this.generateOperationId(curl.method, pathName);
    const schemaPrefix = capitalizeFirstLetter(operationId);

    // Create a schemas object to store all generated schemas
    const schemas: Record<string, OpenAPISchema> = {};

    // Generate response schema with depth tracking
    const responseSchema = this.generateSchema(
      response,
      schemaPrefix,
      0,
      schemas
    );

    // Generate request schema if there's data
    let requestSchema = null;
    if (curl.data) {
      if (curl.contentType === "application/x-www-form-urlencoded") {
        const formData = this.parseFormData(curl.data as string);
        requestSchema = this.generateSchema(
          formData,
          `${schemaPrefix}Request`,
          0,
          schemas
        );
      } else {
        requestSchema = this.generateSchema(
          curl.data,
          `${schemaPrefix}Request`,
          0,
          schemas
        );
      }
    }

    // Extract path parameters to filter them from query parameters
    const pathParams =
      pathName.match(/{([^}]+)}/g)?.map((param) => param.slice(1, -1)) || [];

    // Filter out path parameters from query parameters
    const filteredQueryParams = { ...curl.queryParams };
    pathParams.forEach((param) => {
      delete filteredQueryParams[param];
    });

    // Generate query parameter schema
    const querySchema = this.generateSchema(
      filteredQueryParams,
      `${schemaPrefix}Query`,
      0,
      schemas
    );

    const contentType = this.getContentType(curl.contentType);

    return {
      openapi: "3.0.0",
      info: {
        title: "API Documentation",
        version: "1.0.0",
      },
      paths: {
        [pathName]: {
          [curl.method.toLowerCase()]: {
            operationId,
            summary:
              options?.summary ||
              (options?.operationName
                ? capitalizeFirstLetter(options.operationName)
                : `${curl.method} ${pathName}`),
            tags: options.tags ? options.tags.map(capitalizeFirstLetter) : [],
            parameters: this.generateParameters(
              curl,
              pathName,
              options.urlTemplate
            ),
            requestBody: requestSchema
              ? {
                  required: true,
                  content: {
                    [contentType]: {
                      schema: {
                        $ref: `#/components/schemas/${schemaPrefix}Request`,
                      },
                    },
                  },
                }
              : undefined,
            responses: {
              "200": {
                description: "Successful response",
                content: {
                  "application/json": {
                    schema: {
                      $ref: `#/components/schemas/${schemaPrefix}Response`,
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          [`${schemaPrefix}Response`]: responseSchema,
          ...(requestSchema
            ? { [`${schemaPrefix}Request`]: requestSchema }
            : {}),
          ...(Object.keys(filteredQueryParams).length > 0
            ? { [`${schemaPrefix}Query`]: querySchema }
            : {}),
          ...schemas, // Include all nested schemas
        },
      },
    };
  }

  public static saveToFile(openapi: any, options: OpenAPIOptions): void {
    const yamlContent = yaml.dump(openapi, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    // Use the output path if provided, otherwise use append path or default swagger.yaml
    const outputPath =
      options.outputPath || options.appendPath || "swagger.yaml";

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, yamlContent);
  }

  private static findDuplicateOperationId(
    openapi: any,
    operationId: string
  ): { exists: boolean; path?: string; method?: string } {
    for (const path in openapi.paths) {
      for (const method in openapi.paths[path]) {
        if (openapi.paths[path][method].operationId === operationId) {
          return { exists: true, path, method };
        }
      }
    }
    return { exists: false };
  }

  public static mergeWithExisting(openapi: any, appendPath: string): any {
    try {
      const existingContent = fs.readFileSync(appendPath, "utf8");
      const existingOpenAPI = yaml.load(existingContent) as any;

      // Check for duplicate operation IDs and throw error if found
      for (const path in openapi.paths) {
        for (const method in openapi.paths[path]) {
          const operation = openapi.paths[path][method];
          if (operation.operationId) {
            const duplicate = this.findDuplicateOperationId(
              existingOpenAPI,
              operation.operationId
            );
            if (duplicate.exists) {
              throw new SwagglerException(
                "Operation ID conflict detected",
                "DUPLICATE_OPERATION_ID",
                {
                  operationId: operation.operationId,
                  existingPath: duplicate.path,
                  existingMethod: duplicate.method,
                  newPath: path,
                  newMethod: method,
                }
              );
            }
          }
        }
      }

      // Merge paths
      openapi.paths = {
        ...existingOpenAPI.paths,
        ...openapi.paths,
      };

      // Merge schemas
      openapi.components.schemas = {
        ...existingOpenAPI.components?.schemas,
        ...openapi.components.schemas,
      };

      console.log(`Appended to existing swagger file: ${appendPath}`);
    } catch (error) {
      if (error instanceof SwagglerException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new SwagglerException(
          "Failed to merge with existing OpenAPI specification",
          "MERGE_ERROR",
          { cause: error.message }
        );
      }
      console.warn(`Warning: Could not read existing swagger file: ${error}`);
    }

    return openapi;
  }
}
