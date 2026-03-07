// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { ScalingEditDialog } from './ScalingEditDialog';

export default {
  title: 'Scaling/ScalingEditDialog',
  component: ScalingEditDialog,
} as Meta<typeof ScalingEditDialog>;

const Template: StoryFn<typeof ScalingEditDialog> = args => <ScalingEditDialog {...args} />;

const defaultEditValues = {
  minReplicas: 2,
  maxReplicas: 10,
  targetCPU: 60,
  replicas: 3,
};

const hpaInfo = {
  name: 'my-hpa',
  namespace: 'default',
  minReplicas: 2,
  maxReplicas: 10,
  targetCPUUtilization: 60,
  currentCPUUtilization: 45,
  currentReplicas: 3,
  desiredReplicas: 3,
};

export const HPAMode = Template.bind({});
HPAMode.args = {
  open: true,
  hpaInfo,
  editValues: defaultEditValues,
  saving: false,
  onEditValuesChange: () => {},
  onClose: () => {},
  onSave: async () => {},
};

export const ManualMode = Template.bind({});
ManualMode.args = {
  open: true,
  hpaInfo: null,
  editValues: defaultEditValues,
  saving: false,
  onEditValuesChange: () => {},
  onClose: () => {},
  onSave: async () => {},
};

export const Saving = Template.bind({});
Saving.args = {
  open: true,
  hpaInfo,
  editValues: defaultEditValues,
  saving: true,
  onEditValuesChange: () => {},
  onClose: () => {},
  onSave: async () => {},
};

export const Closed = Template.bind({});
Closed.args = {
  open: false,
  hpaInfo,
  editValues: defaultEditValues,
  saving: false,
  onEditValuesChange: () => {},
  onClose: () => {},
  onSave: async () => {},
};
