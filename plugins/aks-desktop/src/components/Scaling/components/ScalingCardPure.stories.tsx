// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { ScalingCardPure } from './ScalingCardPure';

export default {
  title: 'Scaling/ScalingCardPure',
  component: ScalingCardPure,
} as Meta<typeof ScalingCardPure>;

const Template: StoryFn<typeof ScalingCardPure> = args => (
  <div style={{ width: 800, padding: 16 }}>
    <ScalingCardPure {...args} />
  </div>
);

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
  { name: 'backend', namespace: 'default', replicas: 2, availableReplicas: 2, readyReplicas: 2 },
];

const hpaInfo = {
  name: 'frontend-hpa',
  namespace: 'default',
  minReplicas: 2,
  maxReplicas: 10,
  targetCPUUtilization: 60,
  currentCPUUtilization: 45,
  currentReplicas: 3,
  desiredReplicas: 3,
};

const sampleChartData = [
  { time: 'Mon, 09:00', Replicas: 2, CPU: 35 },
  { time: 'Mon, 10:00', Replicas: 3, CPU: 55 },
  { time: 'Mon, 11:00', Replicas: 4, CPU: 75 },
  { time: 'Mon, 12:00', Replicas: 4, CPU: 80 },
  { time: 'Mon, 13:00', Replicas: 3, CPU: 62 },
  { time: 'Mon, 14:00', Replicas: 2, CPU: 40 },
];

export const WithDeploymentAndHPA = Template.bind({});
WithDeploymentAndHPA.args = {
  deployments: sampleDeployments,
  selectedDeployment: 'frontend',
  loading: false,
  error: null,
  hpaInfo,
  chartData: sampleChartData,
  chartLoading: false,
  chartError: null,
  onDeploymentChange: () => {},
};

export const WithDeploymentManualScaling = Template.bind({});
WithDeploymentManualScaling.args = {
  deployments: sampleDeployments,
  selectedDeployment: 'frontend',
  loading: false,
  error: null,
  hpaInfo: null,
  chartData: sampleChartData,
  chartLoading: false,
  chartError: null,
  onDeploymentChange: () => {},
};

export const LoadingDeployments = Template.bind({});
LoadingDeployments.args = {
  deployments: [],
  selectedDeployment: '',
  loading: true,
  error: null,
  hpaInfo: null,
  chartData: [],
  chartLoading: false,
  chartError: null,
  onDeploymentChange: () => {},
};

export const NoDeploymentSelected = Template.bind({});
NoDeploymentSelected.args = {
  deployments: sampleDeployments,
  selectedDeployment: '',
  loading: false,
  error: null,
  hpaInfo: null,
  chartData: [],
  chartLoading: false,
  chartError: null,
  onDeploymentChange: () => {},
};

export const WithError = Template.bind({});
WithError.args = {
  deployments: [],
  selectedDeployment: '',
  loading: false,
  error: 'Failed to fetch deployments from cluster',
  hpaInfo: null,
  chartData: [],
  chartLoading: false,
  chartError: null,
  onDeploymentChange: () => {},
};

export const ChartLoading = Template.bind({});
ChartLoading.args = {
  deployments: sampleDeployments,
  selectedDeployment: 'frontend',
  loading: false,
  error: null,
  hpaInfo,
  chartData: [],
  chartLoading: true,
  chartError: null,
  onDeploymentChange: () => {},
};
