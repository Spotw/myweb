(() => {
  'use strict';

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const MAX_LEN = 2000;

  const week = document.getElementById('week');
  const clockTime = document.getElementById('clock-time');
  const clockDate = document.getElementById('clock-date');
  const banner = document.getElementById('banner');
  const cells = [];
  let currentToday = -1;

  // 0 = Thứ 2 ... 6 = Chủ nhật
  const todayIndex = () => (new Date().getDay() + 6) % 7;
  const hhmm = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  // ---------- Đồng hồ ----------
  function tick() {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    clockDate.textContent = now.toLocaleDateString('vi-VN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const today = todayIndex();
    if (today !== currentToday) {
      currentToday = today;
      cells.forEach((c, i) => {
        c.card.classList.toggle('is-today', i === today);
        c.badge.hidden = i !== today;
      });
    }
  }

  // ---------- Ô từng ngày ----------
  function setStatus(cell, text, cls) {
    cell.status.textContent = text;
    cell.status.className = 'status' + (cls ? ' ' + cls : '');
  }

  function buildCell(index) {
    const card = document.createElement('section');
    card.className = 'day';
    card.setAttribute('aria-labelledby', `title-${index}`);

    const head = document.createElement('div');
    head.className = 'day-head';
    const title = document.createElement('h2');
    title.className = 'day-name';
    title.id = `title-${index}`;
    title.textContent = DAYS[index];
    const badge = document.createElement('span');
    badge.className = 'day-badge';
    badge.textContent = 'Hôm nay';
    badge.hidden = true;
    head.append(title, badge);

    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    label.htmlFor = `content-${index}`;
    label.textContent = 'Nội dung';
    const area = document.createElement('textarea');
    area.id = `content-${index}`;
    area.maxLength = MAX_LEN;
    area.placeholder = 'Đang tải...';
    area.disabled = true;
    field.append(label, area);

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
    foot.append(btn, status);

    card.append(head, field, foot);
    const cell = { card, badge, area, btn, status };

    area.addEventListener('input', () => setStatus(cell, 'Chưa lưu', 'is-dirty'));
    btn.addEventListener('click', () => save(index));
    return cell;
  }

  async function save(index) {
    const cell = cells[index];
    cell.btn.disabled = true;
    setStatus(cell, 'Đang lưu...', 'is-dirty');
    try {
      const res = await fetch(`/api/notes/${index}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: cell.area.value })
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(cell, `Đã lưu lúc ${hhmm(new Date())}`);
    } catch {
      setStatus(cell, 'Không lưu được. Hãy thử lại.', 'is-error');
    } finally {
      cell.btn.disabled = false;
    }
  }

  async function load() {
    banner.hidden = true;
    try {
      const res = await fetch('/api/notes');
      if (!res.ok) throw new Error(String(res.status));
      const { notes } = await res.json();
      notes.forEach((note, i) => {
        const cell = cells[i];
        cell.area.value = note.content || '';
        cell.area.placeholder = 'Nhập nội dung...';
        cell.area.disabled = false;
        cell.btn.disabled = false;
        if (note.updatedAt) setStatus(cell, `Lưu lúc ${hhmm(new Date(note.updatedAt))}`);
      });
    } catch {
      banner.hidden = false;
    }
  }

  // ---------- Khởi động ----------
  DAYS.forEach((_, i) => {
    const cell = buildCell(i);
    cells.push(cell);
    week.append(cell.card);
  });

  tick();
  setInterval(tick, 1000);
  document.getElementById('retry').addEventListener('click', load);
  load();

  // Trên màn hình hẹp, cuộn tới ô của hôm nay
  cells[todayIndex()].card.scrollIntoView({ inline: 'center', block: 'nearest' });
})();
