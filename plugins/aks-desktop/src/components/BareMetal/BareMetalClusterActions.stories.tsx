// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { ListItemText, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

/**
 * Storybook-only preview of the BareMetal proxy actions that appear in the
 * cluster overview action menu for `aksarc` clusters.
 *
 * The real menu items are registered in `index.tsx` via
 * `registerClusterProviderMenuItem` and cannot be rendered outside the
 * Headlamp shell.  This story recreates the same `<MenuItem>` tree so
 * that the visual appearance can be verified and screenshotted.
 */

interface BareMetalClusterActionsProps {
  /** Cluster name shown in the menu header. */
  clusterName: string;
}

function BareMetalClusterActionsPreview({ clusterName }: BareMetalClusterActionsProps) {
  return (
    <Paper elevation={8} sx={{ width: 280 }}>
      <Menu open anchorReference="none" PaperProps={{ sx: { position: 'static', width: '100%' } }}>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            {clusterName}
          </Typography>
        </MenuItem>

        <MenuItem>
          <ListItemText>Start BareMetal Proxy</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemText>Stop BareMetal Proxy</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemText>Restart BareMetal Proxy</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemText>BareMetal Proxy Settings</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
}

export default {
  title: 'BareMetal/ClusterActions',
  component: BareMetalClusterActionsPreview,
} as Meta;

const Template: StoryFn<BareMetalClusterActionsProps> = args => (
  <BareMetalClusterActionsPreview {...args} />
);

/** Default menu for a BareMetal (aksarc) cluster on the overview page. */
export const Default = Template.bind({});
Default.args = { clusterName: 'edge-arc-cluster' };

/** Menu showing actions for a second cluster. */
export const AlternateCluster = Template.bind({});
AlternateCluster.args = { clusterName: 'factory-floor-node-01' };
