# AKS desktop

AKS desktop delivers an application focused experience for deploying and managing workloads on Azure Kubernetes Service.

Built on top of open-source [Headlamp](https://headlamp.dev), AKS desktop provides a guided, self-service UX built on supported AKS features and best practices. Designed to work within your existing environment and tools, it enables team collaboration through RBAC while abstracting complexity without removing control.

To learn how to get started with AKS desktop, create projects, deploy applications, and explore the full set of features, check out the [official AKS desktop documentation](https://aka.ms/aks/aks-desktop).

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/11652/badge)](https://www.bestpractices.dev/projects/11652)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Azure/aks-desktop/badge)](https://scorecard.dev/viewer/?uri=github.com/Azure/aks-desktop)

## Installation

Please download the latest release for your platform from the [Releases](https://github.com/Azure/aks-desktop/releases/latest) page.

## Development

### Quick start

```bash
git clone --recurse-submodules https://github.com/Azure/aks-desktop.git
cd aks-desktop
npm run setup
npm start
```

> After some time everything will be downloaded and built, and you should see AKS desktop start in development mode.

### Step-by-step

> The quickstart should be enough, but if you want to know the details of each step, read on.

1. Clone the repository:

   ```bash
   git clone --recurse-submodules https://github.com/Azure/aks-desktop.git
   ```

2. Navigate to the project directory:

   ```bash
   cd aks-desktop
   ```

3. Install all dependencies, build the backend, and start the application:

   ```bash
   npm run setup
   npm start
   ```

   > **Tip (slow connections):** If you already have the Azure CLI installed, set
   > `USE_SYSTEM_AZ=1` before building to skip the bundled-az download:
   >
   > Bash (macOS/Linux/WSL/Git Bash):
   >
   > ```bash
   > USE_SYSTEM_AZ=1 npm run build
   > ```
   >
   > Windows CMD:
   >
   > ```cmd
   > set USE_SYSTEM_AZ=1 && npm run build
   > ```
   >
   > PowerShell:
   >
   > ```powershell
   > $env:USE_SYSTEM_AZ=1; npm run build
   > ```

## How to Build

1. Clone the repository:

   ```bash
   git clone --recurse-submodules https://github.com/Azure/aks-desktop.git
   ```

2. Navigate to the project directory:

   ```bash
   cd aks-desktop
   ```

3. Install all dependencies:

   ```bash
   npm run setup
   ```

4. Build the project:

   ```bash
   npm run build
   ```

## Documentation

- [Cluster Requirements](docs/cluster-requirements.md) — What your AKS cluster needs for the best AKS desktop experience
- [AKS Desktop Documentation](https://aka.ms/aks/aks-desktop)
- [AKS Managed Namespaces](https://learn.microsoft.com/en-us/azure/aks/manage-namespaces)

## Contributing

Check out the [CONTRIBUTING.md](CONTRIBUTING.md) file. More
details on how to contribute will come soon.

## Support

See [SUPPORT.md](SUPPORT.md) for information on how to get help with this project.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must [follow Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
