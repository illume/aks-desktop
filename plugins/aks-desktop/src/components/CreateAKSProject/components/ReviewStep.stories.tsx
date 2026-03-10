// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import type { ReviewStepProps } from '../types';
import { ReviewStep } from './ReviewStep';

const SUBSCRIPTION = {
  id: 'sub-123',
  name: 'Production Subscription',
  tenant: 'tenant-1',
  tenantName: 'Contoso Ltd',
  status: 'Enabled',
};

const CLUSTER = {
  name: 'aks-prod-eastus',
  location: 'eastus',
  version: '1.28.3',
  nodeCount: 3,
  status: 'Running',
  resourceGroup: 'rg-prod',
};

const BASE_FORM_DATA = {
  projectName: 'azure-microservices-demo',
  description: 'Demo project for microservices on AKS',
  subscription: 'sub-123',
  cluster: 'aks-prod-eastus',
  resourceGroup: 'rg-prod',
  ingress: 'AllowSameNamespace' as const,
  egress: 'AllowAll' as const,
  cpuRequest: 2000,
  memoryRequest: 4096,
  cpuLimit: 4000,
  memoryLimit: 8192,
  userAssignments: [
    { email: 'alice@example.com', role: 'Admin' },
    { email: 'bob@example.com', role: 'Reader' },
  ],
};

const BASE_PROPS: ReviewStepProps = {
  formData: BASE_FORM_DATA,
  subscriptions: [SUBSCRIPTION],
  clusters: [CLUSTER],
  onFormDataChange: () => {},
  validation: { isValid: true, errors: [], warnings: [] },
};

export default {
  title: 'CreateAKSProject/ReviewStep',
  component: ReviewStep,
} as Meta;

const Template: StoryFn<ReviewStepProps> = args => <ReviewStep {...args} />;

/**
 * Full configuration — two assignees, description filled, cluster resolved from
 * the subscriptions/clusters lists so location + version are shown.
 */
export const FullConfiguration = Template.bind({});
FullConfiguration.args = BASE_PROPS;

/**
 * No assignees — Access Control section shows the count "(0 assignee)" and
 * renders an empty scrollable box.
 */
export const NoAssignees = Template.bind({});
NoAssignees.args = {
  ...BASE_PROPS,
  formData: { ...BASE_FORM_DATA, userAssignments: [] },
};

/**
 * No description — falls back to the "No description provided" placeholder so
 * screen readers are never left with a blank field.
 */
export const NoDescription = Template.bind({});
NoDescription.args = {
  ...BASE_PROPS,
  formData: { ...BASE_FORM_DATA, description: '' },
};

/**
 * Unresolved subscription / cluster — subscription and cluster IDs do not
 * match anything in the lists, so the component falls back to "N/A" /
 * the raw cluster name.  Exercises the graceful-degradation path.
 */
export const UnresolvedResources = Template.bind({});
UnresolvedResources.args = {
  ...BASE_PROPS,
  subscriptions: [],
  clusters: [],
};

/**
 * Single assignee with Writer role.
 */
export const SingleAssignee = Template.bind({});
SingleAssignee.args = {
  ...BASE_PROPS,
  formData: {
    ...BASE_FORM_DATA,
    userAssignments: [{ email: 'charlie@example.com', role: 'Writer' }],
  },
};

/**
 * Many assignees — the Access Control region overflows its 200 px max-height,
 * making it keyboard-scrollable (Tab to focus the region, then ↑/↓ to scroll).
 * Use this story to verify that the scrollable-region-focusable a11y requirement
 * is satisfied and that all assignees are reachable by keyboard.
 */
export const ManyAssignees = Template.bind({});
ManyAssignees.args = {
  ...BASE_PROPS,
  formData: {
    ...BASE_FORM_DATA,
    userAssignments: [
      { email: 'alice@example.com', role: 'Admin' },
      { email: 'bob@example.com', role: 'Reader' },
      { email: 'charlie@example.com', role: 'Writer' },
      { email: 'diana@example.com', role: 'Admin' },
      { email: 'evan@example.com', role: 'Reader' },
      { email: 'fiona@example.com', role: 'Writer' },
      { email: 'george@example.com', role: 'Reader' },
      { email: 'hannah@example.com', role: 'Admin' },
    ],
  },
};
