import { Injectable } from '@nestjs/common';
import { TenantService } from '../services/tenant.js';
import { Tenant } from '../types/tenant.js';

@Injectable()
export class TenantsService {
  private readonly tenantService: TenantService;

  constructor() {
    this.tenantService = new TenantService();
  }

  async createTenant(id: string, name: string): Promise<Tenant> {
    return await this.tenantService.createTenant(id, name);
  }

  async getTenant(id: string): Promise<Tenant | null> {
    return await this.tenantService.getTenant(id);
  }

  listTenants(): Tenant[] {
    return this.tenantService.listTenants();
  }
}
