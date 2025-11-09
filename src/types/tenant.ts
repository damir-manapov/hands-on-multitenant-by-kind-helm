export interface Tenant {
  id: string;
  name: string;
  namespace: string;
  createdAt: Date;
  status: TenantStatus;
  deploymentStatus: DeploymentStatus;
}

export enum TenantStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
}

export enum DeploymentStatus {
  Creating = 'creating',
  Running = 'running',
  Stopped = 'stopped',
  Error = 'error',
}
