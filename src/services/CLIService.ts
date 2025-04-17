import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import { CurlParser } from "./CurlParser";
import { OpenAPIGenerator } from "./OpenAPIGenerator";
import * as fs from "fs";
import { OpenAPIOptions } from "../interfaces/types";
import { SwagglerException } from "../errors/SwagglerException";

const execAsync = promisify(exec);

export class CLIService {
  public static setupCLI(): Command {
    const program = new Command();

    program
      .name("swaggler")
      .description(
        "Swaggler helps you smuggle your existing API requests into structured, well-documented specs with ease"
      )
      .version("1.0.0");

    program
      .command("generate")
      .description(
        "Generate OpenAPI documentation from curl command or response"
      )
      .option(
        "-c, --curl <curl>",
        "Curl command to convert or path to a file containing curl command"
      )
      .option("-i, --input <input>", "Path to a file containing curl command")
      .option("-o, --output <output>", "Output file path", "swagger.yaml")
      .option("-n, --name <name>", "Operation name", "")
      .option(
        "-s, --schema <schema>",
        "URL template with parameters (e.g. /users/:id/edit)"
      )
      .option("-t, --tag <tag>", "Tag for the operation")
      .option("-p, --output-path <path>", "Output file path and directory")
      .option("-a, --append <file>", "Append to existing swagger file")
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
          // Validate input options
          if (!options.curl && !options.input) {
            throw new Error("Either --curl or --input option must be provided");
          }

          let curlCommand = options.curl;
          let responseData;

          // Handle curl command
          // Check if the curl input is a file path
          if (options.input) {
            if (!fs.existsSync(options.input)) {
              throw new Error(`Input file not found: ${options.input}`);
            }
            curlCommand = fs.readFileSync(options.input, "utf-8").trim();
          } else if (fs.existsSync(options.curl)) {
            curlCommand = fs.readFileSync(options.curl, "utf-8").trim();
          }

          // Validate curl command format
          if (!curlCommand.startsWith("curl ")) {
            throw new Error(
              'Invalid curl command format. Command must start with "curl"'
            );
          }

          if (!options.skipExecution) {
            // Execute the curl command to get the response
            console.log("Executing curl command...");
            try {
              const { stdout, stderr } = await execAsync(curlCommand);

              if (stderr) {
                console.warn("Warning from curl:", stderr);
              }

              // Parse the response
              responseData = JSON.parse(stdout);
            } catch (error) {
              if (error instanceof Error) {
                throw new Error(
                  `Failed to execute curl command: ${error.message}`
                );
              }
              throw error;
            }
          } else {
            if (!options.response) {
              throw new Error(
                "--response option is required when --skip-execution is used"
              );
            }
            try {
              responseData = JSON.parse(options.response);
            } catch (error) {
              throw new Error("Invalid JSON response provided");
            }
          }

          // Now sanitize the curl command for documentation
          const sanitizedCurl = CurlParser.sanitize(curlCommand);
          console.log("Sanitized curl command:", sanitizedCurl);

          // Parse sanitized curl command
          const parsedCurl = CurlParser.parse(sanitizedCurl);

          // Prepare options for OpenAPI generation
          const openAPIOptions: OpenAPIOptions = {
            operationName: options.name,
            urlTemplate: options.schema,
            tags: options.tag ? [options.tag] : undefined,
            outputPath: options.outputPath,
            appendPath: options.append,
            version: options.version,
          };

          // Generate OpenAPI documentation
          let openapi = OpenAPIGenerator.generate(
            parsedCurl,
            responseData,
            openAPIOptions
          );

          // If append option is provided, merge with existing swagger file
          if (options.append) {
            try {
              openapi = OpenAPIGenerator.mergeWithExisting(
                openapi,
                options.append
              );
            } catch (error) {
              if (error instanceof SwagglerException) {
                console.error(`Error: ${error.message}`);
                if (error.details) {
                  console.error("Details:", error.details);
                }
                process.exit(1);
              }
            }
          }

          // Save to file
          OpenAPIGenerator.saveToFile(openapi, openAPIOptions);

          console.log(
            `OpenAPI ${options.version} documentation generated and saved to ${
              openAPIOptions.outputPath ||
              openAPIOptions.appendPath ||
              "swagger.yaml"
            }`
          );
        } catch (error) {
          if (error instanceof SwagglerException) {
            console.error(`Error: ${error.message}`);
            if (error.details) {
              console.error("Details:", error.details);
            }
            process.exit(1);
          } else {
            console.error(`Error: ${error}`);
            process.exit(1);
          }
        }
      });

    return program;
  }
}
