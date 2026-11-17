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
  let latestIdentity: string | undefined;
  let pending: Promise<void> | undefined;

  const schedule = (identity: string) => {
    pending = invalidate()
      .then(() => {
        previousIdentity = identity;
      })
      .catch(error => {
        previousIdentity = undefined;
        onError(error);
      })
      .then(() => {
        pending = undefined;
        if (latestIdentity !== identity) {
          schedule(latestIdentity!);
        }
      });
  };

  return status => {
    const identity = identityKey(status);
    latestIdentity = identity;
    if (pending || identity === previousIdentity) {
      return;
    }
    schedule(identity);
  };
}
