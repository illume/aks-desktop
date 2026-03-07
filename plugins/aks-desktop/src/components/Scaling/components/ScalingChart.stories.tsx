// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { ScalingChart } from './ScalingChart';

export default {
  title: 'Scaling/ScalingChart',
  component: ScalingChart,
} as Meta<typeof ScalingChart>;

const Template: StoryFn<typeof ScalingChart> = args => (
  <div style={{ height: 400, width: '100%' }}>
    <ScalingChart {...args} />
  </div>
);

const sampleChartData = [
  { time: 'Mon, 09:00', Replicas: 2, CPU: 35 },
  { time: 'Mon, 10:00', Replicas: 3, CPU: 55 },
  { time: 'Mon, 11:00', Replicas: 4, CPU: 75 },
  { time: 'Mon, 12:00', Replicas: 4, CPU: 80 },
  { time: 'Mon, 13:00', Replicas: 3, CPU: 62 },
  { time: 'Mon, 14:00', Replicas: 2, CPU: 40 },
  { time: 'Mon, 15:00', Replicas: 2, CPU: 30 },
  { time: 'Mon, 16:00', Replicas: 3, CPU: 58 },
];

export const WithData = Template.bind({});
WithData.args = {
  chartData: sampleChartData,
  loading: false,
  error: null,
};

export const Loading = Template.bind({});
Loading.args = {
  chartData: [],
  loading: true,
  error: null,
};

export const ErrorState = Template.bind({});
ErrorState.args = {
  chartData: [],
  loading: false,
  error: 'Unable to connect to Prometheus. Ensure Managed Prometheus is enabled on your cluster.',
};

export const NoData = Template.bind({});
NoData.args = {
  chartData: [],
  loading: false,
  error: null,
};
