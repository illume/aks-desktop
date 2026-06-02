# BareMetal Storybook Screenshots

Use this markdown block in the PR description:

## Screenshots/Videos

### Azure Account and BareMetal proxy entry points (Storybook)

#### Azure Account settings screen
![Azure Account settings screen](https://github.com/user-attachments/assets/a00a592c-daea-4403-9735-ad36b3b80808)

#### BareMetal proxy controls route (running)
![Bare Metal Proxy Running](docs/images/storybook/baremetal-proxy-running.png)

#### BareMetal proxy recovery action shown (dropped)
![Bare Metal Proxy Dropped](docs/images/storybook/baremetal-proxy-dropped.png)

#### Register AKS Cluster overview cluster-action menu (BareMetal)
![Register AKS Cluster - BareMetal Cluster Actions](docs/images/storybook/register-aks-cluster-baremetal-cluster-actions.png)
![Register AKS Cluster - BareMetal Cluster Actions (alternate)](https://github.com/user-attachments/assets/2997f43b-fed6-480e-bff6-ef33e604f1f4)

### BareMetal proxy settings page (Storybook)

> Stories: `BareMetal/ProxySettingsPage` — Default, LoadingSubscriptions, LoadingClusters, NoClustersFound, ClusterSelected, ProxyRunning, ProxyError, ProxyActionLoading, ProxyDropped, WithError, WithProxyUiError, NoSubscription

#### Proxy Settings Page — Default
![Proxy Settings Page Default](docs/images/storybook/baremetal-proxy-settings-default.png)

#### Proxy Settings Page — Cluster selected, proxy running
![Proxy Settings Page Running](docs/images/storybook/baremetal-proxy-settings-running.png)

#### Proxy Settings Page — Proxy error
![Proxy Settings Page Error](docs/images/storybook/baremetal-proxy-settings-error.png)

#### Proxy Settings Page — Proxy dropped
![Proxy Settings Page Dropped](docs/images/storybook/baremetal-proxy-settings-dropped.png)

### BareMetal proxy panel (Storybook)

> Stories: `BareMetal/ProxyPanel` — Unknown, Stopped, Running, ErrorState, ActionLoading, Disabled

#### Bare Metal Proxy Stopped
![Bare Metal Proxy Stopped](docs/images/storybook/baremetal-proxy-stopped.png)

#### Bare Metal Proxy Running
![Bare Metal Proxy Running](docs/images/storybook/baremetal-proxy-running.png)

#### Bare Metal Proxy Error
![Bare Metal Proxy Error](docs/images/storybook/baremetal-proxy-error.png)

#### Bare Metal Proxy Action Loading
![Bare Metal Proxy Action Loading](docs/images/storybook/baremetal-proxy-action-loading.png)

#### Bare Metal Proxy Dropped
![Bare Metal Proxy Dropped](docs/images/storybook/baremetal-proxy-dropped.png)

### BareMetal cluster action menu (Storybook)

> Stories: `BareMetal/ClusterActions` — Default, AlternateCluster

The cluster overview action menu shows proxy actions for each `aksarc` (BareMetal) cluster:
Start Proxy, Stop Proxy, Restart Proxy, and BareMetal Proxy Settings.

#### Cluster action menu — Default
![Cluster Actions Default](docs/images/storybook/baremetal-cluster-actions-default.png)

### BareMetal environment dialog (Storybook)

> Stories: `BareMetal/EnvironmentDialog` — Default, NotLoggedIn, CheckingAuth, FilledForm, SetupLoading, TeardownLoading, WithError, WithSuccess, ExtensionsRequired, ExtensionsInstalling, ExtensionsInstalled, ExtensionError

#### Environment Dialog — Default
![Environment Dialog Default](docs/images/storybook/baremetal-env-dialog-default.png)

### Register AKS Cluster dialog (Storybook)

> Stories: `AKS/RegisterAKSClusterDialogPure` — Default, NotLoggedIn, CheckingAuth, LoadingSubscriptions, LoadingClusters, NoClusters, WithClusters, ClusterSelected, BareMetalProxyStopped, BareMetalProxyRunning, BareMetalProxyError, BareMetalProxyActionLoading, BareMetalProxyDropped, Registering, Success, Error, CheckingCapabilities, AllCapabilitiesEnabled, RbacNotEnabled, NoNetworkPolicy

#### Register AKS Cluster - Default
![Register AKS Cluster - Default](docs/images/storybook/register-aks-cluster-default.png)

#### Register AKS Cluster - Alternate capture
![Register AKS Cluster - Alternate capture](https://github.com/user-attachments/assets/fddcdc44-3251-4457-8112-0e4d9aeec330)

#### Register AKS Cluster - Alternate capture 2
![Register AKS Cluster - Alternate capture 2](https://github.com/user-attachments/assets/f4afb871-bd8c-44dc-adfc-154ac9752862)

#### Register AKS Cluster - Alternate capture 3
![Register AKS Cluster - Alternate capture 3](https://github.com/user-attachments/assets/349285b4-db9c-496b-b0fe-c6f402e612ff)
