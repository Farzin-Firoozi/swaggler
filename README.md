<p align="center">
  <img src="https://github.com/Farzin-Firoozi/swaggler/blob/main/swaggler.png?raw=true" alt="Logo" width="300"/>
</p>

# Swaggler

A CLI tool to convert curl commands and response examples to OpenAPI documentation. Swaggler helps you smuggle your existing API requests into structured, well-documented specs with ease.

[![NPM](https://img.shields.io/npm/v/swaggler.svg)](https://www.npmjs.com/package/swaggler)
![npm](https://img.shields.io/npm/dt/swaggler)
![npm](https://img.shields.io/npm/dw/swaggler)
![NPM](https://img.shields.io/npm/l/swaggler)

## Features

- Convert curl commands to OpenAPI/Swagger documentation
- Support for custom operation names and tags
- Ability to append to existing swagger files
- URL template parameter support
- Automatic schema generation from response data
- Support for various content types (JSON, form-data, URL-encoded)
- Automatic parameter extraction from URLs and headers
- Simple and intuitive CLI interface

## Installation

```bash
npm install -g swaggler
# or
pnpm add -g swaggler
# or
yarn global add swaggler
```

## Usage

```bash
swaggler generate -c "curl https://api.example.com/users" -o swagger.yaml
```

### Options

- `-c, --curl <curl>` - Curl command to convert or path to a file containing curl command
- `-i, --input <input>` - Path to a file containing curl command
- `-o, --output <output>` - Output file path (default: swagger.yaml)
- `-n, --name <name>` - Operation name
- `-s, --schema <schema>` - URL template with parameters (e.g. /users/{id}/edit)
- `-t, --tag <tag>` - Tag for the operation
- `-p, --output-path <path>` - Output file path and directory
- `-a, --append <file>` - Append to existing swagger file
- `-S, --summary <summary>` - Custom summary for the operation
- `-x, --skip-execution` - Skip executing the curl command and use provided response
- `-r, --response <response>` - JSON response to use when skip-execution is true
- `-R, --response-file <file>` - Path to a JSON file containing the response to use when skip-execution is true

### Examples

```bash
# Generate OpenAPI documentation from a curl command
swaggler generate -c "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\": \"John Doe\"}'" -o users-api.yaml

# Generate from a file containing curl command
swaggler generate -i curl-commands.txt -o users-api.yaml

# Generate with custom operation name and tags
swaggler generate -c "curl https://api.example.com/users/123" -n "getUser" -t "users" -o users-api.yaml -s /users/{id}

# Generate with custom summary
swaggler generate -c "curl https://api.example.com/users" -S "Retrieve all users" -o users-api.yaml

# Append to existing swagger file
swaggler generate -c "curl https://api.example.com/users" -a existing-swagger.yaml

# Skip curl execution and use provided response directly
swaggler generate -c "curl https://api.example.com/users" -x -r '{"users": [{"id": 1, "name": "John"}]}'

# Skip curl execution and use response from a JSON file
swaggler generate -c "curl https://api.example.com/users" -x -R response.json

# Generate with both curl and response from files
swaggler generate -i curl-command.txt -x -R response.json -o api-spec.yaml

# Generate with form data
swaggler generate -c "curl -X POST https://api.example.com/users -H 'Content-Type: application/x-www-form-urlencoded' -d 'name=John&age=30'" -o users-api.yaml
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build the project
pnpm build
```

## Requirements

- Node.js >= 14.0.0

## License

MIT

## Author

Farzin Firoozi

## Contributing

Contributions are welcome! Feel free to submit a pull request.
