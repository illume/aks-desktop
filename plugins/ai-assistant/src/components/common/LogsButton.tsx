import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Box, Button, Paper, Typography } from '@mui/material';
import React, { useState } from 'react';
import LogsDialog from './LogsDialog';

interface LogsButtonProps {
  logs: string;
  resourceName?: string;
  resourceType?: string;
  namespace?: string;
  containerName?: string;
}

const LogsButton: React.FC<LogsButtonProps> = ({
  logs,
  resourceName = 'resource',
  resourceType = 'Resource',
  namespace,
  containerName,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { t } = useTranslation();

  const getTitle = () => {
    if (containerName) {
      return t('{{resourceType}} {{resourceName}} (container: {{containerName}}) Logs', {
        resourceType,
        resourceName,
        containerName,
      });
    }
    if (namespace) {
      return t('{{resourceType}} {{resourceName}} ({{namespace}}) Logs', {
        resourceType,
        resourceName,
        namespace,
      });
    }
    return t('{{resourceType}} {{resourceName}} Logs', { resourceType, resourceName });
  };

  return (
    <>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          my: 1,
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          backgroundColor: theme =>
            theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              {getTitle()}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Icon icon="mdi:code-braces" />}
            onClick={() => setDialogOpen(true)}
            size="small"
          >
            {t('View in Editor')}
          </Button>
        </Box>
      </Paper>

      <LogsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        logs={logs}
        title={getTitle()}
        resourceName={resourceName}
      />
    </>
  );
};

export default LogsButton;
