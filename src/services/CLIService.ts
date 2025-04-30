import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import { CurlParser } from "./CurlParser";
import { OpenAPIGenerator } from "./OpenAPIGenerator";
import * as fs from "fs";
import { OpenAPIOptions } from "../interfaces/types";
import { SwagglerException } from "../errors/SwagglerException";
import * as path from "path";

// Read version from package.json
const packageJsonPath = path.resolve(__dirname, "..", "..", "package.json");
let pkgVersion = "0.0.0";
try {
  const pkgContents = fs.readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(pkgContents);
  pkgVersion = pkg.version;
} catch (err) {
  console.warn(`Could not read version from package.json: ${err}`);
}

const execAsync = promisify(exec);

export class CLIService {
  public static setupCLI(): Command {
    const program = new Command();

    program
      .name("Swaggler")
      .description(
        "Swaggler helps you smuggle your existing API requests into structured, well-documented specs with ease"
      )
      .version(pkgVersion);

    program
      .command("generate")
      .description(
        "Generate OpenAPI documentation from curl command or response"
      )
      .option(
        "-c, --curl <curl>",
        "Curl command to convert or path to a file containing a curl command"
      )
      .option("-i, --input <input>", "Path to a file containing a curl command")
      .option(
        "-o, --output <output>",
        "Output file name (defaults to swagger.yaml)",
        "swagger.yaml"
      )
      .option(
        "-p, --output-path <path>",
        "Explicit output path (overrides --output if provided)"
      )
      .option("-n, --name <name>", "Operation name", "")
      .option(
        "-s, --schema <schema>",
        "URL template with parameters (e.g. /users/:id/edit)"
      )
      .option("-t, --tag <tag>", "Tag for the operation")
      .option("-a, --append <file>", "Append to existing swagger file")
      .option("-S, --summary <summary>", "Custom summary for the operation")
      .option(
        "-x, --skip-execution",
        "Skip executing the curl command and use provided response",
        false
      )
      .option(
        "-r, --response <response>",
        "JSON response to use when skip-execution is true"
      )
      .action(async (options) => {
        try {
          // Must have at least one source of curl text
          if (!options.curl && !options.input) {
            throw new Error("Either --curl or --input must be provided");
          }

          // Load the curl command (from option or file)
          let curlCommand = options.curl || "";
          if (options.input) {
            if (!fs.existsSync(options.input)) {
              throw new Error(`Input file not found: ${options.input}`);
            }
            curlCommand = fs.readFileSync(options.input, "utf-8").trim();
          } else if (fs.existsSync(curlCommand)) {
            // if --curl points at an existing file, read from that
            curlCommand = fs.readFileSync(curlCommand, "utf-8").trim();
          }

          // Sanity check
          if (!curlCommand.startsWith("curl ")) {
            throw new Error('Curl command must start with "curl"');
          }

          // Fetch or accept the response JSON
          let responseData: any;
          if (!options.skipExecution) {
            console.log("→ Executing curl …");
            const { stdout, stderr } = await execAsync(curlCommand);
            if (stderr) console.warn("⚠ warning from curl:", stderr);
            try {
              responseData = JSON.parse(stdout);
            } catch {
              throw new Error("Failed to parse curl output as JSON");
            }
          } else {
            if (!options.response) {
              throw new Error(
                "--response is required when --skip-execution is set"
              );
            }
            try {
              responseData = JSON.parse(options.response);
            } catch {
              throw new Error("Invalid JSON passed to --response");
            }
          }

          // Sanitize & parse
          const sanitized = CurlParser.sanitize(curlCommand);
          const parsed = CurlParser.parse(sanitized);

          // Decide on final output path (fallback to --output)
          const outputFile = options.outputPath
            ? options.outputPath
            : options.output;

          // Build OpenAPI options
          const openAPIOptions: OpenAPIOptions = {
            operationName: options.name,
            urlTemplate: options.schema,
            tags: options.tag ? [options.tag] : undefined,
            outputPath: outputFile,
            appendPath: options.append,
            summary: options.summary,
          };

          // Generate + (optionally) merge
          let openapi = OpenAPIGenerator.generate(
            parsed,
            responseData,
            openAPIOptions
          );
          if (options.append) {
            openapi = OpenAPIGenerator.mergeWithExisting(
              openapi,
              options.append
            );
          }

          // Write it out
          OpenAPIGenerator.saveToFile(openapi, openAPIOptions);
          console.log(
            `----- ✅🥳🚀 OpenAPI spec written to ${outputFile} -----`
          );
        } catch (err: any) {
          if (err instanceof SwagglerException) {
            console.error(`Error: ${err.message}`);
            if (err.details) console.error("Details:", err.details);
          } else {
            console.error("Error:", err.message || err);
          }
          process.exit(1);
        }
      });

    return program;
  }
}
