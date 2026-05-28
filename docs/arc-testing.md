# Testing with AKS Arc Clusters

This document describes how to set up, test, and tear down an AKS Arc
(hybrid/edge) cluster environment for local development of AKS Desktop.

## Prerequisites

- Azure CLI installed (`az`) — bundled with AKS Desktop
- An Azure subscription with quota for **Standard\_E16s\_v4** VMs
  (16 vCPUs, 128 GiB RAM)
- Contributor access to the target subscription

## Quick Start

### 1. Set up the environment

From the repository root:

```bash
npm run setupArcEnv -- \
  --subscription <subscription-id> \
  --location eastus \
  --username azureuser \
  --password 'YourSecurePassword123!'
```

Optional flags:

| Flag | Default | Description |
| --- | --- | --- |
| `--group-name` | `jumpstart-rg` | Resource group name |
| `--vm-name` | `jumpstartVM` | Virtual machine name |
| `--vnet-name` | `jumpstartVNet` | Virtual network name |
| `--subnet-name` | `jumpstartSubnet` | Subnet name |

This creates a Windows Server 2022 VM with nested Hyper-V, assigns a
managed identity with Contributor role, and initiates Hyper-V installation
on the VM — all automated via `az vm run-command` (no RDP required).

### 2. Deploy AKS Arc components

After the VM is created, deploy AKS Arc components using the
[aksArc jumpstart](https://github.com/Azure/aksArc/tree/main/aksarc_jumpstart)
scripts. These scripts run remotely via ARM template deployments and
`az vm run-command invoke` — no RDP is required.

### 3. Register the cluster in AKS Desktop

1. Open AKS Desktop and go to **Add Cluster → Azure Kubernetes Service**.
2. Select your subscription — Arc clusters appear alongside standard AKS
   clusters, labelled **AKSARC**.
3. Select the Arc cluster and click **Register**.
4. Use the proxy controls (Start / Stop / Restart / Refresh) to manage
   the `az connectedk8s proxy` connection.

### 4. Tear down the environment

```bash
npm run teardownArcEnv -- \
  --subscription <subscription-id> \
  --group-name jumpstart-rg
```

This deletes the resource group and all associated resources.

## UI-based Setup / Teardown

If the **Arc Test Environment** preview feature is enabled in
**Settings → Preview Features**, AKS Desktop shows an additional
cluster provider in the **Add Cluster** page that exposes the same
setup and teardown operations through a dialog.

## Enabling / Disabling the Feature

The Arc environment UI is gated by a preview feature flag. To toggle it:

1. Open AKS Desktop → **Settings** → **Preview Features**.
2. Toggle **Arc Test Environment** on or off.

When disabled, the cluster provider and route are not registered and the
UI is completely hidden.

## Architecture

| Layer | File | Purpose |
| --- | --- | --- |
| Utility | `plugins/aks-desktop/src/components/Arc/environment.ts` | Setup / teardown / provider registration logic |
| Proxy | `plugins/aks-desktop/src/components/Arc/proxy.ts` | Arc proxy lifecycle management |
| Hook | `plugins/aks-desktop/src/components/Arc/useArcExtensionCheck.ts` | Check & install `connectedk8s` + `aksarc` CLI extensions |
| Hook | `plugins/aks-desktop/src/components/Arc/useArcProxy.ts` | Arc proxy status polling & action dispatch |
| Dialog | `plugins/aks-desktop/src/components/Arc/ArcEnvironmentDialog.tsx` | Stateful dialog component |
| Pure UI | `plugins/aks-desktop/src/components/Arc/ArcEnvironmentDialogPure.tsx` | Presentational dialog |
| Page | `plugins/aks-desktop/src/components/Arc/ArcEnvironmentPage.tsx` | Route target wrapping the dialog |
| Feature flag | `plugins/aks-desktop/src/components/PluginSettings/previewFeaturesStore.ts` | `arcEnvironment` toggle |
| CLI script | `scripts/arc-env.ts` | Node CLI that mirrors the UI logic for `npm run setupArcEnv` / `teardownArcEnv` |

## Troubleshooting

### VM quota errors

Ensure your subscription has quota for E16s\_v4 VMs in the target region.
You can request a quota increase in the Azure portal under
**Subscriptions → Usage + quotas**.

### Provider registration failures

The setup registers seven Azure resource providers. If one fails, check
that you have Contributor or Owner access on the subscription.

### Extensions not found

AKS Desktop will prompt you to install the `connectedk8s` and `aksarc`
CLI extensions when they are missing. Click **Install Extensions** in the
dialog to install them automatically.

### Proxy won't start

Make sure you have registered the cluster and that `az connectedk8s proxy`
can reach the cluster. Common causes: expired credentials, port conflicts,
or the Arc agent not running on the VM.
