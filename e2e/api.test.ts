import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env['API_BASE_URL'] ?? 'http://api.localhost:8080';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
}

interface Tenant {
  id: string;
  name: string;
  namespace: string;
  createdAt: string; // ISO date string
  status: string;
  deploymentStatus: string;
}

interface CreateTenantRequest {
  id: string;
  name: string;
}

// Note: The tenant app uses echoserver Helm chart, which echoes HTTP request information
// It doesn't have custom JSON endpoints like the old TypeScript app

describe('API E2E Tests', () => {
  const testTenantId = `test-${String(Date.now())}`;
  const testTenantName = 'Test Tenant';

  beforeAll(async () => {
    // Wait for API to be ready
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
          console.log('API is ready');
          break;
        }
      } catch {
        if (i === maxRetries - 1) {
          throw new Error('API is not available after 30 retries');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as HealthResponse;
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data).toHaveProperty('version');
      expect(data.version).toBe('1.0.0');
    });
  });

  describe('Tenants Endpoint', () => {
    it('should list empty tenants initially', async () => {
      const response = await fetch(`${API_BASE_URL}/tenants`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as Tenant[];
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create a tenant', async () => {
      const createRequest: CreateTenantRequest = {
        id: testTenantId,
        name: testTenantName,
      };

      const response = await fetch(`${API_BASE_URL}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequest),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Tenant;
      expect(data.id).toBe(testTenantId);
      expect(data.name).toBe(testTenantName);
      expect(data.namespace).toBe(`tenant-${testTenantId}`);
      expect(data.status).toBe('active');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('deploymentStatus');
    });

    it('should list tenants after creation', async () => {
      const response = await fetch(`${API_BASE_URL}/tenants`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as Tenant[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const testTenant = data.find((t) => t.id === testTenantId);
      expect(testTenant).toBeDefined();
      expect(testTenant?.id).toBe(testTenantId);
      expect(testTenant?.name).toBe(testTenantName);
    });

    it('should get a specific tenant by id', async () => {
      const response = await fetch(`${API_BASE_URL}/tenants/${testTenantId}`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as Tenant;
      expect(data.id).toBe(testTenantId);
      expect(data.name).toBe(testTenantName);
      expect(data.namespace).toBe(`tenant-${testTenantId}`);
      expect(data.status).toBe('active');
    });

    it('should return 404 for non-existent tenant', async () => {
      const nonExistentId = `non-existent-${String(Date.now())}`;
      const response = await fetch(`${API_BASE_URL}/tenants/${nonExistentId}`);
      expect(response.status).toBe(404);

      const data = (await response.json()) as { message: string };
      expect(data.message).toContain('not found');
    });

    it('should reject forbidden tenant names', async () => {
      const forbiddenRequest: CreateTenantRequest = {
        id: 'api',
        name: 'Forbidden Tenant',
      };

      const response = await fetch(`${API_BASE_URL}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forbiddenRequest),
      });

      expect(response.status).toBe(400);

      const data = (await response.json()) as { message: string };
      expect(data.message).toContain('forbidden');
      expect(data.message).toContain('api');
    });

    it('should handle duplicate tenant creation', async () => {
      const duplicateRequest: CreateTenantRequest = {
        id: testTenantId,
        name: 'Duplicate Tenant',
      };

      const response = await fetch(`${API_BASE_URL}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateRequest),
      });

      // The API may allow duplicates or return an error
      // Accept either success (201) or error (400/409/500)
      if (response.status === 201) {
        const data = (await response.json()) as Tenant;
        expect(data.id).toBe(testTenantId);
      } else {
        expect([400, 409, 500]).toContain(response.status);
      }
    });

    it('should delete a tenant', async () => {
      // Create a tenant specifically for deletion
      const deleteTestTenantId = `delete-test-${String(Date.now())}`;
      const createRequest: CreateTenantRequest = {
        id: deleteTestTenantId,
        name: 'Tenant to Delete',
      };

      const createResponse = await fetch(`${API_BASE_URL}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequest),
      });

      expect(createResponse.status).toBe(201);

      // Wait a bit for the tenant to be created
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Delete the tenant
      const deleteResponse = await fetch(`${API_BASE_URL}/tenants/${deleteTestTenantId}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.status).toBe(204);

      // Verify tenant is no longer in the list
      const listResponse = await fetch(`${API_BASE_URL}/tenants`);
      const tenants = (await listResponse.json()) as Tenant[];
      const deletedTenant = tenants.find((t) => t.id === deleteTestTenantId);
      expect(deletedTenant).toBeUndefined();
    });

    it('should return 404 when deleting non-existent tenant', async () => {
      const nonExistentId = `non-existent-${String(Date.now())}`;
      const response = await fetch(`${API_BASE_URL}/tenants/${nonExistentId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as { message: string };
      expect(data.message).toContain('not found');
    });
  });

  describe('Tenant Application', () => {
    const TENANT_APP_BASE_URL = `http://${testTenantId}.localhost:8080`;

    async function waitForTenantApp(maxRetries = 60): Promise<void> {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(`${TENANT_APP_BASE_URL}/`, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            console.log(`Tenant app ${testTenantId} is ready`);
            return;
          }
        } catch {
          // Continue retrying
        }
        if (i === maxRetries - 1) {
          throw new Error(
            `Tenant app ${testTenantId} is not available after ${String(maxRetries)} retries`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    beforeAll(async () => {
      // Check if tenant already exists (from previous test run)
      const getResponse = await fetch(`${API_BASE_URL}/tenants/${testTenantId}`);
      if (getResponse.status === 200) {
        console.log(`Tenant ${testTenantId} already exists, skipping creation`);
      } else {
        // Create tenant if it doesn't exist
        const createRequest: CreateTenantRequest = {
          id: testTenantId,
          name: testTenantName,
        };

        const createResponse = await fetch(`${API_BASE_URL}/tenants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createRequest),
        });

        if (createResponse.status !== 201) {
          const errorData = await createResponse.json();
          throw new Error(`Failed to create tenant for testing: ${JSON.stringify(errorData)}`);
        }
      }

      // Wait for tenant app to be ready
      await waitForTenantApp();
    });

    it('should access tenant app root endpoint (echoserver)', async () => {
      const response = await fetch(`${TENANT_APP_BASE_URL}/`, {
        signal: AbortSignal.timeout(10000),
      });

      expect(response.status).toBe(200);

      // Echoserver returns the HTTP request information as text
      const text = await response.text();
      expect(text).toContain('GET / HTTP/1.1');
      expect(text).toContain(`Host: ${testTenantId}.localhost:8080`);
    });

    it('should echo request headers from tenant app', async () => {
      const customHeader = 'X-Test-Header';
      const customValue = 'test-value-123';

      const response = await fetch(`${TENANT_APP_BASE_URL}/`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          [customHeader]: customValue,
        },
      });

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('GET / HTTP/1.1');
      expect(text).toContain(`${customHeader}: ${customValue}`);
    });

    it('should handle POST requests to tenant app', async () => {
      const testBody = JSON.stringify({ test: 'data' });

      const response = await fetch(`${TENANT_APP_BASE_URL}/`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
        },
        body: testBody,
      });

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('POST / HTTP/1.1');
      expect(text).toContain('Content-Type: application/json');
    });
  });

  afterAll(async () => {
    // Cleanup: Optionally delete the test tenant
    // Note: The API doesn't have a DELETE endpoint, so we'll leave it
    // In a real scenario, you might want to add cleanup logic here
  });
});
