export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant with ID "${tenantId}" not found`);
    this.name = 'TenantNotFoundError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantNotFoundError);
    }
  }
}

