import { describe, it } from 'vitest';
import { _testing } from './aksAgentManager';
import { rawRustAxumApp } from './testFixtures';

const { extractAIAnswer } = _testing;

describe('debug rust output', () => {
  it('prints extracted output', () => {
    const result = extractAIAnswer(rawRustAxumApp);
    console.log('=== EXTRACTED RESULT ===');
    console.log(result);
    console.log('=== END ===');
  });
});
