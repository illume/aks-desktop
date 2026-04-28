// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { registerProjectHeaderAction } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import DeployButton from './components/Deploy/DeployButton';

registerProjectHeaderAction({
  id: 'deploy-application',
  component: ({ project }) => <DeployButton project={project} />,
});
