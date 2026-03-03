// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import MonacoEditor from '@monaco-editor/react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { enableMonacoTabFocusMode } from '../../../utils/shared/monacoTabFocus';
import { K8sObject } from '../hooks/useYamlObjects';

/**
 * Pure presentational props for {@link DeployPure}.
 * All data and callbacks come from the parent — the component itself has no
 * stateful business-logic hooks (only `useTranslation` for i18n).
 */
export interface DeployPureProps {
  /** The selected deploy source; controls which review UI is rendered. */
  sourceType: 'container' | 'yaml' | null;
  /** Target namespace shown in the container-path subtitle. */
  namespace?: string;
  /** Generated YAML for the container-source review editor (read-only Monaco). */
  containerPreviewYaml: string;
  /**
   * Outcome of the deploy attempt, or `null` before any attempt.
   * Renders a `role="alert"` box (error) or `role="status"` box (success).
   */
  deployResult: 'success' | 'error' | null;
  /** Human-readable message describing the deploy outcome. */
  deployMessage: string;
  /** Parsed Kubernetes resource summaries shown as review cards (YAML source path). */
  yamlObjects: K8sObject[];
}

/**
 * Pure presentational component for the Deploy wizard review step.
 *
 * Renders either a Monaco editor (container source) or resource-summary cards
 * (YAML source), plus an accessible status/error banner when a deploy result
 * is available. Contains no stateful hooks — all business-logic state comes from props.
 *
 * @see {@link useYamlObjects} for the YAML parsing hook that populates `yamlObjects`.
 * @see {@link DeployPureProps} for the full prop contract.
 */

export default function DeployPure({
  sourceType,
  namespace,
  containerPreviewYaml,
  deployResult,
  deployMessage,
  yamlObjects,
}: DeployPureProps) {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('Review & Deploy')}
      </Typography>
      {deployResult && (
        /* role="alert" (for errors) causes AT to immediately announce the message as an
           assertive live region — appropriate for a failed deploy that needs urgent attention.
           role="status" (for success) uses a polite live region so the confirmation is
           announced without interrupting the current screen reader output.
           Both roles ensure the result box is announced when it is dynamically inserted.
           MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role
           MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role */
        <Box
          role={deployResult === 'error' ? 'alert' : 'status'}
          sx={{
            mb: 1,
            p: 1.5,
            border: '1px solid',
            borderColor: deployResult === 'success' ? 'success.main' : 'error.main',
            borderRadius: 1,
            color: deployResult === 'success' ? 'success.main' : 'error.main',
            backgroundColor: theme =>
              deployResult === 'success'
                ? theme.palette.mode === 'dark'
                  ? 'rgba(46, 125, 50, 0.12)'
                  : 'rgba(46, 125, 50, 0.08)'
                : theme.palette.mode === 'dark'
                ? 'rgba(211, 47, 47, 0.12)'
                : 'rgba(211, 47, 47, 0.08)',
          }}
        >
          {deployMessage}
        </Box>
      )}
      {sourceType === 'container' ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('Generated Kubernetes manifests (namespace: {{namespace}})', {
              namespace: namespace || t('default'),
            })}
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <MonacoEditor
              height="60vh"
              language="yaml"
              value={containerPreviewYaml}
              onChange={() => {}}
              /* enableMonacoTabFocusMode sets Monaco's global TabFocus singleton so Tab
                 moves browser focus out of this read-only preview editor. */
              onMount={enableMonacoTabFocusMode}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                automaticLayout: true,
              }}
            />
          </Box>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('Resources to be deployed ({{count}} object)', {
              count: yamlObjects.length,
            })}
          </Typography>
          <Stack spacing={1.5}>
            {yamlObjects.map((obj, index) => (
              <Paper
                key={`${obj.kind}|${obj.namespace ?? 'default'}|${obj.name}|${index}`}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={obj.kind}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600, minWidth: 120 }}
                  />
                  <Typography variant="body1" sx={{ fontWeight: 500, flex: 1 }}>
                    {obj.name}
                  </Typography>
                  {obj.namespace && (
                    <Chip
                      label={t('namespace: {{namespace}}', { namespace: obj.namespace })}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
