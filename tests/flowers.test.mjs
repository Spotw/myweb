import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const { default: worker, dailyFlowers } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { dailyFlowers };').toString('base64')}`);
const secret = 'daily-flower-test-secret-with-at-least-32-characters';
const time = Date.parse('2026-11-12T03:00:00Z');

test('daily allocation has exactly 36 stems and is stable for each account and Vietnam day', async () => {
  const first = await dailyFlowers('alice', secret, time);
  const later = await dailyFlowers('alice', secret, time + 10 * 60 * 60 * 1000);
  assert.equal(first.day, '2026-11-12');
  assert.equal(first.total, 36);
  assert.equal(Object.keys(first.inventory).length, 16);
  assert.equal(Object.values(first.inventory).reduce((n, value) => n + value, 0), 36);
  assert.ok(Object.values(first.inventory).every(n => Number.isInteger(n) && n >= 0));
  assert.deepEqual(first.inventory, later.inventory);
  assert.deepEqual(first.inventory, (await dailyFlowers('alice', secret, time)).inventory);
  assert.notDeepEqual(first.inventory, (await dailyFlowers('bob', secret, time)).inventory);
  assert.notDeepEqual(first.inventory, (await dailyFlowers('alice', secret, time + 86400000)).inventory);
});

test('allocation switches at 00:00 Vietnam time regardless of UTC day', async () => {
  const before = await dailyFlowers('alice', secret, Date.parse('2026-11-12T16:59:59.999Z'));
  const after = await dailyFlowers('alice', secret, Date.parse('2026-11-12T17:00:00.000Z'));
  assert.equal(before.day, '2026-11-12');
  assert.equal(after.day, '2026-11-13');
  assert.equal(before.nextResetAt, '2026-11-12T17:00:00.000Z');
  assert.equal(after.nextResetAt, '2026-11-13T17:00:00.000Z');
  assert.notDeepEqual(before.inventory, after.inventory);
});

test('authenticated endpoint derives identity and date from the server and never exposes the secret', async () => {
  const env = {
    APP_USERS: JSON.stringify({ alice: 'test-password', bob: 'test-password' }), AUTH_SECRET: secret,
    DB: { prepare() { return { bind() { return this; }, async first() { return null; } }; } }
  };
  const request = (path, cookie, method = 'GET', body) => worker.fetch(new Request(`https://example.test${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: 'https://example.test', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  }), env);
  assert.equal((await request('/api/flowers/daily')).status, 401);
  const login = async username => {
    const response = await request('/api/auth/login', null, 'POST', { username, password: 'test-password' });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const alice = await login('alice'), bob = await login('bob');
  const responses = await Promise.all(Array.from({ length: 5 }, () => request('/api/flowers/daily?username=bob&day=2030-01-01', alice)));
  const results = await Promise.all(responses.map(async response => {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  }));
  for (const result of results) {
    assert.equal(result.username, 'alice');
    assert.notEqual(result.day, '2030-01-01');
    assert.deepEqual(result.inventory, results[0].inventory);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  const bobResult = await (await request('/api/flowers/daily', bob)).json();
  assert.equal(bobResult.username, 'bob');
  assert.notDeepEqual(bobResult.inventory, results[0].inventory);
  assert.equal((await request('/api/flowers/daily', alice, 'POST', { inventory: { rose: 99 } })).status, 405);
});
