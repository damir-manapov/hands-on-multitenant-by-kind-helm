export const FORBIDDEN_TENANT_NAMES = [
  'api',
  'admin',
  'system',
  'root',
  'localhost',
  'www',
  'mail',
  'ftp',
  'test',
] as const;

export function isForbiddenTenantName(name: string): boolean {
  return FORBIDDEN_TENANT_NAMES.includes(
    name.toLowerCase() as (typeof FORBIDDEN_TENANT_NAMES)[number],
  );
}
