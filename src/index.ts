import { TenantService } from './services/tenant.js';

async function main(): Promise<void> {
  console.log('🚀 Multitenant Spinning App');
  console.log('============================\n');

  const tenantService = new TenantService();

  try {
    // Example: Create a tenant (deployment is automatically created)
    console.log('Creating tenant "acme"...');
    const tenant = await tenantService.createTenant('acme', 'Acme Corporation');
    console.log(`✅ Tenant created: ${tenant.id}\n`);

    // Wait a bit for the deployment to start
    console.log('Waiting for deployment to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check tenant status (includes deployment status)
    const tenantStatus = await tenantService.getTenant('acme');
    console.log(`📊 Tenant deployment status: ${tenantStatus?.deploymentStatus}\n`);

    console.log('\n✨ Demo completed successfully!');
    console.log('\nTo interact with the cluster, use kubectl:');
    console.log('  kubectl get namespaces');
    console.log('  kubectl get deployments -n tenant-acme');
    console.log('  kubectl get services -n tenant-acme');
  } catch (error: unknown) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
