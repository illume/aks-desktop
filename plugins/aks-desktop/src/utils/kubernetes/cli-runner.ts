// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { runCommandAsync } from '../azure/az-cli-core';

export async function runCommandWithOutput(
  command: 'az',
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return await runCommandAsync(command, args);
}
