// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { secureStorageDelete, secureStorageLoad, secureStorageSave } from './secure-storage';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).desktopApi;
});

describe('plugin secure storage', () => {
  it('uses the injected package-scoped adapter', async () => {
    const storage = {
      save: vi.fn().mockResolvedValue({ success: true }),
      load: vi.fn().mockResolvedValue({ success: true, value: 'stored' }),
      delete: vi.fn().mockResolvedValue({ success: true }),
    };
    vi.stubGlobal('pluginSecureStorage', storage);

    await expect(secureStorageSave('aks-desktop:github-auth', 'value')).resolves.toBe(true);
    await expect(secureStorageLoad('aks-desktop:github-auth')).resolves.toBe('stored');
    await expect(secureStorageDelete('aks-desktop:github-auth')).resolves.toBe(true);

    expect(storage.save).toHaveBeenCalledWith('github-auth', 'value');
    expect(storage.load).toHaveBeenCalledWith('github-auth');
    expect(storage.delete).toHaveBeenCalledWith('github-auth');
  });

  it('retains the current desktop bridge as a migration fallback', async () => {
    (window as any).desktopApi = {
      secureStorageSave: vi.fn().mockResolvedValue({ success: true }),
      secureStorageLoad: vi.fn().mockResolvedValue({ success: true, value: 'legacy' }),
      secureStorageDelete: vi.fn().mockResolvedValue({ success: true }),
    };

    await expect(secureStorageSave('legacy-key', 'value')).resolves.toBe(true);
    await expect(secureStorageLoad('legacy-key')).resolves.toBe('legacy');
    await expect(secureStorageDelete('legacy-key')).resolves.toBe(true);
  });
});
