import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { getProviderById } from '../../config/modelConfig';
import type { DetectedProvider } from '../../utils/providerAutoDetect';

interface DetectedProvidersDialogProps {
  open: boolean;
  detectedProviders: DetectedProvider[];
  onConfirm: (selected: DetectedProvider[]) => void;
  onDismiss: () => void;
}

export default function DetectedProvidersDialog({
  open,
  detectedProviders,
  onConfirm,
  onDismiss,
}: DetectedProvidersDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(detectedProviders.map((_, i) => i))
  );

  // Sync selected indices when detectedProviders changes or dialog opens,
  // since the component is mounted even when closed and providers start empty.
  useEffect(() => {
    if (open && detectedProviders.length > 0) {
      setSelected(new Set(detectedProviders.map((_, i) => i)));
    }
  }, [open, detectedProviders]);

  const handleToggle = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedProviders = detectedProviders.filter((_, i) => selected.has(i));
    onConfirm(selectedProviders);
  };

  return (
    <Dialog open={open} onClose={onDismiss} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Icon icon="mdi:auto-fix" width="24px" height="24px" />
          <Typography variant="h6">{t('AI Providers Detected')}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          {t(
            'We detected AI providers available in your environment. Select the ones you want to add to your AI Assistant configuration.'
          )}
        </Typography>

        {detectedProviders.map((provider, index) => {
          const providerDef = getProviderById(provider.providerId);
          return (
            <Box
              key={`${provider.providerId}-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                mb: 1,
                border: '1px solid',
                borderColor: selected.has(index) ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                '&:hover': {
                  borderColor: 'primary.light',
                },
              }}
              onClick={() => handleToggle(index)}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selected.has(index)}
                    onChange={() => handleToggle(index)}
                    onClick={e => e.stopPropagation()}
                    inputProps={{ 'aria-label': provider.displayName }}
                  />
                }
                label=""
                sx={{ mr: 0 }}
              />
              {providerDef && (
                <Icon
                  icon={providerDef.icon}
                  width="28px"
                  height="28px"
                  style={{ marginRight: 12, flexShrink: 0 }}
                />
              )}
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {provider.displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('Detected via {{source}}', { source: provider.source })}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>{t('Not Now')}</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={selected.size === 0}>
          {t('Add Selected')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
