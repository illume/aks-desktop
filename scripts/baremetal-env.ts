#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * CLI script for setting up an AKS BareMetal test environment.
 *
 * Uses the same setup/teardown logic as the AKS Desktop UI.
 *
 * Usage:
 *   npx tsx scripts/baremetal-env.ts setup        --subscription <id> --username <user> --password <pass> --group-name rg-yourname-testing [options]
 *   npx tsx scripts/baremetal-env.ts teardown     --subscription <id> --group-name rg-yourname-testing
 *   npx tsx scripts/baremetal-env.ts deployaksarc --subscription <id> --group-name rg-yourname-testing [options]
 *
 * Options:
 *   --subscription      Azure subscription ID (required)
 *   --location          Azure region (default: westus3)
 *   --username          VM admin username (required for setup)
 *   --password          VM admin password (required for setup)
 *   --group-name        Resource group name (default: jumpstart-rg)
 *   --vm-name           VM name (default: jumpstartVM)
 *   --vm-size           VM size (default: Standard_E16s_v5)
 *   --vnet-name         Virtual network name (default: jumpstartVNet)
 *   --subnet-name       Subnet name (default: jumpstartSubnet)
 *   --appliance-name    Appliance name (default: <vmName>-appliance)
 *   --custom-location   Custom location name (default: <applianceName>-cl)
 *   --lnet-name         Logical network name (default: <applianceName>-lnet)
 *   --aks-cluster       AKS Arc cluster name (default: <vmName>-aksarc)
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---- Defaults (mirrored from components/BareMetal/environment.ts) ----

const BAREMETAL_ENV_DEFAULTS = {
  groupName: 'jumpstart-rg',
  location: 'westus3',
  vmName: 'jumpstartVM',
  vmSize: 'Standard_E16s_v5',
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

/** CLI flags whose following value is sensitive and must not appear in logs. */
const SENSITIVE_FLAGS = new Set(['--admin-password', '--password']);

/**
 * Executes a command synchronously (without a shell) and returns its stdout.
 *
 * Logs the command before execution, redacting values that follow any flag
 * listed in {@link SENSITIVE_FLAGS}. Using an args array instead of a shell
 * string prevents shell injection and avoids shell-quoting pitfalls.
 *
 * @param args - The command and its arguments as an array, e.g.
 *   `['az', 'group', 'create', '--name', 'my-rg']`.
 * @returns The stdout output of the command.
 * @throws {Error} If the command exits with a non-zero status.
 */
function run(args: string[]): string {
  const [cmd, ...cmdArgs] = args;
  const redacted = cmdArgs.map((arg, i) =>
    i > 0 && SENSITIVE_FLAGS.has(cmdArgs[i - 1]) ? '***' : arg
  );
  console.log(`  $ ${cmd} ${redacted.join(' ')}`);

  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command exited with status ${result.status}`);
  }
  return result.stdout || '';
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

/** Returns true if Microsoft Remote Desktop is installed (Mac App Store or Homebrew). */
function isMicrosoftRdpInstalled(): boolean {
  return (
    fs.existsSync('/Applications/Microsoft Remote Desktop.app') ||
    fs.existsSync(`${os.homedir()}/Applications/Microsoft Remote Desktop.app`)
  );
}

// ---- aksArc jumpstart URLs ----

/**
 * GitHub raw URLs for aksArc jumpstart assets.
 */
const AKSARC_JUMPSTART_BASE =
  'https://raw.githubusercontent.com/Azure/aksArc/refs/heads/main/aksarc_jumpstart';
const AKSARC_TEMPLATE_URL = `${AKSARC_JUMPSTART_BASE}/configuration/executescript-template.json`;
const AKSARC_SCRIPTS_URL = `${AKSARC_JUMPSTART_BASE}/scripts`;

/** Timeout in seconds for MOC installation via `az vm run-command invoke`. */
const MOC_INSTALL_TIMEOUT_SECONDS = '3600';

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
 * 6. Installs MOC on the VM via `az vm run-command` (no RDP required).
 *
 * @param args - Parsed CLI arguments. Required: `subscription`, `username`,
 *   `password`. Optional: `location`, `group-name`, `vm-name`, `vm-size`,
 *   `vnet-name`, `subnet-name`.
 */
function setup(args: Record<string, string>) {
  const subscription = required(args, 'subscription');
  const location = args['location'] || BAREMETAL_ENV_DEFAULTS.location;
  const username = required(args, 'username');
  const password = required(args, 'password');
  const groupName = args['group-name'] || BAREMETAL_ENV_DEFAULTS.groupName;
  const vmName = args['vm-name'] || BAREMETAL_ENV_DEFAULTS.vmName;
  const vmSize = args['vm-size'] || BAREMETAL_ENV_DEFAULTS.vmSize;
  const vnetName = args['vnet-name'] || BAREMETAL_ENV_DEFAULTS.vnetName;
  const subnetName = args['subnet-name'] || BAREMETAL_ENV_DEFAULTS.subnetName;

  console.log('\n=== AKS BareMetal Test Environment Setup ===\n');

  // Step 1: Register providers
  console.log('Step 1/6: Registering resource providers...');
  for (const provider of REQUIRED_PROVIDERS) {
    console.log(`  Registering ${provider}...`);
    run(['az', 'provider', 'register', '--namespace', provider, '--wait', '--subscription', subscription]);
  }
  console.log('  ✓ All providers registered.\n');

  // Step 2: Create resource group
  console.log('Step 2/6: Creating resource group...');
  run(['az', 'group', 'create', '--name', groupName, '--location', location, '--subscription', subscription]);
  console.log(`  ✓ Resource group '${groupName}' created.\n`);

  // Step 3: Create VM
  console.log('Step 3/6: Creating VM...');
  run([
    'az', 'vm', 'create',
    '--resource-group', groupName,
    '--name', vmName,
    '--image', 'MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest',
    '--size', vmSize,
    '--admin-username', username,
    '--admin-password', password,
    '--vnet-name', vnetName,
    '--subnet', subnetName,
    '--public-ip-sku', 'Standard',
    '--subscription', subscription,
    '--output', 'json',
  ]);

  let publicIp = '';
  try {
    publicIp = run([
      'az', 'vm', 'list-ip-addresses',
      '--resource-group', groupName,
      '--name', vmName,
      '--subscription', subscription,
      '--query', '[0].virtualMachine.network.publicIpAddresses[0].ipAddress',
      '-o', 'tsv',
    ]).trim();
  } catch {
    // non-fatal — IP will be shown as a lookup instruction
  }

  console.log(`  ✓ VM '${vmName}' created.\n`);

  // Step 4: Assign managed identity + Contributor role
  console.log('Step 4/6: Assigning managed identity...');
  run(['az', 'vm', 'identity', 'assign', '--resource-group', groupName, '--name', vmName, '--subscription', subscription]);

  const principalId = run([
    'az', 'vm', 'show',
    '--resource-group', groupName,
    '--name', vmName,
    '--query', 'identity.principalId',
    '-o', 'tsv',
    '--subscription', subscription,
  ]).trim();

  if (principalId) {
    run([
      'az', 'role', 'assignment', 'create',
      '--assignee-object-id', principalId,
      '--assignee-principal-type', 'ServicePrincipal',
      '--role', 'Contributor',
      '--scope', `/subscriptions/${subscription}/resourceGroups/${groupName}`,
    ]);
  }
  console.log('  ✓ Managed identity assigned with Contributor role.\n');

  // Step 5: Install Hyper-V on the VM (no RDP required)
  console.log('Step 5/6: Installing Hyper-V on VM (via run-command)...');
  try {
    run([
      'az', 'vm', 'run-command', 'invoke',
      '--resource-group', groupName,
      '--name', vmName,
      '--command-id', 'RunPowerShellScript',
      '--scripts', 'Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart',
      '--subscription', subscription,
    ]);
    console.log('  ✓ Hyper-V installation initiated (VM will restart).\n');
  } catch {
    console.log('  ⚠ Hyper-V install may require a VM restart (this is normal).\n');
  }

  // Wait for the VM to come back after Hyper-V restart
  console.log('  Waiting for VM to restart after Hyper-V installation...');
  try {
    run([
      'az', 'vm', 'wait',
      '--resource-group', groupName,
      '--name', vmName,
      '--custom', '"instanceView.statuses[?code==\'PowerState/running\']"',
      '--interval', '15',
      '--timeout', '600',
      '--subscription', subscription,
    ]);
    console.log('  ✓ VM is running.\n');
  } catch {
    console.log('  ⚠ Could not confirm VM restart. Proceeding anyway.\n');
  }

  // Step 6: Install MOC on the VM (no RDP required)
  console.log('Step 6/6: Installing MOC on VM (via run-command)...');
  const mocInstallScript = [
    // Download and run the MOC installer from the aksArc jumpstart repo
    '$ErrorActionPreference = "Stop"',
    '$ProgressPreference = "SilentlyContinue"',
    'Write-Host "Downloading MOC installer..."',
    `Invoke-WebRequest -Uri '${AKSARC_SCRIPTS_URL}/deploymoc.ps1' -OutFile 'C:\\deploymoc.ps1'`,
    'Write-Host "Running MOC installer..."',
    `& C:\\deploymoc.ps1 -resource_group '${groupName}' -location '${location}' -subscription '${subscription}'`,
    'Write-Host "MOC installation complete."',
  ].join('; ');
  try {
    run([
      'az', 'vm', 'run-command', 'invoke',
      '--resource-group', groupName,
      '--name', vmName,
      '--command-id', 'RunPowerShellScript',
      '--scripts', mocInstallScript,
      '--subscription', subscription,
      '--timeout', MOC_INSTALL_TIMEOUT_SECONDS,
    ]);
    console.log('  ✓ MOC installation complete.\n');
  } catch (err) {
    console.error('  ✗ MOC installation failed.');
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('  You may need to install MOC manually via RDP.');
    console.error('  After installing MOC, run: npx tsx scripts/baremetal-env.ts deployaksarc ...\n');
  }

  console.log('=== Setup Complete ===');
  console.log(`Resource group: ${groupName}`);
  console.log(`VM: ${vmName}`);
  if (publicIp) {
    console.log(`VM public IP: ${publicIp}`);
  }
  console.log('');
  console.log('Next step — RDP into the VM (macOS):');
  console.log('');
  if (publicIp) {
    console.log(`  VM address: ${publicIp}`);
  } else {
    const ipCmd = `az vm list-ip-addresses -g ${groupName} -n ${vmName} --subscription ${subscription} -o tsv --query '[0].virtualMachine.network.publicIpAddresses[0].ipAddress'`;
    console.log(`  Get VM IP:  ${ipCmd}`);
  }
  console.log(`  Username:   ${username}`);
  console.log('  Password:   (the --password you supplied)');
  console.log('');
  const rdpInstalled = isMicrosoftRdpInstalled();
  if (!rdpInstalled) {
    console.log('  Microsoft Remote Desktop is required on macOS:');
    console.log('    brew install --cask microsoft-remote-desktop');
    console.log('    or install from the Mac App Store (search "Microsoft Remote Desktop")');
    console.log('');
  }
  if (publicIp) {
    const rdpFile = path.join(os.tmpdir(), `${vmName}.rdp`);
    const rdpContent = [
      `full address:s:${publicIp}:3389`,
      `username:s:${username}`,
      'authentication level:i:2',
      'prompt for credentials:i:0',
    ].join('\n');
    fs.writeFileSync(rdpFile, rdpContent);
    console.log('  Connect:');
    console.log(`    open "${rdpFile}"`);
  } else {
    console.log('  Open Microsoft Remote Desktop, add a new PC using the IP above, and connect.');
  }
  console.log('');
  console.log('  Once Server Manager appears, the VM is ready. Disconnect from RDP.');
  console.log('  (MOC and all other components are installed by the deployaksarc command below, not inside the VM.)');
  console.log('');
  console.log('After MOC is ready, run:');
  console.log(`  npm run deployAksArc -- --subscription ${subscription} --group-name ${groupName}`);
}

/**
 * Prints macOS RDP instructions for the jumpstart VM.
 *
 * Looks up the VM's public IP from Azure and prints ready-to-use connection
 * options for Microsoft Remote Desktop.
 *
 * @param args - Parsed CLI arguments. Required: `subscription`, `username`.
 *   Optional: `group-name`, `vm-name`.
 */
function rdp(args: Record<string, string>) {
  const subscription = required(args, 'subscription');
  const username = required(args, 'username');
  const groupName = args['group-name'] || BAREMETAL_ENV_DEFAULTS.groupName;
  const vmName = args['vm-name'] || BAREMETAL_ENV_DEFAULTS.vmName;

  console.log('\n=== RDP Instructions ===\n');

  let publicIp = '';
  try {
    publicIp = run([
      'az', 'vm', 'list-ip-addresses',
      '--resource-group', groupName,
      '--name', vmName,
      '--subscription', subscription,
      '--query', '[0].virtualMachine.network.publicIpAddresses[0].ipAddress',
      '-o', 'tsv',
    ]).trim();
  } catch {
    // fall through — print lookup command instead
  }

  if (publicIp) {
    console.log(`VM address: ${publicIp}`);
  } else {
    console.log(
      `VM address: run: az vm list-ip-addresses -g ${groupName} -n ${vmName} --subscription ${subscription} -o tsv --query '[0].virtualMachine.network.publicIpAddresses[0].ipAddress'`
    );
  }
  console.log(`Username:   ${username}`);
  console.log('Password:   (the --password you supplied at setup)');
  console.log('');

  const rdpInstalled = isMicrosoftRdpInstalled();
  if (!rdpInstalled) {
    console.log('Step 1 — Install Microsoft Remote Desktop (required on macOS):');
    console.log('  brew install --cask microsoft-remote-desktop');
    console.log('  or install from the Mac App Store (search "Microsoft Remote Desktop")');
    console.log('');
    console.log('Step 2 — Connect:');
  } else {
    console.log('Connect:');
  }
  if (publicIp) {
    const rdpFile = path.join(os.tmpdir(), `${vmName}.rdp`);
    const rdpContent = [
      `full address:s:${publicIp}:3389`,
      `username:s:${username}`,
      'authentication level:i:2',
      'prompt for credentials:i:0',
    ].join('\n');
    fs.writeFileSync(rdpFile, rdpContent);
    console.log(`  open "${rdpFile}"`);
    spawnSync('open', [rdpFile], { stdio: 'inherit' });
    console.log('');
    console.log(`  Microsoft Remote Desktop will open. Look for "${vmName}" in the PCs list`);
    console.log('  and double-click it to connect. Enter your password when prompted.');
  } else {
    console.log('  Open Microsoft Remote Desktop, add a new PC with the IP above, then connect.');
  }
  console.log('');
  console.log('Once Server Manager appears, the VM is ready. Disconnect from RDP.');
  console.log('(MOC and all other components are installed by deployaksarc, not inside the VM.)');
  console.log('');
  console.log('After MOC is ready, run:');
  console.log(`  npm run deployAksArc -- --subscription ${subscription} --group-name ${groupName}`);
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
  run(['az', 'group', 'delete', '--name', groupName, '--subscription', subscription, '--yes', '--no-wait']);
  console.log(`  ✓ Resource group '${groupName}' deletion initiated.`);
  console.log('  This may take several minutes to complete.\n');
}

/**
 * Deploys AKS Arc components on a VM that already has MOC installed.
 *
 * Downloads the ARM execution template from the aksArc jumpstart repo and
 * runs the 7 deployment scripts sequentially via `az deployment group create`.
 *
 * MOC is normally pre-installed by the `setup` command (step 6). If that step
 * failed, MOC can be installed manually via RDP before running this command.
 *
 * @param args - Parsed CLI arguments. Required: `subscription`, `location`.
 *   Optional: `group-name`, `vm-name`, `appliance-name`, `custom-location`,
 *   `lnet-name`, `aks-cluster`.
 */
function deployAksArc(args: Record<string, string>) {
  const subscription = required(args, 'subscription');
  const location = args['location'] || BAREMETAL_ENV_DEFAULTS.location;
  const groupName = args['group-name'] || BAREMETAL_ENV_DEFAULTS.groupName;
  const vmName = args['vm-name'] || BAREMETAL_ENV_DEFAULTS.vmName;
  const applianceName = args['appliance-name'] || `${vmName}-appliance`;
  const customLocation = args['custom-location'] || `${applianceName}-cl`;
  const lnetName = args['lnet-name'] || `${applianceName}-lnet`;
  const aksCluster = args['aks-cluster'] || `${vmName}-aksarc`;

  console.log('\n=== AKS Arc Deployment ===\n');
  console.log('NOTE: MOC must be installed on the VM before running this command.');
  console.log('MOC is automatically installed during `setup` (step 6).');
  console.log('If that step failed, install MOC manually via RDP before proceeding.');
  console.log('');

  // Download the ARM execution template to a temp file
  const templatePath = path.join(os.tmpdir(), 'aksarc-exec-template.json');
  console.log('Downloading ARM execution template...');
  const curlResult = spawnSync(
    'curl',
    ['-fsSL', '-o', templatePath, AKSARC_TEMPLATE_URL],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  if (curlResult.status !== 0) {
    console.error(`Error: Failed to download ARM template from ${AKSARC_TEMPLATE_URL}`);
    console.error(curlResult.stderr || `curl exited with status ${curlResult.status}`);
    process.exit(1);
  }
  console.log(`  ✓ Template saved to ${templatePath}\n`);

  /**
   * Runs a PowerShell script on the VM via an ARM deployment.
   *
   * @param step - Step number for logging, e.g. `"1/7"`.
   * @param label - Human-readable step label.
   * @param scriptName - Filename under the aksArc jumpstart scripts directory.
   * @param scriptParams - PowerShell parameters to pass to the script.
   */
  function deployScript(
    step: string,
    label: string,
    scriptName: string,
    scriptParams: string
  ) {
    const scriptStem = scriptName.replace(/\.ps1$/, '');
    const deploymentName = `executescript-${vmName}-${scriptStem}`;
    const scriptUri = `${AKSARC_SCRIPTS_URL}/${scriptName}`;
    const commandToExecute = `powershell.exe -ExecutionPolicy Unrestricted -File ${scriptName} ${scriptParams}`;

    console.log(`Step ${step}: ${label}...`);
    run([
      'az', 'deployment', 'group', 'create',
      '--name', deploymentName,
      '--resource-group', groupName,
      '--template-file', templatePath,
      '--parameters',
      `location=${location}`,
      `vmName=${vmName}`,
      `scriptFileUri=${scriptUri}`,
      `commandToExecute=${commandToExecute}`,
      '--subscription', subscription,
    ]);
    console.log(`  ✓ ${label} complete.\n`);
  }

  // Step 1: Install Az modules
  deployScript(
    '1/7',
    'Installing Az modules',
    'installazmodules.ps1',
    '-arcHciVersion "1.3.15"'
  );

  // Step 2: Deploy appliance
  deployScript(
    '2/7',
    'Deploying appliance',
    'deployappliance.ps1',
    `-resource_group ${groupName} -appliance_name ${applianceName} -location ${location} -subscription ${subscription}`
  );

  // Step 3: Deploy AKS Arc extension
  deployScript(
    '3/7',
    'Deploying AKS Arc extension',
    'deployaksarcextension.ps1',
    `-resource_group ${groupName} -appliance_name ${applianceName} -location ${location} -subscription ${subscription}`
  );

  // Step 4: Deploy VMSS extension
  deployScript(
    '4/7',
    'Deploying VMSS extension',
    'deployvmssextension.ps1',
    `-resource_group ${groupName} -appliance_name ${applianceName} -location ${location} -subscription ${subscription}`
  );

  // Step 5: Deploy custom location
  deployScript(
    '5/7',
    'Deploying custom location',
    'deploycustomlocation.ps1',
    `-resource_group ${groupName} -appliance_name ${applianceName} -customLocationName ${customLocation} -subscription ${subscription}`
  );

  // Step 6: Deploy logical network
  deployScript(
    '6/7',
    'Deploying logical network',
    'deploylnet.ps1',
    `-resource_group ${groupName} -lnetName ${lnetName} -customLocationName ${customLocation} -location ${location} -subscription ${subscription}`
  );

  // Step 7: Deploy AKS Arc cluster
  deployScript(
    '7/7',
    'Deploying AKS Arc cluster',
    'deployaksarccluster.ps1',
    `-resource_group ${groupName} -aksArcClusterName ${aksCluster} -lnetName ${lnetName} -customLocationName ${customLocation} -subscription ${subscription}`
  );

  // Clean up temp file
  try {
    fs.unlinkSync(templatePath);
  } catch {
    /* ignore cleanup errors */
  }

  console.log('=== AKS Arc Deployment Complete ===\n');
  console.log(`Resource group:    ${groupName}`);
  console.log(`Appliance:         ${applianceName}`);
  console.log(`Custom location:   ${customLocation}`);
  console.log(`Logical network:   ${lnetName}`);
  console.log(`AKS Arc cluster:   ${aksCluster}`);
  console.log('');
  console.log('To connect to the cluster:');
  console.log(`  az connectedk8s proxy --resource-group ${groupName} --name ${aksCluster}`);
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
  case 'deployaksarc':
    deployAksArc(args);
    break;
  case 'rdp':
    rdp(args);
    break;
  default:
    console.log('Usage:');
    console.log(
      '  npx tsx scripts/baremetal-env.ts setup        --subscription <id> --location <region> --username <user> --password <pass>'
    );
    console.log(
      '  npx tsx scripts/baremetal-env.ts teardown     --subscription <id> [--group-name <name>]'
    );
    console.log(
      '  npx tsx scripts/baremetal-env.ts deployaksarc --subscription <id> --location <region> [options]'
    );
    console.log(
      '  npx tsx scripts/baremetal-env.ts rdp           --subscription <id> --username <user> [--group-name <name>] [--vm-name <name>]'
    );
    process.exit(command ? 1 : 0);
}
