# AKS Desktop Plugin — Feature Separation Report

This report analyzes which features from the `aks-desktop` plugin can be extracted into separate, feature-based Headlamp plugins. Features are grouped by their external dependencies.

---

## Table of Contents

- [Dependency Groups](#dependency-groups)
  - [Group 1: Headlamp / Kubernetes API Only](#group-1-headlamp--kubernetes-api-only-no-external-dependencies)
  - [Group 2: Azure CLI Dependent](#group-2-azure-cli-dependent)
  - [Group 3: GitHub API Dependent](#group-3-github-api-dependent)
  - [Group 4: Prometheus Dependent (+ Azure CLI for auth)](#group-4-prometheus-dependent--azure-cli-for-auth)
  - [Group 5: Multi-Dependency (Azure CLI + GitHub + Kubernetes)](#group-5-multi-dependency-azure-cli--github--kubernetes)
- [Summary Matrix](#summary-matrix)
- [Notes on Online API Alternatives](#notes-on-online-api-alternatives)

---

## Dependency Groups

### Group 1: Headlamp / Kubernetes API Only (No External Dependencies)

These features depend **only** on the Headlamp plugin API and the Kubernetes API (via the Headlamp backend). They are the easiest to extract into standalone plugins.

#### 1a. Logs Tab — Pod Log Viewer

| | |
|---|---|
| **What it does** | Displays pod/container logs for deployments in a project namespace. |
| **Files** | `src/components/LogsTab/LogsTab.tsx`, `src/components/LogsTab/hooks/` |
| **K8s APIs used** | `Pod.apiGet()`, `pod.getLogs()` (via Headlamp `K8s.ResourceClasses`) |
| **External deps** | None |
| **Online API alternative** | N/A — already uses the Kubernetes API through Headlamp. |

#### 1b. Deploy Wizard — Core Application Deployment

| | |
|---|---|
| **What it does** | Multi-step wizard to deploy container images or YAML manifests: configure container image, env vars, CPU/memory resources, health checks, HPA, networking (Service/Ingress). |
| **Files** | `src/components/DeployWizard/DeployWizard.tsx`, `src/components/DeployWizard/components/` (`SourceStep.tsx`, `BasicsStep.tsx`, `ContainerStep.tsx`, `EnvVarsStep.tsx`, `ResourcesStep.tsx`, `HealthchecksStep.tsx`, `HpaStep.tsx`, `NetworkingStep.tsx`, `Deploy.tsx`), `src/components/DeployWizard/utils/` (`yamlGenerator.ts`, `quotaCheck.ts`), `src/components/Deploy/DeployButton.tsx` |
| **K8s APIs used** | `Deployment`, `Service`, `HorizontalPodAutoscaler`, `Namespace` — create/apply via Headlamp API |
| **External deps** | None for the core wizard. The **optional** `WorkloadIdentityStep.tsx` depends on Azure CLI (see Group 2). |
| **Online API alternative** | N/A — already uses the Kubernetes API. |
| **Notes** | The Workload Identity step (`WorkloadIdentityStep.tsx`, `useDeployWorkloadIdentity.ts`) could remain in an Azure-specific plugin while the core wizard is extracted. |

#### 1c. Scaling Tab — HPA & Manual Scaling

| | |
|---|---|
| **What it does** | View and configure Horizontal Pod Autoscaler rules; manually scale deployments; display scaling status. |
| **Files** | `src/components/Scaling/ScalingTab.tsx`, `src/components/Scaling/ScalingCard.tsx`, `src/components/Scaling/components/` (`ScalingEditDialog.tsx`, `ScalingMetrics.tsx`, `ScalingChart.tsx`), `src/components/Scaling/hooks/` (`useHPAInfo.ts`, `useDeployments.ts`) |
| **K8s APIs used** | `HorizontalPodAutoscaler` (get/create/update/delete), `Deployment` (get/list/scale) |
| **External deps** | The **chart history** (`useChartData.ts`) queries Prometheus for 24h scaling data (see Group 4). The core scaling CRUD is pure K8s. |
| **Online API alternative** | N/A — already uses Kubernetes API. |
| **Notes** | The Prometheus-backed chart component (`ScalingChart.tsx` + `useChartData.ts`) can be split out or made optional. |

#### 1d. Create Namespace — Basic K8s Namespace Creation

| | |
|---|---|
| **What it does** | Create a standard Kubernetes namespace and register it as a project. |
| **Files** | `src/components/CreateNamespace/CreateNamespace.tsx`, `src/utils/kubernetes/namespaceUtils.ts`, `src/utils/kubernetes/k8sNames.ts` |
| **K8s APIs used** | `Namespace` (create, label) |
| **External deps** | None |
| **Online API alternative** | N/A |

#### 1e. Plugin Settings — Preview Feature Toggles

| | |
|---|---|
| **What it does** | Settings page for toggling preview features (e.g., GitHub pipelines). |
| **Files** | `src/components/PluginSettings/PreviewFeaturesSettings.tsx`, `src/components/PluginSettings/previewFeaturesStore.ts` |
| **External deps** | None — uses Headlamp `pluginStore` |

#### 1f. Shared Utilities (Kubernetes)

| | |
|---|---|
| **Files** | `src/utils/kubernetes/cli-runner.ts` (K8s API wrappers via `K8s.ResourceClasses` + `az` CLI runner via `pluginRunCommand`), `src/utils/kubernetes/k8sNames.ts`, `src/utils/kubernetes/namespaceUtils.ts`, `src/utils/kubernetes/serviceAccountNames.ts`, `src/utils/shared/isAksProject.ts`, `src/utils/shared/resourceUnits.ts`, `src/utils/shared/formatTime.ts` |
| **Notes** | These are shared dependencies used across features. Any extracted plugin that needs K8s operations will need copies of or references to these utilities. |

---

### Group 2: Azure CLI Dependent

These features require the `az` CLI to be installed locally and the user to be authenticated via `az login`. They **only work in the Electron desktop app** (gated by `Headlamp.isRunningAsApp()`).

#### 2a. Azure Authentication — Login & Profile

| | |
|---|---|
| **What it does** | Azure CLI login flow, profile display, subscription info, auth status polling. |
| **Files** | `src/components/AzureAuth/AzureLoginPage.tsx`, `src/components/AzureAuth/AzureProfilePage.tsx`, `src/components/AzureAuth/AzureAuthGuard.tsx`, `src/hooks/useAzureAuth.tsx`, `src/hooks/useAzureContext.ts`, `src/utils/azure/az-auth.ts`, `src/utils/azure/az-cli-core.ts`, `src/utils/azure/az-cli-path.ts`, `src/utils/azure/checkAzureCli.ts`, `src/components/AzureCliWarning.tsx` |
| **CLI commands** | `az login`, `az account show`, `az account get-access-token`, `az account list` |
| **Online API alternative** | **Yes — [Microsoft Entra ID (Azure AD) OAuth 2.0](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)**. The browser-based OAuth/OIDC flow can replace `az login` for web/in-cluster scenarios. Use `@azure/identity` SDK with `InteractiveBrowserCredential` or `AuthorizationCodeCredential`. Token acquisition can use `@azure/identity`'s `DefaultAzureCredential` in-cluster (managed identity) or `ClientSecretCredential` for service-to-service. |

#### 2b. AKS Cluster Registration

| | |
|---|---|
| **What it does** | Browse Azure subscriptions, list AKS clusters, register them in Headlamp (merges kubeconfig). |
| **Files** | `src/components/AKS/RegisterAKSClusterPage.tsx`, `src/components/AKS/RegisterAKSClusterDialog.tsx`, `src/components/AKS/RegisterAKSClusterDialogPure.tsx`, `src/utils/azure/az-clusters.ts`, `src/utils/azure/az-subscriptions.ts`, `src/utils/azure/az-resource-graph.ts`, `src/hooks/useRegisteredClusters.ts` |
| **CLI commands** | `az aks list`, `az aks show`, `az aks get-credentials`, `az account list`, `az graph query` |
| **Online API alternative** | **Yes — [Azure Resource Manager REST API](https://learn.microsoft.com/en-us/rest/api/aks/managed-clusters/list)**. `GET /subscriptions/{sub}/providers/Microsoft.ContainerService/managedClusters` lists clusters. [Azure Resource Graph REST API](https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resources/resources) replaces `az graph query`. Kubeconfig retrieval: `POST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{name}/listClusterUserCredential`. All require a Bearer token from Entra ID. |

#### 2c. Create AKS Managed Namespace Project

| | |
|---|---|
| **What it does** | Multi-step wizard: select subscription → cluster → create ARM-managed namespace with RBAC, Azure AD user lookup, extension/feature validation. |
| **Files** | `src/components/CreateAKSProject/CreateAKSProject.tsx`, `src/components/CreateAKSProject/components/` (`BasicsStep.tsx`, `AccessStep.tsx`, `NetworkingStep.tsx`, `ComputeStep.tsx`, `ReviewStep.tsx`), `src/components/CreateAKSProject/hooks/` (`useAzureResources.ts`, `useExtensionCheck.ts`, `useFeatureCheck.ts`, `useValidation.ts`), `src/components/CreateAKSProject/validators.ts` (co-located with the wizard per project conventions) |
| **CLI commands** | `az aks namespace create`, `az aks list`, `az aks show`, `az account show`, `az provider register`, `az extension add`, `az extension list`, `az role assignment create`, `az ad user list --filter` |
| **Online API alternative** | **Partial** — ARM REST API can create managed namespaces (`PUT /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster}/managedNamespaces/{ns}`). Role assignments use [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/create). Azure AD user search uses [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/user-list) (`GET /users?$filter=startswith(displayName,'...')`). Extension checks have no direct REST equivalent outside ARM. |

#### 2d. Import AKS Projects

| | |
|---|---|
| **What it does** | Discover existing namespaces (via Azure Resource Graph and K8s API), convert to AKS Desktop projects. |
| **Files** | `src/components/ImportAKSProjects/ImportAKSProjects.tsx`, `src/components/ImportAKSProjects/components/ConversionDialog.tsx`, `src/hooks/useNamespaceDiscovery.ts` |
| **CLI commands** | `az aks namespace list`, `az graph query` |
| **Online API alternative** | **Yes** — ARM REST API for managed namespace listing; Azure Resource Graph REST API for discovery. |

#### 2e. Access Tab — Azure RBAC Role Assignments

| | |
|---|---|
| **What it does** | Display Azure role assignments for a managed namespace. |
| **Files** | `src/components/AccessTab/AccessTab.tsx`, `src/components/AccessTab/hooks/useAccessTab.ts`, `src/utils/azure/az-namespace-access.ts`, `src/utils/azure/roleAssignment.ts`, `src/utils/azure/az-ad.ts` |
| **CLI commands** | `az role assignment list`, `az role assignment create`, `az ad user list --filter` |
| **Online API alternative** | **Yes** — [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/list) for role assignments; [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/user-list) for user lookup. |

#### 2f. Delete AKS Project

| | |
|---|---|
| **What it does** | Delete ARM-managed namespaces with proper Azure cleanup. |
| **Files** | `src/components/DeleteAKSProject/AKSProjectDeleteButton.tsx`, `src/components/DeleteAKSProject/components/`, `src/components/DeleteAKSProject/hooks/useProjectDeletion.ts` |
| **CLI commands** | `az aks namespace delete` (via `deleteManagedNamespace` in `az-namespaces.ts`) |
| **Online API alternative** | **Yes** — ARM REST API `DELETE` on the managed namespace resource. |

#### 2g. Info Tab — Namespace & Cluster Metadata

| | |
|---|---|
| **What it does** | Display namespace details including managed namespace metadata from Azure. |
| **Files** | `src/components/InfoTab/InfoTab.tsx`, `src/components/InfoTab/hooks/useInfoTab.ts` |
| **CLI commands** | `az aks namespace show` (via `getManagedNamespace` in `az-namespaces.ts`) |
| **Online API alternative** | **Yes** — ARM REST API `GET` on the managed namespace resource. |

#### 2h. Cluster Capability Card

| | |
|---|---|
| **What it does** | Show cluster capabilities (AKS extensions, managed Prometheus, etc.). |
| **Files** | `src/components/ClusterCapabilityCard/ClusterCapabilityCard.tsx`, `src/hooks/useNamespaceCapabilities.ts`, `src/types/ClusterCapabilities.ts` |
| **CLI commands** | `az aks show` (cluster features), `az extension list` |
| **Online API alternative** | **Yes** — `GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{name}` returns full cluster config including addons/features. |

#### 2i. Azure Identity & Workload Identity Utilities

| | |
|---|---|
| **What it does** | Create managed identities, federated credentials, role assignments for workload identity. Used by both Deploy Wizard and GitHub Pipeline features. |
| **Files** | `src/utils/azure/az-identity.ts`, `src/utils/azure/az-federation.ts`, `src/utils/azure/identitySetup.ts`, `src/utils/azure/identityWithRoles.ts`, `src/utils/azure/identityRoles.ts`, `src/utils/azure/az-acr.ts` |
| **CLI commands** | `az identity create`, `az identity show`, `az identity list`, `az identity federated-credential create`, `az role assignment create`, `az acr create`, `az acr list` |
| **Online API alternative** | **Yes** — [Managed Identity REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity/user-assigned-identities), [Federated Identity Credentials REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity/federated-identity-credentials), [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments), [ACR REST API](https://learn.microsoft.com/en-us/rest/api/containerregistry/registries). |

#### 2j. Shared Azure Utilities

| | |
|---|---|
| **Files** | `src/utils/azure/az-cli-core.ts` (command runner), `src/utils/azure/az-cli-path.ts` (path resolution), `src/utils/azure/az-validation.ts`, `src/utils/azure/az-extensions.ts`, `src/utils/azure/checkAzureCli.ts`, `src/utils/azure/aks.ts`, `src/utils/azure/az-subscriptions.ts` |
| **Notes** | These are shared infrastructure used by all Azure CLI features. If migrating to REST APIs, these would be replaced by an Azure SDK client layer using `@azure/identity` + `@azure/arm-*` packages. |

---

### Group 3: GitHub API Dependent

These features depend on the **GitHub REST API via Octokit**. They authenticate through GitHub OAuth (browser-based) and store tokens in localStorage. They do **not** require `gh` CLI.

#### 3a. GitHub Authentication

| | |
|---|---|
| **What it does** | GitHub OAuth device flow, token management, GitHub App installation linking. |
| **Files** | `src/utils/github/github-auth.ts`, `src/utils/github/secure-storage.ts`, `src/components/GitHubPipeline/GitHubAuthContext.tsx`, `src/components/GitHubPipeline/components/GitHubAuthStatusButton.tsx`, `src/components/GitHubPipeline/hooks/useGitHubAuth.ts`, `src/types/github.ts` |
| **External deps** | GitHub.com OAuth API, GitHub App installation |
| **Online API alternative** | Already uses online API (Octokit REST). Works in-cluster/web as-is. |

#### 3b. Deployments / Pipeline Card — Workflow Run Status

| | |
|---|---|
| **What it does** | Display recent GitHub Actions workflow runs and deployment status for a project. |
| **Files** | `src/components/Deployments/PipelineCard.tsx`, `src/components/Deployments/hooks/usePipelineRuns.ts` |
| **External deps** | GitHub REST API (`listWorkflowRuns`) |
| **Online API alternative** | Already uses online API. |

---

### Group 4: Prometheus Dependent (+ Azure CLI for Auth)

These features query **Azure Managed Prometheus** for metrics. They require the Azure CLI **only** to acquire a Prometheus access token (`az account get-access-token --resource https://prometheus.monitor.azure.com/`) and to discover the Prometheus endpoint.

#### 4a. Metrics Tab — Performance Dashboard

| | |
|---|---|
| **What it does** | Real-time CPU, memory, network, request rate, and latency charts using PromQL. |
| **Files** | `src/components/Metrics/MetricsTab.tsx`, `src/components/Metrics/MetricsCard.tsx`, `src/components/Metrics/components/` (`MetricsChart.tsx`, `MetricStatCard.tsx`, `PodDetailsTable.tsx`), `src/components/Metrics/hooks/` (`usePrometheusMetrics.ts`, `useDeployments.ts`, `usePods.ts`), `src/components/Metrics/utils.ts`, `src/utils/prometheus/queryPrometheus.tsx`, `src/utils/prometheus/getPrometheusEndpoint.tsx` |
| **CLI commands** | `az account get-access-token --resource https://prometheus.monitor.azure.com/` (token), `az alerts-management prometheus-rule-group list` (endpoint discovery), `az monitor account show` (workspace endpoint) |
| **K8s APIs used** | `Deployment` (list), `Pod` (list) — for selecting what to query metrics for |
| **Online API alternative** | **Yes** — Token acquisition can use `@azure/identity` (`DefaultAzureCredential` or `ManagedIdentityCredential` for in-cluster). Endpoint discovery can use [Azure Monitor REST API](https://learn.microsoft.com/en-us/rest/api/monitor/). PromQL queries are already standard HTTP POST to the Prometheus endpoint. For **non-Azure** Prometheus, queries work directly without any Azure dependency. |

#### 4b. Scaling History Charts (Prometheus)

| | |
|---|---|
| **What it does** | 24-hour scaling history using Prometheus (replica count, CPU/memory over time). |
| **Files** | `src/components/Scaling/hooks/useChartData.ts`, `src/components/Scaling/components/ScalingChart.tsx` |
| **External deps** | Same as Metrics — Prometheus queries via Azure CLI token |
| **Online API alternative** | Same as above. |

---

### Group 5: Multi-Dependency (Azure CLI + GitHub + Kubernetes)

These features combine multiple external dependencies and represent the most complex extraction targets.

#### 5a. GitHub Pipeline Wizard — Full CI/CD Setup

| | |
|---|---|
| **What it does** | End-to-end GitHub Actions pipeline: connect GitHub repo → detect Dockerfiles → create ACR → set up Workload Identity (managed identity + federated credential + role assignments) → generate workflow YAML → create PR → monitor deployment. |
| **Files** | `src/components/GitHubPipeline/GitHubPipelineWizard.tsx`, `src/components/GitHubPipeline/components/` (`ConnectSourceStep.tsx`, `DockerfileConfirmation.tsx`, `PathSelectionStep.tsx`, `AcrSelector.tsx`, `WorkloadIdentitySetup.tsx`, `ReviewAndMergeStep.tsx`, `RepoSelector.tsx`, etc.), `src/components/GitHubPipeline/hooks/` (`useGitHubPipelineOrchestration.ts`, `useFastPathOrchestration.ts`, `useDockerfileDiscovery.ts`, `useWorkloadIdentitySetup.ts`, `usePipelineAnnotationSync.ts`), `src/components/GitHubPipeline/utils/` (`pipelineOrchestration.ts`, `fastPathTemplates.ts`, `agentTemplates.ts`), `src/components/ConfigurePipeline/ConfigurePipelineButton.tsx` (currently in a separate directory; could be moved into `GitHubPipeline/components/` to co-locate with the feature) |
| **CLI commands (Azure)** | `az identity create`, `az identity federated-credential create`, `az role assignment create`, `az aks show`, `az acr create`, `az acr list` |
| **GitHub API** | Octokit: list repos, search files (Dockerfiles), create branches, push commits, create PRs, list workflow runs |
| **K8s APIs** | `Deployment` (apply, patch annotations), `ServiceAccount` |
| **Online API alternative** | **Azure:** All commands have REST API equivalents (see Group 2i). **GitHub:** Already online API. **K8s:** Already via Headlamp backend. This feature could be fully web-compatible with Azure SDK migration. |

#### 5b. Deploy Tab — Deployment Overview with Pipeline Status

| | |
|---|---|
| **What it does** | Combined view of cluster deployments (K8s) and pipeline deployments (GitHub). Shows deployment cards, pipeline trigger dialog. |
| **Files** | `src/components/DeployTab/DeployTab.tsx`, `src/components/DeployTab/components/` (`ClusterDeployCard.tsx`, `PipelineDeployDialog.tsx`), `src/components/DeployTab/hooks/` (`useClusterDeployStatus.ts`, `usePipelineStatus.ts`, `usePipelineSettings.ts`) |
| **External deps** | Kubernetes API + GitHub API (workflow dispatch, run status) |
| **Online API alternative** | Already uses online APIs for both. |

---

## Summary Matrix

| Feature | Can Be Separate Plugin? | Az CLI | kubectl | GitHub API | Prometheus | K8s API | Online API Alternative? |
|---|---|---|---|---|---|---|---|
| **Logs Tab** | ✅ Easy | — | — | — | — | ✅ | N/A (already online) |
| **Deploy Wizard** (core) | ✅ Easy | — | — | — | — | ✅ | N/A (already online) |
| **Scaling Tab** (core) | ✅ Easy | — | — | — | Optional | ✅ | N/A |
| **Create Namespace** | ✅ Easy | — | — | — | — | ✅ | N/A |
| **Plugin Settings** | ✅ Easy | — | — | — | — | — | N/A |
| **Azure Auth** | ✅ Yes | ✅ | — | — | — | — | ✅ Entra ID OAuth |
| **AKS Cluster Registration** | ✅ Yes | ✅ | — | — | — | — | ✅ ARM REST API |
| **Create AKS Project** | ✅ Yes | ✅ | — | — | — | ✅ | ✅ Partial (ARM + Graph API) |
| **Import AKS Projects** | ✅ Yes | ✅ | — | — | — | ✅ | ✅ ARM + Resource Graph REST |
| **Access Tab** | ✅ Yes | ✅ | — | — | — | — | ✅ Authorization + Graph REST |
| **Delete AKS Project** | ✅ Yes | ✅ | — | — | — | — | ✅ ARM REST API |
| **Info Tab** | ✅ Yes | ✅ | — | — | — | ✅ | ✅ ARM REST API |
| **Cluster Capabilities** | ✅ Yes | ✅ | — | — | — | ✅ | ✅ ARM REST API |
| **Workload Identity Setup** | ✅ Yes | ✅ | — | — | — | — | ✅ Identity + Auth REST |
| **GitHub Auth** | ✅ Yes | — | — | ✅ | — | — | Already online |
| **Pipeline Card** | ✅ Yes | — | — | ✅ | — | ✅ | Already online |
| **Metrics Tab** | ✅ Yes | ✅ (token) | — | — | ✅ | ✅ | ✅ Azure Identity SDK |
| **Scaling Charts** | ✅ Yes | ✅ (token) | — | — | ✅ | — | ✅ Azure Identity SDK |
| **GitHub Pipeline Wizard** | ⚠️ Complex | ✅ | — | ✅ | — | ✅ | ✅ All replaceable |
| **Deploy Tab** | ⚠️ Moderate | — | — | ✅ | — | ✅ | Already online |

> **Note:** No features use `kubectl` CLI directly. All Kubernetes operations go through the Headlamp `K8s.ResourceClasses` API (which uses the Headlamp backend proxy to the K8s API server). The `cli-runner.ts` file uses `pluginRunCommand` only for `az` commands, not `kubectl`.

---

## Notes on Online API Alternatives

### Replacing Azure CLI with Azure REST APIs / SDKs

Every `az` CLI command used in this plugin has an equivalent Azure REST API. To make features work in-cluster or via the web (not just the Electron desktop app), the az CLI calls can be replaced with:

| Current (az CLI) | Replacement (REST / SDK) |
|---|---|
| `az login` | [Entra ID OAuth 2.0 Authorization Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) or `@azure/identity` SDK |
| `az account show/list` | [Subscriptions REST API](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list) |
| `az account get-access-token` | `@azure/identity` `getToken()` with appropriate credential |
| `az aks list/show` | [AKS REST API](https://learn.microsoft.com/en-us/rest/api/aks/managed-clusters) |
| `az aks namespace *` | AKS Managed Namespace ARM REST API |
| `az role assignment *` | [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments) |
| `az ad user list` | [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/user-list) |
| `az identity *` | [Managed Identity REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity) |
| `az identity federated-credential *` | [Federated Identity REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity/federated-identity-credentials) |
| `az acr *` | [Container Registry REST API](https://learn.microsoft.com/en-us/rest/api/containerregistry) |
| `az graph query` | [Resource Graph REST API](https://learn.microsoft.com/en-us/rest/api/azureresourcegraph) |
| `az alerts-management prometheus-rule-group list` | [Azure Monitor REST API](https://learn.microsoft.com/en-us/rest/api/monitor) |
| `az monitor account show` | [Azure Monitor Workspaces REST API](https://learn.microsoft.com/en-us/rest/api/monitor/azure-monitor-workspaces) |
| `az provider register` | [Providers REST API](https://learn.microsoft.com/en-us/rest/api/resources/providers) |
| `az extension *` | N/A (CLI-only concept; the extension just enables CLI commands — the underlying REST APIs are always available) |

### In-Cluster Authentication

For in-cluster or web deployment, Azure authentication can use:
- **Managed Identity** (`ManagedIdentityCredential` from `@azure/identity`) — for pods running in AKS with workload identity or pod identity configured
- **Client Certificate/Secret** (`ClientSecretCredential`) — for service accounts
- **On-Behalf-Of flow** (`OnBehalfOfCredential`) — when acting on behalf of a signed-in user

### GitHub API

The GitHub integration already uses Octokit (REST API over HTTPS) and does not depend on the `gh` CLI. It works in any environment with internet access.

### Prometheus

The PromQL queries themselves are standard HTTP — only the **token acquisition** depends on Azure CLI. Replacing `az account get-access-token` with `@azure/identity` SDK would make the Prometheus features fully web-compatible. For non-Azure Prometheus instances, the queries would work directly without any Azure dependency.

---

## Recommended Plugin Extraction Groupings

Based on the dependency analysis, here are recommended plugin boundaries:

1. **`headlamp-plugin-deploy`** — Deploy Wizard (core), Deploy Button, YAML generator *(K8s API only)*
2. **`headlamp-plugin-logs`** — Logs Tab *(K8s API only)*
3. **`headlamp-plugin-scaling`** — Scaling Tab core (HPA CRUD, manual scaling) *(K8s API only)*
4. **`headlamp-plugin-metrics`** — Metrics Tab, Scaling Charts *(K8s API + Prometheus)*
5. **`headlamp-plugin-github-pipelines`** — GitHub Auth, Pipeline Wizard, Pipeline Card, Deploy Tab pipeline integration *(GitHub API + K8s API)*
6. **`headlamp-plugin-azure-core`** — Azure Auth, Cluster Registration, Azure theme/branding *(Azure CLI / Azure SDK)*
7. **`headlamp-plugin-azure-namespaces`** — Create/Import/Delete AKS Projects, Access Tab, Info Tab, Cluster Capabilities *(Azure CLI / Azure SDK + K8s API)*
8. **`headlamp-plugin-azure-identity`** — Workload Identity setup, ACR management, Federated Credentials *(Azure CLI / Azure SDK)*
