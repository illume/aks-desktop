// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { ScalingMetrics } from './ScalingMetrics';

export default {
  title: 'Scaling/ScalingMetrics',
  component: ScalingMetrics,
} as Meta<typeof ScalingMetrics>;

const Template: StoryFn<typeof ScalingMetrics> = args => <ScalingMetrics {...args} />;

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

export const HPAManaged = Template.bind({});
HPAManaged.args = {
  selectedDeployment: 'frontend',
  deployments: sampleDeployments,
  hpaInfo,
};

export const ManualScaling = Template.bind({});
ManualScaling.args = {
  selectedDeployment: 'frontend',
  deployments: sampleDeployments,
  hpaInfo: null,
};

export const HPAWithMissingMetrics = Template.bind({});
HPAWithMissingMetrics.args = {
  selectedDeployment: 'frontend',
  deployments: sampleDeployments,
  hpaInfo: {
    name: 'frontend-hpa',
    namespace: 'default',
    minReplicas: undefined,
    maxReplicas: undefined,
    targetCPUUtilization: undefined,
    currentCPUUtilization: undefined,
    currentReplicas: undefined,
    desiredReplicas: undefined,
  },
};

export const DeploymentNotFound = Template.bind({});
DeploymentNotFound.args = {
  selectedDeployment: 'unknown-deployment',
  deployments: sampleDeployments,
  hpaInfo: null,
};
