const DAY_COUNT = 7;
const MAX_LENGTH = 5000;
const MAX_TASKS_PER_DAY = 20;
const MAX_TASK_TITLE_LENGTH = 100;
const MAX_RECURRENCE_YEARS = 5;
const RECURRENCE_FREQUENCIES = new Set(['none', 'daily', 'weekly', 'monthly', 'yearly']);
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const SESSION_COOKIE = 'myweb_session';
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.@+-]{0,253}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HASH_ITERATIONS = 100000;
const ACCOUNT_CREATOR_USERNAME = 'duyvu@pvdv';
const PROFILE_LIMITS = {
  full_name: 120,
  hometown: 200,
  current_location: 200,
  workplace: 200
};
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
      (task.startTime != null &&
        (typeof task.startTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.startTime))) ||
      (task.durationHours != null &&
        (!Number.isInteger(task.durationHours) || task.durationHours < 0 || task.durationHours > 999)) ||
      (task.durationMinutes != null &&
        (!Number.isInteger(task.durationMinutes) || task.durationMinutes < 0 || task.durationMinutes > 59)) ||
      (task.repeat != null && !RECURRENCE_FREQUENCIES.has(task.repeat)) ||
      (task.repeatUntil != null &&
        (typeof task.repeatUntil !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(task.repeatUntil) ||
          !isValidDate(
            Number(task.repeatUntil.slice(0, 4)),
            Number(task.repeatUntil.slice(5, 7)),
            Number(task.repeatUntil.slice(8, 10))
          ))) ||
      (task.seriesId != null &&
        (typeof task.seriesId !== 'string' || task.seriesId.length === 0 || task.seriesId.length > 80)) ||
      (task.occurrenceDate != null &&
        (typeof task.occurrenceDate !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(task.occurrenceDate) ||
          !isValidDate(
            Number(task.occurrenceDate.slice(0, 4)),
            Number(task.occurrenceDate.slice(5, 7)),
            Number(task.occurrenceDate.slice(8, 10))
          ))) ||
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
  const userConfigs = Object.entries(env).filter(([configName, config]) =>
    (configName === 'APP_USERS' ||
      configName === 'APP_USERS_EXTRA' ||
      configName.startsWith('APP_USERS_EXTRA_')) &&
    config
  );

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
  const managedAccount = configuredUser ? null : await readManagedAccount(env.DB, session.username);
  if (
    (!configuredUser && !managedAccount) ||
    (configuredUser && configuredUser.username !== session.username) ||
    (managedAccount && managedAccount.username !== session.username) ||
    !Number.isSafeInteger(session.expiresAt) ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  return { username: configuredUser?.username || managedAccount.username };
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

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_HASH_ITERATIONS },
    key,
    256
  );
  return new Uint8Array(hash);
}

const encodeBytes = (bytes) => toBase64Url(bytes);

async function verifyStoredPassword(password, salt, expectedHash) {
  return passwordsMatch(encodeBytes(await hashPassword(password, fromBase64Url(salt))), expectedHash);
}

async function readAccountCredentials(db, username) {
  return db.prepare(
    'SELECT password_salt, password_hash FROM user_profiles WHERE username = ?'
  ).bind(username.toLowerCase()).first();
}

async function readManagedAccount(db, username) {
  return db.prepare(
    'SELECT username, password_salt, password_hash FROM user_accounts WHERE username = ?'
  ).bind(username.toLowerCase()).first();
}

async function handleAccountProfile(request, db, username) {
  if (request.method === 'GET') {
    const profile = await db.prepare(
      'SELECT full_name, birth_year, hometown, current_location, workplace FROM user_profiles WHERE username = ?'
    ).bind(username.toLowerCase()).first();
    return json({
      profile: {
        full_name: profile?.full_name || '',
        birth_year: profile?.birth_year || '',
        hometown: profile?.hometown || '',
        current_location: profile?.current_location || '',
        workplace: profile?.workplace || ''
      }
    });
  }

  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const body = await readJson(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Nội dung gửi lên không phải JSON hợp lệ.' }, 400);
  }

  const profile = {};
  for (const [field, limit] of Object.entries(PROFILE_LIMITS)) {
    if (typeof body[field] !== 'string') {
      return json({ error: 'Các trường thông tin cá nhân cần có định dạng văn bản.' }, 400);
    }
    profile[field] = body[field].trim();
    if (profile[field].length > limit) {
      return json({ error: `Trường thông tin vượt quá ${limit} ký tự.` }, 400);
    }
  }

  const currentYear = new Date().getFullYear();
  const birthYear = body.birth_year === '' ? null : Number(body.birth_year);
  if (
    birthYear !== null &&
    (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear)
  ) {
    return json({ error: `Năm sinh phải nằm trong khoảng 1900 đến ${currentYear}.` }, 400);
  }

  await db.prepare(
    `INSERT INTO user_profiles (username, full_name, birth_year, hometown, current_location, workplace)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       full_name = excluded.full_name,
       birth_year = excluded.birth_year,
       hometown = excluded.hometown,
       current_location = excluded.current_location,
       workplace = excluded.workplace`
  ).bind(
    username.toLowerCase(),
    profile.full_name,
    birthYear,
    profile.hometown,
    profile.current_location,
    profile.workplace
  ).run();
  return json({ ok: true });
}

async function handlePasswordChange(request, db, username, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await readJson(request);
  if (
    !body ||
    typeof body.current_password !== 'string' ||
    typeof body.new_password !== 'string' ||
    body.current_password.length > 1024 ||
    body.new_password.length > 1024
  ) {
    return json({ error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới hợp lệ.' }, 400);
  }
  if (body.new_password.length < PASSWORD_MIN_LENGTH) {
    return json({ error: `Mật khẩu mới cần có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` }, 400);
  }

  const configuredUser = getUsers(env).get(username.toLowerCase());
  const managedAccount = configuredUser ? null : await readManagedAccount(db, username);
  if (!configuredUser && !managedAccount) return json({ error: 'Tài khoản không còn hợp lệ.' }, 401);
  const credentials = managedAccount || await readAccountCredentials(db, username);
  const currentPasswordMatches = credentials?.password_hash
    ? await verifyStoredPassword(
      body.current_password,
      credentials.password_salt,
      credentials.password_hash
    )
    : passwordsMatch(body.current_password, configuredUser.password);
  if (!currentPasswordMatches) {
    return json({ error: 'Mật khẩu hiện tại không chính xác.' }, 400);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = encodeBytes(await hashPassword(body.new_password, salt));
  if (managedAccount) {
    await db.prepare(
      'UPDATE user_accounts SET password_salt = ?, password_hash = ? WHERE username = ?'
    ).bind(encodeBytes(salt), passwordHash, username.toLowerCase()).run();
  } else {
    await db.prepare(
      `INSERT INTO user_profiles (username, password_salt, password_hash)
       VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET
         password_salt = excluded.password_salt,
         password_hash = excluded.password_hash`
    ).bind(username.toLowerCase(), encodeBytes(salt), passwordHash).run();
  }
  return json({ ok: true });
}

async function createManagedAccount(request, db, username, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (username.toLowerCase() !== ACCOUNT_CREATOR_USERNAME) {
    return json({ error: 'Bạn không có quyền tạo tài khoản.' }, 403);
  }

  const body = await readJson(request);
  if (
    !body ||
    typeof body.username !== 'string' ||
    typeof body.password !== 'string' ||
    body.username.length > 254 ||
    body.password.length > 1024
  ) {
    return json({ error: 'Tên tài khoản hoặc mật khẩu không hợp lệ.' }, 400);
  }

  const newUsername = body.username.trim();
  if (!USERNAME_PATTERN.test(newUsername)) {
    return json({
      error: 'Tên tài khoản phải bắt đầu bằng chữ hoặc số và chỉ gồm chữ ASCII, số, dấu chấm, gạch dưới, @, + hoặc -.'
    }, 400);
  }
  if (body.password.length < PASSWORD_MIN_LENGTH) {
    return json({ error: `Mật khẩu cần có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` }, 400);
  }

  const normalizedUsername = newUsername.toLowerCase();
  if (getUsers(env).has(normalizedUsername)) {
    return json({ error: 'Tên tài khoản này đã tồn tại.' }, 409);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = encodeBytes(await hashPassword(body.password, salt));
  const result = await db.prepare(
    `INSERT INTO user_accounts (username, password_salt, password_hash, created_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO NOTHING`
  ).bind(normalizedUsername, encodeBytes(salt), passwordHash, username.toLowerCase()).run();

  if (!result.meta?.changes) return json({ error: 'Tên tài khoản này đã tồn tại.' }, 409);
  return json({ ok: true, username: normalizedUsername }, 201);
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

async function ensureScheduleTables(db, username) {
  const usernameHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(username.toLowerCase()))
  );
  const suffix = Array.from(usernameHash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const table = tableForUser(suffix);
  const recurrenceTable = `${table}_recurrences`;
  const overrideTable = `${table}_overrides`;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS "${table}" (date TEXT PRIMARY KEY, tasks TEXT NOT NULL)`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS "${recurrenceTable}" (id TEXT PRIMARY KEY, start_date TEXT NOT NULL, task TEXT NOT NULL)`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS "${overrideTable}" (series_id TEXT NOT NULL, date TEXT NOT NULL, task TEXT, canceled INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (series_id, date))`
  ).run();
  return { table, recurrenceTable, overrideTable };
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

  if (pathname === '/api/auth/accounts') {
    const session = await readSession(request, env);
    if (!session) return json({ error: 'Vui lòng đăng nhập để tiếp tục.' }, 401);
    return createManagedAccount(request, env.DB, session.username, env);
  }

  if (pathname === '/api/auth/profile' || pathname === '/api/auth/password') {
    const session = await readSession(request, env);
    if (!session) return json({ error: 'Vui lòng đăng nhập để tiếp tục.' }, 401);
    if (pathname === '/api/auth/profile') {
      return handleAccountProfile(request, env.DB, session.username);
    }
    return handlePasswordChange(request, env.DB, session.username, env);
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
    const managedAccount = configuredUser ? null : await readManagedAccount(env.DB, body.username);
    const credentials = configuredUser
      ? await readAccountCredentials(env.DB, configuredUser.username)
      : managedAccount;
    const passwordIsValid = configuredUser
      ? (credentials?.password_hash
        ? await verifyStoredPassword(body.password, credentials.password_salt, credentials.password_hash)
        : passwordsMatch(body.password, configuredUser.password))
      : managedAccount && await verifyStoredPassword(
        body.password,
        managedAccount.password_salt,
        managedAccount.password_hash
      );
    if (!passwordIsValid) {
      return json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác.' }, 401);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const authenticatedUsername = configuredUser?.username || managedAccount.username;
    const token = await signSession(authenticatedUsername, expiresAt, env.AUTH_SECRET);
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json(
      { authenticated: true, username: authenticatedUsername },
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

const addYearsToDate = (date, years) => {
  const [year, month, day] = date.split('-').map(Number);
  const targetYear = Math.min(9999, year + years);
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    Math.min(day, daysInMonth(targetYear, month))
  ).padStart(2, '0')}`;
};

const previousDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  if (day > 1) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day - 1).padStart(2, '0')}`;
  }
  if (month > 1) {
    const previousMonth = month - 1;
    return `${String(year).padStart(4, '0')}-${String(previousMonth).padStart(2, '0')}-${String(
      daysInMonth(year, previousMonth)
    ).padStart(2, '0')}`;
  }
  return `${String(year - 1).padStart(4, '0')}-12-31`;
};

const recurrenceStartCutoff = (year, month) =>
  `${String(Math.max(1, year - MAX_RECURRENCE_YEARS)).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;

function isRecurrenceDate(startDate, repeat, date, repeatUntil = null) {
  const maximumEndDate = addYearsToDate(startDate, MAX_RECURRENCE_YEARS);
  const endDate = repeatUntil && repeatUntil < maximumEndDate ? repeatUntil : maximumEndDate;
  if (date < startDate || date > endDate) return false;
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  if (repeat === 'daily') return true;
  if (repeat === 'weekly') {
    const start = Date.UTC(startYear, startMonth - 1, startDay);
    const current = Date.UTC(year, month - 1, day);
    return Math.floor((current - start) / 86400000) % 7 === 0;
  }
  if (repeat === 'monthly') return day === Math.min(startDay, daysInMonth(year, month));
  if (repeat === 'yearly') {
    return month === startMonth && day === Math.min(startDay, daysInMonth(year, month));
  }
  return false;
}

const taskDetails = (task) => ({
  title: task.title,
  done: task.done,
  startTime: task.startTime || null,
  durationHours: task.durationHours ?? null,
  durationMinutes: task.durationMinutes ?? null,
  repeat: task.repeat || 'none',
  repeatUntil: task.repeatUntil || null
});

const sameTaskDetails = (left, right) => {
  const leftDetails = taskDetails(left);
  const rightDetails = taskDetails(right);
  return Object.keys(leftDetails).every((key) => leftDetails[key] === rightDetails[key]);
};

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
    const { table, recurrenceTable, overrideTable } = await ensureScheduleTables(db, username);
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
      tasksByDate[date] = parsedTasks.map((task) => ({ ...task, repeat: task.repeat || 'none' }));
    }

    const cutoff = recurrenceStartCutoff(year, monthNumber);
    const { results: recurringTasks } = await db.prepare(
      `SELECT id, start_date, task FROM "${recurrenceTable}"
       WHERE start_date >= ? AND start_date <= ?`
    ).bind(cutoff, lastKey).all();
    const { results: overrides } = await db.prepare(
      `SELECT series_id, date, task, canceled FROM "${overrideTable}"
       WHERE date >= ? AND date <= ?`
    ).bind(firstKey, lastKey).all();
    const overridesByOccurrence = new Map(
      overrides.map((override) => [
        `${override.series_id}:${override.date}`,
        override.canceled ? { canceled: true } : JSON.parse(override.task)
      ])
    );

    for (const series of recurringTasks) {
      const task = JSON.parse(series.task);
      if (!isValidTaskList([task]) || !RECURRENCE_FREQUENCIES.has(task.repeat) || task.repeat === 'none') {
        throw new Error(`Dữ liệu lặp lại không hợp lệ: ${series.id}`);
      }
      const occurrenceStart = series.start_date > firstKey ? series.start_date : firstKey;
      for (let day = Number(occurrenceStart.slice(8, 10)); day <= days; day += 1) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        if (!isRecurrenceDate(series.start_date, task.repeat, date)) continue;
        const override = overridesByOccurrence.get(`${series.id}:${date}`);
        if (override?.canceled) continue;
        tasksByDate[date].push({
          ...task,
          ...(override || {}),
          id: series.id,
          seriesId: series.id,
          occurrenceDate: date,
          repeat: task.repeat,
          repeatStartDate: series.start_date,
          repeatUntil: task.repeatUntil || addYearsToDate(series.start_date, MAX_RECURRENCE_YEARS)
        });
      }
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
    const seriesUpdate = body?.seriesUpdate;
    if (
      !body ||
      !isValidTaskList(body.tasks) ||
      (seriesUpdate != null && (
        typeof seriesUpdate.seriesId !== 'string' ||
        !isValidTaskList([{
          id: seriesUpdate.seriesId,
          title: seriesUpdate.title,
          done: false,
          startTime: seriesUpdate.startTime,
          durationHours: seriesUpdate.durationHours,
          durationMinutes: seriesUpdate.durationMinutes,
          repeat: seriesUpdate.repeat,
          repeatUntil: seriesUpdate.repeatUntil
        }]) ||
        (seriesUpdate.repeat != null && !RECURRENCE_FREQUENCIES.has(seriesUpdate.repeat))
      ))
    ) {
      return json({ error: `Mỗi ngày cần có tối đa ${MAX_TASKS_PER_DAY} công việc hợp lệ.` }, 400);
    }

    const date = `${year}-${month}-${day}`;
    const { table, recurrenceTable, overrideTable } = await ensureScheduleTables(db, username);
    const seriesIdsInBody = new Set(
      body.tasks.filter((task) => task.seriesId).map((task) => task.seriesId)
    );

    if (seriesUpdate) {
      if (!seriesIdsInBody.has(seriesUpdate.seriesId)) {
        return json({ error: 'Không tìm thấy công việc lặp cần cập nhật.' }, 400);
      }
      const { results } = await db.prepare(
        `SELECT start_date, task FROM "${recurrenceTable}" WHERE id = ?`
      ).bind(seriesUpdate.seriesId).all();
      if (!results.length) return json({ error: 'Chuỗi công việc không còn tồn tại.' }, 404);
      const master = JSON.parse(results[0].task);
      const endingSeries = seriesUpdate.repeat === 'none';
      const updatedMaster = {
        ...master,
        title: seriesUpdate.title,
        startTime: seriesUpdate.startTime || null,
        durationHours: seriesUpdate.durationHours ?? null,
        durationMinutes: seriesUpdate.durationMinutes ?? null,
        repeat: endingSeries
          ? (date > results[0].start_date ? master.repeat : 'none')
          : (seriesUpdate.repeat || master.repeat),
        repeatUntil: endingSeries
          ? (date > results[0].start_date ? previousDate(date) : null)
          : (seriesUpdate.repeatUntil || master.repeatUntil || addYearsToDate(results[0].start_date, MAX_RECURRENCE_YEARS))
      };
      if (!endingSeries && (
        updatedMaster.repeatUntil < date ||
        updatedMaster.repeatUntil < results[0].start_date ||
        updatedMaster.repeatUntil > addYearsToDate(results[0].start_date, MAX_RECURRENCE_YEARS)
      )) {
        return json({ error: 'Ngày kết thúc lặp phải nằm trong vòng 5 năm kể từ ngày bắt đầu.' }, 400);
      }
      await db.prepare(
        `UPDATE "${recurrenceTable}" SET task = ? WHERE id = ?`
      ).bind(JSON.stringify(updatedMaster), seriesUpdate.seriesId).run();
      await db.prepare(
        `DELETE FROM "${overrideTable}" WHERE series_id = ? AND date >= ?`
      ).bind(seriesUpdate.seriesId, date).run();
    }

    const cutoff = recurrenceStartCutoff(Number(year), Number(month));
    const { results: recurringResults } = await db.prepare(
      `SELECT id, start_date, task FROM "${recurrenceTable}"
       WHERE start_date >= ? AND start_date <= ?`
    ).bind(cutoff, date).all();
    const activeSeries = new Map();
    for (const series of recurringResults) {
      const storedTask = JSON.parse(series.task);
      const task = {
        ...storedTask,
        repeatUntil: storedTask.repeatUntil ||
          addYearsToDate(series.start_date, MAX_RECURRENCE_YEARS)
      };
      if (isRecurrenceDate(series.start_date, task.repeat, date, task.repeatUntil)) {
        activeSeries.set(series.id, { ...series, task });
      }
    }

    const regularTasks = [];
    for (const task of body.tasks) {
      if (task.seriesId) {
        if (task.occurrenceDate !== date) {
          return json({ error: 'Công việc lặp không hợp lệ.' }, 400);
        }
        if (seriesUpdate?.seriesId === task.seriesId && seriesUpdate.repeat === 'none') {
          regularTasks.push({
            ...taskDetails(task),
            id: task.seriesId,
            done: task.done,
            repeat: 'none',
            repeatUntil: null
          });
          continue;
        }
        if (!activeSeries.has(task.seriesId)) {
          if (seriesUpdate?.seriesId === task.seriesId) continue;
          return json({ error: 'Công việc lặp không hợp lệ.' }, 400);
        }
        continue;
      }
      if (task.repeat && task.repeat !== 'none') {
        const repeatUntil = task.repeatUntil || addYearsToDate(date, MAX_RECURRENCE_YEARS);
        if (repeatUntil < date || repeatUntil > addYearsToDate(date, MAX_RECURRENCE_YEARS)) {
          return json({ error: 'Ngày kết thúc lặp phải nằm trong vòng 5 năm kể từ ngày bắt đầu.' }, 400);
        }
        const recurringTask = { ...task, repeatUntil, done: false };
        await db.prepare(
          `INSERT INTO "${recurrenceTable}" (id, start_date, task) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET start_date = excluded.start_date, task = excluded.task`
        ).bind(task.id, date, JSON.stringify(recurringTask)).run();
        activeSeries.set(task.id, { id: task.id, start_date: date, task: recurringTask });
        seriesIdsInBody.add(task.id);
      } else {
        regularTasks.push({ ...task, repeat: 'none' });
      }
    }

    for (const [seriesId, series] of activeSeries) {
      const occurrence = body.tasks.find((task) => task.seriesId === seriesId);
      if (!occurrence) {
        if (!seriesIdsInBody.has(seriesId)) {
          await db.prepare(
            `INSERT INTO "${overrideTable}" (series_id, date, task, canceled) VALUES (?, ?, NULL, 1)
             ON CONFLICT(series_id, date) DO UPDATE SET task = NULL, canceled = 1`
          ).bind(seriesId, date).run();
        }
        continue;
      }
      if (seriesUpdate?.seriesId === seriesId) {
        await db.prepare(
          `DELETE FROM "${overrideTable}" WHERE series_id = ? AND date = ?`
        ).bind(seriesId, date).run();
        continue;
      }
      const overriddenTask = {
        ...taskDetails(occurrence),
        id: seriesId
      };
      if (sameTaskDetails(occurrence, series.task)) {
        await db.prepare(
          `DELETE FROM "${overrideTable}" WHERE series_id = ? AND date = ?`
        ).bind(seriesId, date).run();
      } else {
        await db.prepare(
          `INSERT INTO "${overrideTable}" (series_id, date, task, canceled) VALUES (?, ?, ?, 0)
           ON CONFLICT(series_id, date) DO UPDATE SET task = excluded.task, canceled = 0`
        ).bind(seriesId, date, JSON.stringify(overriddenTask)).run();
      }
    }

    if (regularTasks.length === 0) {
      await db.prepare(`DELETE FROM "${table}" WHERE date = ?`).bind(date).run();
    } else {
      await db.prepare(
        `INSERT INTO "${table}" (date, tasks) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET tasks = excluded.tasks`
      ).bind(date, JSON.stringify(regularTasks)).run();
    }
    return json({ ok: true });
  }

  return null;
}

async function handleEntries(request, db, pathname) {
  if (pathname === '/api/entries/trash') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const { results } = await db.prepare(
      `SELECT id, mo_ta, loai_thong_tin, noi_dung, created_at, deleted_at
       FROM entries WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC`
    ).all();
    return json(results);
  }

  if (pathname === '/api/entries') {
    if (request.method === 'GET') {
      const { results } = await db.prepare(
        `SELECT id, mo_ta, loai_thong_tin, noi_dung, created_at
         FROM entries WHERE deleted_at IS NULL ORDER BY id DESC`
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

  const restoreMatch = pathname.match(/^\/api\/entries\/(\d+)\/restore$/);
  if (restoreMatch) {
    if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
    const id = Number(restoreMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      return json({ error: 'Mã thông tin không hợp lệ.' }, 400);
    }
    const result = await db.prepare(
      'UPDATE entries SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL'
    ).bind(id).run();
    if (!result.meta.changes) {
      return json({ error: 'Thông tin này không còn trong thùng rác.' }, 404);
    }
    return json({ ok: true });
  }

  const deleteMatch = pathname.match(/^\/api\/entries\/(\d+)$/);
  if (deleteMatch) {
    if (request.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);
    const id = Number(deleteMatch[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      return json({ error: 'Mã thông tin không hợp lệ.' }, 400);
    }
    const result = await db.prepare(
      "UPDATE entries SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
    ).bind(id).run();
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
  async scheduled(controller, env) {
    await env.DB.prepare(
      "DELETE FROM entries WHERE deleted_at IS NOT NULL AND deleted_at <= datetime('now', '-30 days')"
    ).run();
  },

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
