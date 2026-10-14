(() => {
  'use strict';

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const MAX_LENGTH = 5000; // phải khớp với giới hạn ở src/index.js

  const clockTime = document.getElementById('clock-time');
  const clockDate = document.getElementById('clock-date');
  const daysRoot = document.getElementById('days');
  const banner = document.getElementById('banner');
  const bannerText = document.getElementById('banner-text');
  const bannerRetry = document.getElementById('banner-retry');

  const cards = [];

  const pad = (n) => String(n).padStart(2, '0');

  // getDay(): 0 = Chủ nhật ... 6 = Thứ 7  ->  0 = Thứ 2 ... 6 = Chủ nhật
  const todayIndex = () => (new Date().getDay() + 6) % 7;

  // ---------- Đồng hồ ----------
  function tick() {
    const now = new Date();
    clockTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const idx = todayIndex();
    clockDate.textContent = `${DAYS[idx]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    cards.forEach((c) => {
      const isToday = c.index === idx;
      c.card.classList.toggle('is-today', isToday);
      c.badge.hidden = !isToday;
    });
  }

  // ---------- Giao diện từng ngày ----------
  function setStatus(c, message, kind) {
    c.status.textContent = message;
    c.status.classList.toggle('is-error', kind === 'error');
    c.status.classList.toggle('is-dirty', kind === 'dirty');
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
    area.rows = 3;
    area.maxLength = MAX_LENGTH;
    area.disabled = true;
    //area.placeholder = 'Đang tải...';
    area.setAttribute('aria-label', `Nội dung ${DAYS[index]}`);

    const foot = document.createElement('div');
    foot.className = 'day-foot';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-save';
    btn.textContent = 'Lưu';
    btn.disabled = true;
    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    foot.append(btn, status);

    card.append(head, area, foot);

    const c = { index, card, badge, area, btn, status };
    area.addEventListener('input', () => setStatus(c, 'Chưa lưu', 'dirty'));
    btn.addEventListener('click', () => save(c));
    return c;
  }

  // ---------- Gọi API (Worker + KV) ----------
  async function save(c) {
    c.btn.disabled = true;
    setStatus(c, 'Đang lưu...');
    try {
      const res = await fetch(`/api/notes/${c.index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: c.area.value })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const now = new Date();
      setStatus(c, `Đã lưu lúc ${pad(now.getHours())}:${pad(now.getMinutes())}`);
    } catch {
      setStatus(c, 'Lưu thất bại, hãy thử lại.', 'error');
    } finally {
      c.btn.disabled = false;
    }
  }

  function showBanner(message) {
    bannerText.textContent = message;
    banner.hidden = false;
  }

   async function loadNotes() {
    banner.hidden = true;
    bannerRetry.disabled = true;
    try {
      const res = await fetch('/api/notes', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const notes = Array.isArray(data.notes) ? data.notes : [];
      cards.forEach((c) => {
        c.area.value = typeof notes[c.index] === 'string' ? notes[c.index] : '';
        c.area.placeholder = 'Nhập nội dung...';
        c.area.disabled = false;
        c.btn.disabled = false;
      });
    } //catch {
      //cards.forEach((c) => { c.area.placeholder = 'Chưa tải được dữ liệu'; });
      //showBanner('Không tải được ghi chú từ máy chủ.');
    //} 
     finally {
     bannerRetry.disabled = false;
    }
  }

  function init() {
    const fragment = document.createDocumentFragment();
    DAYS.forEach((_, index) => {
      const c = createCard(index);
      cards.push(c);
      fragment.append(c.card);
    });
    daysRoot.append(fragment);

    tick();
    setInterval(tick, 1000);

    bannerRetry.addEventListener('click', loadNotes);
    loadNotes();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
