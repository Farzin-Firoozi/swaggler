import { ParsedCurl } from "../interfaces/types";

export class CurlParser {
  public static parse(curlCommand: string): ParsedCurl {
    const result: ParsedCurl = {
      method: "GET",
      url: "",
      headers: {},
      queryParams: {},
      data: undefined,
    };

    // Extract URL
    const urlMatch = curlCommand.match(
      /curl\s+'([^']+)'|curl\s+"([^"]+)"|curl\s+([^\s]+)/
    );
    if (urlMatch) {
      const url = urlMatch[1] || urlMatch[2] || urlMatch[3];
      try {
        const parsedUrl = new URL(url);
        result.url = parsedUrl.origin + parsedUrl.pathname;
        // Parse query parameters
        parsedUrl.searchParams.forEach((value, key) => {
          result.queryParams[key] = value;
        });
      } catch {
        result.url = url;
      }
    }

    // Extract method
    const methodMatch = curlCommand.match(/-X\s+([A-Z]+)/i);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    }

    // Extract headers
    const headerMatches = curlCommand.matchAll(
      /-H\s+'([^']+)'|-H\s+"([^"]+)"/g
    );
    for (const match of headerMatches) {
      const header = match[1] || match[2];
      const [key, ...valueParts] = header.split(": ");
      const value = valueParts.join(": "); // Handle cases where value contains ": "
      result.headers[key] = value;
    }

    // Extract data
    const dataMatch = curlCommand.match(
      /-d\s+'([^']+)'|-d\s+"([^"]+)"|--data\s+'([^']+)'|--data\s+"([^"]+)"/
    );
    const formDataMatch = curlCommand.match(
      /-F\s+'([^']+)'|-F\s+"([^"]+)"|--form\s+'([^']+)'|--form\s+"([^"]+)"/
    );

    if (formDataMatch) {
      const formData =
        formDataMatch[1] ||
        formDataMatch[2] ||
        formDataMatch[3] ||
        formDataMatch[4];
      try {
        // Handle form data format: key=value
        const formParts = formData.split("&");
        result.data = {};
        result.contentType = "multipart/form-data";

        formParts.forEach((part) => {
          const [key, value] = part.split("=");
          if (key && value) {
            result.data[key] = value;
          }
        });
      } catch {
        result.data = formData;
      }
    } else if (dataMatch) {
      const data = dataMatch[1] || dataMatch[2] || dataMatch[3] || dataMatch[4];
      try {
        result.data = JSON.parse(data);
        result.contentType = "application/json";
      } catch {
        result.data = data;
        result.contentType = "application/x-www-form-urlencoded";
      }
    }

    return result;
  }

  public static sanitize(curlCommand: string): string {
    // Remove authorization header
    curlCommand = curlCommand.replace(/-H\s+'Authorization:[^']+'/gi, "");
    curlCommand = curlCommand.replace(/-H\s+"Authorization:[^"]+"/gi, "");

    // Remove common browser headers that aren't needed for API documentation
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
      "accept-language",
      "accept-encoding",
      "accept-language",
      "accept-encoding",
      "accept-language",
      "accept-encoding",
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
      .replace(/\\\s*\n/g, " ") // Remove line continuations
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/\s*-H\s+/g, " -H ") // Fix header formatting
      .trim();
  }
}
