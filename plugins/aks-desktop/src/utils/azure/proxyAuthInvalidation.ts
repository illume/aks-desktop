// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import type { AzureLoginStatus } from './az-auth';

function identityKey(status: AzureLoginStatus | undefined): string {
  return JSON.stringify([
    status?.isLoggedIn,
    status?.username,
    status?.tenantId,
    status?.subscriptionId,
    status?.environmentName,
  ]);
}

/** Invalidates once for each observed Azure identity, including the first one. */
export function createProxyAuthInvalidator(
  invalidate: () => Promise<void>,
  onError: (error: unknown) => void
): (status: AzureLoginStatus | undefined) => void {
  let previousIdentity: string | undefined;
  let pendingIdentity: string | undefined;
  return status => {
    const identity = identityKey(status);
    if (identity === previousIdentity || identity === pendingIdentity) {
      return;
    }
    pendingIdentity = identity;
    void invalidate().then(
      () => {
        previousIdentity = identity;
        if (pendingIdentity === identity) {
          pendingIdentity = undefined;
        }
      },
      error => {
        if (pendingIdentity === identity) {
          pendingIdentity = undefined;
        }
        onError(error);
      }
    );
  };
}
