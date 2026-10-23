const DAY_COUNT = 7;
const MAX_LENGTH = 5000; // phải khớp với MAX_LENGTH trong public/app.js
const MAX_TASKS_PER_DAY = 20;
const MAX_TASK_TITLE_LENGTH = 100;

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

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

export default {
  async fetch(request, env) {
    try {
      const { pathname } = new URL(request.url);

      // GET /api/tasks?month=YYYY-MM -> { tasks: { "YYYY-MM-DD": [...] } }
      if (pathname === '/api/tasks') {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

        const month = new URL(request.url).searchParams.get('month') || '';
        const match = month.match(/^(\d{4})-(\d{2})$/);
        if (!match || !isValidDate(Number(match[1]), Number(match[2]), 1)) {
          return json({ error: 'Tháng không hợp lệ' }, 400);
        }

        const year = Number(match[1]);
        const monthNumber = Number(match[2]);
        const days = daysInMonth(year, monthNumber);
        const entries = await Promise.all(
          Array.from({ length: days }, async (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            const date = `${month}-${day}`;
            const value = await env.NOTES.get(`tasks:${date}`);
            if (value === null) return [date, []];

            const tasks = JSON.parse(value);
            if (!isValidTaskList(tasks)) throw new Error(`Dữ liệu công việc không hợp lệ: ${date}`);
            return [date, tasks];
          })
        );
        return json({ tasks: Object.fromEntries(entries) });
      }

      // PUT /api/tasks/YYYY-MM-DD với body { "tasks": [...] }
      const taskMatch = pathname.match(/^\/api\/tasks\/(\d{4})-(\d{2})-(\d{2})$/);
      if (taskMatch) {
        if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
        const [, year, month, day] = taskMatch;
        if (!isValidDate(Number(year), Number(month), Number(day))) {
          return json({ error: 'Ngày không hợp lệ' }, 400);
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Dữ liệu không hợp lệ' }, 400);
        }
        if (!body || !isValidTaskList(body.tasks)) {
          return json({ error: `Mỗi ngày cần có tối đa ${MAX_TASKS_PER_DAY} công việc hợp lệ.` }, 400);
        }

        const key = `tasks:${year}-${month}-${day}`;
        if (body.tasks.length === 0) {
          await env.NOTES.delete(key);
        } else {
          await env.NOTES.put(key, JSON.stringify(body.tasks));
        }
        return json({ ok: true });
      }

      // GET /api/notes -> { notes: ["...", "...", ...] } (7 phần tử, Thứ 2 -> Chủ nhật)
      if (pathname === '/api/notes') {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const values = await Promise.all(
          Array.from({ length: DAY_COUNT }, (_, i) => env.NOTES.get(`day:${i}`))
        );
        return json({ notes: values.map((v) => v ?? '') });
      }

      // PUT /api/notes/:day (0..6) với body { "content": "..." }
      const match = pathname.match(/^\/api\/notes\/([0-6])$/);
      if (match) {
        if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);

        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Dữ liệu không hợp lệ' }, 400);
        }
        if (!body || typeof body.content !== 'string') {
          return json({ error: 'Thiếu trường content' }, 400);
        }
        if (body.content.length > MAX_LENGTH) {
          return json({ error: 'Nội dung quá dài' }, 413);
        }

        const key = `day:${match[1]}`;
        if (body.content.trim() === '') {
          await env.NOTES.delete(key);
        } else {
          await env.NOTES.put(key, body.content);
        }
        return json({ ok: true });
      }

      return json({ error: 'Not found' }, 404);
    } catch {
      return json({ error: 'Lỗi máy chủ' }, 500);
    }
  }
};
