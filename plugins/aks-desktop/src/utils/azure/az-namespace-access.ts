// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { quoteForPlatform } from '../shared/quoteForPlatform';
import { debugLog, getErrorMessage, isAzError, needsRelogin, runCommandAsync } from './az-cli-core';
import { checkNamespaceStatus } from './az-namespaces';

export async function checkNamespaceExists(
  clusterName: string,
  resourceGroup: string,
  namespaceName: string,
  subscriptionId?: string
): Promise<{ exists: boolean; stdout: string; stderr: string; error?: string }> {
  const result = await checkNamespaceStatus(
    clusterName,
    resourceGroup,
    namespaceName,
    subscriptionId
  );
  if (!result.success) {
    return { exists: false, stdout: result.stdout, stderr: result.stderr, error: result.error };
  }
  return { exists: result.status !== 'notfound', stdout: result.stdout, stderr: result.stderr };
}

export async function createNamespaceRoleAssignment(options: {
  clusterName: string;
  resourceGroup: string;
  namespaceName: string;
  assigneeObjectId: string;
  role: string;
  subscriptionId?: string;
}): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  const { clusterName, resourceGroup, namespaceName, assigneeObjectId, role, subscriptionId } =
    options;

  // Strip quotes from role if present (they may have been added for Windows)
  let cleanRole = role.trim();
  if (
    (cleanRole.startsWith('"') && cleanRole.endsWith('"')) ||
    (cleanRole.startsWith("'") && cleanRole.endsWith("'"))
  ) {
    cleanRole = cleanRole.slice(1, -1);
  }

  // On Windows, role names with spaces need double quotes for shell execution
  const finalRole = quoteForPlatform(cleanRole);

  try {
    // First, get the resource ID of the managed namespace
    const namespaceArgs = [
      'aks',
      'namespace',
      'show',
      '--cluster-name',
      clusterName,
      '--resource-group',
      resourceGroup,
      '--name',
      namespaceName,
      '--query',
      'id',
      '--output',
      'tsv',
    ];

    if (subscriptionId) {
      namespaceArgs.push('--subscription', subscriptionId);
    }

    debugLog('Getting namespace resource ID:', 'az', namespaceArgs.join(' '));

    const { stdout: namespaceStdout, stderr: namespaceStderr } = await runCommandAsync(
      'az',
      namespaceArgs
    );

    if (namespaceStderr && needsRelogin(namespaceStderr)) {
      return {
        success: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: 'Authentication required. Please log in to Azure CLI: az login',
      };
    }

    if (namespaceStderr && isAzError(namespaceStderr)) {
      return {
        success: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: `Failed to get namespace resource ID: ${namespaceStderr}`,
      };
    }

    const namespaceResourceId = namespaceStdout.trim();
    if (!namespaceResourceId) {
      return {
        success: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: 'Failed to get namespace resource ID',
      };
    }

    // Now create the role assignment
    const roleArgs = [
      'role',
      'assignment',
      'create',
      '--assignee-object-id',
      assigneeObjectId,
      '--assignee-principal-type',
      'User',
      '--role',
      finalRole,
      '--scope',
      namespaceResourceId,
    ];

    if (subscriptionId) {
      roleArgs.push('--subscription', subscriptionId);
    }

    roleArgs.push('--output', 'json');

    debugLog('Creating role assignment:', 'az', roleArgs.join(' '));

    const { stdout: roleStdout, stderr: roleStderr } = await runCommandAsync('az', roleArgs);

    if (roleStderr && needsRelogin(roleStderr)) {
      return {
        success: false,
        stdout: roleStdout,
        stderr: roleStderr,
        error: 'Authentication required. Please log in to Azure CLI: az login',
      };
    }

    if (roleStderr && isAzError(roleStderr)) {
      return {
        success: false,
        stdout: roleStdout,
        stderr: roleStderr,
        error: `Failed to create role assignment: ${roleStderr}`,
      };
    }

    return {
      success: true,
      stdout: roleStdout,
      stderr: roleStderr,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: `Failed to create role assignment: ${errorMessage}`,
    };
  }
}

export async function verifyNamespaceAccess(options: {
  clusterName: string;
  resourceGroup: string;
  namespaceName: string;
  assigneeObjectId: string;
  subscriptionId?: string;
}): Promise<{
  success: boolean;
  hasAccess: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const { clusterName, resourceGroup, namespaceName, assigneeObjectId, subscriptionId } = options;

  try {
    // First, get the resource ID of the managed namespace
    const namespaceArgs = [
      'aks',
      'namespace',
      'show',
      '--cluster-name',
      clusterName,
      '--resource-group',
      resourceGroup,
      '--name',
      namespaceName,
      '--query',
      'id',
      '--output',
      'tsv',
    ];

    if (subscriptionId) {
      namespaceArgs.push('--subscription', subscriptionId);
    }

    debugLog(
      'Getting namespace resource ID for access verification:',
      'az',
      namespaceArgs.join(' ')
    );

    const { stdout: namespaceStdout, stderr: namespaceStderr } = await runCommandAsync(
      'az',
      namespaceArgs
    );

    if (namespaceStderr && needsRelogin(namespaceStderr)) {
      return {
        success: false,
        hasAccess: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: 'Authentication required. Please log in to Azure CLI: az login',
      };
    }

    if (namespaceStderr && isAzError(namespaceStderr)) {
      return {
        success: false,
        hasAccess: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: `Failed to get namespace resource ID: ${namespaceStderr}`,
      };
    }

    const namespaceResourceId = namespaceStdout.trim();
    if (!namespaceResourceId) {
      return {
        success: false,
        hasAccess: false,
        stdout: namespaceStdout,
        stderr: namespaceStderr,
        error: 'Failed to get namespace resource ID',
      };
    }

    // Now check for existing role assignments
    const roleArgs = [
      'role',
      'assignment',
      'list',
      '--assignee',
      assigneeObjectId,
      '--scope',
      namespaceResourceId,
      '--query',
      '[].{roleDefinitionName:roleDefinitionName,scope:scope}',
      '--output',
      'json',
    ];

    if (subscriptionId) {
      roleArgs.push('--subscription', subscriptionId);
    }

    debugLog('Checking role assignments:', 'az', roleArgs.join(' '));

    const { stdout: roleStdout, stderr: roleStderr } = await runCommandAsync('az', roleArgs);

    if (roleStderr && needsRelogin(roleStderr)) {
      return {
        success: false,
        hasAccess: false,
        stdout: roleStdout,
        stderr: roleStderr,
        error: 'Authentication required. Please log in to Azure CLI: az login',
      };
    }

    if (roleStderr && isAzError(roleStderr)) {
      return {
        success: false,
        hasAccess: false,
        stdout: roleStdout,
        stderr: roleStderr,
        error: `Failed to check role assignments: ${roleStderr}`,
      };
    }

    try {
      const roleAssignments = JSON.parse(roleStdout || '[]');
      const hasAccess = roleAssignments.length > 0;

      return {
        success: true,
        hasAccess,
        stdout: roleStdout,
        stderr: roleStderr,
      };
    } catch (parseError) {
      return {
        success: false,
        hasAccess: false,
        stdout: roleStdout,
        stderr: roleStderr,
        error: 'Failed to parse role assignments response',
      };
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      success: false,
      hasAccess: false,
      stdout: '',
      stderr: '',
      error: `Failed to verify namespace access: ${errorMessage}`,
    };
  }
}
