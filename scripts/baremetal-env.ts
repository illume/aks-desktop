#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * CLI script for setting up an AKS BareMetal test environment.
 *
 * Uses the same setup/teardown logic as the AKS Desktop UI.
 *
 * Usage:
 *   npx tsx scripts/baremetal-env.ts setup   --subscription <id> --location <region> --username <user> --password <pass> [options]
 *   npx tsx scripts/baremetal-env.ts teardown --subscription <id> [--group-name <name>]
 *
 * Options:
 *   --subscription   Azure subscription ID (required)
 *   --location       Azure region, e.g. eastus (required for setup)
 *   --username       VM admin username (required for setup)
 *   --password       VM admin password (required for setup)
 *   --group-name     Resource group name (default: jumpstart-rg)
 *   --vm-name        VM name (default: jumpstartVM)
 */

import { execSync } from 'child_process';

// ---- Defaults (mirrored from baremetal-environment.ts) ----

const BAREMETAL_ENV_DEFAULTS = {
  groupName: 'jumpstart-rg',
  vmName: 'jumpstartVM',
  vnetName: 'jumpstartVNet',
  subnetName: 'jumpstartSubnet',
};

const REQUIRED_PROVIDERS = [
  'Microsoft.Kubernetes',
  'Microsoft.KubernetesConfiguration',
  'Microsoft.ExtendedLocation',
  'Microsoft.ResourceConnector',
  'Microsoft.AzureStackHCI',
  'Microsoft.HybridConnectivity',
  'Microsoft.HybridContainerService',
];

// ---- Helpers ----

/**
 * Executes a shell command synchronously and returns its stdout.
 *
 * Logs the command before execution. If the command fails, throws an
 * `Error` with the stderr output (or the original error message).
 *
 * @param cmd - The shell command string to execute.
 * @returns The stdout output of the command.
 * @throws {Error} If the command exits with a non-zero status.
 */
function run(cmd: string): string {
  console.log(`  $ ${cmd}`);
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    throw new Error(stderr);
  }
}

/**
 * Parses CLI arguments into a key-value map.
 *
 * Expects `--key value` pairs. Flags without a following value
 * (or followed by another flag) are ignored.
 *
 * @param argv - The argument array (typically `process.argv.slice(2)`).
 * @returns A record mapping argument names (without `--` prefix) to their values.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[argv[i].replace(/^--/, '')] = argv[i + 1];
      i++;
    }
  }
  return args;
}

/**
 * Returns the value for a required CLI argument, or exits the process with
 * an error message if the argument is missing.
 *
 * @param args - The parsed argument map from {@link parseArgs}.
 * @param key - The argument name to look up (without `--` prefix).
 * @returns The argument value.
 */
function required(args: Record<string, string>, key: string): string {
  if (!args[key]) {
    console.error(`Error: --${key} is required.`);
    process.exit(1);
  }
  return args[key];
}

// ---- Commands ----

/**
 * Provisions an AKS BareMetal test environment in Azure.
 *
 * Performs the following steps:
 * 1. Registers required Azure resource providers.
 * 2. Creates a resource group.
 * 3. Creates a Windows Server 2022 VM with nested virtualisation support.
 * 4. Assigns a managed identity with Contributor role to the VM.
 * 5. Installs Hyper-V on the VM via `az vm run-command` (no RDP required).
 *
 * @param args - Parsed CLI arguments. Required: `subscription`, `location`,
 *   `username`, `password`. Optional: `group-name`, `vm-name`, `vnet-name`,
 *   `subnet-name`.
 */
function setup(args: Record<string, string>) {
  const subscription = required(args, 'subscription');
  const location = required(args, 'location');
  const username = required(args, 'username');
  const password = required(args, 'password');
  const groupName = args['group-name'] || BAREMETAL_ENV_DEFAULTS.groupName;
  const vmName = args['vm-name'] || BAREMETAL_ENV_DEFAULTS.vmName;
  const vnetName = args['vnet-name'] || BAREMETAL_ENV_DEFAULTS.vnetName;
  const subnetName = args['subnet-name'] || BAREMETAL_ENV_DEFAULTS.subnetName;

  console.log('\n=== AKS BareMetal Test Environment Setup ===\n');

  // Step 1: Register providers
  console.log('Step 1/5: Registering resource providers...');
  for (const provider of REQUIRED_PROVIDERS) {
    console.log(`  Registering ${provider}...`);
    run(`az provider register --namespace ${provider} --wait --subscription ${subscription}`);
  }
  console.log('  ✓ All providers registered.\n');

  // Step 2: Create resource group
  console.log('Step 2/5: Creating resource group...');
  run(
    `az group create --name ${groupName} --location ${location} --subscription ${subscription}`
  );
  console.log(`  ✓ Resource group '${groupName}' created.\n`);

  // Step 3: Create VM
  console.log('Step 3/5: Creating VM...');
  run(
    [
      'az vm create',
      `--resource-group ${groupName}`,
      `--name ${vmName}`,
      '--image MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest',
      '--size Standard_E16s_v4',
      `--admin-username ${username}`,
      `--admin-password "${password}"`,
      `--vnet-name ${vnetName}`,
      `--subnet ${subnetName}`,
      '--public-ip-sku Standard',
      `--subscription ${subscription}`,
      '--output json',
    ].join(' ')
  );
  console.log(`  ✓ VM '${vmName}' created.\n`);

  // Step 4: Assign managed identity + Contributor role
  console.log('Step 4/5: Assigning managed identity...');
  run(`az vm identity assign --resource-group ${groupName} --name ${vmName}`);

  const principalId = run(
    `az vm show --resource-group ${groupName} --name ${vmName} --query identity.principalId -o tsv`
  ).trim();

  if (principalId) {
    run(
      `az role assignment create --assignee ${principalId} --role Contributor --scope /subscriptions/${subscription}`
    );
  }
  console.log('  ✓ Managed identity assigned with Contributor role.\n');

  // Step 5: Install Hyper-V on the VM (no RDP required)
  console.log('Step 5/5: Installing Hyper-V on VM (via run-command)...');
  try {
    run(
      [
        'az vm run-command invoke',
        `--resource-group ${groupName}`,
        `--name ${vmName}`,
        '--command-id RunPowerShellScript',
        '--scripts "Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart"',
      ].join(' ')
    );
    console.log('  ✓ Hyper-V installation initiated.\n');
  } catch {
    console.log('  ⚠ Hyper-V install may require a VM restart (this is normal).\n');
  }

  console.log('=== Setup Complete ===');
  console.log(`Resource group: ${groupName}`);
  console.log(`VM: ${vmName}`);
  console.log('');
  console.log('Next step:');
  console.log(
    'Deploy AKS Arc components using the aksArc jumpstart scripts:'
  );
  console.log(
    'https://github.com/Azure/aksArc/tree/main/aksarc_jumpstart'
  );
}

/**
 * Tears down an AKS BareMetal test environment by deleting its resource group.
 *
 * The deletion runs asynchronously (`--no-wait`) so this function returns
 * quickly while Azure removes the resources in the background.
 *
 * @param args - Parsed CLI arguments. Required: `subscription`.
 *   Optional: `group-name` (defaults to `jumpstart-rg`).
 */
function teardown(args: Record<string, string>) {
  const subscription = required(args, 'subscription');
  const groupName = args['group-name'] || BAREMETAL_ENV_DEFAULTS.groupName;

  console.log('\n=== AKS BareMetal Test Environment Teardown ===\n');
  console.log(`Deleting resource group '${groupName}'...`);
  run(
    `az group delete --name ${groupName} --subscription ${subscription} --yes --no-wait`
  );
  console.log(`  ✓ Resource group '${groupName}' deletion initiated.`);
  console.log('  This may take several minutes to complete.\n');
}

// ---- Main ----

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

switch (command) {
  case 'setup':
    setup(args);
    break;
  case 'teardown':
    teardown(args);
    break;
  default:
    console.log('Usage:');
    console.log(
      '  npx tsx scripts/baremetal-env.ts setup   --subscription <id> --location <region> --username <user> --password <pass>'
    );
    console.log(
      '  npx tsx scripts/baremetal-env.ts teardown --subscription <id> [--group-name <name>]'
    );
    process.exit(command ? 1 : 0);
}
