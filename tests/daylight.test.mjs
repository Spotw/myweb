import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/flower-studio/daylight.js', import.meta.url), 'utf8');
const { daylightAt } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('ocean night lighting runs from 19:00 through midnight until 05:00 local time', () => {
  for (const [hour, minute, second, expected] of [
    [18, 59, 59, false], [19, 0, 0, true], [23, 59, 59, true],
    [0, 0, 0, true], [4, 59, 59, true], [5, 0, 0, false], [12, 0, 0, false],
  ]) {
    const state = daylightAt(new Date(2026, 10, 13, hour, minute, second));
    assert.equal(state.night, expected, `${hour}:${minute}:${second}`);
    assert.ok(Number.isFinite(state.daylight));
  }
});
