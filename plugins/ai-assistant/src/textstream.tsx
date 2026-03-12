import { Icon } from '@iconify/react';
import { Alert, Box, CircularProgress, Fab, Typography } from '@mui/material';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentThinkingStep } from './agent/aksAgentManager';
import { Prompt } from './ai/manager';
import AgentThinkingSteps from './components/agent/AgentThinkingSteps';
import ContentRenderer from './ContentRenderer';
import EditorDialog from './editordialog';

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: {
      selectedBackground: string;
    };
  }
  interface PaletteOptions {
    sidebar: {
      selectedBackground: string;
    };
  }
}

const TextStreamContainer = React.memo(function TextStreamContainer({
  history,
  isLoading,
  apiError,
  onOperationSuccess,
  onOperationFailure,
  onYamlAction,
  agentThinkingSteps,
}: {
  history: Prompt[];
  isLoading: boolean;
  apiError: string | null;
  onOperationSuccess?: (response: any) => void;
  onOperationFailure?: (error: any, operationType: string, resourceInfo?: any) => void;
  onYamlAction?: (yaml: string, title: string, resourceType: string, isDelete: boolean) => void;
  agentThinkingSteps?: AgentThinkingStep[];
}) {
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [isDelete, setIsDelete] = useState(false);
  const theme = useTheme();
  // Track if content filter errors were detected
  const [contentFilterErrors, setContentFilterErrors] = useState<boolean>(false);
  // Refs for controlling auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // State to track if user has scrolled up
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
  // Track the last user message count for detecting new user messages
  const lastUserMessageCountRef = useRef<number>(0);
  // Track whether the user was near the bottom *before* the latest history update.
  // This avoids the race where a tall new message pushes the scroll position far
  // from the bottom, causing isNearBottom() to return false even though the user
  // was following the conversation.
  const wasNearBottomRef = useRef<boolean>(true);

  // Check if user is near bottom for auto-scrolling
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return true;

    const container = containerRef.current;
    const threshold = 100; // pixels from bottom to trigger auto-scroll
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Hide the button immediately after clicking it
      setShowScrollButton(false);
    } else if (containerRef.current) {
      // Fallback scrolling method if the ref isn't available
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const scrollToShowNewMessage = useCallback(() => {
    if (!containerRef.current || history.length === 0) return;

    const container = containerRef.current;

    // If the newest message is from the user (e.g. loading state, before assistant
    // response arrives), scroll to bottom so the user message and loading indicator
    // stay visible — don't jump back to a previous assistant message.
    const lastMessage = history[history.length - 1];
    if (lastMessage.role === 'user') {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }

    // Find the latest non-user, non-system message (the newest agent response)
    let lastResponseIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role !== 'user' && history[i].role !== 'system') {
        lastResponseIndex = i;
        break;
      }
    }

    if (lastResponseIndex < 0) return;

    const messageElements = container.querySelectorAll('[data-message-index]');
    const targetElement = Array.from(messageElements).find(
      el => el.getAttribute('data-message-index') === lastResponseIndex.toString()
    ) as HTMLElement;

    if (targetElement) {
      const messageRect = targetElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const messageTop = messageRect.top - containerRect.top + container.scrollTop;

      // Scroll so the top of the new response is at the top of the viewport
      container.scrollTo({
        top: Math.max(0, messageTop),
        behavior: 'smooth',
      });
    }
  }, [history]);

  // Handle container scroll event
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const nearBottom = isNearBottom();
      setShowScrollButton(!nearBottom);
      // Keep track of whether user is near bottom so the history-change effect
      // can use the value that was current *before* React re-renders with new items.
      wasNearBottomRef.current = nearBottom;
    }
  }, [isNearBottom]);

  // Scroll to latest message when new messages appear, but only if already near bottom
  useEffect(() => {
    // Count current user messages
    const currentUserMessageCount = history.filter(prompt => prompt.role === 'user').length;

    // Check if there's a new user message
    const hasNewUserMessage = currentUserMessageCount > lastUserMessageCountRef.current;

    if (hasNewUserMessage) {
      // Always scroll to bottom when there's a new user message
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      // Update the ref with current count
      lastUserMessageCountRef.current = currentUserMessageCount;
    } else if (wasNearBottomRef.current) {
      // Use the pre-update near-bottom state so that a tall new message doesn't
      // cause us to skip auto-scroll (the new content shifts scrollHeight but the
      // user was following the conversation before the update).
      setTimeout(() => {
        scrollToShowNewMessage();
      }, 100);
    } else if (history.length > 0) {
      // If not at bottom, just show the scroll button — don't force scroll
      setShowScrollButton(true);
    }
  }, [history, scrollToBottom, scrollToShowNewMessage]);

  // Auto-scroll only when loading starts (not when it finishes)
  useEffect(() => {
    if (isLoading && wasNearBottomRef.current) {
      // Small delay to ensure content has rendered
      setTimeout(scrollToShowNewMessage, 100);
    }
  }, [isLoading, scrollToShowNewMessage]);

  useEffect(() => {
    // Collect tool responses
    const responseMap: Record<string, string> = {};
    history.forEach(prompt => {
      if (prompt.role === 'tool' && prompt.toolCallId) {
        responseMap[prompt.toolCallId] = prompt.content;
      }

      // Check for content filter errors
      if (prompt.role === 'assistant' && prompt.contentFilterError) {
        setContentFilterErrors(true);
      }
    });
  }, [history]);

  const handleYamlDetected = useCallback((yaml: string, resourceType: string) => {
    // Since we're removing the Delete button, we'll set isDelete to false always
    setEditorContent(yaml);
    setEditorTitle(`Apply ${resourceType}`);
    setResourceType(resourceType);
    setIsDelete(false); // Always false since we don't show delete button
    setShowEditor(true);
  }, []);

  // Memoize the onYamlDetected callback to prevent ContentRenderer from re-rendering
  const memoizedOnYamlDetected = useCallback(
    (yaml: string, resourceType: string) => {
      if (onYamlAction) {
        onYamlAction(yaml, `Apply ${resourceType}`, resourceType, false);
      } else {
        handleYamlDetected(yaml, resourceType);
      }
    },
    [onYamlAction, handleYamlDetected]
  );

  const renderMessage = useCallback(
    (prompt: Prompt, index: number) => {
      if (
        prompt.role === 'system' ||
        (prompt.role === 'tool' && typeof prompt.content !== 'string')
      ) {
        return null;
      }

      // Check if this is a content filter error or if the prompt has its own error
      const isContentFilterError = prompt.role === 'assistant' && prompt.contentFilterError;
      const hasError = prompt.error === true;
      const isJsonError = prompt.error;
      const isJsonSuccess = prompt.success;

      if (prompt.content === '' && prompt.role === 'user') return null;
      if (prompt.content === '' && prompt.role === 'assistant') return null;
      return (
        <Box
          ref={history.length === index + 1 ? lastMessageRef : null}
          data-message-index={index}
          key={index}
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor:
              prompt.role === 'user'
                ? alpha(theme.palette.sidebar.selectedBackground, 0.75)
                : theme.palette.background.paper,
            border: '1px solid',
            borderColor:
              isContentFilterError || hasError || isJsonError
                ? 'error.main'
                : isJsonSuccess
                ? 'success.main'
                : 'divider',
            color: theme.palette.getContrastText(
              prompt.role === 'user'
                ? alpha(theme.palette.sidebar.selectedBackground, 0.75)
                : theme.palette.background.paper
            ),
            ml: prompt.role === 'user' ? 3 : 0,
            mr: prompt.role !== 'user' ? 3 : 0,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
            {prompt.role === 'user' ? 'You' : 'AI Assistant'}
          </Typography>
          <Box sx={{ whiteSpace: 'unset' }}>
            {prompt.role === 'user' ? (
              prompt.content
            ) : (
              <>
                {isContentFilterError || hasError ? (
                  <Alert severity="error" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                    {prompt.content}
                    {isContentFilterError && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                        Tip: Focus your question specifically on Kubernetes administration tasks.
                      </Typography>
                    )}
                  </Alert>
                ) : (
                  <>
                    {/* Use ContentRenderer for all assistant content */}
                    <ContentRenderer
                      content={prompt.content || ''}
                      onYamlDetected={memoizedOnYamlDetected}
                    />
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      );
    },
    [history.length, theme.palette, memoizedOnYamlDetected]
  );

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          maxHeight: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Content filter guidance when errors are detected */}
        {contentFilterErrors && (
          <Alert severity="info" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
            <Typography variant="body2">
              Some requests have been blocked by content filters. Please ensure your questions focus
              only on Kubernetes tasks.
            </Typography>
          </Alert>
        )}

        {history.map((prompt, index) => renderMessage(prompt, index))}

        {isLoading &&
          (agentThinkingSteps && agentThinkingSteps.length > 0 ? (
            <AgentThinkingSteps steps={agentThinkingSteps} isRunning={isLoading} />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography>Processing your request...</Typography>
            </Box>
          ))}

        {/* This is an invisible element that we'll scroll to */}
        <div ref={messagesEndRef} />
      </Box>

      {showScrollButton && (
        <Fab
          color="primary"
          size="small"
          onClick={scrollToBottom}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 2,
          }}
          aria-label="scroll to bottom"
        >
          <Icon icon="mdi:chevron-down" width="20px" />
        </Fab>
      )}

      {/* Show global API error only when there's no history or specific prompt errors */}
      {apiError && history.length === 0 && (
        <Box
          sx={{
            p: 2,
            bgcolor: 'error.light',
            color: 'error.contrastText',
            borderRadius: 1,
            mt: 2,
          }}
        >
          <Typography variant="body2">{apiError}</Typography>
        </Box>
      )}

      {/* Editor Dialog */}
      <EditorDialog
        open={showEditor}
        onClose={() => setShowEditor(false)}
        yamlContent={editorContent}
        title={editorTitle}
        resourceType={resourceType}
        isDelete={isDelete}
        onSuccess={response => {
          if (onOperationSuccess) {
            onOperationSuccess(response);
          }
        }}
        onFailure={(error, operationType, resourceInfo) => {
          if (onOperationFailure) {
            onOperationFailure(error, operationType, resourceInfo);
          }
        }}
      />
    </Box>
  );
});

export default TextStreamContainer;
