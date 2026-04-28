# AKS Desktop Plugin — Feature Separation Report

This report analyzes which features from the `aks-desktop` plugin can be extracted into separate, feature-based Headlamp plugins. Features are grouped by their external dependencies.

> All file paths are relative to `plugins/aks-desktop/src/`.

---

## Table of Contents

- [Dependency Groups](#dependency-groups)
  - [Group 1: Headlamp / Kubernetes API Only](#group-1-headlamp--kubernetes-api-only-no-external-dependencies)
  - [Group 2: Azure CLI Dependent](#group-2-azure-cli-dependent)
  - [Group 3: GitHub API Dependent](#group-3-github-api-dependent)
  - [Group 4: Prometheus Dependent (+ Azure CLI for auth)](#group-4-prometheus-dependent--azure-cli-for-auth)
  - [Group 5: Multi-Dependency (Azure CLI + GitHub + Kubernetes)](#group-5-multi-dependency-azure-cli--github--kubernetes)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
- [Summary Matrix](#summary-matrix)
- [Notes on Online API Alternatives](#notes-on-online-api-alternatives)
- [Recommended Plugin Extraction Groupings](#recommended-plugin-extraction-groupings)

---

## Dependency Groups

### Group 1: Headlamp / Kubernetes API Only (No External Dependencies)

These features depend **only** on the Headlamp plugin API and the Kubernetes API (via the Headlamp backend). They are the easiest to extract into standalone plugins.

#### 1a. Logs Tab — Pod Log Viewer

| | |
|---|---|
| **What it does** | Displays pod/container logs for deployments in a project namespace. |
| **Files** | `components/LogsTab/LogsTab.tsx`, `components/LogsTab/hooks/` |
| **K8s APIs used** | `Pod.apiGet()`, `pod.getLogs()` (via Headlamp `K8s.ResourceClasses`) |
| **External deps** | None |
| **Online API alternative** | N/A — already uses the Kubernetes API through Headlamp. |
| **Separation difficulty** | ✅ Easy — self-contained, no cross-feature imports. |

#### 1b. Deploy Wizard — Core Application Deployment

| | |
|---|---|
| **What it does** | Multi-step wizard to deploy container images or YAML manifests: configure container image, env vars, CPU/memory resources, health checks, HPA, networking (Service/Ingress). |
| **Files** | `components/DeployWizard/DeployWizard.tsx`, `components/DeployWizard/components/` (24 files: `SourceStep.tsx`, `BasicsStep.tsx`, `ConfigureContainer.tsx`, `ConfigureYAML.tsx`, `EnvVarsStep.tsx`, `ResourcesStep.tsx`, `HealthchecksStep.tsx`, `HpaStep.tsx`, `NetworkingStep.tsx`, `AdvancedStep.tsx`, `Deploy.tsx`, `DeployPure.tsx`, `DeployWizardPure.tsx`, + stories and tests), `components/DeployWizard/utils/` (`yamlGenerator.ts`, `quotaCheck.ts`, `dryRunApply.ts`, `namespaceOverride.ts`, + tests), `components/Deploy/DeployButton.tsx` |
| **K8s APIs used** | `Deployment`, `Service`, `HorizontalPodAutoscaler`, `Namespace` — create/apply via Headlamp API |
| **External deps** | None for the core wizard. The **optional** `WorkloadIdentityStep.tsx` depends on Azure CLI (see Group 2). |
| **Online API alternative** | N/A — already uses the Kubernetes API. |
| **Separation difficulty** | ⚠️ Moderate — the `ConfigureContainer` component and `ContainerConfig` type are imported by `GitHubPipeline/components/AgentSetupReview.tsx`. The `Breadcrumb` component from `CreateAKSProject` is also imported. These cross-feature imports must be resolved (extract to shared or duplicate). |

#### 1c. Scaling Tab — HPA & Manual Scaling

| | |
|---|---|
| **What it does** | View and configure Horizontal Pod Autoscaler rules; manually scale deployments; display scaling status. |
| **Files** | `components/Scaling/ScalingTab.tsx`, `components/Scaling/ScalingCard.tsx`, `components/Scaling/components/` (`ScalingEditDialog.tsx`, `ScalingMetrics.tsx`, `ScalingChart.tsx`), `components/Scaling/hooks/` (`useHPAInfo.ts`, `useDeployments.ts`, `useChartData.ts`) |
| **K8s APIs used** | `HorizontalPodAutoscaler` (get/create/update/delete), `Deployment` (get/list/scale) |
| **External deps** | The **chart history** (`useChartData.ts`) queries Prometheus for 24h scaling data (see Group 4). The core scaling CRUD is pure K8s. |
| **Online API alternative** | N/A — already uses Kubernetes API. |
| **Separation difficulty** | ⚠️ Moderate — uses `DeploymentSelector` shared component and optionally depends on Prometheus. The chart component can be split out or made optional. |

#### 1d. Create Namespace — Basic K8s Namespace Creation

| | |
|---|---|
| **What it does** | Create a standard Kubernetes namespace and register it as a project. |
| **Files** | `components/CreateNamespace/CreateNamespace.tsx`, `utils/kubernetes/namespaceUtils.ts`, `utils/kubernetes/k8sNames.ts` |
| **K8s APIs used** | `Namespace` (create, label) |
| **External deps** | None |
| **Separation difficulty** | ⚠️ Moderate — imports `Breadcrumb` component from `CreateAKSProject/components/`. Also uses `clusterSettings` (shared utility with localStorage). These would need to be extracted to shared code. |

#### 1e. Plugin Settings — Preview Feature Toggles

| | |
|---|---|
| **What it does** | Settings page for toggling preview features (e.g., GitHub pipelines). |
| **Files** | `components/PluginSettings/PreviewFeaturesSettings.tsx`, `components/PluginSettings/previewFeaturesStore.ts` |
| **External deps** | None — uses Headlamp `ConfigStore` |
| **Separation difficulty** | ⚠️ Cross-cutting — the `previewFeaturesStore` is consumed by 5+ components across features (controls GitHub pipeline visibility in `index.tsx`, `DeployTab`, etc.). If extracted, other plugins would need to access this store, or each plugin would need its own feature flags. |

#### 1f. Shared Utilities (Kubernetes & Platform)

| | |
|---|---|
| **Files** | `utils/kubernetes/cli-runner.ts` (K8s API wrappers via `K8s.ResourceClasses` + `az` CLI runner via `pluginRunCommand`), `utils/kubernetes/k8sNames.ts` (DNS-1123 validation), `utils/kubernetes/namespaceUtils.ts` (create/label namespaces), `utils/kubernetes/serviceAccountNames.ts`, `utils/shared/isAksProject.ts` (checks namespace labels), `utils/shared/resourceUnits.ts` (parse CPU/memory), `utils/shared/formatTime.ts`, `utils/shared/clusterSettings.ts` (per-cluster localStorage settings), `utils/shared/openExternalUrl.ts` (safe `window.open`), `utils/shared/runCommandAsync.ts` (generic `pluginRunCommand` bridge), `utils/shared/quoteForPlatform.ts` (Windows shell quoting) |
| **Notes** | These are shared dependencies used across features. Any extracted plugin that needs K8s or platform operations will need copies of or references to these utilities. `cli-runner.ts` contains both K8s API wrappers (e.g., `getDeployments()`, `getPods()`) and a `runCommandWithOutput('az', ...)` helper used by Prometheus and Azure features. |

#### 1g. Shared UI Components

| | |
|---|---|
| **Files** | `components/shared/DeploymentSelector.tsx` (5 imports across Metrics, Scaling, Pipeline features), `components/shared/FormField.tsx` (5 imports across wizards), `components/shared/ComputeStep.tsx`, `components/shared/NetworkingStep.tsx`, `components/shared/ResourceCard.tsx`, `components/shared/CopyButton.tsx` |
| **Notes** | These shared components create coupling between features. `DeploymentSelector` is used by Metrics, Scaling, and Pipeline features. `FormField` is used across multiple wizards. These would need to be published as a shared UI library or duplicated into each plugin. |

#### 1h. Shared Types & Constants

| | |
|---|---|
| **Files** | `types/project.ts` (`ProjectDefinition`), `types/ClusterCapabilities.ts` (used by Metrics, Scaling, ClusterCapabilityCard), `types/github.ts` (GitHub types — shared between utils/github/ and GitHubPipeline), `types/global.d.ts`, `types/mui.d.ts`, `utils/constants/projectLabels.ts` (K8s label keys for AKS projects), `utils/constants/timing.ts` (polling intervals shared across features) |
| **Notes** | `projectLabels.ts` defines the labels used by `isAksProject()`, `isArmManagedProject()`, and all project creation/import flows. `timing.ts` constants are used by Azure auth polling, Metrics refresh, Access Tab cache, and login flows. |

---

### Group 2: Azure CLI Dependent

These features require the `az` CLI to be installed locally and the user to be authenticated via `az login`. They **only work in the Electron desktop app** (gated by `Headlamp.isRunningAsApp()`).

> **Important finding:** The plugin's `package.json` lists `@azure/identity`, `@azure/arm-subscriptions`, and `@azure/arm-resourcegraph` as dependencies, but **none of these Azure SDK packages are actually imported or used in the source code**. All Azure operations currently go through `az` CLI shell commands via `pluginRunCommand`. The SDK packages appear to be aspirational/unused dependencies.

#### 2a. Azure Authentication — Login & Profile

| | |
|---|---|
| **What it does** | Azure CLI login flow, profile display, subscription info, auth status polling (30s intervals). Auth state is exposed globally via `window.__azureAuthStatus` and `azure-auth-update` custom events. |
| **Files** | `components/AzureAuth/AzureLoginPage.tsx`, `components/AzureAuth/AzureProfilePage.tsx`, `components/AzureAuth/AzureAuthGuard.tsx`, `hooks/useAzureAuth.tsx`, `hooks/useAzureContext.ts`, `utils/azure/az-auth.ts`, `utils/azure/az-cli-core.ts`, `utils/azure/az-cli-path.ts`, `utils/azure/checkAzureCli.ts`, `components/AzureCliWarning.tsx` |
| **CLI commands** | `az login`, `az account show`, `az account get-access-token`, `az account list` |
| **Shared state** | `window.__azureAuthStatus` (global), `azure-auth-update` custom event, `localStorage('headlampThemePreference')` |
| **Online API alternative** | **Yes — [Microsoft Entra ID (Azure AD) OAuth 2.0](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)**. The browser-based OAuth/OIDC flow can replace `az login` for web/in-cluster scenarios. Use `@azure/identity` SDK with `InteractiveBrowserCredential` or `AuthorizationCodeCredential`. Token acquisition can use `@azure/identity`'s `DefaultAzureCredential` in-cluster (managed identity) or `ClientSecretCredential` for service-to-service. |
| **Separation difficulty** | ⚠️ Moderate — auth state is consumed globally by many features via `window.__azureAuthStatus` and `useAzureAuth` hook. This must remain a foundational plugin that others depend on. |

#### 2b. AKS Cluster Registration

| | |
|---|---|
| **What it does** | Browse Azure subscriptions, list AKS clusters, register them in Headlamp (merges kubeconfig). |
| **Files** | `components/AKS/RegisterAKSClusterPage.tsx`, `components/AKS/RegisterAKSClusterDialog.tsx`, `components/AKS/RegisterAKSClusterDialogPure.tsx`, `utils/azure/az-clusters.ts`, `utils/azure/az-subscriptions.ts`, `utils/azure/az-resource-graph.ts`, `hooks/useRegisteredClusters.ts` |
| **CLI commands** | `az aks list`, `az aks show`, `az aks get-credentials`, `az account list`, `az graph query` |
| **Online API alternative** | **Yes — [Azure Resource Manager REST API](https://learn.microsoft.com/en-us/rest/api/aks/managed-clusters/list)**. `GET /subscriptions/{sub}/providers/Microsoft.ContainerService/managedClusters` lists clusters. [Azure Resource Graph REST API](https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resources/resources) replaces `az graph query`. Kubeconfig retrieval: `POST /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{name}/listClusterUserCredential`. All require a Bearer token from Entra ID. |
| **Separation difficulty** | ⚠️ Moderate — imports `ClusterConfigurePanel` from `CreateAKSProject/components/`, creating coupling with that feature. |

#### 2c. Create AKS Managed Namespace Project

| | |
|---|---|
| **What it does** | Multi-step wizard: select subscription → cluster → create ARM-managed namespace with RBAC, Azure AD user lookup, extension/feature validation. |
| **Files** | `components/CreateAKSProject/CreateAKSProject.tsx`, `components/CreateAKSProject/components/` (`BasicsStep.tsx`, `AccessStep.tsx`, `NetworkingStep.tsx`, `ComputeStep.tsx`, `ReviewStep.tsx`, `Breadcrumb.tsx`, `ClusterConfigurePanel.tsx`), `components/CreateAKSProject/hooks/` (`useAzureResources.ts`, `useExtensionCheck.ts`, `useFeatureCheck.ts`, `useValidation.ts`), `components/CreateAKSProject/validators.ts` |
| **CLI commands** | `az aks namespace create`, `az aks list`, `az aks show`, `az account show`, `az provider register`, `az extension add`, `az extension list`, `az role assignment create`, `az ad user list --filter` |
| **Online API alternative** | **Partial** — ARM REST API can create managed namespaces (`PUT /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{cluster}/managedNamespaces/{ns}`). Role assignments use [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/create). Azure AD user search uses [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/user-list) (`GET /users?$filter=startswith(displayName,'...')`). Extension checks (`az extension add/list`) have no REST equivalent but are unnecessary when using REST APIs directly (the extensions just enable CLI commands — the underlying REST APIs are always available). |
| **Separation difficulty** | ⚠️ Moderate — `Breadcrumb` and `ClusterConfigurePanel` components from this feature are imported by other features (CreateNamespace, AKS cluster registration, ClusterCapabilityCard). These shared components should be extracted to `components/shared/` before separation. |

#### 2d. Import AKS Projects

| | |
|---|---|
| **What it does** | Discover existing namespaces (via Azure Resource Graph and K8s API), convert to AKS Desktop projects. |
| **Files** | `components/ImportAKSProjects/ImportAKSProjects.tsx`, `components/ImportAKSProjects/components/ConversionDialog.tsx`, `hooks/useNamespaceDiscovery.ts` |
| **CLI commands** | `az aks namespace list`, `az graph query` |
| **Other deps** | Uses `clusterSettings.ts` (localStorage) for persisting allowed namespaces |
| **Online API alternative** | **Yes** — ARM REST API for managed namespace listing; Azure Resource Graph REST API for discovery. |

#### 2e. Access Tab — Azure RBAC Role Assignments

| | |
|---|---|
| **What it does** | Display Azure role assignments for a managed namespace; allows adding new role assignments. |
| **Files** | `components/AccessTab/AccessTab.tsx`, `components/AccessTab/hooks/useAccessTab.ts`, `utils/azure/az-namespace-access.ts`, `utils/azure/roleAssignment.ts`, `utils/azure/az-ad.ts` |
| **CLI commands** | `az role assignment list`, `az role assignment create`, `az ad user list --filter` |
| **Other deps** | Uses `ACCESS_TAB_CACHE_TTL_MS` timing constant for caching |
| **Online API alternative** | **Yes** — [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/list) for role assignments; [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/user-list) for user lookup. |

#### 2f. Delete AKS Project

| | |
|---|---|
| **What it does** | Delete ARM-managed namespaces with proper Azure cleanup. Includes permission check before deletion. |
| **Files** | `components/DeleteAKSProject/AKSProjectDeleteButton.tsx`, `components/DeleteAKSProject/components/AKSProjectDeleteDialog.tsx`, `components/DeleteAKSProject/hooks/useProjectDeletion.ts`, `components/DeleteAKSProject/hooks/useProjectPermissions.ts` |
| **CLI commands** | `az aks namespace delete` (via `deleteManagedNamespace` in `az-namespaces.ts`) |
| **Online API alternative** | **Yes** — ARM REST API `DELETE` on the managed namespace resource. |

#### 2g. Info Tab — Namespace & Cluster Metadata

| | |
|---|---|
| **What it does** | Display namespace details including managed namespace metadata from Azure. |
| **Files** | `components/InfoTab/InfoTab.tsx`, `components/InfoTab/hooks/useInfoTab.ts` |
| **CLI commands** | `az aks namespace show` (via `getManagedNamespace` in `az-namespaces.ts`) |
| **Online API alternative** | **Yes** — ARM REST API `GET` on the managed namespace resource. |

#### 2h. Cluster Capability Card

| | |
|---|---|
| **What it does** | Show cluster capabilities (AKS extensions, managed Prometheus, etc.). |
| **Files** | `components/ClusterCapabilityCard/ClusterCapabilityCard.tsx`, `hooks/useNamespaceCapabilities.ts`, `types/ClusterCapabilities.ts` |
| **CLI commands** | `az aks show` (cluster features), `az extension list` |
| **Cross-feature coupling** | Imports `ClusterConfigurePanel` from `CreateAKSProject/components/` |
| **Online API alternative** | **Yes** — `GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{name}` returns full cluster config including addons/features. |

#### 2i. Azure Identity & Workload Identity Utilities

| | |
|---|---|
| **What it does** | Create managed identities, federated credentials, role assignments for workload identity. Used by both Deploy Wizard (WorkloadIdentityStep) and GitHub Pipeline (WorkloadIdentitySetup). |
| **Files** | `utils/azure/az-identity.ts`, `utils/azure/az-federation.ts`, `utils/azure/identitySetup.ts`, `utils/azure/identityWithRoles.ts`, `utils/azure/identityRoles.ts`, `utils/azure/az-acr.ts`, `utils/azure/az-identity-kubelet.test.ts`, `utils/azure/identityRoles.test.ts`, `utils/azure/identitySetup.test.ts`, `utils/azure/identityWithRoles.test.ts` |
| **CLI commands** | `az identity create`, `az identity show`, `az identity list`, `az identity federated-credential create`, `az role assignment create`, `az acr create`, `az acr list` |
| **Online API alternative** | **Yes** — [Managed Identity REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity/user-assigned-identities), [Federated Identity Credentials REST API](https://learn.microsoft.com/en-us/rest/api/managedidentity/federated-identity-credentials), [Authorization REST API](https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments), [ACR REST API](https://learn.microsoft.com/en-us/rest/api/containerregistry/registries). |

#### 2j. Shared Azure Utilities

| | |
|---|---|
| **Files** | `utils/azure/az-cli-core.ts` (command runner with `runAzCommand<T>()`), `utils/azure/az-cli-path.ts` (cross-platform path resolution), `utils/azure/az-validation.ts` (GUID validation, name sanitization), `utils/azure/az-extensions.ts` (auto-install CLI extensions), `utils/azure/checkAzureCli.ts` (verify `az` installation), `utils/azure/aks.ts` (high-level AKS wrapper), `utils/azure/az-subscriptions.ts` (subscription/resource group management), `utils/azure/az-namespaces.ts` (managed namespace CRUD), `utils/azure/README.md` |
| **Notes** | These are shared infrastructure used by all Azure CLI features. If migrating to REST APIs, these would be replaced by an Azure SDK client layer. Note that `@azure/identity`, `@azure/arm-subscriptions`, and `@azure/arm-resourcegraph` are already listed in `package.json` but are **not currently imported in any source file** — the actual Azure operations all shell out to `az` CLI via `pluginRunCommand`. |

---

### Group 3: GitHub API Dependent

These features depend on the **GitHub REST API via Octokit** (`@octokit/rest`). They authenticate through a GitHub OAuth device flow and store tokens via `libsodium-wrappers` (encrypted) with a `localStorage` fallback in dev mode. They do **not** require the `gh` CLI.

#### 3a. GitHub Authentication

| | |
|---|---|
| **What it does** | GitHub OAuth device flow, token management, GitHub App installation linking. Tokens are encrypted using `libsodium-wrappers` for secure storage. |
| **Files** | `utils/github/github-auth.ts`, `utils/github/github-auth.test.ts`, `utils/github/github-api.ts`, `utils/github/github-api.test.ts`, `utils/github/secure-storage.ts`, `components/GitHubPipeline/GitHubAuthContext.tsx`, `components/GitHubPipeline/components/GitHubAuthStatusButton.tsx`, `components/GitHubPipeline/hooks/useGitHubAuth.ts`, `types/github.ts` |
| **npm dependencies** | `@octokit/rest` (GitHub REST API client), `libsodium-wrappers` (token encryption) |
| **External deps** | GitHub.com OAuth API, GitHub App installation |
| **Shared state** | `GitHubAuthProvider` React Context (duplicated 3× in `index.tsx` because Headlamp renders each registered component in independent React trees — no shared ancestor), `github-auth-update` custom event, `localStorage` token fallback in dev mode |
| **Online API alternative** | Already uses online API (Octokit REST). Works in-cluster/web as-is. |

#### 3b. Deployments / Pipeline Card — Workflow Run Status

| | |
|---|---|
| **What it does** | Display recent GitHub Actions workflow runs and deployment status for a project. Can trigger opening the GitHub Pipeline wizard via `OPEN_CONFIGURE_PIPELINE_EVENT` custom event. |
| **Files** | `components/Deployments/PipelineCard.tsx`, `components/Deployments/hooks/usePipelineRuns.ts` |
| **External deps** | GitHub REST API (`listWorkflowRuns`), K8s API (deployment status) |
| **Online API alternative** | Already uses online API. |

---

### Group 4: Prometheus Dependent (+ Azure CLI for Auth)

These features query **Azure Managed Prometheus** for metrics. They require the Azure CLI **only** to acquire a Prometheus access token (`az account get-access-token --resource https://prometheus.monitor.azure.com/`) and to discover the Prometheus endpoint. The actual PromQL queries are standard HTTP POST requests.

#### 4a. Metrics Tab — Performance Dashboard

| | |
|---|---|
| **What it does** | Real-time CPU, memory, network, request rate, and latency charts using PromQL. Auto-refreshes at 30s intervals. |
| **Files** | `components/Metrics/MetricsTab.tsx`, `components/Metrics/MetricsCard.tsx`, `components/Metrics/components/` (7 files: `MetricsChart.tsx`, `MetricStatCard.tsx`, `PodDetailsTable.tsx`, `MetricsChartsGrid.tsx`, `MetricsSummaryBar.tsx`, `MetricsLoadingSkeleton.tsx`, `EmptyStateCard.tsx`), `components/Metrics/hooks/` (5 hooks: `usePrometheusMetrics.ts`, `useDeployments.ts`, `usePods.ts`, `useCardMetrics.ts`, `useNamespaceLabels.ts`, + tests), `components/Metrics/utils.ts`, `utils/prometheus/queryPrometheus.tsx`, `utils/prometheus/getPrometheusEndpoint.tsx` |
| **npm dependencies** | `recharts` (chart rendering) |
| **CLI commands** | `az account get-access-token --resource https://prometheus.monitor.azure.com/` (token), `az alerts-management prometheus-rule-group list` (endpoint discovery), `az monitor account show` (workspace endpoint) |
| **K8s APIs used** | `Deployment` (list), `Pod` (list) — for selecting what to query metrics for |
| **Online API alternative** | **Yes** — Token acquisition can use `@azure/identity` (`DefaultAzureCredential` or `ManagedIdentityCredential` for in-cluster). Endpoint discovery can use [Azure Monitor REST API](https://learn.microsoft.com/en-us/rest/api/monitor/). PromQL queries are already standard HTTP POST to the Prometheus endpoint. For **non-Azure** Prometheus, queries work directly without any Azure dependency. |

#### 4b. Scaling History Charts (Prometheus)

| | |
|---|---|
| **What it does** | 24-hour scaling history using Prometheus (replica count, CPU/memory over time). |
| **Files** | `components/Scaling/hooks/useChartData.ts`, `components/Scaling/components/ScalingChart.tsx` |
| **npm dependencies** | `recharts` (shared with Metrics) |
| **External deps** | Same as Metrics — Prometheus queries via Azure CLI token |
| **Online API alternative** | Same as above. |

---

### Group 5: Multi-Dependency (Azure CLI + GitHub + Kubernetes)

These features combine multiple external dependencies and represent the most complex extraction targets.

#### 5a. GitHub Pipeline Wizard — Full CI/CD Setup

| | |
|---|---|
| **What it does** | End-to-end GitHub Actions pipeline: connect GitHub repo → detect Dockerfiles → create ACR → set up Workload Identity (managed identity + federated credential + role assignments) → generate workflow YAML → create PR → monitor deployment. |
| **Files** | `components/GitHubPipeline/GitHubPipelineWizard.tsx`, `components/GitHubPipeline/components/` (17 files: `ConnectSourceStep.tsx`, `DockerfileConfirmation.tsx`, `PathSelectionStep.tsx`, `AcrSelector.tsx`, `WorkloadIdentitySetup.tsx`, `ReviewAndMergeStep.tsx`, `RepoSelector.tsx`, `AgentSetupReview.tsx`, `GitHubPipelineWizardPure.tsx`, `StepStatusIcon.tsx`, `WizardShell.tsx`, + stories/tests), `components/GitHubPipeline/hooks/` (20 files: `useGitHubPipelineOrchestration.ts`, `useFastPathOrchestration.ts`, `useDockerfileDiscovery.ts`, `useWorkloadIdentitySetup.ts`, `usePipelineAnnotationSync.ts`, `useGitHubAuth.ts`, `useGitHubPipelineState.ts`, `useFastPathPipelineState.ts`, `useAgentPRDiscovery.ts`, `useAgentWorkflowProgress.ts`, `useDeploymentHealth.ts`, `usePRPolling.ts`, `usePolling.ts`, `useWorkflowPolling.ts`, + tests), `components/GitHubPipeline/utils/` (20 files: `pipelineOrchestration.ts`, `fastPathOrchestration.ts`, `fastPathTemplates.ts`, `agentTemplates.ts`, `pipelineStorage.ts`, `deriveAcrName.ts`, `getWizardStep.ts`, `probeHelpers.ts`, `statusDisplay.ts`, `safeRecord.ts`, `yamlUtils.ts`, + tests), `components/GitHubPipeline/GitHubAuthContext.tsx`, `components/ConfigurePipeline/ConfigurePipelineButton.tsx` |
| **CLI commands (Azure)** | `az identity create`, `az identity federated-credential create`, `az role assignment create`, `az aks show`, `az acr create`, `az acr list` |
| **GitHub API** | Octokit: list repos, search files (Dockerfiles), create branches, push commits, create PRs, list workflow runs, dispatch workflows |
| **K8s APIs** | `Deployment` (apply, patch annotations), `ServiceAccount` |
| **Cross-feature coupling** | `AgentSetupReview.tsx` imports `ConfigureContainer` and `ContainerConfig` from `DeployWizard`. `PipelineCard` communicates with `ConfigurePipelineButton` via `OPEN_CONFIGURE_PIPELINE_EVENT` custom event. |
| **Online API alternative** | **Azure:** All commands have REST API equivalents (see Group 2i). **GitHub:** Already online API. **K8s:** Already via Headlamp backend. This feature could be fully web-compatible with Azure SDK migration. |
| **Separation difficulty** | ⚠️ Complex — largest feature (~57 files), imports from DeployWizard, communicates via custom events, shares Azure identity utilities with other features. |

#### 5b. Deploy Tab — Deployment Overview with Pipeline Status

| | |
|---|---|
| **What it does** | Combined view of cluster deployments (K8s) and pipeline deployments (GitHub). Shows deployment cards, pipeline trigger dialog. |
| **Files** | `components/DeployTab/DeployTab.tsx`, `components/DeployTab/components/` (`ClusterDeployCard.tsx`, `PipelineDeployDialog.tsx`), `components/DeployTab/hooks/` (`useClusterDeployStatus.ts`, `usePipelineStatus.ts`, `usePipelineSettings.ts`) |
| **External deps** | Kubernetes API + GitHub API (workflow dispatch, run status) |
| **Online API alternative** | Already uses online APIs for both. |

---

## Cross-Cutting Concerns

These are implicit dependencies that affect feature separation difficulty but are not feature-specific.

### Shared State Mechanisms

| Mechanism | Where Defined | Consumers | Impact on Separation |
|---|---|---|---|
| `window.__azureAuthStatus` | `index.tsx` | Headlamp components, `useAzureAuth` hook | Any plugin needing Azure auth status must read this global |
| `azure-auth-update` event | Fired by `AzureLoginPage`, `AzureProfilePage` | `index.tsx`, `useAzureAuth` hook | Cross-plugin event communication needed |
| `github-auth-update` event | Fired by `useGitHubAuth` (5 places) | GitHub-related components re-render | Keep within GitHub plugin |
| `OPEN_CONFIGURE_PIPELINE_EVENT` | Fired by `PipelineCard` | `ConfigurePipelineButton` listens | Tight coupling between Deployments and GitHubPipeline |
| `GitHubAuthProvider` Context | `GitHubAuthContext.tsx` | Duplicated 3× in `index.tsx` registrations | Headlamp's independent React trees force duplication |
| `previewFeaturesStore` ConfigStore | `previewFeaturesStore.ts` | `index.tsx` (pipeline overview gating), `DeployTab`, `usePreviewFeatures` hook (5+ uses) | Cross-plugin feature flag coordination needed |
| `clusterSettings` localStorage | `clusterSettings.ts` | `ImportAKSProjects`, `CreateNamespace`, `useNamespaceDiscovery` | Shared via localStorage — low coupling |

### Cross-Feature Component Imports

| Source Component | Imported By | Required Action |
|---|---|---|
| `CreateAKSProject/components/Breadcrumb` | `DeployWizard`, `CreateNamespace` | Extract to `components/shared/` |
| `CreateAKSProject/components/ClusterConfigurePanel` | `AKS/RegisterAKSClusterDialogPure`, `ClusterCapabilityCard` | Extract to `components/shared/` |
| `DeployWizard/components/ConfigureContainer` | `GitHubPipeline/components/AgentSetupReview` | Extract to `components/shared/` or create interface |
| `DeployWizard/hooks/useContainerConfiguration` (type) | `GitHubPipeline/components/AgentSetupReview` | Extract type to `types/` |
| `components/shared/DeploymentSelector` | Metrics, Scaling, Pipeline features (5 imports) | Already shared — would become a shared library |
| `components/shared/FormField` | Multiple wizards (5 imports) | Already shared — would become a shared library |

### Headlamp Plugin API Registrations (in `index.tsx`)

| Registration | Count | Feature |
|---|---|---|
| `registerAppLogo` | 1 | Branding |
| `registerAppTheme` | 1 | Branding |
| `registerPluginSettings` | 1 | Plugin Settings |
| `registerSidebarEntry` | 3 | Azure Auth (dynamic label updates) |
| `registerRoute` | 6 | Azure Auth (2), Create AKS Project, Import AKS Projects, Create Namespace, AKS Cluster Registration |
| `registerProjectOverviewSection` | 4 | Cluster Capabilities, Scaling, Metrics, Pipeline |
| `registerProjectDetailsTab` | 6 | Info, Deploy, Logs, Metrics, Scaling, Access |
| `registerProjectHeaderAction` | 3 | Deploy Button, GitHub Auth Status, Configure Pipeline |
| `registerCustomCreateProject` | 3 | Use Existing Namespace, Create Namespace, Create AKS Managed Namespace |
| `registerAddClusterProvider` | 1 | AKS Cluster Registration |
| `registerProjectDeleteButton` | 1 | Delete AKS Project |
| `Headlamp.setAppMenu` | 1 | Help menu customization (Documentation + Open Issue links) |

### npm Dependencies per Feature

| Dependency | Version | Used By |
|---|---|---|
| `@octokit/rest` | ^22.0.0 | GitHub Pipeline, Deployments |
| `libsodium-wrappers` | ^0.8.2 | GitHub Auth (token encryption in `github-api.ts`) |
| `recharts` | ^3.1.2 | Metrics Tab, Scaling Charts |
| `yaml` | ^2.8.3 | Deploy Wizard (YAML parsing), GitHub Pipeline |
| `@azure/identity` | ^4.12.0 | **Not imported in source** — listed but unused |
| `@azure/arm-subscriptions` | ^5.1.0 | **Not imported in source** — listed but unused |
| `@azure/arm-resourcegraph` | ^4.2.1 | **Not imported in source** — listed but unused |

---

## Summary Matrix

| Feature | Separate Plugin? | Az CLI | GitHub API | Prometheus | K8s API | Online API Alt? | Key Blocker |
|---|---|---|---|---|---|---|---|
| **Logs Tab** | ✅ Easy | — | — | — | ✅ | N/A | None |
| **Deploy Wizard** (core) | ⚠️ Moderate | — | — | — | ✅ | N/A | Cross-imports from GitHubPipeline, Breadcrumb |
| **Scaling Tab** (core) | ⚠️ Moderate | — | — | Optional | ✅ | N/A | DeploymentSelector shared, Prometheus optional |
| **Create Namespace** | ⚠️ Moderate | — | — | — | ✅ | N/A | Imports Breadcrumb from CreateAKSProject |
| **Plugin Settings** | ⚠️ Cross-cutting | — | — | — | — | N/A | Store consumed by 5+ features |
| **Azure Auth** | ⚠️ Foundational | ✅ | — | — | — | ✅ Entra ID | Global state consumed by all Azure features |
| **AKS Cluster Registration** | ⚠️ Moderate | ✅ | — | — | — | ✅ ARM REST | Imports ClusterConfigurePanel |
| **Create AKS Project** | ⚠️ Moderate | ✅ | — | — | ✅ | ✅ Partial | Shared components imported by 3 other features |
| **Import AKS Projects** | ✅ Easy | ✅ | — | — | ✅ | ✅ ARM + RG REST | Low coupling |
| **Access Tab** | ✅ Easy | ✅ | — | — | — | ✅ Auth + Graph | Self-contained |
| **Delete AKS Project** | ✅ Easy | ✅ | — | — | — | ✅ ARM REST | Self-contained |
| **Info Tab** | ✅ Easy | ✅ | — | — | ✅ | ✅ ARM REST | Self-contained |
| **Cluster Capabilities** | ⚠️ Moderate | ✅ | — | — | ✅ | ✅ ARM REST | Imports ClusterConfigurePanel |
| **Workload Identity** | ✅ Yes (util) | ✅ | — | — | — | ✅ Identity REST | Shared by DeployWizard + GitHubPipeline |
| **GitHub Auth** | ⚠️ Moderate | — | ✅ | — | — | Already online | Context duplicated 3×, event-based state |
| **Pipeline Card** | ⚠️ Moderate | — | ✅ | — | ✅ | Already online | Custom event coupling with ConfigurePipeline |
| **Metrics Tab** | ✅ Yes | ✅ (token) | — | ✅ | ✅ | ✅ Azure SDK | Self-contained (with recharts dep) |
| **Scaling Charts** | ✅ Yes | ✅ (token) | — | ✅ | — | ✅ Azure SDK | Part of Scaling Tab |
| **GitHub Pipeline Wizard** | ❌ Complex | ✅ | ✅ | — | ✅ | ✅ All replaceable | 57 files, imports from DeployWizard, custom events |
| **Deploy Tab** | ⚠️ Moderate | — | ✅ | — | ✅ | Already online | Combines K8s + GitHub views |

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
| `az aks get-credentials` | [AKS REST API `listClusterUserCredential`](https://learn.microsoft.com/en-us/rest/api/aks/managed-clusters/list-cluster-user-credentials) |
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

The GitHub integration already uses Octokit (REST API over HTTPS) and does not depend on the `gh` CLI. It works in any environment with internet access. Token management uses `libsodium-wrappers` for encryption.

### Prometheus

The PromQL queries themselves are standard HTTP POST — only the **token acquisition** depends on Azure CLI. Replacing `az account get-access-token` with `@azure/identity` SDK would make the Prometheus features fully web-compatible. For non-Azure Prometheus instances, the queries would work directly without any Azure dependency.

---

## Recommended Plugin Extraction Groupings

Based on the dependency analysis and cross-cutting concerns, here are recommended plugin boundaries:

### Prerequisite: Resolve Cross-Feature Coupling

Before extracting plugins, these shared components should be moved to `components/shared/`:
1. `Breadcrumb` (currently in `CreateAKSProject/components/`, imported by DeployWizard and CreateNamespace)
2. `ClusterConfigurePanel` (currently in `CreateAKSProject/components/`, imported by AKS and ClusterCapabilityCard)
3. `ConfigureContainer` + `ContainerConfig` type (currently in `DeployWizard/`, imported by GitHubPipeline)

### Plugin Groupings

1. **`headlamp-plugin-deploy`** — Deploy Wizard (core), Deploy Button, YAML generator *(K8s API only, `yaml` npm dep)*
2. **`headlamp-plugin-logs`** — Logs Tab *(K8s API only — easiest to extract)*
3. **`headlamp-plugin-scaling`** — Scaling Tab core (HPA CRUD, manual scaling) *(K8s API only)*
4. **`headlamp-plugin-metrics`** — Metrics Tab, Scaling Charts *(K8s API + Prometheus, `recharts` npm dep)*
5. **`headlamp-plugin-github-pipelines`** — GitHub Auth, Pipeline Wizard, Pipeline Card, Deploy Tab pipeline integration *(GitHub API + K8s API, `@octokit/rest` + `libsodium-wrappers` npm deps)*
6. **`headlamp-plugin-azure-core`** — Azure Auth, Cluster Registration, Azure theme/branding *(Azure CLI / Azure SDK)*
7. **`headlamp-plugin-azure-namespaces`** — Create/Import/Delete AKS Projects, Access Tab, Info Tab, Cluster Capabilities *(Azure CLI / Azure SDK + K8s API)*
8. **`headlamp-plugin-azure-identity`** — Workload Identity setup, ACR management, Federated Credentials *(Azure CLI / Azure SDK)*

### Extraction Priority (Easiest First)

1. **Logs Tab** — zero cross-feature imports, no external deps, self-contained
2. **Metrics Tab** — self-contained, external dep is `recharts` + Prometheus (well-bounded)
3. **Access Tab / Info Tab / Delete AKS Project** — self-contained Azure features, minimal coupling
4. **Scaling Tab** — minor coupling via `DeploymentSelector` shared component
5. **Deploy Wizard** — moderate coupling (Breadcrumb, ConfigureContainer shared with GitHubPipeline)
6. **GitHub Pipeline Wizard** — most complex (57 files, imports from DeployWizard, custom events, multi-dependency)
