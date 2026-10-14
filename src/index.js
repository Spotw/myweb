const DAY_COUNT = 7;
const MAX_LENGTH = 5000; // phải khớp với MAX_LENGTH trong public/app.js

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
