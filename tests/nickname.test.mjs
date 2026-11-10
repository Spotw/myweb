import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const name of ['0003_create_user_profiles.sql', '0005_create_user_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  sqlite.exec("INSERT INTO user_profiles (username, full_name, password_salt, password_hash) VALUES ('existing', 'Original name', 'salt', 'hash')");
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  sqlite.exec(readFileSync(new URL('../migrations/0009_add_profile_nickname.sql', import.meta.url), 'utf8'));
  assert.deepEqual(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(), tables);
  const db = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
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
    DB: db, APP_USERS: JSON.stringify({ 'duyvu@pvdv': 'test-password', alice: 'test-password', bob: 'test-password' }),
    AUTH_SECRET: 'nickname-test-secret-with-at-least-32-characters'
  };
  async function request(path, { method = 'GET', body, cookie, origin } = {}) {
    return worker.fetch(new Request(`https://example.test${path}`, {
      method, headers: {
        ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      }, body: body !== undefined ? JSON.stringify(body) : undefined
    }), env);
  }
  async function login(username, password = 'test-password') {
    const response = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    assert.equal(response.status, 200);
    return { cookie: response.headers.get('set-cookie').split(';')[0], data: await response.json() };
  }
  return { sqlite, request, login };
}

test('migration adds only nickname and preserves existing profile data', (t) => {
  const { sqlite } = fixture(t);
  const profile = sqlite.prepare("SELECT * FROM user_profiles WHERE username = 'existing'").get();
  assert.equal(profile.nickname, '');
  assert.equal(profile.full_name, 'Original name');
  assert.equal(profile.password_hash, 'hash');
});

test('administrator creates nickname; login/session reflect subsequent self edits', async (t) => {
  const { request, login } = fixture(t);
  const admin = await login('duyvu@pvdv');
  const created = await request('/api/auth/accounts', {
    method: 'POST', cookie: admin.cookie,
    body: { username: 'New.User', password: 'new-password', nickname: '  Nguyễn An  ' }
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).nickname, 'Nguyễn An');
  const user = await login('new.user', 'new-password');
  assert.equal(user.data.nickname, 'Nguyễn An');
  const edited = await request('/api/auth/profile', { method: 'PUT', cookie: user.cookie, body: { nickname: 'An mới' } });
  assert.equal(edited.status, 200);
  assert.equal((await (await request('/api/auth/session', { cookie: user.cookie })).json()).nickname, 'An mới');
  assert.equal((await login('new.user', 'new-password')).data.nickname, 'An mới');
  const duplicate = await request('/api/auth/accounts', {
    method: 'POST', cookie: admin.cookie,
    body: { username: 'NEW.USER', password: 'other-password', nickname: 'Overwrite' }
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await login('new.user', 'new-password')).data.nickname, 'An mới');
});

test('only own nickname can be edited; empty nickname and configured accounts work', async (t) => {
  const { sqlite, request, login } = fixture(t);
  const alice = await login('alice');
  sqlite.exec("INSERT INTO user_profiles (username, nickname, password_salt, password_hash) VALUES ('bob', 'Bob', 'salt', 'hash')");
  await request('/api/auth/profile', { method: 'PUT', cookie: alice.cookie, body: { username: 'bob', nickname: 'Alice' } });
  assert.equal(sqlite.prepare("SELECT nickname FROM user_profiles WHERE username = 'bob'").get().nickname, 'Bob');
  assert.equal((await (await request('/api/auth/profile', { cookie: alice.cookie })).json()).nickname, 'Alice');
  await request('/api/auth/profile', { method: 'PUT', cookie: alice.cookie, body: { nickname: '   ' } });
  assert.equal((await login('alice')).data.nickname, '');
  assert.equal(sqlite.prepare("SELECT password_hash FROM user_profiles WHERE username = 'bob'").get().password_hash, 'hash');
  assert.equal((await request('/api/auth/accounts', { method: 'POST', cookie: alice.cookie, body: {} })).status, 403);
});

test('invalid nicknames, unauthenticated and cross-origin writes are rejected', async (t) => {
  const { request, login } = fixture(t);
  assert.equal((await request('/api/auth/profile', { method: 'PUT', body: { nickname: 'x' } })).status, 401);
  const admin = await login('duyvu@pvdv');
  for (const nickname of [null, 123, {}, 'x'.repeat(51), 'line\nbreak', 'bad\u0000name']) {
    assert.equal((await request('/api/auth/profile', { method: 'PUT', cookie: admin.cookie, body: { nickname } })).status, 400);
    assert.equal((await request('/api/auth/accounts', { method: 'POST', cookie: admin.cookie, body: { username: 'invalid', password: 'test-password', nickname } })).status, 400);
  }
  assert.equal((await request('/api/auth/profile', { method: 'PUT', cookie: admin.cookie, origin: 'https://other.test', body: { nickname: 'x' } })).status, 403);
  assert.equal((await request('/api/auth/profile', { method: 'POST', cookie: admin.cookie, body: { nickname: 'x' } })).status, 405);
});

test('account creation without nickname remains compatible', async (t) => {
  const { request, login } = fixture(t);
  const admin = await login('duyvu@pvdv');
  assert.equal((await request('/api/auth/accounts', {
    method: 'POST', cookie: admin.cookie, body: { username: 'legacy', password: 'test-password' }
  })).status, 201);
  assert.equal((await login('legacy')).data.nickname, '');
});

test('nickname and password updates preserve each other for both account types', async (t) => {
  const { request, login } = fixture(t);
  const admin = await login('duyvu@pvdv');
  await request('/api/auth/accounts', {
    method: 'POST', cookie: admin.cookie, body: { username: 'managed', password: 'test-password' }
  });
  for (const username of ['alice', 'managed']) {
    const user = await login(username);
    await request('/api/auth/profile', { method: 'PUT', cookie: user.cookie, body: { nickname: 'Trước' } });
    assert.equal((await request('/api/auth/password', {
      method: 'POST', cookie: user.cookie,
      body: { current_password: 'test-password', new_password: 'changed-password' }
    })).status, 200);
    assert.equal((await login(username, 'changed-password')).data.nickname, 'Trước');
    await request('/api/auth/profile', { method: 'PUT', cookie: user.cookie, body: { nickname: 'Sau' } });
    assert.equal((await login(username, 'changed-password')).data.nickname, 'Sau');
  }
});

test('profile write failure rolls back the new account', async (t) => {
  const { sqlite, request, login } = fixture(t);
  const admin = await login('duyvu@pvdv');
  sqlite.exec("CREATE TRIGGER fail_profile BEFORE INSERT ON user_profiles BEGIN SELECT RAISE(ABORT, 'test profile failure'); END");
  const previousError = console.error;
  console.error = () => {};
  try {
    const response = await request('/api/auth/accounts', {
      method: 'POST', cookie: admin.cookie, body: { username: 'rollback', password: 'test-password', nickname: 'Test' }
    });
    assert.equal(response.status, 500);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM user_accounts WHERE username = 'rollback'").get().count, 0);
  } finally {
    console.error = previousError;
  }
});
