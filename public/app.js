(() => {
  'use strict';

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const MAX_LEN = 2000; // khớp với giới hạn trong src/index.js
  const API = '/api/notes';

  const timeFmt = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const dateFmt = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const stampFmt = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false
  });

  const cards = []; // { card, badge, area, btn, status }
  let currentToday = -1;

  // ---------- Đồng hồ ----------
  function todayIndex() {
    // getDay(): 0 = Chủ nhật ... 6 = Thứ 7  ->  0 = Thứ 2 ... 6 = Chủ nhật
    return (new Date().getDay() + 6) % 7;
  }

  function markToday() {
    const today = todayIndex();
    if (today === currentToday) return;
    currentToday = today;
    cards.forEach((c, i) => {
      c.card.classList.toggle('is-today', i === today);
      c.badge.hidden = i !== today;
    });
  }

  function startClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const tick = () => {
      const now = new Date();
      timeEl.textContent = timeFmt.format(now);
      dateEl.textContent = dateFmt.format(now);
      markToday();
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Thẻ từng ngày ----------
  function setStatus(c, message, state) {
    c.status.textContent = message;
    c.status.classList.toggle('is-ok', state === 'ok');
    c.status.classList.toggle('is-error', state === 'error');
  }

  function setLocked(locked) {
    cards.forEach((c) => {
      c.area.disabled = locked;
      c.btn.disabled = locked;
      c.area.placeholder = locked ? 'Đang tải...' : 'Nhập nội dung...';
    });
  }

  function createCard(index) {
    const card = document.createElement('section');
    card.className = 'day';
    card.setAttribute('aria-labelledby', `day-title-${index}`);

    const head = document.createElement('div');
    head.className = 'day-head';

    const title = document.createElement('h2');
    title.className = 'day-name';
    title.id = `day-title-${index}`;
    title.textContent = DAYS[index];

    const badge = document.createElement('span');
    badge.className = 'day-badge';
    badge.textContent = 'Hôm nay';
    badge.hidden = true;

    head.append(title, badge);

    const area = document.createElement('textarea');
    area.id = `content-${index}`;
    area.name = `content-${index}`;
    area.rows = 3;
    area.maxLength = MAX_LEN;
    area.setAttribute('aria-label', `Nội dung ${DAYS[index]}`);

    const foot = document.createElement('div');
    foot.className = 'day-foot';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-save';
    btn.textContent = 'Lưu';

    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    foot.append(btn, status);
    card.append(head, area, foot);

    const entry = { card, badge, area, btn, status };

    btn.addEventListener('click', () => save(index));
    area.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        save(index);
      }
    });

    return entry;
  }

  // ---------- Gọi API (Worker + KV) ----------
  async function save(index) {
    const c = cards[index];
    c.btn.disabled = true;
    setStatus(c, 'Đang lưu...');
    try {
      const res = await fetch(`${API}/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: c.area.value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
      setStatus(
        c,
        data.updatedAt ? `Đã lưu lúc ${stampFmt.format(new Date(data.updatedAt))}` : 'Đã lưu (ô trống)',
        'ok'
      );
    } catch (err) {
      const message = err instanceof TypeError ? 'Không kết nối được máy chủ' : err.message;
      setStatus(c, `Không lưu được: ${message}`, 'error');
    } finally {
      c.btn.disabled = false;
    }
  }

  async function load() {
    const banner = document.getElementById('banner');
    const bannerText = document.getElementById('banner-text');
    banner.hidden = true;
    setLocked(true);

    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      const data = await res.json();
      const notes = Array.isArray(data.notes) ? data.notes : [];

      cards.forEach((c, i) => {
        const note = notes[i] || {};
        c.area.value = typeof note.content === 'string' ? note.content : '';
        setStatus(
          c,
          note.updatedAt ? `Lưu lần cuối: ${stampFmt.format(new Date(note.updatedAt))}` : ''
        );
      });
      setLocked(false);
    } catch {
      bannerText.textContent = 'Không tải được ghi chú từ máy chủ.';
      banner.hidden = false;
      // Giữ các ô bị khóa để không ghi đè dữ liệu chưa tải được.
      cards.forEach((c) => { c.area.placeholder = 'Chưa tải được dữ liệu'; });
    }
  }

  // ---------- Khởi tạo ----------
  function init() {
    const root = document.getElementById('week');
    if (!root) return;

    const fragment = document.createDocumentFragment();
    DAYS.forEach((_, index) => {
      const entry = createCard(index);
      cards.push(entry);
      fragment.append(entry.card);
    });
    root.append(fragment);

    startClock();
    document.getElementById('retry').addEventListener('click', load);
    load();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
