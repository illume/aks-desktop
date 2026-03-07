// @vitest-environment jsdom
import { virtual } from '@guidepup/virtual-screen-reader';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
}));

// NO mocks for ScalingChart or DeploymentSelector

import { ScalingCardPure } from './ScalingCardPure';

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
];

afterEach(async () => {
  await virtual.stop();
  cleanup();
});

test('guidepup without mocks - no deployment selected', async () => {
  const { container } = render(
    <ScalingCardPure
      deployments={sampleDeployments}
      selectedDeployment=""
      loading={false}
      error={null}
      hpaInfo={null}
      chartData={[]}
      chartLoading={false}
      chartError={null}
      onDeploymentChange={() => {}}
    />
  );

  await virtual.start({ container });

  const phrases: string[] = [];
  for (let i = 0; i < 30; i++) {
    const phrase = await virtual.lastSpokenPhrase();
    phrases.push(phrase);
    if (phrase === 'end of document') break;
    await virtual.next();
  }
  console.log('Phrases:', JSON.stringify(phrases, null, 2));
});

test('guidepup without mocks - with deployment selected', async () => {
  const { container } = render(
    <ScalingCardPure
      deployments={sampleDeployments}
      selectedDeployment="frontend"
      loading={false}
      error={null}
      hpaInfo={{
        name: 'frontend-hpa',
        namespace: 'default',
        minReplicas: 2,
        maxReplicas: 10,
        targetCPUUtilization: 60,
        currentCPUUtilization: 45,
        currentReplicas: 3,
        desiredReplicas: 3,
      }}
      chartData={[{ time: 'Mon, 09:00', Replicas: 2, CPU: 35 }]}
      chartLoading={false}
      chartError={null}
      onDeploymentChange={() => {}}
    />
  );

  await virtual.start({ container });

  const phrases: string[] = [];
  for (let i = 0; i < 50; i++) {
    const phrase = await virtual.lastSpokenPhrase();
    phrases.push(phrase);
    if (phrase === 'end of document') break;
    await virtual.next();
  }
  console.log('Phrases with deployment:', JSON.stringify(phrases, null, 2));
});
