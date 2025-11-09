import * as k8s from '@kubernetes/client-node';
import { DeploymentStatus } from '../types/tenant.js';

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

    // Create deployment
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: tenantId,
        namespace,
        labels: {
          app: 'tenant-app',
          tenant: tenantId,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'tenant-app',
            tenant: tenantId,
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'tenant-app',
              tenant: tenantId,
            },
          },
          spec: {
            containers: [
              {
                name: 'app-container',
                image: 'tenant-app:latest',
                imagePullPolicy: 'Never',
                ports: [{ containerPort: 9090 }],
                env: [
                  { name: 'TENANT_ID', value: tenantId },
                  { name: 'PORT', value: '9090' },
                ],
                resources: {
                  requests: {
                    memory: '64Mi',
                    cpu: '100m',
                  },
                  limits: {
                    memory: '128Mi',
                    cpu: '200m',
                  },
                },
              },
            ],
          },
        },
      },
    };

    // Create service
    const service: k8s.V1Service = {
      metadata: {
        name: tenantId,
        namespace,
        labels: {
          app: 'tenant-app',
          tenant: tenantId,
        },
      },
      spec: {
        selector: {
          app: 'tenant-app',
          tenant: tenantId,
        },
        ports: [
          {
            protocol: 'TCP',
            port: 9090,
            targetPort: 9090,
          },
        ],
        type: 'ClusterIP',
      },
    };

    try {
      await this.k8sApi.createNamespacedDeployment({ namespace, body: deployment });
      console.log(`Deployment created: ${tenantId} in ${namespace}`);

      await this.coreApi.createNamespacedService({ namespace, body: service });
      console.log(`Service created: ${tenantId} in ${namespace}`);

      // Create ingress for subdomain routing
      await this.createIngress(tenantId);
    } catch (error: unknown) {
      if (isKubernetesError(error) && (error.statusCode === 409 || error.code === 409)) {
        console.log(`Deployment already exists for tenant: ${tenantId}`);
      } else {
        throw error;
      }
    }
  }

  async createIngress(tenantId: string): Promise<void> {
    const namespace = `tenant-${tenantId}`;
    const host = `${tenantId}.localhost`;

    const ingress: k8s.V1Ingress = {
      metadata: {
        name: tenantId,
        namespace,
        labels: {
          app: 'tenant-app',
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
                      name: tenantId,
                      port: {
                        number: 9090,
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
      console.log(`Ingress created: ${host} -> ${tenantId} in ${namespace}`);
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
      const deployment = await this.k8sApi.readNamespacedDeployment({
        name: tenantId,
        namespace,
      });

      const replicas: number = deployment.spec?.replicas ?? 0;
      const readyReplicas: number = deployment.status?.readyReplicas ?? 0;

      if (readyReplicas === replicas && replicas > 0) {
        return DeploymentStatus.Running;
      } else if (readyReplicas > 0) {
        return DeploymentStatus.Creating;
      } else {
        return DeploymentStatus.Stopped;
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
      await this.k8sApi.deleteNamespacedDeployment({
        name: tenantId,
        namespace,
      });
      console.log(`Deployment deleted for tenant: ${tenantId}`);

      await this.coreApi.deleteNamespacedService({
        name: tenantId,
        namespace,
      });
      console.log(`Service deleted for tenant: ${tenantId}`);
    } catch (error: unknown) {
      if (isKubernetesError(error) && error.statusCode === 404) {
        console.log(`Deployment not found for tenant: ${tenantId}`);
      } else {
        throw error;
      }
    }
  }
}
