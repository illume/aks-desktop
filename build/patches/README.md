# Headlamp Submodule Patches

Patches in this directory must be applied to the `headlamp/` submodule before building.

## Applying patches

```bash
# Initialize the submodule if not already done
git submodule update --init headlamp

# Apply all patches
cd headlamp
git apply ../build/patches/*.patch
```

## Current patches

| Patch | Description |
| --- | --- |
| `headlamp-aksarc-support.patch` | Adds AKS Arc/Edge cluster support: `az aksarc get-credentials`, `clusterType` IPC parameter, `az connectedk8s` command allowlisting |
