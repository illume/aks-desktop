// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import type { AgentThinkingStep } from '../../agent/aksAgentManager';
import AgentThinkingSteps from './AgentThinkingSteps';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    sidebar: { selectedBackground: '#555555' },
  },
});

const meta: Meta<typeof AgentThinkingSteps> = {
  title: 'AIAssistant/AgentThinkingSteps',
  component: AgentThinkingSteps,
};
export default meta;

const now = Date.now();

const initSteps: AgentThinkingStep[] = [
  { id: 1, label: 'Connecting to cluster', status: 'completed', phase: 'init', timestamp: now },
  { id: 2, label: 'Loading context', status: 'completed', phase: 'init', timestamp: now },
];

const planningSteps: AgentThinkingStep[] = [
  { id: 3, label: 'Analyze pod health', status: 'completed', phase: 'planning', timestamp: now },
  { id: 4, label: 'Check node resources', status: 'completed', phase: 'planning', timestamp: now },
  { id: 5, label: 'Review recent events', status: 'running', phase: 'planning', timestamp: now },
  { id: 6, label: 'Gather network policies', status: 'pending', phase: 'planning', timestamp: now },
];

const executingSteps: AgentThinkingStep[] = [
  { id: 7, label: 'Running kubectl get pods', status: 'completed', phase: 'executing', timestamp: now },
  { id: 8, label: 'Fetching node metrics', status: 'running', phase: 'executing', timestamp: now },
];

/** Agent actively working with steps across all phases. */
export const Running: StoryFn<typeof AgentThinkingSteps> = () => (
  <AgentThinkingSteps
    steps={[...initSteps, ...planningSteps, ...executingSteps]}
    isRunning
  />
);

/** All steps completed - shows success styling. */
export const Completed: StoryFn<typeof AgentThinkingSteps> = () => {
  const completedSteps: AgentThinkingStep[] = [
    { id: 1, label: 'Connecting to cluster', status: 'completed', phase: 'init', timestamp: now },
    { id: 2, label: 'Loading context', status: 'completed', phase: 'init', timestamp: now },
    { id: 3, label: 'Analyze pod health', status: 'completed', phase: 'planning', timestamp: now },
    { id: 4, label: 'Check node resources', status: 'completed', phase: 'planning', timestamp: now },
    { id: 5, label: 'Review recent events', status: 'completed', phase: 'planning', timestamp: now },
    { id: 6, label: 'Running kubectl get pods', status: 'completed', phase: 'executing', timestamp: now },
    { id: 7, label: 'Fetching node metrics', status: 'completed', phase: 'executing', timestamp: now },
  ];
  return <AgentThinkingSteps steps={completedSteps} isRunning={false} />;
};

/** Only init phase visible. */
export const InitPhaseOnly: StoryFn<typeof AgentThinkingSteps> = () => (
  <AgentThinkingSteps
    steps={[
      { id: 1, label: 'Connecting to cluster', status: 'completed', phase: 'init', timestamp: now },
      { id: 2, label: 'Loading context', status: 'running', phase: 'init', timestamp: now },
    ]}
    isRunning
  />
);

/** Running state in dark theme - verifies contrast of success colors. */
export const RunningDark: StoryFn<typeof AgentThinkingSteps> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <AgentThinkingSteps
      steps={[...initSteps, ...planningSteps, ...executingSteps]}
      isRunning
    />
  </ThemeProvider>
);

/** All completed in dark theme - verifies green checkmarks contrast. */
export const CompletedDark: StoryFn<typeof AgentThinkingSteps> = () => {
  const completedSteps: AgentThinkingStep[] = [
    { id: 1, label: 'Connecting to cluster', status: 'completed', phase: 'init', timestamp: now },
    { id: 2, label: 'Loading context', status: 'completed', phase: 'init', timestamp: now },
    { id: 3, label: 'Analyze pod health', status: 'completed', phase: 'planning', timestamp: now },
    { id: 4, label: 'Check node resources', status: 'completed', phase: 'planning', timestamp: now },
    { id: 5, label: 'Review recent events', status: 'completed', phase: 'planning', timestamp: now },
    { id: 6, label: 'Running kubectl get pods', status: 'completed', phase: 'executing', timestamp: now },
    { id: 7, label: 'Fetching node metrics', status: 'completed', phase: 'executing', timestamp: now },
  ];
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AgentThinkingSteps steps={completedSteps} isRunning={false} />
    </ThemeProvider>
  );
};
