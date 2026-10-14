const DAY_COUNT = 7;
const MAX_LEN = 2000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    try {
      // Lấy ghi chú của cả 7 ngày
      if (pathname === '/api/notes' && request.method === 'GET') {
        const notes = await Promise.all(
          Array.from({ length: DAY_COUNT }, (_, i) => env.NOTES.get(`day:${i}`, 'json'))
        );
        return json({ notes: notes.map((n) => n || { content: '', updatedAt: null }) });
      }

      // Lưu ghi chú của một ngày (0 = Thứ 2 ... 6 = Chủ nhật)
      const match = pathname.match(/^\/api\/notes\/([0-6])$/);
      if (match && request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
        }
        if (typeof body?.content !== 'string') return json({ error: 'Thiếu nội dung' }, 400);
        if (body.content.length > MAX_LEN) return json({ error: `Tối đa ${MAX_LEN} ký tự` }, 413);

        const key = `day:${match[1]}`;
        if (!body.content.trim()) {
          await env.NOTES.delete(key);
          return json({ ok: true, updatedAt: null });
        }
        const updatedAt = new Date().toISOString();
        await env.NOTES.put(key, JSON.stringify({ content: body.content, updatedAt }));
        return json({ ok: true, updatedAt });
      }

      if (pathname.startsWith('/api/')) return json({ error: 'Không tìm thấy' }, 404);

      // Mọi đường dẫn khác: phục vụ file tĩnh trong public/
      return env.ASSETS.fetch(request);
    } catch {
      return json({ error: 'Lỗi máy chủ' }, 500);
    }
  }
};
