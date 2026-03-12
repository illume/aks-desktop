// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DeployPure, { DeployPureProps } from './DeployPure';

export default {
  title: 'DeployWizard/DeployPure',
  component: DeployPure,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} as Meta;

const Template: StoryFn<DeployPureProps> = args => <DeployPure {...args} />;

const sampleYamlObjects = [
  { kind: 'Deployment', name: 'my-app', namespace: 'default' },
  { kind: 'Service', name: 'my-app-svc', namespace: 'default' },
];

export const Idle = Template.bind({});
Idle.args = {
  sourceType: 'yaml',
  namespace: 'default',
  containerPreviewYaml: '',
  deployResult: null,
  deployMessage: '',
  yamlObjects: sampleYamlObjects,
};

export const DeploySuccess = Template.bind({});
DeploySuccess.args = {
  ...Idle.args,
  deployResult: 'success',
  deployMessage: 'Applied 5 resources successfully.',
};

export const DeployError = Template.bind({});
DeployError.args = {
  ...Idle.args,
  deployResult: 'error',
  deployMessage:
    'Failed to apply resources: connection refused to api-server.production.svc.cluster.local:443 (error: ECONNREFUSED)',
};

export const YamlWithObjects = Template.bind({});
YamlWithObjects.args = {
  ...Idle.args,
  yamlObjects: [
    { kind: 'Deployment', name: 'api-server', namespace: 'production' },
    { kind: 'Service', name: 'api-server-svc' },
    { kind: 'Ingress', name: 'api-ingress', namespace: 'production' },
  ],
};

/** Edge case: no resources parsed from YAML. */
export const EmptyResourceList = Template.bind({});
EmptyResourceList.args = {
  ...Idle.args,
  yamlObjects: [],
};

/** Edge case: single resource — exercises singular count label. */
export const SingleResource = Template.bind({});
SingleResource.args = {
  ...Idle.args,
  yamlObjects: [{ kind: 'Deployment', name: 'web-frontend', namespace: 'production' }],
};

/** Multiple diverse resource kinds. */
export const ManyResourceTypes = Template.bind({});
ManyResourceTypes.args = {
  ...Idle.args,
  yamlObjects: [
    { kind: 'Deployment', name: 'web-frontend', namespace: 'production' },
    { kind: 'Service', name: 'web-frontend-svc', namespace: 'production' },
    { kind: 'ConfigMap', name: 'app-config', namespace: 'production' },
    { kind: 'HorizontalPodAutoscaler', name: 'web-frontend-hpa', namespace: 'production' },
    { kind: 'ServiceAccount', name: 'web-frontend-sa', namespace: 'production' },
  ],
};

const sampleContainerYaml = `# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: test
  annotations:
    aks-project/deployed-by: manual
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:latest
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            allowPrivilegeEscalation: false
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: test
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80`;

/** Container source — shows the Monaco editor with generated YAML. */
export const ContainerPreview = Template.bind({});
ContainerPreview.args = {
  sourceType: 'container',
  namespace: 'test',
  containerPreviewYaml: sampleContainerYaml,
  deployResult: null,
  deployMessage: '',
  yamlObjects: [],
};

/** Container source — deploy succeeded. */
export const ContainerDeploySuccess = Template.bind({});
ContainerDeploySuccess.args = {
  ...ContainerPreview.args,
  deployResult: 'success',
  deployMessage: 'Applied 2 resources successfully.',
};

/** Container source — deploy failed. */
export const ContainerDeployError = Template.bind({});
ContainerDeployError.args = {
  ...ContainerPreview.args,
  deployResult: 'error',
  deployMessage: 'Failed to apply Deployment/my-app in namespace test: ImagePullBackOff',
};
