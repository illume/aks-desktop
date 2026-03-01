// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { PageGrid, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import AzureCliWarning from '../AzureCliWarning';
import { Breadcrumb } from './components/Breadcrumb';
import { STEPS } from './types';

/** Set to `true` locally to enable verbose debug logging. Never enable in production. */
const DEBUG = false;

/**
 * Pure presentational props for {@link CreateAKSProjectPure}.
 * Every value and callback is passed in from the connector — the component
 * itself has no stateful business-logic hooks (only `useTranslation` for i18n).
 */
export interface CreateAKSProjectPureProps {
  /** Zero-based index of the currently visible wizard step. */
  activeStep: number;
  /** Ordered step labels used to render the breadcrumb navigation bar. */
  steps: typeof STEPS;
  /** Advances `activeStep` and clears any Azure resource errors. */
  handleNext: () => void;
  /** Decrements `activeStep`. */
  handleBack: () => void;
  /** Jumps directly to `step`. */
  handleStepClick: (step: number) => void;
  /** Kicks off the namespace-creation request. */
  handleSubmit: () => Promise<void>;
  /** Navigates back to the home route (`/`). */
  onBack: () => void;
  /** `true` while the namespace-creation request is in-flight (shows loading overlay). */
  isCreating: boolean;
  /** Status message updated at each stage of the creation process. */
  creationProgress: string;
  /** Error message when creation failed; `null` otherwise (shows alertdialog overlay). */
  creationError: string | null;
  /** `true` when creation succeeded and the success dialog should be shown. */
  showSuccessDialog: boolean;
  /** Name of the first application entered in the success dialog. */
  applicationName: string;
  /** Setter for {@link applicationName}. */
  setApplicationName: React.Dispatch<React.SetStateAction<string>>;
  /**
   * CLI warning messages from `checkAzureCliAndAksPreview`.
   * Non-empty when the Azure CLI or required extensions are missing.
   */
  cliSuggestions: string[];
  /** Per-step validation result; gates the "Next" / "Create Project" button. */
  validation: { isValid: boolean };
  /** `true` while Azure subscriptions/clusters are loading; adds `aria-busy` to Next button. */
  azureResourcesLoading: boolean;
  /** Navigate to the given URL after the project is created (success dialog). */
  onNavigateToProject: (url: string) => void;
  /** Step-specific content rendered inside the scrollable area (composed by the connector). */
  stepContent: React.ReactNode;
  /** The project name (`formData.projectName`) shown in success/error dialogs. */
  projectName: string;
  /** Dismisses the error alertdialog and navigates back. */
  onDismissError: () => void;
  /** Closes the success dialog and navigates back without further action. */
  onCancelSuccess: () => void;
}

/**
 * Pure presentational component for the Create AKS Project wizard.
 *
 * Renders the breadcrumb navigation, scrollable step content area, navigation
 * footer, and the full-screen creation overlays (loading, error alertdialog,
 * success dialog). All overlays carry complete ARIA attributes for screen
 * reader accessibility. Contains no stateful business-logic hooks (only `useTranslation`
 * for i18n) — all state comes from
 * {@link useCreateAKSProjectWizard} via the connector.
 *
 * @see {@link useCreateAKSProjectWizard} for the hook that drives this component.
 * @see {@link CreateAKSProjectPureProps} for the full prop contract.
 */

export default function CreateAKSProjectPure({
  activeStep,
  steps,
  handleNext,
  handleBack,
  handleStepClick,
  handleSubmit,
  onBack,
  isCreating,
  creationProgress,
  creationError,
  showSuccessDialog,
  applicationName,
  setApplicationName,
  cliSuggestions,
  validation,
  azureResourcesLoading,
  onNavigateToProject,
  stepContent,
  projectName,
  onDismissError,
  onCancelSuccess,
}: CreateAKSProjectPureProps) {
  const { t } = useTranslation();

  return (
    // @ts-ignore -- headlamp PageGrid typings are incomplete; `sx`/layout props are supported at runtime but not in the type definition.
    <PageGrid maxWidth="lg" sx={{ margin: '0 auto' }}>
      <SectionBox
        title={t('New Project')}
        subtitle={t('Set up and configure a new project in Azure Kubernetes Service (AKS)')}
        backLink="/"
      >
        {cliSuggestions.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <AzureCliWarning suggestions={cliSuggestions} />
          </Box>
        )}

        {/* aria-busy signals to assistive technologies that this region is being updated
            while the project creation request is in-flight. aria-describedby links the Card
            to the progress indicator so AT knows which region is loading.
            MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
            MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby */}
        <Card
          elevation={2}
          sx={{ position: 'relative' }}
          aria-describedby={isCreating ? 'aksd-create-aks-project-progress' : undefined}
          aria-busy={isCreating || undefined}
        >
          {/* Loading Overlay */}
          {isCreating && (
            <Box
              sx={(theme: any) => ({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: theme.palette.background.muted,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                borderRadius: '4px',
              })}
            >
              {/* id links this progress bar to the Card's aria-describedby above, so assistive
                  technologies know which region is loading. aria-label provides an accessible
                  name for the progressbar role since there is no visible text label.
                  MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/progressbar_role
                  MUI: https://mui.com/material-ui/react-progress/#accessibility */}
              <CircularProgress
                id="aksd-create-aks-project-progress"
                size={60}
                aria-label={t('Creating Project')}
              />
              <Typography variant="h6" component="p" sx={{ mt: 2, mb: 1 }}>
                {t('Creating Project')}...
              </Typography>
              {/* aria-live="polite" causes assistive technologies to announce each status
                  message update after the current AT output finishes, keeping users informed
                  of progress without interrupting them.
                  MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live */}
              <Typography
                aria-live="polite"
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center', maxWidth: 400, px: 2 }}
              >
                {creationProgress}
              </Typography>
            </Box>
          )}

          {/* inert hides the underlying interactive content from assistive technologies
              AND prevents keyboard focus from reaching it while the loading overlay is active.
              inert is used instead of aria-hidden because aria-hidden alone does not prevent
              focus, which violates the aria-hidden-focus axe rule.
              MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert */}
          <CardContent
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore – inert is a valid HTML attribute; MUI CardContent typings omit it
            {...(isCreating ? { inert: '' } : {})}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              p: 0,
            }}
          >
            {/* Breadcrumbs */}
            <Breadcrumb
              steps={steps.map(step => t(step))}
              activeStep={activeStep}
              onStepClick={handleStepClick}
            />

            {/* Step Content */}
            <Box sx={{ p: 3 }}>{stepContent}</Box>

            {/* Footer with navigation buttons */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center' }}>
              {/* Left side - Back and Cancel buttons */}
              <Box>
                {activeStep > 0 && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleBack}
                    disabled={isCreating}
                  >
                    {t('Back')}
                  </Button>
                )}
                {activeStep === 0 && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={onBack}
                    disabled={isCreating}
                  >
                    {t('Cancel')}
                  </Button>
                )}
              </Box>

              {/* Right side - Next/Create Project button */}
              <Box sx={{ ml: 'auto' }}>
                {activeStep === steps.length - 1 ? (
                  <Button
                    size="large"
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isCreating || !validation.isValid}
                    aria-busy={isCreating || undefined}
                  >
                    {t('Create Project')}
                  </Button>
                ) : (
                  /* aria-busy signals to assistive technologies that the button is performing
                     an async operation (loading Azure resources). The CircularProgress spinner
                     is hidden from the accessibility tree with aria-hidden because the button
                     text ("Loading...") already conveys the busy state to screen readers.
                     MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
                     MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden */
                  <Button
                    size="large"
                    variant="contained"
                    onClick={handleNext}
                    disabled={azureResourcesLoading || !validation.isValid}
                    aria-busy={azureResourcesLoading || undefined}
                  >
                    {azureResourcesLoading ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CircularProgress size={16} color="inherit" aria-hidden="true" />
                        {t('Loading')}...
                      </Box>
                    ) : (
                      t('Next')
                    )}
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Success dialog — uses MUI Dialog so focus management and focus trapping
            are handled automatically, satisfying the role="dialog" accessibility
            requirements without any custom autoFocus or inert-background logic.
            MUI: https://mui.com/material-ui/react-dialog/#accessibility */}
        <Dialog
          open={showSuccessDialog}
          onClose={onCancelSuccess}
          aria-labelledby="aksd-create-aks-project-success-title"
          aria-describedby="aksd-create-aks-project-success-desc"
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { border: '1px solid', borderColor: 'success.main', textAlign: 'center' },
          }}
        >
          <DialogTitle
            id="aksd-create-aks-project-success-title"
            sx={{ typography: 'h4', color: 'success.main', fontWeight: 'bold', pt: 4 }}
          >
            {/* aria-hidden: decorative icon; the adjacent text already names the dialog */}
            <Icon
              icon="mdi:check-circle"
              width={80}
              height={80}
              aria-hidden="true"
              style={{ display: 'block', margin: '0 auto 16px' }}
            />
            {t('Project Created Successfully!')}
          </DialogTitle>
          <DialogContent>
            {/* id provides the accessible description for this dialog via aria-describedby.
                component="p" keeps h6 visual styling but renders as a <p> element so the
                heading hierarchy (DialogTitle=h2 → this) stays valid. */}
            <Typography
              id="aksd-create-aks-project-success-desc"
              variant="h6"
              component="p"
              sx={{ mb: 3, color: 'text.secondary' }}
            >
              {t('Your AKS project "{{projectName}}" has been created and is ready to use.', {
                projectName,
              })}
            </Typography>
            {/* MUI TextField manages the label–input association via htmlFor/id automatically.
                MUI: https://mui.com/material-ui/react-text-field/#accessibility
                autoFocus moves keyboard focus into the dialog when it opens. MUI Dialog handles
                focus trapping; autoFocus on the first interactive element ensures keyboard and
                screen reader users land on the input immediately without extra navigation.
                MUI: https://mui.com/material-ui/react-dialog/#accessibility */}
            <TextField
              label={t('Application name')}
              fullWidth
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={applicationName}
              onChange={e => setApplicationName(e.target.value)}
              placeholder={`${t('Enter application name')}...`}
              helperText={t(
                'Enter a name for your first application to get started with deployment.'
              )}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="outlined" onClick={onCancelSuccess}>
              {t('Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (applicationName.trim()) {
                  const encodedProject = encodeURIComponent(projectName);
                  const appName = encodeURIComponent(applicationName.trim());
                  const projectUrl = `/project/${encodedProject}?openDeploy=true&applicationName=${appName}`;
                  if (DEBUG) console.log('navigating to project page', projectUrl);
                  onNavigateToProject(projectUrl);
                }
              }}
              disabled={!applicationName.trim()}
            >
              {t('Create Application')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Error Dialog — role="alertdialog" because the user must interact with the
            Cancel button to dismiss it. MUI Dialog provides built-in focus trapping,
            focus management, and aria-modal handling automatically.
            role is set via PaperProps so it lands on the same Paper element that MUI
            puts aria-labelledby on; if set on the Dialog root prop it goes to the
            outer MuiModal-root div which has no aria-labelledby (axe: aria-dialog-name).
            MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alertdialog_role
            MUI: https://mui.com/material-ui/react-dialog/#accessibility */}
        <Dialog
          open={!!creationError}
          onClose={onDismissError}
          aria-labelledby="aksd-create-aks-project-error-title"
          aria-describedby="aksd-create-aks-project-error-desc"
          maxWidth="md"
          fullWidth
          PaperProps={{
            role: 'alertdialog',
            sx: {
              border: '2px solid',
              borderColor: 'error.main',
              textAlign: 'center',
              maxWidth: 700,
            },
          }}
        >
          <DialogTitle
            id="aksd-create-aks-project-error-title"
            sx={{ typography: 'h5', color: 'error.main', fontWeight: 'bold', pt: 4 }}
          >
            {/* aria-hidden: decorative icon; the adjacent text already names the dialog */}
            <Icon
              icon="mdi:alert-circle"
              width={64}
              height={64}
              aria-hidden="true"
              style={{ display: 'block', margin: '0 auto 12px' }}
            />
            {t('Project Creation Failed')}
          </DialogTitle>
          <DialogContent
            // tabIndex={0} makes this scrollable region keyboard-accessible so keyboard users
            // can scroll through long error messages. Required by the scrollable-region-focusable
            // axe rule: https://dequeuniversity.com/rules/axe/4.11/scrollable-region-focusable
            tabIndex={0}
            sx={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            {/* id provides the accessible description for this alertdialog via aria-describedby */}
            <Typography
              id="aksd-create-aks-project-error-desc"
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: 1.4,
                backgroundColor: theme =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(211, 47, 47, 0.15)'
                    : 'rgba(211, 47, 47, 0.08)',
                color: 'text.primary',
                padding: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: theme =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(211, 47, 47, 0.5)'
                    : 'rgba(211, 47, 47, 0.3)',
              }}
            >
              {creationError}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            {/* autoFocus moves keyboard focus to Cancel when the alertdialog opens, satisfying
                the MDN requirement that focus lands on the dismiss control immediately.
                MUI Dialog handles focus trapping; autoFocus ensures the correct initial target.
                MDN: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alertdialog_role */}
            <Button
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              variant="outlined"
              color="inherit"
              onClick={onDismissError}
              sx={{ minWidth: 120 }}
            >
              {t('Cancel')}
            </Button>
          </DialogActions>
        </Dialog>
      </SectionBox>
    </PageGrid>
  );
}
