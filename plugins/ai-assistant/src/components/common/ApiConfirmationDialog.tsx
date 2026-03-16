import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { ConfirmDialog, EditorDialog } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Typography } from '@mui/material';
import React from 'react';
import YAML from 'yaml';

// Helper function to clean YAML content by removing the |- prefix if present
function cleanYamlContent(content: string): string {
  if (content.trim().startsWith('|-')) {
    return content.trim().substring(2).trim();
  }
  return content.trim();
}

interface ApiConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  method: string;
  url: string;
  body?: string;
  onConfirm: (editedBody?: string, resourceInfo?: string) => void; // Updated to accept edited body
  isLoading?: boolean;
  result?: any;
  error?: string;
}

export default function ApiConfirmationDialog({
  open,
  onClose,
  method,
  url,
  body,
  onConfirm,
}: ApiConfirmationDialogProps) {
  const { t } = useTranslation();
  const upperMethod = method.toUpperCase();
  const [editedBody, setEditedBody] = React.useState('');
  const [resourceInfo, setResourceInfo] = React.useState<{
    kind: string;
    name: string;
    namespace?: string;
  } | null>(null);
  // const cluster = getCluster();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [openEditorDialog, setOpenEditorDialog] = React.useState(true);
  const [showUpdateConfirm, setShowUpdateConfirm] = React.useState(false);

  // Reset internal state when dialog closes so each open cycle starts fresh
  React.useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false);
      setShowUpdateConfirm(false);
      setOpenEditorDialog(true);
      setEditedBody('');
      setResourceInfo(null);
    }
  }, [open]);

  // Auto-confirm GET requests without showing a dialog
  React.useEffect(() => {
    if (open && upperMethod === 'GET') {
      onConfirm();
      onClose();
    }
  }, [open, upperMethod, onConfirm, onClose]);

  React.useEffect(() => {
    if (!open) return;
    if (upperMethod === 'DELETE') {
      setShowDeleteConfirm(true);
    }
    if (body) {
      try {
        const processedBody = cleanYamlContent(body);

        let parsed;
        try {
          parsed = YAML.parse(processedBody);
        } catch (yamlError) {
          try {
            parsed = JSON.parse(processedBody);
          } catch (jsonError) {
            console.warn('Failed to parse body as YAML or JSON:', yamlError, jsonError);
            parsed = null;
          }
        }

        if (parsed) {
          const yamlContent = YAML.stringify(parsed).trim();
          setEditedBody(yamlContent);

          if (parsed.kind && parsed.metadata && parsed.metadata.name) {
            setResourceInfo({
              kind: parsed.kind,
              name: parsed.metadata.name,
              namespace: parsed.metadata.namespace,
            });
          } else {
            setResourceInfo(null);
          }
        } else {
          setEditedBody(processedBody);
          setResourceInfo(null);
        }
      } catch (e) {
        console.warn('Unexpected error during body processing:', e);
        setEditedBody(cleanYamlContent(body));
        setResourceInfo(null);
      }
    } else {
      setEditedBody('');
      setResourceInfo(null);
    }
  }, [open, body, method]);

  React.useEffect(() => {
    if (!open) return;
    if (!resourceInfo && url) {
      const urlParts = url.split('/');
      const nameIndex = urlParts.length - 1;
      if (nameIndex > 0) {
        const resourceTypeIndex = nameIndex - 1;
        let namespaceIndex = -1;

        const namespacePos = urlParts.indexOf('namespaces');
        if (namespacePos >= 0 && namespacePos + 1 < urlParts.length) {
          namespaceIndex = namespacePos + 1;
        }

        if (resourceTypeIndex > 0) {
          setResourceInfo({
            kind: urlParts[resourceTypeIndex],
            name: urlParts[nameIndex],
            namespace: namespaceIndex > 0 ? urlParts[namespaceIndex] : undefined,
          });
        }
      }
    }
  }, [open, url, resourceInfo]);

  React.useEffect(() => {
    if (open && upperMethod === 'PUT' && body && resourceInfo) {
      const processedBody = cleanYamlContent(body);
      try {
        const parsed = YAML.parse(processedBody);
        const yamlContent = YAML.stringify(parsed).trim();
        setEditedBody(yamlContent);
      } catch (e) {
        setEditedBody(processedBody);
      }
      setShowUpdateConfirm(true);
    }
  }, [open, method, body, resourceInfo]);

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onConfirm(JSON.stringify(resourceInfo));
    onClose();
  };

  const handleUpdateConfirm = () => {
    setShowUpdateConfirm(false);
    onConfirm(editedBody, JSON.stringify(resourceInfo));
    onClose();
  };

  function handleSave(items) {
    const newItemDef = Array.isArray(items) ? items[0] : items;

    onConfirm(JSON.stringify(newItemDef));
    setOpenEditorDialog(false);
    onClose();
  }
  const getTitle = () => {
    if (resourceInfo) {
      if (upperMethod === 'DELETE')
        return t('Delete {{kind}}: {{name}}', {
          kind: resourceInfo.kind,
          name: resourceInfo.name,
        });
      if (upperMethod === 'POST')
        return t('Create {{kind}}: {{name}}', {
          kind: resourceInfo.kind,
          name: resourceInfo.name,
        });
      if (upperMethod === 'GET')
        return t('Fetch {{kind}}: {{name}}', {
          kind: resourceInfo.kind,
          name: resourceInfo.name,
        });
      return t('Update {{kind}}: {{name}}', {
        kind: resourceInfo.kind,
        name: resourceInfo.name,
      });
    }

    if (upperMethod === 'DELETE') return t('Delete Resource');
    if (upperMethod === 'POST') return t('Create Resource');
    if (upperMethod === 'GET') return t('Fetch Resource');
    return t('Update Resource');
  };

  if (!url || !method) {
    return null;
  }
  if (showDeleteConfirm) {
    return (
      <ConfirmDialog
        // @ts-ignore
        open={showDeleteConfirm}
        handleClose={() => {
          setShowDeleteConfirm(false);
          onClose();
        }}
        onConfirm={handleDeleteConfirm}
        title={
          resourceInfo ? t('Delete {{kind}}', { kind: resourceInfo.kind }) : t('Delete Resource')
        }
        description={
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {resourceInfo
                ? resourceInfo.namespace
                  ? t(
                      'Are you sure you want to delete the {{kind}} "{{name}}" in namespace "{{namespace}}"?',
                      {
                        kind: resourceInfo.kind,
                        name: resourceInfo.name,
                        namespace: resourceInfo.namespace,
                      }
                    )
                  : t('Are you sure you want to delete the {{kind}} "{{name}}"?', {
                      kind: resourceInfo.kind,
                      name: resourceInfo.name,
                    })
                : t('Are you sure you want to delete this resource?')}
            </Typography>
            {resourceInfo && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
                  {t('Resource details:')}
                </Typography>
                <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                  <strong>{t('Type:')}</strong> {resourceInfo.kind}
                </Typography>
                <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                  <strong>{t('Name:')}</strong> {resourceInfo.name}
                </Typography>
                {resourceInfo.namespace && (
                  <Typography variant="body2" component="div" sx={{ ml: 2 }}>
                    <strong>{t('Namespace:')}</strong> {resourceInfo.namespace}
                  </Typography>
                )}
              </Box>
            )}
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {t('This action cannot be undone.')}
            </Typography>
          </Box>
        }
        confirmLabel={
          resourceInfo
            ? t('Yes, Delete {{kind}}', { kind: resourceInfo.kind })
            : t('Yes, Delete Resource')
        }
      />
    );
  }

  if (upperMethod === 'PUT' && showUpdateConfirm) {
    return (
      <ConfirmDialog
        // @todo: open does exist on ConfirmDialog, but TS is not recognizing it.
        // @ts-ignore
        open={showUpdateConfirm}
        handleClose={() => {
          setShowUpdateConfirm(false);
          onClose();
        }}
        onConfirm={handleUpdateConfirm}
        title={
          resourceInfo
            ? t('Apply Patch to {{kind}}: {{name}}', {
                kind: resourceInfo.kind,
                name: resourceInfo.name,
              })
            : t('Apply Patch to Resource')
        }
        description={
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {t('The following patch will be applied to the resource:')}
            </Typography>
            <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 1 }}>
              <pre>{editedBody}</pre>
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              {t(
                'Are you sure you want to apply this patch? The system will merge this patch with the current resource and update it.'
              )}
            </Typography>
          </Box>
        }
        confirmLabel={t('Yes, Apply Patch')}
      />
    );
  }

  if (upperMethod === 'GET') {
    return null;
  }

  return (
    <EditorDialog
      item={editedBody}
      // @ts-ignore
      open={openEditorDialog}
      onClose={() => setOpenEditorDialog(false)}
      setOpen={setOpenEditorDialog}
      saveLabel={t('Apply')}
      onSave={handleSave}
      title={getTitle()}
    />
  );
}
