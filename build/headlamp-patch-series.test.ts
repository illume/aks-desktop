import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePatchSeries } from './headlamp-patch-series';

test('accepts a contiguous, ordered patch series', () => {
  assert.deepEqual(
    parsePatchSeries('0001-first-change.patch\n0002-second-change.patch\n'),
    ['0001-first-change.patch', '0002-second-change.patch']
  );
});

test('rejects unsafe or unordered patch series entries', () => {
  for (const series of [
    '',
    '../0001-change.patch\n',
    '0002-change.patch\n',
    '0001-change.patch\n0003-other-change.patch\n',
  ]) {
    assert.throws(() => parsePatchSeries(series));
  }
});
