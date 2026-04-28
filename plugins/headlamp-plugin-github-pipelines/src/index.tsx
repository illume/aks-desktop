// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import {
  registerProjectDetailsTab,
  // @ts-ignore todo: registerProjectHeaderAction is not exported properly
  registerProjectHeaderAction,
  registerProjectOverviewSection,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import ConfigurePipelineButton from './components/ConfigurePipeline/ConfigurePipelineButton';
import PipelineCard from './components/Deployments/PipelineCard';
import DeployTab from './components/DeployTab/DeployTab';
import { GitHubAuthStatusButton } from './components/GitHubPipeline/components/GitHubAuthStatusButton';
import { GitHubAuthProvider } from './components/GitHubPipeline/GitHubAuthContext';
import { previewFeaturesStore } from './components/PluginSettings/previewFeaturesStore';
import type { ProjectDefinition } from './types/project';
import { isAksProject } from './utils/shared/isAksProject';

registerProjectOverviewSection({
  id: 'pipeline-overview',
  // @ts-expect-error isEnabled exists at runtime but is missing from ProjectOverviewSection types
  isEnabled: props =>
    previewFeaturesStore.get()?.githubPipelines ? isAksProject(props) : Promise.resolve(false),
  component: ({ project }) => (
    <GitHubAuthProvider>
      <PipelineCard project={project} />
    </GitHubAuthProvider>
  ),
});

registerProjectDetailsTab({
  id: 'deploy',
  label: 'Deploy',
  icon: 'mdi:cloud-upload',
  isEnabled: isAksProject,
  component: ({ project }) => (
    <GitHubAuthProvider>
      <DeployTab project={project} />
    </GitHubAuthProvider>
  ),
});

registerProjectHeaderAction({
  id: 'github-auth-status',
  component: () => (
    <GitHubAuthProvider>
      <GitHubAuthStatusButton />
    </GitHubAuthProvider>
  ),
});

registerProjectHeaderAction({
  id: 'configure-pipeline',
  component: (props: { project: ProjectDefinition; setSelectedTab?: (tabId: string) => void }) => (
    <GitHubAuthProvider>
      <ConfigurePipelineButton project={props.project} setSelectedTab={props.setSelectedTab} />
    </GitHubAuthProvider>
  ),
});
