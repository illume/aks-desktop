// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Arc test environment setup and teardown utilities.
 *
 * Wraps the aksArc jumpstart scripts to provision and destroy
 * Azure VM-based AKS Arc environments for development and testing.
 *
 * @see https://github.com/Azure/aksArc/tree/main/aksarc_jumpstart
 */

import { debugLog, getErrorMessage, runCommandAsync } from '../../utils/azure/az-cli-core';

/** Parameters for provisioning an Arc test environment. */
export interface ArcEnvironmentConfig {
  /** Azure subscription GUID. */
  subscription: string;
  /** Resource group name (default: `'jumpstart-rg'`). */
  groupName?: string;
  /** Azure region (e.g. `'eastus'`). */
  location: string;
  /** VM admin username. */
  username: string;
  /** VM admin password. */
  password: string;
  /** Virtual network name (default: `'jumpstartVNet'`). */
  vnetName?: string;
  /** Virtual machine name (default: `'jumpstartVM'`). */
  vmName?: string;
  /** Subnet name (default: `'jumpstartSubnet'`). */
  subnetName?: string;
}

/** Default values for optional Arc environment parameters. */
export const ARC_ENV_DEFAULTS = {
  groupName: 'jumpstart-rg',
  vnetName: 'jumpstartVNet',
  vmName: 'jumpstartVM',
  subnetName: 'jumpstartSubnet',
} as const;

/** Result from an Arc environment setup or teardown operation. */
export interface ArcEnvironmentResult {
  /** Whether the operation succeeded. */
  success: boolean;
  /** Human-readable status or error message. */
  message: string;
}

/**
 * Required Azure resource providers for AKS Arc environments.
 * These must be registered before setup.
 */
const REQUIRED_PROVIDERS = [
  'Microsoft.Kubernetes',
  'Microsoft.KubernetesConfiguration',
  'Microsoft.ExtendedLocation',
  'Microsoft.ResourceConnector',
  'Microsoft.AzureStackHCI',
  'Microsoft.HybridConnectivity',
  'Microsoft.HybridContainerService',
] as const;

/**
 * Registers the Azure resource providers required for AKS Arc.
 *
 * @returns A result indicating success or the first registration failure.
 */
export async function registerArcProviders(): Promise<ArcEnvironmentResult> {
  for (const provider of REQUIRED_PROVIDERS) {
    debugLog(`[ARC-ENV] Registering provider: ${provider}`);
    const { stderr } = await runCommandAsync('az', [
      'provider',
      'register',
      '--namespace',
      provider,
      '--wait',
    ]);

    if (stderr && stderr.includes('ERROR:')) {
      return {
        success: false,
        message: `Failed to register provider ${provider}: ${stderr}`,
      };
    }
  }

  return { success: true, message: 'All required providers registered successfully.' };
}

/**
 * Creates the Azure resource group for the Arc test environment.
 *
 * @param config - Environment configuration.
 * @returns A result indicating success or failure.
 */
export async function createResourceGroup(
  config: ArcEnvironmentConfig
): Promise<ArcEnvironmentResult> {
  const groupName = config.groupName || ARC_ENV_DEFAULTS.groupName;

  debugLog(`[ARC-ENV] Creating resource group: ${groupName} in ${config.location}`);
  const { stderr } = await runCommandAsync('az', [
    'group',
    'create',
    '--name',
    groupName,
    '--location',
    config.location,
    '--subscription',
    config.subscription,
  ]);

  if (stderr && stderr.includes('ERROR:')) {
    return {
      success: false,
      message: `Failed to create resource group: ${stderr}`,
    };
  }

  return { success: true, message: `Resource group '${groupName}' created.` };
}

/**
 * Sets up an AKS Arc test environment.
 *
 * This is a high-level orchestration function that:
 * 1. Registers required Azure resource providers.
 * 2. Creates the resource group.
 * 3. Provisions the VM with nested virtualisation.
 * 4. Assigns a managed identity with Contributor role to the VM.
 * 5. Runs initialisation scripts on the VM via `az vm run-command`.
 *
 * The VM uses a Standard_E16s_v4 SKU (16 vCPUs, 128 GiB) with
 * nested Hyper-V support. All post-creation steps are automated
 * through `az vm run-command invoke` — no RDP is required.
 *
 * @param config - Environment configuration.
 * @returns A result with success/failure and a status message.
 */
export async function setupArcEnvironment(
  config: ArcEnvironmentConfig
): Promise<ArcEnvironmentResult> {
  const groupName = config.groupName || ARC_ENV_DEFAULTS.groupName;
  const vmName = config.vmName || ARC_ENV_DEFAULTS.vmName;
  const vnetName = config.vnetName || ARC_ENV_DEFAULTS.vnetName;
  const subnetName = config.subnetName || ARC_ENV_DEFAULTS.subnetName;

  try {
    // Step 1: Register providers
    debugLog('[ARC-ENV] Step 1/5: Registering resource providers...');
    const providerResult = await registerArcProviders();
    if (!providerResult.success) {
      return providerResult;
    }

    // Step 2: Create resource group
    debugLog('[ARC-ENV] Step 2/5: Creating resource group...');
    const rgResult = await createResourceGroup(config);
    if (!rgResult.success) {
      return rgResult;
    }

    // Step 3: Create VM
    debugLog('[ARC-ENV] Step 3/5: Creating VM...');
    const vmResult = await runCommandAsync('az', [
      'vm',
      'create',
      '--resource-group',
      groupName,
      '--name',
      vmName,
      '--image',
      'MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest',
      '--size',
      'Standard_E16s_v4',
      '--admin-username',
      config.username,
      '--admin-password',
      config.password,
      '--vnet-name',
      vnetName,
      '--subnet',
      subnetName,
      '--public-ip-sku',
      'Standard',
      '--subscription',
      config.subscription,
      '--output',
      'json',
    ]);

    if (vmResult.stderr && vmResult.stderr.includes('ERROR:')) {
      return {
        success: false,
        message: `Failed to create VM: ${vmResult.stderr}`,
      };
    }

    debugLog('[ARC-ENV] VM created:', vmResult.stdout);

    // Step 4: Assign managed identity + Contributor role
    debugLog('[ARC-ENV] Step 4/5: Assigning managed identity...');
    const identityResult = await runCommandAsync('az', [
      'vm',
      'identity',
      'assign',
      '--resource-group',
      groupName,
      '--name',
      vmName,
    ]);

    if (identityResult.stderr && identityResult.stderr.includes('ERROR:')) {
      return {
        success: false,
        message: `Failed to assign managed identity: ${identityResult.stderr}`,
      };
    }

    // Get the principal ID and assign Contributor role
    const showResult = await runCommandAsync('az', [
      'vm',
      'show',
      '--resource-group',
      groupName,
      '--name',
      vmName,
      '--query',
      'identity.principalId',
      '-o',
      'tsv',
    ]);

    const principalId = showResult.stdout.trim();
    if (principalId) {
      await runCommandAsync('az', [
        'role',
        'assignment',
        'create',
        '--assignee',
        principalId,
        '--role',
        'Contributor',
        '--scope',
        `/subscriptions/${config.subscription}`,
      ]);
    }

    // Step 5: Run initialisation via VM run-command (no RDP required)
    debugLog('[ARC-ENV] Step 5/5: Running initialisation scripts on VM...');
    const initResult = await runCommandAsync('az', [
      'vm',
      'run-command',
      'invoke',
      '--resource-group',
      groupName,
      '--name',
      vmName,
      '--command-id',
      'RunPowerShellScript',
      '--scripts',
      'Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart',
    ]);

    if (initResult.stderr && initResult.stderr.includes('ERROR:')) {
      debugLog('[ARC-ENV] Hyper-V install warning (may require restart):', initResult.stderr);
    }

    return {
      success: true,
      message:
        `Arc test environment created successfully.\n` +
        `Resource group: ${groupName}\n` +
        `VM: ${vmName}\n\n` +
        `The VM has been provisioned with a managed identity and Contributor role.\n` +
        `Hyper-V installation has been initiated on the VM.\n\n` +
        `Next step: deploy AKS Arc components using the aksArc jumpstart scripts:\n` +
        `https://github.com/Azure/aksArc/tree/main/aksarc_jumpstart`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Setup failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Tears down an AKS Arc test environment by deleting the resource group
 * and all resources within it.
 *
 * @param subscription - Azure subscription GUID.
 * @param groupName - Resource group to delete (default: `'jumpstart-rg'`).
 * @returns A result with success/failure and a status message.
 */
export async function teardownArcEnvironment(
  subscription: string,
  groupName: string = ARC_ENV_DEFAULTS.groupName
): Promise<ArcEnvironmentResult> {
  try {
    debugLog(`[ARC-ENV] Tearing down resource group: ${groupName}`);
    const { stderr } = await runCommandAsync('az', [
      'group',
      'delete',
      '--name',
      groupName,
      '--subscription',
      subscription,
      '--yes',
      '--no-wait',
    ]);

    if (stderr && stderr.includes('ERROR:')) {
      return {
        success: false,
        message: `Failed to delete resource group: ${stderr}`,
      };
    }

    return {
      success: true,
      message:
        `Resource group '${groupName}' deletion initiated. ` +
        `This may take several minutes to complete.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Teardown failed: ${getErrorMessage(error)}`,
    };
  }
}
