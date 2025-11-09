# Tenant Application

Simple TypeScript application that runs as a tenant instance.

## Features

- Express.js HTTP server
- Health check endpoint
- Tenant ID display
- Dockerized for easy deployment

## Endpoints

- `GET /` - Returns tenant information
- `GET /health` - Health check endpoint (returns status and uptime)
- `GET /inspect` - Inspection endpoint (returns detailed app information including memory usage, environment, etc.)

## Building

Build the Docker image and load it into kind from the project root:

```bash
pnpm build:app
```

Or run the script directly:

```bash
./build-app.sh
```

## Environment Variables

- `PORT` - Server port (default: 9090)
- `TENANT_ID` - Tenant identifier

## Installation

Install dependencies:

```bash
cd app
pnpm install
```

## Local Development

### Running the App

1. Install dependencies:
```bash
cd app
pnpm install
```

2. Build the app:
```bash
pnpm run build
```

3. Start the app:
```bash
pnpm start
```

Or set environment variables and run:
```bash
TENANT_ID=acme pnpm start
```

**Note:** If port 9090 is already in use, you can specify a different port:
```bash
PORT=9091 TENANT_ID=acme pnpm start
```

The app will start on `http://localhost:9090` (or the port specified by `PORT` environment variable).

### Testing the App

Once the app is running, you can test it:

```bash
# Check the root endpoint
curl http://localhost:9090/

# Check health endpoint
curl http://localhost:9090/health

# Check inspect endpoint
curl http://localhost:9090/inspect
```

### Environment Variables

- `PORT` - Server port (default: 9090)
- `TENANT_ID` - Tenant identifier (default: 'unknown')

