const DAY_COUNT = 7;
const MAX_LENGTH = 5000;
const MAX_TASKS_PER_DAY = 20;
const MAX_TASK_TITLE_LENGTH = 100;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const SESSION_COOKIE = 'myweb_session';
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.@+-]{0,253}$/;
const ENTRY_LIMITS = { mo_ta: 300, loai_thong_tin: 100, noi_dung: 10000 };
const encoder = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });

const daysInMonth = (year, month) => {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isValidDate = (year, month, day) =>
  year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);

const isValidTaskList = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS_PER_DAY) return false;

  const ids = new Set();
  return tasks.every((task) => {
    if (
      !task ||
      typeof task.id !== 'string' ||
      task.id.length === 0 ||
      task.id.length > 80 ||
      typeof task.title !== 'string' ||
      task.title.trim().length === 0 ||
      task.title.length > MAX_TASK_TITLE_LENGTH ||
      typeof task.done !== 'boolean' ||
      ids.has(task.id)
    ) {
      return false;
    }
    ids.add(task.id);
    return true;
  });
};

function getUsers(env) {
  if (!env.APP_USERS) {
    throw new Error('Thiếu cấu hình bí mật APP_USERS.');
  }
  if (typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET phải là chuỗi bí mật dài ít nhất 32 ký tự.');
  }

  const normalizedUsers = new Map();
  const userConfigs = [
    ['APP_USERS', env.APP_USERS],
    ['APP_USERS_EXTRA', env.APP_USERS_EXTRA]
  ].filter(([, config]) => config);

  for (const [configName, userConfig] of userConfigs) {
    let users;
    try {
      users = JSON.parse(userConfig);
    } catch {
      throw new Error(`Cấu hình ${configName} không phải JSON hợp lệ.`);
    }

    if (!users || typeof users !== 'object' || Array.isArray(users)) {
      throw new Error(`Cấu hình ${configName} phải là một đối tượng JSON.`);
    }

    for (const [username, password] of Object.entries(users)) {
      if (
        !USERNAME_PATTERN.test(username) ||
        typeof password !== 'string' ||
        password.length < 1 ||
        password.length > 1024
      ) {
        throw new Error(`Cấu hình ${configName} có tên tài khoản hoặc mật khẩu không hợp lệ.`);
      }
      const normalizedName = username.toLowerCase();
      if (normalizedUsers.has(normalizedName)) {
        throw new Error('Cấu hình tài khoản có tên đăng nhập trùng nhau.');
      }
      normalizedUsers.set(normalizedName, { username, password });
    }
  }

  if (normalizedUsers.size === 0) throw new Error('Cấu hình APP_USERS chưa có tài khoản.');
  return normalizedUsers;
}

const toBase64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

async function signSession(username, expiresAt, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ username, expiresAt })));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function readSession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const users = getUsers(env);
  const payload = token.slice(0, separator);
  let signature;
  let session;
  try {
    signature = fromBase64Url(token.slice(separator + 1));
    session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload));
  if (!valid) return null;

  const configuredUser = users.get(String(session.username).toLowerCase());
  if (
    !configuredUser ||
    configuredUser.username !== session.username ||
    !Number.isSafeInteger(session.expiresAt) ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return { username: configuredUser.username };
}

function passwordsMatch(candidate, expected) {
  const candidateBytes = encoder.encode(candidate);
  const expectedBytes = encoder.encode(expected);
  let difference = candidateBytes.length ^ expectedBytes.length;
  const length = Math.max(candidateBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (candidateBytes[index] || 0) ^ (expectedBytes[index] || 0);
  }
  return difference === 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const hasValidOrigin = (request) => {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
};

const tableForUser = (username) => {
  if (!USERNAME_PATTERN.test(username)) throw new Error('Tên tài khoản không hợp lệ.');
  return `schedule_${username.toLowerCase()}`;
};

async function ensureScheduleTable(db, username) {
  const usernameHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(username.toLowerCase()))
  );
  const suffix = Array.from(usernameHash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const table = tableForUser(suffix);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS "${table}" (date TEXT PRIMARY KEY, tasks TEXT NOT NULL)`
  ).run();
  return table;
}

async function handleAuth(request, env, pathname) {
  if (
    ['POST', 'PUT', 'DELETE'].includes(request.method) &&
    pathname.startsWith('/api/auth/') &&
    !hasValidOrigin(request)
  ) {
    return json({ error: 'Nguồn gửi yêu cầu không hợp lệ.' }, 403);
  }

  if (pathname === '/api/auth/session') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const session = await readSession(request, env);
    return json({ authenticated: Boolean(session), username: session?.username || null });
  }

  if (pathname === '/api/auth/login') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await readJson(request);
    if (
      !body ||
      typeof body.username !== 'string' ||
      typeof body.password !== 'string' ||
      body.username.length > 254 ||
      body.password.length > 1024
    ) {
      return json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác.' }, 400);
    }

    const users = getUsers(env);
    const configuredUser = USERNAME_PATTERN.test(body.username)
      ? users.get(body.username.toLowerCase())
      : null;
    const candidatePassword = body.password;
    const expectedPassword = configuredUser?.password || env.AUTH_SECRET;
    if (!configuredUser || !passwordsMatch(candidatePassword, expectedPassword)) {
      return json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác.' }, 401);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const token = await signSession(configuredUser.username, expiresAt, env.AUTH_SECRET);
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json(
      { authenticated: true, username: configuredUser.username },
      200,
      {
        'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`
      }
    );
  }

  if (pathname === '/api/auth/logout') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json(
      { ok: true },
      200,
      {
        'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
      }
    );
  }

  return null;
}

async function handleSchedule(request, db, username, pathname, url) {
  if (pathname === '/api/tasks') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    const month = url.searchParams.get('month') || '';
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match || !isValidDate(Number(match[1]), Number(match[2]), 1)) {
      return json({ error: 'Tháng không hợp lệ' }, 400);
    }

    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const days = daysInMonth(year, monthNumber);
    const firstKey = `${month}-01`;
    const lastKey = `${month}-${String(days).padStart(2, '0')}`;
    const table = await ensureScheduleTable(db, username);
    const { results } = await db.prepare(
      `SELECT date, tasks FROM "${table}" WHERE date >= ? AND date <= ?`
    ).bind(firstKey, lastKey).all();
    const tasksByDate = Object.fromEntries(
      Array.from({ length: days }, (_, index) => [
        `${month}-${String(index + 1).padStart(2, '0')}`,
        []
      ])
    );
    for (const { date, tasks } of results) {
      const parsedTasks = JSON.parse(tasks);
      if (!isValidTaskList(parsedTasks)) throw new Error(`Dữ liệu công việc không hợp lệ: ${date}`);
      tasksByDate[date] = parsedTasks;
    }
    return json({ tasks: tasksByDate });
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/(\d{4})-(\d{2})-(\d{2})$/);
  if (taskMatch) {
    if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
    const [, year, month, day] = taskMatch;
    if (!isValidDate(Number(year), Number(month), Number(day))) {
      return json({ error: 'Ngày không hợp lệ' }, 400);
    }

    const body = await readJson(request);
    if (!body || !isValidTaskList(body.tasks)) {
      return json({ error: `Mỗi ngày cần có tối đa ${MAX_TASKS_PER_DAY} công việc hợp lệ.` }, 400);
    }

    const date = `${year}-${month}-${day}`;
    const table = await ensureScheduleTable(db, username);
    if (body.tasks.length === 0) {
      await db.prepare(`DELETE FROM "${table}" WHERE date = ?`).bind(date).run();
    } else {
      await db.prepare(
        `INSERT INTO "${table}" (date, tasks) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET tasks = excluded.tasks`
      ).bind(date, JSON.stringify(body.tasks)).run();
    }
    return json({ ok: true });
  }

  return null;
}

async function handleEntries(request, db, pathname) {
  if (pathname === '/api/entries') {
    if (request.method === 'GET') {
      const { results } = await db.prepare(
        'SELECT id, mo_ta, loai_thong_tin, noi_dung, created_at FROM entries ORDER BY id DESC'
      ).all();
      return json(results);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Nội dung gửi lên không phải JSON hợp lệ.' }, 400);
    }

    const entry = {};
    for (const [field, limit] of Object.entries(ENTRY_LIMITS)) {
      const value = body[field] ?? '';
      if (typeof value !== 'string') {
        return json({ error: 'Các trường thông tin cần có định dạng văn bản.' }, 400);
      }
      entry[field] = value.trim();
      if (entry[field].length > limit) {
        return json({ error: `Trường "${field}" vượt quá giới hạn ký tự.` }, 400);
      }
    }
    if (!entry.mo_ta || !entry.loai_thong_tin) {
      return json({ error: 'Vui lòng nhập mô tả và loại thông tin.' }, 400);
    }

    const result = await db.prepare(
      'INSERT INTO entries (mo_ta, loai_thong_tin, noi_dung) VALUES (?, ?, ?)'
    ).bind(entry.mo_ta, entry.loai_thong_tin, entry.noi_dung).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  }

  const deleteMatch = pathname.match(/^\/api\/entries\/(\d+)$/);
  if (deleteMatch) {
    if (request.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);
    const id = Number(deleteMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      return json({ error: 'Mã thông tin không hợp lệ.' }, 400);
    }
    const result = await db.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
    if (!result.meta.changes) {
      return json({ error: 'Thông tin này không còn tồn tại.' }, 404);
    }
    return json({ ok: true });
  }

  return null;
}

async function handleLegacyNotes(request, db, pathname) {
  if (pathname === '/api/notes') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const keys = Array.from({ length: DAY_COUNT }, (_, index) => `day:${index}`);
    const placeholders = keys.map(() => '?').join(', ');
    const { results } = await db.prepare(
      `SELECT key, value FROM web_data WHERE key IN (${placeholders})`
    ).bind(...keys).all();
    const notesByKey = Object.fromEntries(results.map(({ key, value }) => [key, value]));
    return json({ notes: keys.map((key) => notesByKey[key] ?? '') });
  }

  const match = pathname.match(/^\/api\/notes\/([0-6])$/);
  if (!match) return null;
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);

  const body = await readJson(request);
  if (!body || typeof body.content !== 'string') {
    return json({ error: 'Thiếu trường content' }, 400);
  }
  if (body.content.length > MAX_LENGTH) return json({ error: 'Nội dung quá dài' }, 413);

  const key = `day:${match[1]}`;
  if (body.content.trim() === '') {
    await db.prepare('DELETE FROM web_data WHERE key = ?').bind(key).run();
  } else {
    await db.prepare(
      'INSERT INTO web_data (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).bind(key, body.content).run();
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;
      const authResponse = await handleAuth(request, env, pathname);
      if (authResponse) return authResponse;

      if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

      const session = await readSession(request, env);
      if (!session) return json({ error: 'Vui lòng đăng nhập để tiếp tục.' }, 401);

      if (['POST', 'PUT', 'DELETE'].includes(request.method) && !hasValidOrigin(request)) {
        return json({ error: 'Nguồn gửi yêu cầu không hợp lệ.' }, 403);
      }

      const scheduleResponse = await handleSchedule(request, env.DB, session.username, pathname, url);
      if (scheduleResponse) return scheduleResponse;

      const entriesResponse = await handleEntries(request, env.DB, pathname);
      if (entriesResponse) return entriesResponse;

      const notesResponse = await handleLegacyNotes(request, env.DB, pathname);
      if (notesResponse) return notesResponse;

      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Lỗi xử lý yêu cầu API:', error);
      return json({ error: 'Lỗi máy chủ. Vui lòng kiểm tra cấu hình và thử lại.' }, 500);
    }
  }
};
