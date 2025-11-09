# Multitenant Spinning App

A multitenant application for managing tenant instances using Kubernetes (kind) for local development. Built with TypeScript, pnpm, and tsx, featuring strict type checking, ESLint, and Prettier configurations.

## Prerequisites

Before setting up the project, ensure you have the following tools installed on your system.

### Required Tools

#### 1. Node.js (v20 or higher)

**Installation:**

- **Using nvm (recommended):**
  ```bash
  # Install nvm (if not already installed)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source ~/.bashrc
  
  # Install latest LTS Node.js
  nvm install --lts
  nvm use --lts
  ```

- **Using package manager (Ubuntu/Debian):**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- **Verify installation:**
  ```bash
  node --version
  npm --version
  ```

#### 2. pnpm (v10 or higher)

**Installation:**

- **Using npm:**
  ```bash
  npm install -g pnpm
  ```

- **Using standalone script:**
  ```bash
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  source ~/.bashrc
  ```

- **Using package manager (Ubuntu/Debian):**
  ```bash
  # Add pnpm repository
  wget -qO- https://get.pnpm.io/install.sh | sh -
  source ~/.bashrc
  ```

- **Verify installation:**
  ```bash
  pnpm --version
  ```

#### 3. Docker

**Installation:**

- **Ubuntu/Debian:**
  ```bash
  # Remove old versions
  sudo apt-get remove docker docker-engine docker.io containerd runc
  
  # Install prerequisites
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  
  # Add Docker's official GPG key
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  
  # Set up repository
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  # Install Docker
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  # Add user to docker group (requires logout/login)
  sudo usermod -aG docker $USER
  ```

- **Verify installation:**
  ```bash
  docker --version
  docker ps
  ```

#### 4. kind (Kubernetes in Docker)

**Installation:**

- **Using binary (recommended):**
  ```bash
  # Download latest release
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind
  ```

- **Using package manager:**
  ```bash
  # Using go install (if Go is installed)
  go install sigs.k8s.io/kind@latest
  ```

- **Verify installation:**
  ```bash
  kind --version
  ```

#### 5. kubectl (Kubernetes command-line tool)

**Installation:**

- **Using package manager (Ubuntu/Debian):**
  ```bash
  # Download latest stable release
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  
  # Install
  chmod +x kubectl
  sudo mv kubectl /usr/local/bin/
  ```

- **Using snap:**
  ```bash
  sudo snap install kubectl --classic
  ```

- **Verify installation:**
  ```bash
  kubectl version --client
  ```

#### 6. gitleaks (Secret scanning)

**Installation:**

- **Using binary:**
  ```bash
  # Download latest release
  wget https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks-linux-amd64 -O gitleaks
  chmod +x gitleaks
  sudo mv gitleaks /usr/local/bin/
  ```

- **Using package manager:**
  ```bash
  # Using go install (if Go is installed)
  go install github.com/gitleaks/gitleaks/v8@latest
  ```

- **Using package manager (Homebrew on macOS):**
  ```bash
  brew install gitleaks
  ```

- **Verify installation:**
  ```bash
  gitleaks version
  ```

## Project Setup

Once all prerequisites are installed, set up the project:

### 1. Navigate to Project Directory

```bash
cd <project-directory>
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all project dependencies including:
- TypeScript and type definitions
- ESLint and Prettier with strict configurations
- Kubernetes client library
- Development tools (tsx, etc.)

### 3. Setup kind Cluster

Use the setup script to create the kind cluster and install the nginx-ingress controller:

```bash
./setup-kind.sh
```

This creates a Kubernetes cluster with:
- 1 control-plane node
- 2 worker nodes
- Port mappings for ingress (80→8080, 443→8443)
- Ingress-ready node labels
- nginx-ingress controller installed and ready

**To reset the cluster** (delete and recreate):

```bash
./setup-kind.sh
```

**To skip reset and use existing cluster** (if it exists):

```bash
./setup-kind.sh --no-reset
```

**Note:** The demo script (`./demo.sh`) automatically runs `./setup-kind.sh` to ensure the cluster is set up.

### 4. Install Tenant App Dependencies

Install dependencies for the tenant application:

```bash
cd app
pnpm install
cd ..
```

### 5. Build Docker Images

Build the tenant application and API Docker images and load them into the kind cluster:

**Build tenant app:**
```bash
pnpm build:app
```

Or run the script directly:
```bash
./build-app.sh
```

**Build API:**
```bash
pnpm build:api
```

Or run the script directly:
```bash
./build-api.sh
```

This will:
- Build the TypeScript applications
- Create Docker images (`tenant-app:latest` and `multitenant-api:latest`)
- Load the images into the kind cluster

### 6. Verify Cluster

```bash
# Check cluster info
kubectl cluster-info --context kind-multitenant-research

# Set context (if needed)
kubectl config use-context kind-multitenant-research

# Verify nodes
kubectl get nodes
```

### 7. Quick Start Demo (Optional)

For a quick demo with two tenants, you can use the automated script:

```bash
pnpm demo
```

Or run directly:

```bash
./demo.sh
```

This will automatically:
- **Reset the kind cluster** (delete and recreate)
- Build and load the tenant app and API images
- Deploy the API to Kubernetes
- Create two tenants (acme and globex) - each tenant automatically gets one deployment
- Set up ingress for API and tenants
- Provide instructions for browser access

**To skip cluster reset** (use existing cluster):

```bash
./demo.sh --no-reset
```

Or:

```bash
./demo.sh -n
```

By default, the demo script resets the kind cluster to ensure a clean state.

## Development

### Testing Tenant App Locally

To test the tenant app locally before deploying to Kubernetes:

```bash
cd app
pnpm install
pnpm run build
TENANT_ID=acme pnpm start
```

**Note:** If port 9090 is already in use, specify a different port:
```bash
PORT=9091 TENANT_ID=acme pnpm start
```

The app will start on `http://localhost:9090` (or the port specified by `PORT`). You can test it:

```bash
# Check the root endpoint
curl http://localhost:9090/

# Check health endpoint
curl http://localhost:9090/health

# Check inspect endpoint
curl http://localhost:9090/inspect
```

### Run in Development Mode

```bash
pnpm dev
```

This starts the NestJS REST API server with hot-reload using `tsx watch`. The API will be available at `http://localhost:3000`.

### Build the Project

```bash
pnpm build
```

### Run the Built Application

```bash
pnpm start
```

### E2E Testing

End-to-end tests for the API running in Kubernetes are available using Vitest.

**Prerequisites:**
- The API must be running in Kubernetes (deployed via `./demo.sh` or manually)
- The API should be accessible at `http://api.localhost:8080` (or set `API_BASE_URL` environment variable)

**Run E2E tests:**
```bash
pnpm test:e2e
```

**Run E2E tests in watch mode:**
```bash
pnpm test:e2e:watch
```

**Set custom API URL:**
```bash
API_BASE_URL=http://localhost:3000 pnpm test:e2e
```

The tests cover:
- Health endpoint
- Tenant CRUD operations (create, list, get)
- Forbidden tenant name validation
- Error handling (404, 400)

**Note:** E2E tests are not included in `check.sh` - they require a running Kubernetes cluster with the API deployed.

### Code Quality Scripts

#### Format Code

```bash
pnpm format
```

#### Check Code Formatting

```bash
pnpm format:check
```

#### Run Linter

```bash
pnpm lint
```

#### Type Check (No Emit)

```bash
pnpm type-check
```

## Utility Scripts

### check.sh - Comprehensive Code Quality Check

This script performs all code quality checks:

```bash
./check.sh
```

**What it does:**
1. ✅ Formats code with Prettier
2. ✅ Runs ESLint with strict rules
3. ✅ Checks tenant app source code structure and compilation
4. ✅ Scans for secret leaks using gitleaks
5. ✅ Performs TypeScript type checking (no emit)

**Output:** Color-coded, informative output showing the status of each check.

### health.sh - Dependency Health Check

This script checks the health of your dependencies:

```bash
./health.sh
```

**What it does:**
1. ✅ Checks for vulnerabilities in packages (moderate+ severity)
2. ✅ Lists outdated dependencies
3. ✅ Checks tenant app dependencies for vulnerabilities

**Output:** Detailed information about vulnerabilities and outdated packages with suggestions.

## Project Structure

```
.
├── app/                        # Tenant application
│   ├── src/
│   │   └── index.ts           # Simple Express.js app
│   ├── Dockerfile             # Docker image for tenant app
│   └── package.json           # App dependencies
├── setup-kind.sh              # Setup kind cluster with ingress
├── build-app.sh               # Build and load tenant app script
├── build-api.sh               # Build and load API script
├── demo.sh                    # Quick start demo script
├── port-forward.sh            # Helper script for port forwarding
├── k8s/
│   └── api-deployment.yaml    # Kubernetes manifests for API
├── src/
│   ├── types/
│   │   └── tenant.ts          # Type definitions for tenants and instances
│   ├── services/
│   │   ├── kubernetes.ts      # Kubernetes API integration
│   │   └── tenant.ts          # Tenant management service
│   ├── tenants/
│   │   ├── tenants.controller.ts  # REST API controller for tenants
│   │   ├── tenants.service.ts     # NestJS service for tenants
│   │   └── tenants.module.ts      # NestJS module for tenants
│   ├── dto/
│   │   └── create-tenant.dto.ts      # DTO for creating tenants
│   ├── app.module.ts          # Main NestJS application module
│   ├── main.ts                # NestJS application entry point
│   └── index.ts               # Demo/example script
├── k8s/
│   └── api-deployment.yaml    # Kubernetes manifests for the main API
├── kind-config.yaml           # kind cluster configuration
├── tsconfig.json              # Strict TypeScript configuration
├── .eslintrc.json             # Strict ESLint configuration
├── .prettierrc.json           # Prettier formatting rules
├── .prettierignore            # Files to ignore for Prettier
├── check.sh                   # Code quality check script
├── health.sh                   # Dependency health check script
├── package.json               # Project dependencies and scripts
└── README.md                  # This file
```

## Configuration Details

### TypeScript Configuration

The project uses **strict TypeScript configuration** with:
- All strict type-checking options enabled
- No implicit any
- Strict null checks
- Strict function types
- No unchecked indexed access
- No implicit override
- And more...

### ESLint Configuration

The project uses **strict ESLint rules** including:
- TypeScript strict type-checked rules
- Explicit function return types required
- No unsafe assignments/calls/returns
- Strict boolean expressions
- Prettier integration

### Prettier Configuration

Code formatting is enforced with:
- Single quotes
- Semicolons
- Trailing commas
- 100 character line width
- 2 space indentation

## REST API

The application provides a REST API built with NestJS for managing tenants and instances.

### API Endpoints

#### Tenants

- **POST** `/tenants` - Create a new tenant
  ```json
  {
    "id": "acme",
    "name": "Acme Corporation"
  }
  ```

- **GET** `/tenants` - List all tenants

- **GET** `/tenants/:id` - Get a specific tenant by ID

#### Health

- **GET** `/health` - Health check endpoint

### Example API Usage

```bash
# Create a tenant
curl -X POST http://api.localhost:8080/tenants \
  -H "Content-Type: application/json" \
  -d '{"id": "acme", "name": "Acme Corporation"}'

# Create another tenant
curl -X POST http://api.localhost:8080/tenants \
  -H "Content-Type: application/json" \
  -d '{"id": "globex", "name": "Globex Corporation"}'

# List all tenants
curl http://api.localhost:8080/tenants

# Get a tenant
curl http://api.localhost:8080/tenants/acme

# Health check
curl http://api.localhost:8080/health
```

### Accessing API and Tenant Apps via Subdomains

The API and tenants are accessible via subdomains using Kubernetes Ingress. Each tenant gets its own subdomain automatically.

**Step 1: Configure /etc/hosts**

Add the API and tenant subdomains to your `/etc/hosts` file:

```bash
sudo bash -c 'echo "127.0.0.1 api.localhost" >> /etc/hosts'
sudo bash -c 'echo "127.0.0.1 acme.localhost" >> /etc/hosts'
sudo bash -c 'echo "127.0.0.1 globex.localhost" >> /etc/hosts'
```

Or edit `/etc/hosts` manually and add:
```
127.0.0.1 api.localhost
127.0.0.1 acme.localhost
127.0.0.1 globex.localhost
```

**Step 2: Wait for pods and ingress to be ready**

Make sure the pods are running:

```bash
kubectl get pods -n tenant-acme
kubectl get pods -n tenant-globex
```

Wait until the pods show `STATUS: Running` and `READY: 1/1`.

Check ingress status:

```bash
kubectl get ingress -A
```

**Step 3: Access the apps**

Once everything is ready, you can access the API and tenants via subdomains:

- **API:**
  - Health: http://api.localhost:8080/health
  - List tenants: http://api.localhost:8080/tenants
  - Get tenant: http://api.localhost:8080/tenants/acme
  - Create tenant: POST http://api.localhost:8080/tenants

- **Acme tenant:**
  - Root: http://acme.localhost:8080/
  - Health: http://acme.localhost:8080/health
  - Inspect: http://acme.localhost:8080/inspect

- **Globex tenant:**
  - Root: http://globex.localhost:8080/
  - Health: http://globex.localhost:8080/health
  - Inspect: http://globex.localhost:8080/inspect

**Test with curl:**

```bash
# Test API
curl http://api.localhost:8080/health
curl http://api.localhost:8080/tenants

# Test acme tenant
curl http://acme.localhost:8080/

# Test globex tenant
curl http://globex.localhost:8080/
```

**Note:** 
- The ingress controller listens on port 8080 (mapped from port 80 in the kind cluster)
- The API runs in Kubernetes and is accessible at `api.localhost:8080`
- Each tenant automatically gets an Ingress resource created when the tenant is created
- The subdomain format is `{tenant-id}.localhost` for tenants and `api.localhost` for the API

## Usage

The application demonstrates a multitenant architecture where:

1. **Tenants** are isolated in separate Kubernetes namespaces
2. **Instances** are deployed as Kubernetes deployments within tenant namespaces
3. Each tenant automatically gets one instance when created

### Example Workflow

1. Create a tenant (instance is automatically created):
   ```typescript
   const tenant = await tenantService.createTenant('acme', 'Acme Corporation');
   ```

2. Get the instance for a tenant:
   ```typescript
   const instance = await tenantService.getInstance('acme', 'instance-1');
   ```

## Kubernetes Operations

**View all namespaces:**
```bash
kubectl get namespaces
```

**View deployments for a tenant:**
```bash
kubectl get deployments -n tenant-acme
```

**View services for a tenant:**
```bash
kubectl get services -n tenant-acme
```

**View pods for a tenant:**
```bash
kubectl get pods -n tenant-acme
```

**View pod logs:**
```bash
kubectl logs -n tenant-acme deployment/acme
```

**Reset the kind cluster** (delete and recreate):

```bash
./setup-kind.sh
```

To skip reset and use existing cluster:

```bash
./setup-kind.sh --no-reset
```

**Note:** The demo script (`./demo.sh`) automatically runs `./setup-kind.sh` to ensure the cluster is set up.

**Delete a tenant's instance** (each tenant has one instance automatically):
```bash
kubectl delete deployment acme -n tenant-acme
kubectl delete service acme -n tenant-acme
```

**Delete a tenant namespace:**
```bash
kubectl delete namespace tenant-acme
```

## Cleanup

**Delete the kind cluster:**
```bash
kind delete cluster --name multitenant-research
```

## Troubleshooting

### kubectl can't connect to the cluster

```bash
kubectl config use-context kind-multitenant-research
```

### Cluster is not running

```bash
# Check if cluster exists
kind get clusters

# If multitenant-research is not listed, recreate it:
kind create cluster --config kind-config.yaml
```

### Check cluster status

```bash
# Check Docker containers
docker ps | grep kind

# Check cluster nodes
kubectl get nodes
```

### gitleaks not found

If `check.sh` reports gitleaks is not found:
1. Install gitleaks following the instructions in the Prerequisites section
2. Ensure it's in your PATH: `which gitleaks`
3. Verify it works: `gitleaks version`

### ESLint/TypeScript errors

The project uses strict configurations. If you encounter errors:
1. Run `pnpm format` to format code
2. Run `pnpm lint` to see specific linting errors
3. Run `pnpm type-check` to see type errors
4. Fix errors according to the strict rules

### Dependency vulnerabilities

If `health.sh` reports vulnerabilities:
```bash
# Attempt automatic fixes
pnpm audit --fix

# Review and update manually if needed
pnpm update
```

## Development Notes

- The application uses the Kubernetes client library to interact with the cluster
- Each tenant gets its own namespace: `tenant-{tenantId}`
- Instances are deployed as Kubernetes deployments with associated services
- Instances run the tenant application Docker image (`tenant-app:latest`)
- All code must pass strict TypeScript, ESLint, and Prettier checks
- Secret scanning is performed on every check to prevent credential leaks

## License

MIT
