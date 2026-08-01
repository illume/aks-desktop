// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  LogsViewer: () => <div>legacy logs</div>,
  WorkloadLogs: () => <div>workload logs</div>,
}));
vi.mock('./hooks/useLogsTab', () => ({
  useLogsTab: () => ({
    deployments: [{ jsonData: { metadata: { name: 'deployment', uid: 'uid' } } }],
    selectedDeployment: { jsonData: { metadata: { name: 'deployment', uid: 'uid' } } },
    selectedDeploymentName: 'deployment',
    liveReady: true,
    setSelectedDeploymentName: vi.fn(),
  }),
}));

import LogsTab from './LogsTab';

describe('LogsTab', () => {
  it('prefers Headlamp workload logs over the legacy fork viewer', () => {
    render(<LogsTab projectResources={[]} />);

    expect(screen.getByText('workload logs')).not.toBeNull();
    expect(screen.queryByText('legacy logs')).toBeNull();
  });
});
