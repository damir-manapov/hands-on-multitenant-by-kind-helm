/**
 * Gets the namespace prefix for tenant namespaces.
 * Can be configured via NAMESPACE_PREFIX environment variable.
 */
export function getNamespacePrefix(): string {
  return process.env['NAMESPACE_PREFIX'] || 'tenant-';
}

/**
 * Builds a namespace name from a tenant ID using the configured prefix.
 */
export function buildNamespaceName(tenantId: string): string {
  return `${getNamespacePrefix()}${tenantId}`;
}

