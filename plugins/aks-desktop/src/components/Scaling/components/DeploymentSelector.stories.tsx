// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { DeploymentSelector } from './DeploymentSelector';

export default {
  title: 'Scaling/DeploymentSelector',
  component: DeploymentSelector,
} as Meta<typeof DeploymentSelector>;

const Template: StoryFn<typeof DeploymentSelector> = args => <DeploymentSelector {...args} />;

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
  { name: 'backend', namespace: 'default', replicas: 2, availableReplicas: 2, readyReplicas: 2 },
  { name: 'worker', namespace: 'default', replicas: 1, availableReplicas: 1, readyReplicas: 1 },
];

export const WithDeployments = Template.bind({});
WithDeployments.args = {
  selectedDeployment: 'frontend',
  deployments: sampleDeployments,
  loading: false,
  onDeploymentChange: () => {},
};

export const LoadingDeployments = Template.bind({});
LoadingDeployments.args = {
  selectedDeployment: '',
  deployments: [],
  loading: true,
  onDeploymentChange: () => {},
};

export const EmptyDeployments = Template.bind({});
EmptyDeployments.args = {
  selectedDeployment: '',
  deployments: [],
  loading: false,
  onDeploymentChange: () => {},
};

export const NothingSelected = Template.bind({});
NothingSelected.args = {
  selectedDeployment: '',
  deployments: sampleDeployments,
  loading: false,
  onDeploymentChange: () => {},
};
