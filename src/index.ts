#!/usr/bin/env node

import { config } from "dotenv";
import { CLIService } from "./services/CLIService";

// Load environment variables
config();

// Setup and run the CLI
const program = CLIService.setupCLI();
program.parse();
