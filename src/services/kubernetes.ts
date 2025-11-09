import * as k8s from '@kubernetes/client-node';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DeploymentStatus } from '../types/tenant.js';

const execAsync = promisify(exec);

interface KubernetesError extends Error {
  body?:
    | string
    | {
        reason?: string;
      };
  statusCode?: number;
  code?: number;
}

function isKubernetesError(error: unknown): error is KubernetesError {
  return typeof error === 'object' && error !== null && ('body' in error || 'statusCode' in error);
}

export class KubernetesService {
  private k8sApi: k8s.AppsV1Api;
  private coreApi: k8s.CoreV1Api;
  private networkingApi: k8s.NetworkingV1Api;
  private kc: k8s.KubeConfig;
  private readonly helmChart: string = 'oci://ghcr.io/ricoberger/charts/echoserver';

  constructor() {
    this.kc = new k8s.KubeConfig();
    // Try to load in-cluster config first (when running in Kubernetes)
    try {
      this.kc.loadFromCluster();
    } catch {
      // Fall back to default config (for local development)
      this.kc.loadFromDefault();
    }
    this.k8sApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
  }

  async createNamespace(tenantId: string): Promise<void> {
    const namespace: k8s.V1Namespace = {
      metadata: {
        name: `tenant-${tenantId}`,
        labels: {
          tenant: tenantId,
        },
      },
    };

    try {
      await this.coreApi.createNamespace({ body: namespace });
      console.log(`Namespace created: tenant-${tenantId}`);
    } catch (error: unknown) {
      if (isKubernetesError(error) && (error.statusCode === 409 || error.code === 409)) {
        console.log(`Namespace already exists: tenant-${tenantId}`);
      } else {
        throw error;
      }
    }
  }

  async createDeployment(tenantId: string): Promise<void> {
    const namespace = `tenant-${tenantId}`;

    // Install Helm chart for the tenant
    // Add tenant label to all resources via Helm values
    const helmCommand = `helm install ${tenantId} ${this.helmChart} --namespace ${namespace} --create-namespace --wait --timeout 5m --set labels.tenant=${tenantId}`;

    try {
      const { stdout, stderr } = await execAsync(helmCommand);
      if (stderr && !stderr.includes('WARNING')) {
        console.warn(`Helm install stderr: ${stderr}`);
      }
      console.log(`Helm chart installed: ${tenantId} in ${namespace}`);
      console.log(stdout);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('cannot re-use a name')
      ) {
        console.log(`Helm release already exists for tenant: ${tenantId}`);
      } else {
        throw new Error(`Failed to install Helm chart: ${errorMessage}`);
      }
    }

    // Create ingress for subdomain routing
    // Note: The echoserver chart may create its own service, so we need to check the service name
    // Typically Helm charts create services with the release name, but we'll use the tenantId
    await this.createIngress(tenantId);
  }

  async createIngress(tenantId: string): Promise<void> {
    const namespace = `tenant-${tenantId}`;
    const host = `${tenantId}.localhost`;

    // The echoserver chart typically creates a service with the release name
    // Let's check what service was created by the Helm chart
    let serviceName = tenantId;
    try {
      const response = await this.coreApi.listNamespacedService({ namespace });
      const body: k8s.V1ServiceList = response;
      const items: k8s.V1Service[] = body.items;
      const service = items.find((svc: k8s.V1Service) => svc.metadata?.name === tenantId);
      if (service === undefined && items.length > 0) {
        // Use the first service found if the expected name doesn't exist
        const firstService = items[0];
        const name = firstService?.metadata?.name;
        if (name !== undefined && name !== '') {
          serviceName = name;
        }
      }
    } catch {
      // If we can't find the service, use tenantId as fallback
      serviceName = tenantId;
    }

    // Get the service port (echoserver typically uses port 8080)
    let servicePort = 8080;
    try {
      const response = await this.coreApi.readNamespacedService({ name: serviceName, namespace });
      const body: k8s.V1Service = response;
      const spec: k8s.V1ServiceSpec | undefined = body.spec;
      const port: number | undefined = spec?.ports?.[0]?.port;
      if (port !== undefined) {
        servicePort = port;
      }
    } catch {
      // Use default port if we can't read the service
      servicePort = 8080;
    }

    const ingress: k8s.V1Ingress = {
      metadata: {
        name: tenantId,
        namespace,
        labels: {
          app: 'echoserver',
          tenant: tenantId,
        },
        annotations: {
          'nginx.ingress.kubernetes.io/rewrite-target': '/',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: servicePort,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    try {
      await this.networkingApi.createNamespacedIngress({ namespace, body: ingress });
      console.log(
        `Ingress created: ${host} -> ${serviceName}:${String(servicePort)} in ${namespace}`,
      );
    } catch (error: unknown) {
      if (isKubernetesError(error) && (error.statusCode === 409 || error.code === 409)) {
        console.log(`Ingress already exists for tenant: ${tenantId}`);
      } else {
        throw error;
      }
    }
  }

  async getDeploymentStatus(tenantId: string): Promise<DeploymentStatus> {
    const namespace = `tenant-${tenantId}`;

    try {
      // Check if Helm release exists
      try {
        const { stdout } = await execAsync(
          `helm list --namespace ${namespace} --filter ${tenantId} -o json`,
        );
        const releases = JSON.parse(stdout) as Array<{ name: string; status: string }>;
        const release = releases.find((r) => r.name === tenantId);

        if (!release) {
          return DeploymentStatus.Error;
        }

        // Check deployment status
        const response = await this.k8sApi.listNamespacedDeployment({ namespace });
        const body: k8s.V1DeploymentList = response;
        const items: k8s.V1Deployment[] = body.items;
        const deployment = items.find(
          (dep: k8s.V1Deployment) =>
            dep.metadata?.labels?.['app.kubernetes.io/instance'] === tenantId ||
            dep.metadata?.name === tenantId,
        );

        if (deployment === undefined) {
          return DeploymentStatus.Error;
        }

        const spec: k8s.V1DeploymentSpec | undefined = deployment.spec;
        const status: k8s.V1DeploymentStatus | undefined = deployment.status;
        const replicas: number = spec?.replicas ?? 0;
        const readyReplicas: number = status?.readyReplicas ?? 0;

        if (readyReplicas === replicas && replicas > 0) {
          return DeploymentStatus.Running;
        } else if (readyReplicas > 0) {
          return DeploymentStatus.Creating;
        } else {
          return DeploymentStatus.Stopped;
        }
      } catch {
        // If helm command fails, try to check deployment directly
        const deploymentResponse = await this.k8sApi.readNamespacedDeployment({
          name: tenantId,
          namespace,
        });
        const deployment: k8s.V1Deployment = deploymentResponse;

        const spec: k8s.V1DeploymentSpec | undefined = deployment.spec;
        const status: k8s.V1DeploymentStatus | undefined = deployment.status;
        const replicas: number = spec?.replicas ?? 0;
        const readyReplicas: number = status?.readyReplicas ?? 0;

        if (readyReplicas === replicas && replicas > 0) {
          return DeploymentStatus.Running;
        } else if (readyReplicas > 0) {
          return DeploymentStatus.Creating;
        } else {
          return DeploymentStatus.Stopped;
        }
      }
    } catch (error: unknown) {
      if (isKubernetesError(error) && error.statusCode === 404) {
        return DeploymentStatus.Error;
      }
      throw error;
    }
  }

  async deleteDeployment(tenantId: string): Promise<void> {
    const namespace = `tenant-${tenantId}`;

    try {
      // Uninstall Helm release
      try {
        await execAsync(`helm uninstall ${tenantId} --namespace ${namespace}`);
        console.log(`Helm release deleted for tenant: ${tenantId}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found') || errorMessage.includes('release: not found')) {
          console.log(`Helm release not found for tenant: ${tenantId}`);
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      if (isKubernetesError(error) && error.statusCode === 404) {
        console.log(`Deployment not found for tenant: ${tenantId}`);
      } else {
        throw error;
      }
    }
  }
}
