// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { registerProjectDetailsTab, registerProjectOverviewSection } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import MetricsCard from './components/Metrics/MetricsCard';
import MetricsTab from './components/Metrics/MetricsTab';
import { isAksProject } from './utils/shared/isAksProject';

registerProjectOverviewSection({
  id: 'metrics-overview',
  // @ts-ignore isEnabled not in types yet
  isEnabled: isAksProject,
  component: ({ project }) => <MetricsCard project={project} />,
});

registerProjectDetailsTab({
  id: 'metrics',
  label: 'Metrics',
  icon: 'mdi:chart-line',
  isEnabled: isAksProject,
  component: ({ project }) => <MetricsTab project={project} />,
});
