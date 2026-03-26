// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { quoteForPlatform } from '../shared/quoteForPlatform';
import { runAzCommand } from './az-cli-core';

// Allowlist for OData filter values — blocks injection of OData operators and quotes
const ODATA_SAFE_QUERY_PATTERN = /^[a-zA-Z0-9@._ -]+$/;

export interface AzureADUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

/**
 * Searches Azure AD users by display name or email prefix.
 * Uses `az ad user list` with OData `--filter` for display name, mail, and UPN.
 * Results are limited to 15 via JMESPath slice.
 * May fail if the tenant blocks directory reads via conditional access policies.
 */
export async function searchAzureADUsers(
  query: string
): Promise<{ success: boolean; users: AzureADUser[]; error?: string }> {
  if (!query || query.trim().length < 2) {
    return { success: true, users: [] };
  }

  const trimmed = query.trim();

  // Reject queries with characters that could manipulate the OData filter
  if (!ODATA_SAFE_QUERY_PATTERN.test(trimmed)) {
    return { success: true, users: [] };
  }

  const filterValue = `startswith(displayName,'${trimmed}') or startswith(mail,'${trimmed}') or startswith(userPrincipalName,'${trimmed}')`;

  const result = await runAzCommand<AzureADUser[]>(
    [
      'ad',
      'user',
      'list',
      '--filter',
      quoteForPlatform(filterValue),
      '--query',
      '[:15].{id:id,displayName:displayName,mail:mail,userPrincipalName:userPrincipalName}',
      '--output',
      'json',
    ],
    'Searching Azure AD users:',
    'search Azure AD users',
    stdout => JSON.parse(stdout || '[]'),
    stderr => {
      // Surface conditional-access / permission errors to the caller so the UI
      // can permanently disable search and fall back to manual UUID entry.
      if (
        stderr.includes('AADSTS530084') ||
        stderr.includes('AADSTS50079') ||
        stderr.includes('Authorization_RequestDenied') ||
        stderr.includes('Insufficient privileges')
      ) {
        return { success: false, error: stderr };
      }
      return null;
    }
  );

  return { success: result.success, users: result.data ?? [], error: result.error };
}
