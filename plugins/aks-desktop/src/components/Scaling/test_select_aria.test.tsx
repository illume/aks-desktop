// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { DeploymentSelector } from './components/DeploymentSelector';

afterEach(() => { cleanup(); });

test('dump MUI Select ARIA attributes', () => {
  const { container } = render(
    <DeploymentSelector
      selectedDeployment="frontend"
      deployments={[
        { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
      ]}
      loading={false}
      onDeploymentChange={() => {}}
    />
  );

  // Find the combobox element
  const combobox = container.querySelector('[role="combobox"]');
  if (combobox) {
    console.log('Combobox element:', combobox.tagName);
    for (const attr of combobox.attributes) {
      if (attr.name.startsWith('aria-') || attr.name === 'role' || attr.name === 'id') {
        console.log(`  ${attr.name}="${attr.value}"`);
      }
    }
    // Check if the referenced element exists
    const controls = combobox.getAttribute('aria-controls');
    if (controls) {
      const target = document.getElementById(controls);
      console.log(`  aria-controls="${controls}" -> exists: ${!!target}`);
    }
  }
});
