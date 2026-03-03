// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Autocomplete } from '@mui/material';
import { Box, CircularProgress, TextField, Typography } from '@mui/material';
import React, { ReactNode, useMemo } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  showSearch?: boolean;
  className?: string;
  helperText?: ReactNode;
}

/**
 * Searchable select component with enhanced display options
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  loading = false,
  error = false,
  disabled = false,
  placeholder,
  helperText,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? `${t('Select an option')}...`;
  // Sort options alphabetically by label
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [options]);

  return (
    <Autocomplete
      options={sortedOptions}
      disabled={disabled}
      getOptionKey={it => it.value}
      value={sortedOptions.find(it => it.value === value) ?? null}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          helperText={helperText}
          placeholder={resolvedPlaceholder}
          error={error}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {/* The adornment spinner is decorative; MUI Autocomplete already manages
                    aria-busy on the listbox via the loading prop, so this spinner
                    would cause a duplicate announcement if not hidden.
                    MUI: https://mui.com/material-ui/react-autocomplete/#asynchronous-requests */}
                {loading ? <CircularProgress color="inherit" size={20} aria-hidden="true" /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      loading={loading}
      onChange={(e, newValue) => onChange(newValue?.value)}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Typography variant="body1">{option.label}</Typography>
              {option.subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {option.subtitle}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
    />
  );
};
