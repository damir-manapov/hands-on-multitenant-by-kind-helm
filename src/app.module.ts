import { Module } from '@nestjs/common';
import { TenantsModule } from './tenants/tenants.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [TenantsModule, HealthModule],
  controllers: [],
  providers: [],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
