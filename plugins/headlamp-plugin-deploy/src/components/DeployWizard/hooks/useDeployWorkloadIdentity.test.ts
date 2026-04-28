// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getServiceAccountName } from '../../../utils/kubernetes/serviceAccountNames';
import { getDeployIdentityName, useDeployWorkloadIdentity } from './useDeployWorkloadIdentity';

describe('getDeployIdentityName', () => {
  it('derives identity name from app name', () => {
    expect(getDeployIdentityName('my-app')).toBe('id-my-app-workload');
  });
});

describe('getServiceAccountName', () => {
  it('sanitizes: lowercase, strips invalid chars, truncates to 63, fallback to app-sa', () => {
    expect(getServiceAccountName('my-app')).toBe('my-app-sa');
  });

  it('converts uppercase to lowercase', () => {
    expect(getServiceAccountName('MyApp')).toBe('myapp-sa');
  });

  it('replaces underscores with hyphens', () => {
    expect(getServiceAccountName('my_app')).toBe('my-app-sa');
  });

  it('falls back for empty string', () => {
    expect(getServiceAccountName('')).toBe('sa');
  });

  it('strips trailing hyphens after truncation to 63 chars', () => {
    const longName = 'a'.repeat(60) + '_b';
    const result = getServiceAccountName(longName);
    expect(result.length).toBeLessThanOrEqual(63);
    expect(result).not.toMatch(/-$/);
  });

  it('handles input producing only special characters', () => {
    expect(getServiceAccountName('!!!@@@###')).toBe('sa');
  });
});

describe('useDeployWorkloadIdentity (stub)', () => {
  it('initializes with idle status', () => {
    const { result } = renderHook(() => useDeployWorkloadIdentity());

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });
});
