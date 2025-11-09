import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantsService } from './tenants.service.js';
import { CreateTenantDto } from '../dto/create-tenant.dto.js';
import type { Tenant } from '../types/tenant.js';
import {
  isForbiddenTenantName,
  FORBIDDEN_TENANT_NAMES,
} from '../constants/forbidden-tenant-names.js';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTenant(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    if (isForbiddenTenantName(createTenantDto.id)) {
      throw new BadRequestException(
        `Tenant ID "${createTenantDto.id}" is forbidden. Reserved tenant names: ${FORBIDDEN_TENANT_NAMES.join(', ')}`,
      );
    }
    return await this.tenantsService.createTenant(createTenantDto.id, createTenantDto.name);
  }

  @Get()
  listTenants(): Tenant[] {
    return this.tenantsService.listTenants();
  }

  @Get(':id')
  async getTenant(@Param('id') id: string): Promise<Tenant> {
    const tenant = await this.tenantsService.getTenant(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }
}
