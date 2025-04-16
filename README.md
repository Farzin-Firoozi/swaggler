<p align="center">
  <img src="./swaggler.png" alt="Logo" width="150"/>
</p>

# Swaggler

A CLI tool to convert curl commands and response examples to OpenAPI documentation. Swaggler helps you smuggle your existing API requests into structured, well-documented specs with ease.

## Features

- Convert curl commands to OpenAPI/Swagger documentation
- Support for custom operation names and tags
- Ability to append to existing swagger files
- URL template parameter support
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

- `-c, --curl <curl>` - Curl command to convert (required)
- `-o, --output <output>` - Output file path (default: swagger.yaml)
- `-n, --name <name>` - Operation name
- `-s, --schema <schema>` - URL template with parameters (e.g. /users/:id)
- `-t, --tag <tag>` - Tag for the operation
- `-O, --output-path <path>` - Output file path and directory
- `-a, --append <file>` - Append to existing swagger file

### Examples

```bash
# Generate OpenAPI documentation from a curl command
swaggler generate -c "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\": \"John Doe\"}'" -o users-api.yaml

# Generate with custom operation name and tags
swaggler generate -c "curl https://api.example.com/users/123" -n "getUser" -t "users" -o users-api.yaml

# Append to existing swagger file
swaggler generate -c "curl https://api.example.com/users" -a existing-swagger.yaml
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
