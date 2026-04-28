// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import {
  Headlamp,
  registerCustomCreateProject,
  registerPluginSettings,
  registerProjectDeleteButton,
  registerProjectDetailsTab,
  registerProjectOverviewSection,
  registerRoute,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { Redirect } from 'react-router-dom';
import AccessTab from './components/AccessTab/AccessTab';
import ClusterCapabilityCard from './components/ClusterCapabilityCard/ClusterCapabilityCard';
import CreateAKSProject from './components/CreateAKSProject/CreateAKSProject';
import CreateNamespace from './components/CreateNamespace/CreateNamespace';
import AKSProjectDeleteButton from './components/DeleteAKSProject/AKSProjectDeleteButton';
import ImportAKSProjects from './components/ImportAKSProjects/ImportAKSProjects';
import InfoTab from './components/InfoTab/InfoTab';
import PreviewFeaturesSettings from './components/PluginSettings/PreviewFeaturesSettings';
import { isAksProject, isArmManagedProject } from './utils/shared/isAksProject';

// add azure related components only if running as app
if (Headlamp.isRunningAsApp()) {
  registerRoute({
    path: '/projects/create-aks-project',
    component: CreateAKSProject,
    name: 'Create a new AKS project',
    sidebar: {
      sidebar: 'HOME',
      item: 'projects',
    },
    exact: true,
    noAuthRequired: true,
    useClusterURL: false,
  });

  registerRoute({
    path: '/projects/import-aks-projects',
    component: ImportAKSProjects,
    name: 'Import AKS Projects',
    sidebar: {
      sidebar: 'HOME',
      item: 'projects',
    },
    exact: true,
    noAuthRequired: true,
    useClusterURL: false,
  });

  // Override built-in "Use Existing Namespace(s)" with enhanced AKS version
  registerCustomCreateProject({
    id: 'use-existing-namespace',
    name: 'Use Existing Namespace(s)',
    description: 'Select namespaces to use as a project',
    component: () => <Redirect to="/projects/import-aks-projects" />,
    icon: 'mdi:import',
  });

  // Override built-in "Create New Namespace" with AKS-aware version
  registerRoute({
    path: '/projects/create-namespace',
    component: CreateNamespace,
    name: 'Create New Namespace',
    sidebar: {
      sidebar: 'HOME',
      item: 'projects',
    },
    exact: true,
    noAuthRequired: true,
    useClusterURL: false,
  });

  registerCustomCreateProject({
    id: 'create-namespace',
    name: 'Create New Namespace',
    description: 'New namespace with resources as a project',
    component: () => <Redirect to="/projects/create-namespace" />,
    icon: 'mdi:folder-add',
  });

  // AKS-specific: Create new managed namespace via Azure
  registerCustomCreateProject({
    id: 'create-aks-managed-namespace',
    name: 'Create New AKS Managed Namespace',
    description: 'Create new AKS managed namespace and use as a project',
    component: () => <Redirect to="/projects/create-aks-project" />,
    icon: 'logos:microsoft-azure',
  });
}

registerPluginSettings('aks-desktop', PreviewFeaturesSettings, false);

registerProjectOverviewSection({
  id: 'cluster-capabilities',
  // @ts-ignore todo: there is an isEnabled prop in registerProjectOverviewSection it's just not present in the types yet
  isEnabled: isAksProject,
  component: ({ project }) => <ClusterCapabilityCard project={project} />,
});

registerProjectDetailsTab({
  id: 'info',
  label: 'Info',
  icon: 'mdi:information',
  isEnabled: isAksProject,
  component: ({ project }) => <InfoTab project={project} />,
});

// Override built-in Access tab with Azure role assignments for ARM-managed projects
registerProjectDetailsTab({
  id: 'headlamp-projects.tabs.access',
  label: 'Access',
  icon: 'mdi:account-lock',
  isEnabled: isArmManagedProject,
  component: ({ project }) => <AccessTab project={project} />,
});

// Register custom delete button for AKS Desktop + ARM-managed projects only
registerProjectDeleteButton({
  isEnabled: isArmManagedProject,
  component: ({ project }) => <AKSProjectDeleteButton project={project} />,
});
