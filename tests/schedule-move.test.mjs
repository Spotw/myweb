import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const task = (id, extra = {}) => ({ id, title: id, done: false, repeat: 'none', ...extra });

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const migration of ['0003_create_user_profiles.sql', '0005_create_user_accounts.sql', '0009_add_profile_nickname.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const db = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
  const env = {
    DB: db, APP_USERS: JSON.stringify({ alice: 'test-password', bob: 'test-password' }),
    AUTH_SECRET: 'schedule-test-secret-with-at-least-32-characters'
  };
  let cookie = '';
  const request = (path, { method = 'GET', body, origin, anonymous = false } = {}) => worker.fetch(
    new Request(`https://example.test${path}`, {
      method, headers: {
        ...(!anonymous && cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      }, body: body !== undefined ? JSON.stringify(body) : undefined
    }), env
  );
  async function login(username) {
    const response = await request('/api/auth/login', {
      method: 'POST', body: { username, password: 'test-password' }
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
  }
  await login('alice');
  async function put(date, tasks) {
    const response = await request(`/api/tasks/${date}`, { method: 'PUT', body: { tasks } });
    assert.equal(response.status, 200, await response.text());
  }
  async function tasks(date) {
    const response = await request(`/api/tasks?month=${date.slice(0, 7)}`);
    assert.equal(response.status, 200);
    return (await response.json()).tasks[date];
  }
  const move = (sourceDate, targetDate, original, scope = 'occurrence', details = {}) => request('/api/tasks/move', {
    method: 'POST', body: { sourceDate, targetDate, taskId: original.id, scope, details: { ...original, ...details } }
  });
  return { sqlite, request, login, put, tasks, move };
}

test('moving and editing a task across years preserves both days and task details', async (t) => {
  const f = await fixture(t);
  const original = task('moving', { done: true, startTime: '08:30', durationMinutes: 45 });
  await f.put('2026-12-31', [original, task('stay')]);
  await f.put('2027-01-02', [task('neighbor')]);
  assert.equal((await f.move('2026-12-31', '2027-01-02', original, 'occurrence', { title: 'Edited' })).status, 200);
  assert.deepEqual((await f.tasks('2026-12-31')).map(t => t.id), ['stay']);
  const target = await f.tasks('2027-01-02');
  assert.equal(target.length, 2);
  assert.equal(target[1].title, 'Edited');
  assert.equal(target[1].done, true);
  assert.equal(target[1].startTime, '08:30');
  assert.equal(target[1].durationMinutes, 45);
});

test('moving one recurring occurrence preserves other occurrences and creates a standalone task', async (t) => {
  const f = await fixture(t);
  await f.put('2026-11-10', [task('daily', { repeat: 'daily', repeatUntil: '2026-11-20' })]);
  const [original] = await f.tasks('2026-11-11');
  assert.equal((await f.move('2026-11-11', '2026-12-01', original)).status, 200);
  assert.equal((await f.tasks('2026-11-11')).length, 0);
  assert.equal((await f.tasks('2026-11-12')).length, 1);
  const [moved] = await f.tasks('2026-12-01');
  assert.equal(moved.title, 'daily');
  assert.equal(moved.repeat, 'none');
  assert.equal(moved.seriesId, undefined);
});

test('moving a series shifts completed and canceled occurrences atomically', async (t) => {
  const f = await fixture(t);
  await f.put('2026-11-10', [task('daily', { repeat: 'daily', repeatUntil: '2026-11-20' })]);
  const [completed] = await f.tasks('2026-11-11');
  await f.put('2026-11-11', [{ ...completed, done: true }]);
  await f.put('2026-11-12', []);
  const [original] = await f.tasks('2026-11-10');
  assert.equal((await f.move('2026-11-10', '2026-11-13', original, 'series', { title: 'Shifted' })).status, 200);
  assert.equal((await f.tasks('2026-11-10')).length, 0);
  assert.equal((await f.tasks('2026-11-13'))[0].title, 'Shifted');
  assert.equal((await f.tasks('2026-11-14'))[0].done, true);
  assert.equal((await f.tasks('2026-11-14'))[0].title, 'Shifted');
  assert.equal((await f.tasks('2026-11-15')).length, 0);
});

test('invalid dates, full target days and duplicate retries leave the source intact', async (t) => {
  const f = await fixture(t);
  const original = task('moving');
  await f.put('2026-11-10', [original]);
  await f.put('2026-11-11', Array.from({ length: 20 }, (_, i) => task(`task-${i}`)));
  assert.equal((await f.move('2026-11-10', '2026-11-11', original)).status, 400);
  assert.equal((await f.move('2026-11-10', '2026-02-30', original)).status, 400);
  assert.equal((await f.tasks('2026-11-10')).length, 1);
  assert.equal((await f.move('2026-11-10', '2026-11-13', original)).status, 200);
  assert.equal((await f.move('2026-11-10', '2026-11-13', original)).status, 404);
  assert.equal((await f.tasks('2026-11-13')).length, 1);
});

test('moving a standalone task can start a recurring series on the new date', async (t) => {
  const f = await fixture(t);
  const original = task('weekly');
  await f.put('2026-11-10', [original]);
  assert.equal((await f.move('2026-11-10', '2026-12-01', original, 'occurrence', {
    repeat: 'weekly', repeatUntil: '2026-12-31'
  })).status, 200);
  assert.equal((await f.tasks('2026-11-10')).length, 0);
  assert.equal((await f.tasks('2026-12-01'))[0].seriesId, 'weekly');
  assert.equal((await f.tasks('2026-12-08'))[0].seriesId, 'weekly');
});

test('moving and stopping a series keeps earlier occurrences', async (t) => {
  const f = await fixture(t);
  await f.put('2026-11-10', [task('daily', { repeat: 'daily', repeatUntil: '2026-11-20' })]);
  const [original] = await f.tasks('2026-11-12');
  assert.equal((await f.move('2026-11-12', '2026-12-01', original, 'series', {
    repeat: 'none', repeatUntil: null
  })).status, 200);
  assert.equal((await f.tasks('2026-11-11')).length, 1);
  assert.equal((await f.tasks('2026-11-12')).length, 0);
  assert.equal((await f.tasks('2026-11-13')).length, 0);
  assert.equal((await f.tasks('2026-12-01'))[0].repeat, 'none');
});

test('a failed destination write rolls back removal from the source', async (t) => {
  t.mock.method(console, 'error', () => {});
  const f = await fixture(t);
  const original = task('moving');
  await f.put('2026-11-10', [original]);
  const table = f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'schedule_%' AND name NOT LIKE '%_recurrences' AND name NOT LIKE '%_overrides'").get().name;
  f.sqlite.exec(`CREATE TRIGGER fail_move BEFORE INSERT ON "${table}" WHEN NEW.date = '2026-11-11' BEGIN SELECT RAISE(ABORT, 'test move failure'); END`);
  assert.equal((await f.move('2026-11-10', '2026-11-11', original)).status, 500);
  assert.equal((await f.tasks('2026-11-10')).length, 1);
  assert.equal((await f.tasks('2026-11-11')).length, 0);
});

test('moving requires authentication, same origin and ownership', async (t) => {
  const f = await fixture(t);
  const original = task('private');
  await f.put('2026-11-10', [original]);
  const body = { sourceDate: '2026-11-10', targetDate: '2026-11-11', taskId: original.id, scope: 'occurrence', details: original };
  assert.equal((await f.request('/api/tasks/move', { method: 'POST', body, anonymous: true })).status, 401);
  assert.equal((await f.request('/api/tasks/move', { method: 'POST', body, origin: 'https://other.test' })).status, 403);
  await f.login('bob');
  assert.equal((await f.move('2026-11-10', '2026-11-11', original)).status, 404);
  await f.login('alice');
  assert.equal((await f.tasks('2026-11-10')).length, 1);
});
