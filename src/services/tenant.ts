import { Tenant, TenantStatus, DeploymentStatus } from '../types/tenant.js';
import { KubernetesService } from './kubernetes.js';

export class TenantService {
  private kubernetesService: KubernetesService;
  private tenants: Map<string, Tenant>;

  constructor() {
    this.kubernetesService = new KubernetesService();
    this.tenants = new Map();
  }

  async createTenant(id: string, name: string): Promise<Tenant> {
    const namespace = `tenant-${id}`;

    // Create namespace in Kubernetes
    await this.kubernetesService.createNamespace(id);

    // Automatically create deployment for the tenant
    await this.kubernetesService.createDeployment(id);

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
}
