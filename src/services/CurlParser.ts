import { ParsedCurl } from "../interfaces/types";

export class CurlParser {
  public static parse(curlCommand: string): ParsedCurl {
    const result: ParsedCurl = {
      method: "GET",
      url: "",
      headers: {},
      queryParams: {},
      data: undefined,
      contentType: undefined,
    };

    // Extract URL + query params
    const urlMatch = curlCommand.match(
      /curl\s+'([^']+)'|curl\s+"([^"]+)"|curl\s+([^\s]+)/
    );
    if (urlMatch) {
      const url = urlMatch[1] || urlMatch[2] || urlMatch[3];
      try {
        const parsedUrl = new URL(url);
        result.url = parsedUrl.origin + parsedUrl.pathname;
        parsedUrl.searchParams.forEach((value, key) => {
          result.queryParams[key] = value;
        });
      } catch {
        result.url = url;
      }
    }

    // Extract explicit -X METHOD
    const methodMatch = curlCommand.match(/-X\s+([A-Z]+)/i);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    }

    // Extract headers
    for (const match of curlCommand.matchAll(
      /-H\s+'([^']+)'|-H\s+"([^"]+)"/g
    )) {
      const header = match[1] || match[2];
      const [key, ...valueParts] = header.split(": ");
      result.headers[key] = valueParts.join(": ");

      // Check for content-type header
      if (key.toLowerCase() === "content-type") {
        result.contentType = valueParts.join(": ");
      }
    }

    // Gather all body/form flags
    const dataRawMatches = Array.from(
      curlCommand.matchAll(/--data-raw\s+['"]?([^'"\s]+)['"]?/gi)
    ).map((m) => m[1]);
    const dataMatches = Array.from(
      curlCommand.matchAll(/(?:-d|--data)\s+['"]([^'"]+)['"]/gi)
    ).map((m) => m[1]);
    const urlEncMatches = Array.from(
      curlCommand.matchAll(/--data-urlencode\s+['"]?([^'"\s]+)['"]?/gi)
    ).map((m) => m[1]);
    const formMatches = Array.from(
      curlCommand.matchAll(/(?:-F|--form)\s+['"]([^'"]+)['"]/gi)
    ).map((m) => m[1]);

    // If there's any body/form but no explicit -X, assume POST
    if (
      !methodMatch &&
      (dataRawMatches.length ||
        dataMatches.length ||
        urlEncMatches.length ||
        formMatches.length)
    ) {
      result.method = "POST";
    }

    // Process multipart form fields
    if (formMatches.length) {
      result.contentType = "multipart/form-data";
      result.data = {};
      formMatches.forEach((pair) => {
        const [key, val] = pair.split("=");
        if (val !== undefined) {
          result.data![key] = val;
        }
      });
    }
    // Process URL-encoded bodies
    else if (dataMatches.length || urlEncMatches.length) {
      result.contentType =
        result.contentType || "application/x-www-form-urlencoded";
      result.data = {};
      [...dataMatches, ...urlEncMatches].forEach((chunk) => {
        chunk.split("&").forEach((kv) => {
          const [key, val] = kv.split("=");
          if (val !== undefined) {
            result.data![key] = decodeURIComponent(val);
          }
        });
      });
    }
    // Process raw JSON or other payloads
    else if (dataRawMatches.length) {
      const raw = dataRawMatches.join("&");

      // If content-type header is set to application/x-www-form-urlencoded, parse as form data
      if (result.contentType === "application/x-www-form-urlencoded") {
        result.data = {};
        raw.split("&").forEach((kv) => {
          const [key, val] = kv.split("=");
          if (val !== undefined) {
            result.data![key] = decodeURIComponent(val);
          }
        });
      } else {
        try {
          result.data = JSON.parse(raw);
          result.contentType = "application/json";
        } catch {
          result.data = raw;
          result.contentType = "text/plain";
        }
      }
    }

    return result;
  }

  public static sanitize(curlCommand: string): string {
    // Remove authorization header
    curlCommand = curlCommand.replace(/-H\s+'Authorization:[^']+'/gi, "");
    curlCommand = curlCommand.replace(/-H\s+"Authorization:[^"]+"/gi, "");

    // Remove common browser headers
    const headersToRemove = [
      "accept-encoding",
      "accept-language",
      "sec-fetch-dest",
      "sec-fetch-mode",
      "sec-fetch-site",
      "user-agent",
      "priority",
      "referer",
      "origin",
      "cookie",
      "connection",
      "cache-control",
      "pragma",
      "accept",
    ];
    headersToRemove.forEach((header) => {
      const regex = new RegExp(
        `-H\\s+'${header}:[^']+'|\\s*-H\\s+"${header}:[^"]+"`,
        "gi"
      );
      curlCommand = curlCommand.replace(regex, "");
    });

    // Clean up the command
    return curlCommand
      .replace(/\\\s*\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*-H\s+/g, " -H ")
      .trim();
  }
}
