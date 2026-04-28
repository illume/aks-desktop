// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { registerProjectDetailsTab } from '@kinvolk/headlamp-plugin/lib';
import LogsTab from './components/LogsTab/LogsTab';

registerProjectDetailsTab({
  id: 'logs',
  label: 'Logs',
  icon: 'mdi:text-box-multiple-outline',
  component: LogsTab,
});
