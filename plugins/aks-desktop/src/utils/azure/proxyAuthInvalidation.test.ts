// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { describe, expect, test, vi } from 'vitest';
import { createProxyAuthInvalidator } from './proxyAuthInvalidation';

const identity = {
  isLoggedIn: true,
  username: 'operator@example.com',
  tenantId: 'tenant-a',
  subscriptionId: 'subscription-a',
  environmentName: 'AzureCloud',
};

describe('createProxyAuthInvalidator', () => {
  test('invalidates the first observed identity so a pre-renderer proxy cannot be reused', () => {
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const handleIdentity = createProxyAuthInvalidator(invalidate, vi.fn());

    handleIdentity(identity);

    expect(invalidate).toHaveBeenCalledOnce();
  });

  test('ignores duplicate observations but invalidates an account change', () => {
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const handleIdentity = createProxyAuthInvalidator(invalidate, vi.fn());

    handleIdentity(identity);
    handleIdentity({ ...identity });
    handleIdentity({ ...identity, username: 'another@example.com' });

    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  test('reports an invalidation failure and permits retrying the same identity', async () => {
    const error = new Error('cleanup failed');
    const onError = vi.fn();
    const invalidate = vi.fn().mockRejectedValue(error);
    const handleIdentity = createProxyAuthInvalidator(invalidate, onError);

    handleIdentity(identity);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    handleIdentity(identity);
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
  });
});
