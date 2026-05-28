// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import ArcEnvironmentDialog from './ArcEnvironmentDialog';

/**
 * Page component for the Arc test environment setup/teardown flow.
 * Rendered when the user clicks "Add" on the Arc Test Environment cluster provider.
 */
export default function ArcEnvironmentPage() {
  const [open, setOpen] = useState(true);
  const history = useHistory();

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      history.push('/');
    }, 100);
  };

  return <ArcEnvironmentDialog open={open} onClose={handleClose} />;
}
