import { Tenant, TenantStatus, DeploymentStatus } from '../types/tenant.js';
import { KubernetesService } from './kubernetes.js';
import { TenantNotFoundError } from '../errors/tenant-not-found.error.js';
import { buildNamespaceName } from '../config/namespace.config.js';

export class TenantService {
  private kubernetesService: KubernetesService;
  private tenants: Map<string, Tenant>;

  constructor() {
    this.kubernetesService = new KubernetesService();
    this.tenants = new Map();
  }

  async createTenant(id: string, name: string): Promise<Tenant> {
    // Check if tenant already exists
    if (this.tenants.has(id)) {
      throw new Error(`Tenant with ID "${id}" already exists`);
    }

    const namespace = buildNamespaceName(id);

    // Create namespace in Kubernetes
    await this.kubernetesService.createNamespace(id);

    // Create tenant record immediately
    const tenant: Tenant = {
      id,
      name,
      namespace,
      createdAt: new Date(),
      status: TenantStatus.Active,
      deploymentStatus: DeploymentStatus.Creating,
    };

    this.tenants.set(id, tenant);
    console.log(`Tenant created: ${id} (${name})`);

    // Start deployment asynchronously (fire and forget)
    // Client can poll GET /tenants/:id to check deployment status
    this.kubernetesService
      .createDeployment(id)
      .then(() => {
        console.log(`Deployment completed for tenant: ${id}`);
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to deploy tenant ${id}: ${errorMessage}`);
        // Optionally update tenant status to Error
        const tenantRecord = this.tenants.get(id);
        if (tenantRecord) {
          tenantRecord.deploymentStatus = DeploymentStatus.Error;
        }
      });

    return tenant;
  }

  async getTenant(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return null;
    }

    // Update deployment status from Kubernetes
    const deploymentStatus = await this.kubernetesService.getDeploymentStatus(id);
    tenant.deploymentStatus = deploymentStatus;

    return tenant;
  }

  listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  async deleteTenant(id: string): Promise<void> {
    if (!this.tenants.has(id)) {
      throw new TenantNotFoundError(id);
    }

    // Delete Helm release and resources
    await this.kubernetesService.deleteDeployment(id);

    // Delete namespace (this will also delete ingress and any remaining resources)
    await this.kubernetesService.deleteNamespace(id);

    // Remove from in-memory map
    this.tenants.delete(id);
    console.log(`Tenant deleted: ${id}`);
  }
}
