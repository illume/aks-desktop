// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { registerProjectDetailsTab, registerProjectOverviewSection } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import ScalingCard from './components/Scaling/ScalingCard';
import ScalingTab from './components/Scaling/ScalingTab';
import { isAksProject } from './utils/shared/isAksProject';

registerProjectOverviewSection({
  id: 'scaling-overview',
  // @ts-expect-error isEnabled not in types yet
  isEnabled: isAksProject,
  component: ({ project }: { project: { id: string; namespaces: string[]; clusters: string[] } }) => <ScalingCard project={project} />,
});

registerProjectDetailsTab({
  id: 'scaling',
  label: 'Scaling',
  icon: 'mdi:chart-timeline-variant',
  isEnabled: isAksProject,
  component: ({ project }: { project: { id: string; namespaces: string[]; clusters: string[] } }) => <ScalingTab project={project} />,
});
