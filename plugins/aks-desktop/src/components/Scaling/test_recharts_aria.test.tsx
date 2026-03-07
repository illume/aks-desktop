// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ScalingChart } from './components/ScalingChart';

afterEach(() => { cleanup(); });

test('dump recharts aria attributes', () => {
  const { container } = render(
    <div style={{ width: 400, height: 300 }}>
      <ScalingChart
        chartData={[{ time: 'Mon, 09:00', Replicas: 2, CPU: 35 }]}
        loading={false}
        error={null}
      />
    </div>
  );
  
  // Find all elements with aria-* attributes
  const allElements = container.querySelectorAll('*');
  let ariaCount = 0;
  allElements.forEach(el => {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('aria-') || attr.name === 'role') {
        console.log(`${el.tagName}.${el.className?.substring?.(0,40)}: ${attr.name}="${attr.value}"`);
        ariaCount++;
      }
    }
  });
  console.log(`Total ARIA attributes: ${ariaCount}`);
});
