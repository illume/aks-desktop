# Baremetal Support

AKS desktop can connect to baremetal-style Kubernetes environments such as AKS Arc, AKS local, and AKS edge clusters that are represented as Azure Arc connected Kubernetes resources. These clusters differ from regular AKS clusters because they usually require a local proxy before the Kubernetes API server is reachable from AKS desktop.

## Requirements

| Requirement | Why it is needed | How to check |
| --- | --- | --- |
| Azure CLI | Used to discover clusters, get kubeconfig credentials, and start the proxy. | `az version` |
| Azure CLI login | Required to read Arc cluster resources and obtain credentials. | `az account show` |
| connectedk8s CLI command | Required for baremetal cluster discovery and proxy access. | `az connectedk8s -h` |
| aksarc CLI command | Required to get credentials for AKS Arc/local/edge clusters. | `az aksarc -h` |
If a command is missing, install or update the relevant Azure CLI extension before connecting the cluster.

## Getting Started

For a test environment, the AKS Arc jumpstart project can create a baremetal-style AKS Arc environment on an Azure VM:

<https://github.com/Azure/aksArc/tree/main/aksarc_jumpstart>

A shared lab environment can also be used, provided the user has permission to read the connected cluster resource and obtain kubeconfig credentials.

## Registration Flow

When a baremetal cluster is selected in AKS desktop, registration uses the Arc-specific credential command:

```bash
az aksarc get-credentials \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <cluster-name>
```

For regular AKS clusters, AKS desktop continues to use:

```bash
az aks get-credentials \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <cluster-name>
```

AKS desktop stores the resulting kubeconfig entry in the same kubeconfig merge flow used for regular AKS clusters.

## Proxy Management

Baremetal clusters may not be reachable directly from the local machine. In that case, start the proxy from the proxy controls in the cluster registration dialog.

The proxy command is:

```bash
az connectedk8s proxy \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <cluster-name>
```

AKS desktop exposes these proxy actions for baremetal clusters:

| Action | Behavior |
| --- | --- |
| Start Proxy | Starts `az connectedk8s proxy` through the existing run-command permission path. |
| Stop Proxy | Stops the proxy process started by AKS desktop in the current plugin session. |
| Restart Proxy | Stops the tracked proxy process and starts it again. |
| Refresh Status | Checks whether the cluster API is reachable through the proxy. |

Proxy commands go through the existing Headlamp run-command permission and consent flow. AKS desktop does not expose separate privileged IPC methods for proxy control.

## Status Reconciliation

Proxy status is tracked while AKS desktop is running. If the plugin reloads or the app restarts, the in-memory proxy process handle is lost. To reconcile status, AKS desktop uses Headlamp's normal frontend Kubernetes API path to make a lightweight namespace list request against the selected cluster.

If the probe succeeds, AKS desktop treats the proxy as available. If it fails, the proxy is shown as stopped and the last error is displayed when available.

## Troubleshooting

### Cluster appears but does not connect

Start or restart the proxy from the registration dialog. If the proxy is already running outside AKS desktop, use Refresh Status to verify that the Kubernetes API is reachable.

### Credentials fail to merge

Run the credential command manually to inspect the Azure CLI error:

```bash
az aksarc get-credentials \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <cluster-name>
```

Common causes include missing Azure login, insufficient permissions, missing CLI extensions, or a mismatched subscription.

### Proxy fails to start

Run the proxy command manually to inspect the Azure CLI error:

```bash
az connectedk8s proxy \
  --subscription <subscription-id> \
  --resource-group <resource-group> \
  --name <cluster-name>
```

Common causes include expired Azure credentials, missing connectedk8s support, local port conflicts, or network restrictions between the local machine and the Arc endpoint.

### Status shows stopped after restart

This can happen if AKS desktop cannot reach the Kubernetes API during reconciliation. Start the proxy again from AKS desktop, or verify that the selected cluster can load namespaces in Headlamp after the proxy is running.
