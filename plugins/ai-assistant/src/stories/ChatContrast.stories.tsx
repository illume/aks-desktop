// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Box, createTheme, CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ContentRenderer from '../ContentRenderer';

/**
 * Stories to verify the contrast of the agent chat message bubbles.
 * Each story renders user and assistant messages with realistic content
 * in both light and dark themes.
 */

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    sidebar: { selectedBackground: '#555555' },
  },
});

// Approximate the Azure theme used in production
const azureTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3F3682' },
    secondary: { main: '#ecebe9' },
    text: { primary: '#000000', secondary: '#323130' },
    background: { default: '#ffffff', paper: '#ffffff' },
    sidebar: { selectedBackground: '#c2c2c2' },
  },
});

interface MessageBubbleProps {
  sender: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  isSuccess?: boolean;
}

/** Renders a single message bubble matching the styling from textstream.tsx. */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  sender,
  content,
  isError = false,
  isSuccess = false,
}) => {
  // Use a fallback color for sidebar.selectedBackground since custom themes may not have it
  const userBgColor = '#c2c2c2';

  return (
    <Box
      sx={theme => ({
        mb: 2,
        p: 1.5,
        borderRadius: 1,
        bgcolor:
          sender === 'user'
            ? alpha(userBgColor, 0.75)
            : theme.palette.background.paper,
        border: '1px solid',
        borderColor: isError ? 'error.main' : isSuccess ? 'success.main' : 'divider',
        color: theme.palette.getContrastText(
          sender === 'user' ? alpha(userBgColor, 0.75) : theme.palette.background.paper
        ),
        ml: sender === 'user' ? 3 : 0,
        mr: sender !== 'user' ? 3 : 0,
      })}
    >
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
        {sender === 'user' ? 'You' : 'AI Assistant'}
      </Typography>
      <Box sx={{ whiteSpace: 'unset' }}>
        {sender === 'user' ? content : <ContentRenderer content={content} />}
      </Box>
    </Box>
  );
};

const meta: Meta = {
  title: 'AIAssistant/ChatContrast',
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;

const conversationContent = {
  userMessage: 'How do I check the status of my pods?',
  assistantMarkdown: `You can check pod status with the following command:

\`\`\`bash
kubectl get pods --all-namespaces
\`\`\`

Here's what each status means:

| Status | Description |
|--------|-------------|
| Running | Pod is healthy |
| Pending | Waiting for scheduling |
| CrashLoopBackOff | Container keeps crashing |

> **Tip**: Use \`-o wide\` flag for more details including node assignment.`,
  assistantCodeBlock: `Here's a multi-line script to debug:

\`\`\`bash
# Get all failing pods
kubectl get pods --field-selector=status.phase!=Running -A

# Check events for errors
kubectl get events --sort-by='.lastTimestamp' | tail -20
\`\`\`

Run \`kubectl describe pod <name>\` for details on a specific pod.`,
};

/** Full conversation in default light theme. */
export const LightTheme: StoryFn = () => (
  <Box sx={{ maxWidth: 700, p: 2, bgcolor: 'background.default' }}>
    <MessageBubble sender="user" content={conversationContent.userMessage} />
    <MessageBubble sender="assistant" content={conversationContent.assistantMarkdown} />
    <MessageBubble sender="user" content="Can you show me a debugging script?" />
    <MessageBubble sender="assistant" content={conversationContent.assistantCodeBlock} />
    <MessageBubble sender="assistant" content={JSON.stringify({ error: true, content: 'Failed to connect to cluster API server.' })} isError />
    <MessageBubble sender="assistant" content={JSON.stringify({ success: true, content: 'Scaled deployment to 5 replicas.' })} isSuccess />
  </Box>
);

/** Full conversation in dark theme - primary contrast verification. */
export const DarkTheme: StoryFn = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <Box sx={{ maxWidth: 700, p: 2, bgcolor: 'background.default' }}>
      <MessageBubble sender="user" content={conversationContent.userMessage} />
      <MessageBubble sender="assistant" content={conversationContent.assistantMarkdown} />
      <MessageBubble sender="user" content="Can you show me a debugging script?" />
      <MessageBubble sender="assistant" content={conversationContent.assistantCodeBlock} />
      <MessageBubble sender="assistant" content={JSON.stringify({ error: true, content: 'Failed to connect to cluster API server.' })} isError />
      <MessageBubble sender="assistant" content={JSON.stringify({ success: true, content: 'Scaled deployment to 5 replicas.' })} isSuccess />
    </Box>
  </ThemeProvider>
);

/** Full conversation in Azure theme (production colors). */
export const AzureTheme: StoryFn = () => (
  <ThemeProvider theme={azureTheme}>
    <CssBaseline />
    <Box sx={{ maxWidth: 700, p: 2, bgcolor: 'background.default' }}>
      <MessageBubble sender="user" content={conversationContent.userMessage} />
      <MessageBubble sender="assistant" content={conversationContent.assistantMarkdown} />
      <MessageBubble sender="user" content="Can you show me a debugging script?" />
      <MessageBubble sender="assistant" content={conversationContent.assistantCodeBlock} />
    </Box>
  </ThemeProvider>
);
