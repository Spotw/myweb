(() => {
  'use strict';

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const STORAGE_PREFIX = 'ghichu_thu_';
  const LEGACY_KEY = 'thu2'; // khóa cũ của bản đầu tiên (chỉ có Thứ 2)
  const AUTOSAVE_DELAY_MS = 800;

  // ---------- Lưu trữ (có bắt lỗi) ----------
  function readNote(index) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + index);
      if (!raw) return { content: '', note: '' };
      const data = JSON.parse(raw);
      return {
        content: typeof data.content === 'string' ? data.content : '',
        note: typeof data.note === 'string' ? data.note : ''
      };
    } catch {
      return { content: '', note: '' };
    }
  }

  function writeNote(index, value) {
    try {
      if (!value.content.trim() && !value.note.trim()) {
        localStorage.removeItem(STORAGE_PREFIX + index);
      } else {
        localStorage.setItem(STORAGE_PREFIX + index, JSON.stringify(value));
      }
      return true;
    } catch {
      return false;
    }
  }

  // Chuyển dữ liệu Thứ 2 từ bản cũ sang khóa mới (chạy một lần)
  function migrateLegacy() {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (!legacy) return;
      if (!localStorage.getItem(STORAGE_PREFIX + 0)) {
        const data = JSON.parse(legacy);
        writeNote(0, {
          content: typeof data.content === 'string' ? data.content : '',
          note: typeof data.note === 'string' ? data.note : ''
        });
      }
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* bỏ qua dữ liệu cũ bị hỏng */
    }
  }

  // ---------- Giao diện ----------
  function todayIndex() {
    // getDay(): 0 = Chủ nhật ... 6 = Thứ 7  ->  0 = Thứ 2 ... 6 = Chủ nhật
    return (new Date().getDay() + 6) % 7;
  }

  function createField(id, labelText, placeholder, value) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;

    const area = document.createElement('textarea');
    area.id = id;
    area.name = id;
    area.rows = 3;
    area.placeholder = placeholder;
    area.value = value;

    wrap.append(label, area);
    return { wrap, area };
  }

  function createDayCard(index, isToday) {
    const saved = readNote(index);

    const card = document.createElement('section');
    card.className = 'day' + (isToday ? ' is-today' : '');
    card.setAttribute('aria-labelledby', `day-title-${index}`);

    const head = document.createElement('div');
    head.className = 'day-head';
    const title = document.createElement('h2');
    title.className = 'day-name';
    title.id = `day-title-${index}`;
    title.textContent = DAYS[index];
    head.append(title);
    if (isToday) {
      const badge = document.createElement('span');
      badge.className = 'day-badge';
      badge.textContent = 'Hôm nay';
      head.append(badge);
    }

    const content = createField(`content-${index}`, 'Nội dung:', 'Nhập nội dung...', saved.content);
    const note = createField(`note-${index}`, 'Lưu ý:', 'Nhập lưu ý...', saved.note);

    const foot = document.createElement('div');
    foot.className = 'day-foot';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-save';
    saveBtn.textContent = 'Lưu';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn btn-clear';
    clearBtn.textContent = 'Xóa';

    const status = document.createElement('span');
    status.className = 'status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    foot.append(saveBtn, clearBtn, status);
    card.append(head, content.wrap, note.wrap, foot);

    function showStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    }

    function save() {
      clearTimeout(timer);
      const ok = writeNote(index, { content: content.area.value, note: note.area.value });
      if (!ok) {
        showStatus('Không lưu được. Trình duyệt đang chặn lưu trữ.', true);
        return;
      }
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      showStatus(`Đã lưu lúc ${time}`);
    }

    let timer;
    function scheduleSave() {
      showStatus('');
      clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    }

    content.area.addEventListener('input', scheduleSave);
    note.area.addEventListener('input', scheduleSave);
    saveBtn.addEventListener('click', save);

    clearBtn.addEventListener('click', () => {
      if (!content.area.value && !note.area.value) return;
      if (!window.confirm(`Xóa ghi chú của ${DAYS[index]}?`)) return;
      clearTimeout(timer);
      content.area.value = '';
      note.area.value = '';
      const ok = writeNote(index, { content: '', note: '' });
      showStatus(ok ? 'Đã xóa' : 'Không xóa được. Trình duyệt đang chặn lưu trữ.', !ok);
    });

    return card;
  }

  function init() {
    const root = document.getElementById('week');
    if (!root) return;

    migrateLegacy();

    const today = todayIndex();
    const fragment = document.createDocumentFragment();
    DAYS.forEach((_, index) => fragment.append(createDayCard(index, index === today)));
    root.append(fragment);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
