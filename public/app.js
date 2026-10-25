(() => {
  'use strict';

  const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const MONTHS = [
    'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu',
    'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai'
  ];
  const MAX_TASKS_PER_DAY = 20;
  const MAX_TASK_TITLE_LENGTH = 100;
  const LUNAR_TIME_ZONE = 7;
  const { createElement: h, useEffect, useMemo, useRef, useState } = React;
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

  function julianDay(day, month, year) {
    const adjustedMonth = Math.floor((14 - month) / 12);
    const adjustedYear = year + 4800 - adjustedMonth;
    const adjustedMonthNumber = month + 12 * adjustedMonth - 3;
    let julian = day + Math.floor((153 * adjustedMonthNumber + 2) / 5) +
      365 * adjustedYear + Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) - 32045;
    if (julian < 2299161) {
      julian = day + Math.floor((153 * adjustedMonthNumber + 2) / 5) +
        365 * adjustedYear + Math.floor(adjustedYear / 4) - 32083;
    }
    return julian;
  }

  function newMoonDay(k) {
    const t = k / 1236.85;
    const t2 = t * t;
    const t3 = t2 * t;
    const dr = Math.PI / 180;
    let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
    jd += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr);

    const meanAnomaly = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
    const moonAnomaly = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
    const latitudeArgument = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
    const correction = (0.1734 - 0.000393 * t) * Math.sin(meanAnomaly * dr) +
      0.0021 * Math.sin(2 * meanAnomaly * dr) -
      0.4068 * Math.sin(moonAnomaly * dr) +
      0.0161 * Math.sin(2 * moonAnomaly * dr) -
      0.0004 * Math.sin(3 * moonAnomaly * dr) +
      0.0104 * Math.sin(2 * latitudeArgument * dr) -
      0.0051 * Math.sin((meanAnomaly + moonAnomaly) * dr) -
      0.0074 * Math.sin((meanAnomaly - moonAnomaly) * dr) +
      0.0004 * Math.sin((2 * latitudeArgument + meanAnomaly) * dr) -
      0.0004 * Math.sin((2 * latitudeArgument - meanAnomaly) * dr) -
      0.0006 * Math.sin((2 * latitudeArgument + moonAnomaly) * dr) +
      0.0010 * Math.sin((2 * latitudeArgument - moonAnomaly) * dr);
    const deltaT = t < -11
      ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t2 * t2
      : -0.000278 + 0.000265 * t + 0.000262 * t2;
    return Math.floor(jd + correction - deltaT + 0.5 + LUNAR_TIME_ZONE / 24);
  }

  function sunLongitudeSector(dayNumber) {
    const t = (dayNumber - 2451545.5 - LUNAR_TIME_ZONE / 24) / 36525;
    const t2 = t * t;
    const dr = Math.PI / 180;
    const meanAnomaly = 357.52910 + 35999.05030 * t - 0.0001559 * t2 - 0.00000048 * t2 * t;
    const meanLongitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
    const equationOfCenter = (1.914600 - 0.004817 * t - 0.000014 * t2) * Math.sin(meanAnomaly * dr) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly * dr) +
      0.000290 * Math.sin(3 * meanAnomaly * dr);
    let longitude = (meanLongitude + equationOfCenter) * dr;
    longitude -= 2 * Math.PI * Math.floor(longitude / (2 * Math.PI));
    return Math.floor(longitude / Math.PI * 6);
  }

  function lunarMonth11(year) {
    const offset = julianDay(31, 12, year) - 2415021;
    const k = Math.floor(offset / 29.530588853);
    let monthStart = newMoonDay(k);
    if (sunLongitudeSector(monthStart) >= 9) monthStart = newMoonDay(k - 1);
    return monthStart;
  }

  function leapMonthOffset(monthStart) {
    const k = Math.floor(0.5 + (monthStart - 2415021) / 29.530588853);
    let previousSector = -1;
    for (let month = 1; month < 14; month += 1) {
      const sector = sunLongitudeSector(newMoonDay(k + month));
      if (sector === previousSector) return month - 1;
      previousSector = sector;
    }
    throw new Error('Không xác định được tháng nhuận âm lịch.');
  }

  function toLunarDate(day, month, year) {
    const dayNumber = julianDay(day, month, year);
    let k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = newMoonDay(k);
    while (monthStart > dayNumber) {
      k -= 1;
      monthStart = newMoonDay(k);
    }
    while (newMoonDay(k + 1) <= dayNumber) {
      k += 1;
      monthStart = newMoonDay(k);
    }

    let month11 = lunarMonth11(year);
    let nextMonth11 = month11;
    let lunarYear;
    if (month11 >= monthStart) {
      lunarYear = year;
      month11 = lunarMonth11(year - 1);
    } else {
      lunarYear = year + 1;
      nextMonth11 = lunarMonth11(year + 1);
    }

    const lunarDay = dayNumber - monthStart + 1;
    const monthOffset = Math.floor((monthStart - month11) / 29);
    let lunarMonth = monthOffset + 11;
    let isLeapMonth = false;
    if (nextMonth11 - month11 > 365) {
      const leapOffset = leapMonthOffset(month11);
      if (monthOffset >= leapOffset) {
        lunarMonth = monthOffset + 10;
        isLeapMonth = monthOffset === leapOffset;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && monthOffset < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeapMonth };
  }

  const lunarDateLabel = (lunarDate) =>
    `${lunarDate.day}/${lunarDate.month}${lunarDate.isLeapMonth ? ' nhuận' : ''}`;

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      cache: 'no-store',
      headers: options.body
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options.headers
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`);
    return data;
  }

  function LoginView({ onLogin, initialError = '' }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(initialError);
    const [submitting, setSubmitting] = useState(false);

    async function submit(event) {
      event.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        onLogin(result.username);
      } catch (loginError) {
        setError(loginError.message);
      } finally {
        setSubmitting(false);
      }
    }

    return h('main', { className: 'login-shell' },
      h('section', { className: 'login-card' },
        h('span', { className: 'eyebrow' },
          h('span', { className: 'eyebrow-dot', 'aria-hidden': 'true' }),
          'KHÔNG GIAN LÀM VIỆC'
        ),
        h('h1', null, 'Chào mừng', h('br'), h('span', null, 'bạn trở lại.')),
        h('p', { className: 'login-description' },
          'Đăng nhập để xem lịch trình tháng và cổng thông tin dùng chung.'
        ),
        error && h('p', { className: 'login-error', role: 'alert' }, error),
        h('form', { className: 'login-form', onSubmit: submit },
          h('label', { htmlFor: 'login-username' }, 'Tên tài khoản'),
          h('input', {
            id: 'login-username',
            name: 'username',
            autoComplete: 'username',
            maxLength: 254,
            value: username,
            onChange: (event) => setUsername(event.target.value),
            required: true
          }),
          h('label', { htmlFor: 'login-password' }, 'Mật khẩu'),
          h('input', {
            id: 'login-password',
            name: 'password',
            type: 'password',
            autoComplete: 'current-password',
            value: password,
            onChange: (event) => setPassword(event.target.value),
            required: true
          }),
          h('button', { className: 'btn btn-save login-submit', type: 'submit', disabled: submitting },
            submitting ? 'Đang đăng nhập...' : 'Đăng nhập'
          )
        ),
        h('p', { className: 'login-hint' }, 'Tài khoản được cấp phát bởi quản trị viên.')
      )
    );
  }

  function EntriesPortal() {
    const [entries, setEntries] = useState([]);
    const [trashEntries, setTrashEntries] = useState([]);
    const [form, setForm] = useState({ mo_ta: '', loai_thong_tin: '', noi_dung: '' });
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('Tất cả');
    const [view, setView] = useState('entries');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [restoring, setRestoring] = useState(null);
    const [notice, setNotice] = useState(null);

    async function loadEntries() {
      setLoading(true);
      try {
        const [allEntries, deletedEntries] = await Promise.all([
          apiRequest('/api/entries'),
          apiRequest('/api/entries/trash')
        ]);
        setEntries(allEntries);
        setTrashEntries(deletedEntries);
      } catch (loadError) {
        setNotice({ type: 'error', text: loadError.message });
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { loadEntries(); }, []);

    const categories = [...new Set(entries.map((entry) => entry.loai_thong_tin))];
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    const filteredEntries = entries.filter((entry) => {
      const matchesCategory = category === 'Tất cả' || entry.loai_thong_tin === category;
      const matchesQuery = !normalizedQuery ||
        `${entry.mo_ta} ${entry.loai_thong_tin} ${entry.noi_dung}`
          .toLocaleLowerCase('vi').includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });

    async function saveEntry(event) {
      event.preventDefault();
      setSaving(true);
      setNotice(null);
      try {
        await apiRequest('/api/entries', {
          method: 'POST',
          body: JSON.stringify(form)
        });
        setForm({ mo_ta: '', loai_thong_tin: '', noi_dung: '' });
        setNotice({ type: 'success', text: 'Đã lưu thông tin vào cổng thông tin dùng chung.' });
        await loadEntries();
      } catch (saveError) {
        setNotice({ type: 'error', text: saveError.message });
      } finally {
        setSaving(false);
      }
    }

    async function deleteEntry(id) {
      if (!window.confirm('Chuyển thông tin này vào thùng rác? Bạn có thể khôi phục trong vòng 30 ngày.')) return;
      setDeleting(id);
      setNotice(null);
      try {
        await apiRequest(`/api/entries/${id}`, { method: 'DELETE' });
        setEntries((current) => current.filter((entry) => entry.id !== id));
        setNotice({ type: 'success', text: 'Đã chuyển thông tin vào thùng rác. Mục này sẽ bị xóa vĩnh viễn sau 30 ngày.' });
        await loadEntries();
      } catch (deleteError) {
        setNotice({ type: 'error', text: deleteError.message });
      } finally {
        setDeleting(null);
      }
    }

    async function restoreEntry(id) {
      setRestoring(id);
      setNotice(null);
      try {
        await apiRequest(`/api/entries/${id}/restore`, { method: 'PUT' });
        setNotice({ type: 'success', text: 'Đã khôi phục thông tin về danh sách.' });
        await loadEntries();
      } catch (restoreError) {
        setNotice({ type: 'error', text: restoreError.message });
      } finally {
        setRestoring(null);
      }
    }

    return h('main', { className: 'page-shell portal-shell' },
      h('div', { className: 'container' },
        h('section', { className: 'portal-intro' },
          h('div', null,
            h('span', { className: 'section-kicker' }, 'DỮ LIỆU DÙNG CHUNG'),
            h('h1', null, 'Cổng thông tin'),
            h('p', null, 'Thông tin tại đây được lưu vào kho dữ liệu dùng chung. Mục đã xóa sẽ bị xóa vĩnh viễn sau 30 ngày.')
          ),
          h('div', { className: 'portal-count' },
            h('strong', null, String(entries.length)),
            h('span', null, 'mục đã lưu')
          )
        ),
        notice && h('div', {
          className: `portal-notice ${notice.type}`,
          role: notice.type === 'error' ? 'alert' : 'status'
        }, notice.text),
        h('div', { className: 'portal-grid' },
          h('section', { className: 'portal-panel' },
            h('div', { className: 'portal-panel-heading' },
              h('div', null, h('span', { className: 'section-kicker' }, 'KHO THÔNG TIN'), h('h2', null, 'Danh sách')),
              h('span', { className: 'portal-count-pill' },
                `${view === 'trash' ? trashEntries.length : filteredEntries.length} mục`
              )
            ),
            h('div', { className: 'portal-views', role: 'tablist', 'aria-label': 'Danh sách thông tin' },
              h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': view === 'entries',
                className: view === 'entries' ? 'active' : '',
                onClick: () => setView('entries')
              }, 'Thông tin'),
              h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': view === 'trash',
                className: view === 'trash' ? 'active' : '',
                onClick: () => setView('trash')
              }, `Thùng rác${trashEntries.length ? ` (${trashEntries.length})` : ''}`)
            ),
            view === 'entries' && h('div', { className: 'portal-filters' },
                h('input', {
                  type: 'search',
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                  placeholder: 'Tìm thông tin...',
                  'aria-label': 'Tìm thông tin'
                }),
                h('select', {
                  value: category,
                  onChange: (event) => setCategory(event.target.value),
                  'aria-label': 'Lọc theo loại thông tin'
                },
                h('option', { value: 'Tất cả' }, 'Tất cả loại'),
                categories.map((name) => h('option', { value: name, key: name }, name)))
            ),
            loading
              ? h('p', { className: 'portal-empty' }, 'Đang tải thông tin...')
              : (view === 'trash' ? trashEntries.length : filteredEntries.length) === 0
                ? h('p', { className: 'portal-empty' },
                    view === 'trash'
                      ? 'Thùng rác đang trống.'
                      : entries.length ? 'Không tìm thấy thông tin phù hợp.' : 'Chưa có thông tin nào được lưu.'
                  )
                : h('div', { className: 'portal-entry-list' },
                    (view === 'trash' ? trashEntries : filteredEntries)
                      .map((entry) => h('article', { className: 'portal-entry', key: entry.id },
                      h('div', { className: 'portal-entry-heading' },
                        h('span', { className: 'portal-entry-category' }, entry.loai_thong_tin),
                        h('time', null, view === 'trash' ? `Đã xóa ${entry.deleted_at}` : entry.created_at)
                      ),
                      h('h3', null, entry.mo_ta),
                      entry.noi_dung && h('p', null, entry.noi_dung),
                      view === 'trash'
                        ? h('button', {
                            className: 'portal-restore',
                            type: 'button',
                            onClick: () => restoreEntry(entry.id),
                            disabled: restoring === entry.id,
                            'aria-label': `Khôi phục ${entry.mo_ta}`
                          }, restoring === entry.id ? 'Đang khôi phục...' : 'Khôi phục')
                        : h('button', {
                            className: 'portal-delete',
                            type: 'button',
                            onClick: () => deleteEntry(entry.id),
                            disabled: deleting === entry.id,
                            'aria-label': `Xóa ${entry.mo_ta}`
                          }, deleting === entry.id ? 'Đang xóa...' : 'Xóa')
                    ))
                  )
          ),
          h('aside', { className: 'portal-panel portal-form-panel' },
            h('span', { className: 'section-kicker' }, 'ĐÓNG GÓP THÔNG TIN'),
            h('h2', null, 'Thêm thông tin'),
            h('p', { className: 'portal-form-description' }, 'Nội dung sẽ được chia sẻ với mọi tài khoản đã đăng nhập.'),
            h('form', { className: 'portal-form', onSubmit: saveEntry },
              h('label', { htmlFor: 'entry-category' }, 'Loại thông tin'),
              h('input', {
                id: 'entry-category',
                value: form.loai_thong_tin,
                onChange: (event) => setForm((current) => ({ ...current, loai_thong_tin: event.target.value })),
                maxLength: 100,
                required: true
              }),
              h('label', { htmlFor: 'entry-description' }, 'Mô tả ngắn'),
              h('input', {
                id: 'entry-description',
                value: form.mo_ta,
                onChange: (event) => setForm((current) => ({ ...current, mo_ta: event.target.value })),
                maxLength: 300,
                required: true
              }),
              h('label', { htmlFor: 'entry-content' }, 'Nội dung chi tiết'),
              h('textarea', {
                id: 'entry-content',
                value: form.noi_dung,
                onChange: (event) => setForm((current) => ({ ...current, noi_dung: event.target.value })),
                maxLength: 10000,
                rows: 6
              }),
              h('button', { className: 'btn btn-save portal-submit', type: 'submit', disabled: saving || loading },
                saving ? 'Đang lưu...' : 'Lưu thông tin'
              )
            )
          )
        )
      )
    );
  }

  function AccountDialog({ onClose }) {
    const emptyProfile = {
      full_name: '',
      birth_year: '',
      hometown: '',
      current_location: '',
      workplace: ''
    };
    const [section, setSection] = useState('profile');
    const [profile, setProfile] = useState(emptyProfile);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
      let active = true;
      apiRequest('/api/auth/profile')
        .then((result) => {
          if (active) {
            setProfile({ ...emptyProfile, ...result.profile });
            setProfileLoaded(true);
          }
        })
        .catch((profileError) => {
          if (active) setError(profileError.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      function handleKeyDown(event) {
        if (event.key === 'Escape') onClose();
      }
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        active = false;
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, []);

    async function saveProfile(event) {
      event.preventDefault();
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await apiRequest('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify(profile)
        });
        setNotice('Đã lưu thông tin cá nhân.');
      } catch (saveError) {
        setError(saveError.message);
      } finally {
        setSaving(false);
      }
    }

    async function changePassword(event) {
      event.preventDefault();
      setError('');
      setNotice('');
      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
      setSaving(true);
      try {
        await apiRequest('/api/auth/password', {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
          })
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setNotice('Đã thay đổi mật khẩu.');
      } catch (passwordError) {
        setError(passwordError.message);
      } finally {
        setSaving(false);
      }
    }

    function profileField(id, label, key, maxLength, placeholder = '') {
      return h(React.Fragment, { key: id },
        h('label', { htmlFor: id }, label),
        h('input', {
          id,
          value: profile[key],
          maxLength,
          placeholder,
          onChange: (event) => setProfile((current) => ({ ...current, [key]: event.target.value }))
        })
      );
    }

    return h('div', {
      className: 'dialog-backdrop',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) onClose();
      }
    },
    h('section', {
      className: 'task-dialog account-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'account-dialog-title'
    },
    h('button', {
      type: 'button',
      className: 'dialog-close',
      onClick: onClose,
      'aria-label': 'Đóng'
    }, '×'),
    h('span', { className: 'section-kicker' }, 'TÀI KHOẢN'),
    h('h2', { id: 'account-dialog-title' }, 'Thông tin của bạn'),
    h('div', { className: 'account-dialog-tabs', role: 'tablist', 'aria-label': 'Cài đặt tài khoản' },
      h('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': section === 'profile',
        className: section === 'profile' ? 'active' : '',
        onClick: () => { setSection('profile'); setError(''); setNotice(''); }
      }, 'Thông tin cá nhân'),
      h('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': section === 'password',
        className: section === 'password' ? 'active' : '',
        onClick: () => { setSection('password'); setError(''); setNotice(''); }
      }, 'Đổi mật khẩu')
    ),
    error && h('p', { className: 'account-message error', role: 'alert' }, error),
    notice && h('p', { className: 'account-message success', role: 'status' }, notice),
    loading
      ? h('p', { className: 'login-loading' }, 'Đang tải thông tin tài khoản...')
      : !profileLoaded
        ? h('p', { className: 'account-form-hint' }, 'Không thể tải hồ sơ. Hãy đóng cửa sổ và thử lại.')
        : section === 'profile'
        ? h('form', { className: 'account-form', onSubmit: saveProfile },
            profileField('profile-full-name', 'Họ và tên', 'full_name', 120, 'Nguyễn Văn An'),
            h('label', { htmlFor: 'profile-birth-year' }, 'Năm sinh'),
            h('input', {
              id: 'profile-birth-year',
              type: 'number',
              min: 1900,
              max: new Date().getFullYear(),
              value: profile.birth_year,
              onChange: (event) => setProfile((current) => ({ ...current, birth_year: event.target.value }))
            }),
            profileField('profile-hometown', 'Quê quán', 'hometown', 200),
            profileField('profile-current-location', 'Nơi ở hiện tại', 'current_location', 200),
            profileField('profile-workplace', 'Nơi làm việc', 'workplace', 200),
            h('button', { className: 'btn btn-save', type: 'submit', disabled: saving },
              saving ? 'Đang lưu...' : 'Lưu thông tin'
            )
          )
        : h('form', { className: 'account-form', onSubmit: changePassword },
            h('label', { htmlFor: 'current-password' }, 'Mật khẩu hiện tại'),
            h('input', {
              id: 'current-password',
              type: 'password',
              autoComplete: 'current-password',
              maxLength: 1024,
              value: currentPassword,
              onChange: (event) => setCurrentPassword(event.target.value),
              required: true
            }),
            h('label', { htmlFor: 'new-password' }, 'Mật khẩu mới'),
            h('input', {
              id: 'new-password',
              type: 'password',
              autoComplete: 'new-password',
              minLength: 8,
              maxLength: 1024,
              value: newPassword,
              onChange: (event) => setNewPassword(event.target.value),
              required: true
            }),
            h('label', { htmlFor: 'confirm-password' }, 'Xác nhận mật khẩu mới'),
            h('input', {
              id: 'confirm-password',
              type: 'password',
              autoComplete: 'new-password',
              minLength: 8,
              maxLength: 1024,
              value: confirmPassword,
              onChange: (event) => setConfirmPassword(event.target.value),
              required: true
            }),
            h('p', { className: 'account-form-hint' }, 'Mật khẩu mới cần có ít nhất 8 ký tự.'),
            h('button', { className: 'btn btn-save', type: 'submit', disabled: saving },
              saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'
            )
          )
    ));
  }

  function Workspace({ username, onLogout }) {
    const [activeView, setActiveView] = useState('calendar');
    const [logoutError, setLogoutError] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);

    async function logout() {
      setLogoutError('');
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
        onLogout();
      } catch (error) {
        setLogoutError(error.message);
      }
    }

    return h('div', { className: 'workspace' },
      h('header', { className: 'workspace-bar' },
        h('a', { className: 'workspace-brand', href: '/', 'aria-label': 'Trang chủ' },
          h('span', { className: 'workspace-brand-mark' }, '✳'),
          h('span', null, 'Không gian chung')
        ),
        h('nav', { className: 'workspace-tabs', 'aria-label': 'Tính năng' },
          h('button', {
            type: 'button',
            className: `workspace-tab${activeView === 'calendar' ? ' active' : ''}`,
            onClick: () => setActiveView('calendar')
          }, 'Lịch trình tháng'),
          h('button', {
            type: 'button',
            className: `workspace-tab${activeView === 'entries' ? ' active' : ''}`,
            onClick: () => setActiveView('entries')
          }, 'Cổng thông tin')
        ),
        h('div', { className: 'workspace-account' },
          h('button', {
            className: 'workspace-username',
            type: 'button',
            onClick: () => setAccountOpen(true),
            'aria-label': `Mở cài đặt tài khoản ${username}`
          }, h('span', { 'aria-hidden': 'true' }, '◉'), username),
          h('button', { className: 'workspace-logout', type: 'button', onClick: logout }, 'Đăng xuất')
        )
      ),
      logoutError && h('p', { className: 'workspace-error', role: 'alert' }, logoutError),
      accountOpen && h(AccountDialog, { onClose: () => setAccountOpen(false) }),
      activeView === 'calendar' ? h(CalendarApp) : h(EntriesPortal)
    );
  }

  function AuthenticatedApp() {
    const [username, setUsername] = useState(null);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      let active = true;
      apiRequest('/api/auth/session')
        .then((session) => {
          if (active && session.authenticated) setUsername(session.username);
        })
        .catch((sessionError) => {
          if (active) setError(sessionError.message);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
      return () => { active = false; };
    }, []);

    if (checking) {
      return h('main', { className: 'login-shell' }, h('p', { className: 'login-loading' }, 'Đang kiểm tra phiên đăng nhập...'));
    }
    if (username) return h(Workspace, { username, onLogout: () => setUsername(null) });
    return h(LoginView, { onLogin: setUsername, initialError: error });
  }

  function CalendarApp() {
    const [today, setToday] = useState(() => new Date());
    const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [tasksByDate, setTasksByDate] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);
    const [savingDates, setSavingDates] = useState({});
    const [dayErrors, setDayErrors] = useState({});
    const [activeDate, setActiveDate] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const titleInput = useRef(null);

    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const monthKey = `${year}-${pad(month + 1)}`;
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const todayLunarDate = toLunarDate(today.getDate(), today.getMonth() + 1, today.getFullYear());
    const monthTasks = Object.entries(tasksByDate)
      .filter(([date]) => date.startsWith(`${monthKey}-`))
      .flatMap(([, tasks]) => tasks);
    const completeCount = monthTasks.filter((task) => task.done).length;
    const pendingCount = monthTasks.length - completeCount;
    const selectedTasks = tasksByDate[activeDate] || [];

    const calendarDays = useMemo(() => {
      const offset = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return [
        ...Array(offset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
      ];
    }, [year, month]);

    useEffect(() => {
      const timer = window.setInterval(() => setToday(new Date()), 60_000);
      return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
      let active = true;
      setLoading(true);
      setLoadError('');

      fetch(`/api/tasks?month=${monthKey}`, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (active) setTasksByDate(data.tasks && typeof data.tasks === 'object' ? data.tasks : {});
        })
        .catch(() => {
          if (active) setLoadError('Không tải được lịch trình. Hãy kiểm tra kết nối rồi thử lại.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => { active = false; };
    }, [monthKey, refreshToken]);

    useEffect(() => {
      if (loading || !window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const context = window.gsap.context(() => {
        window.gsap.fromTo(
          '.calendar-cell:not(.is-empty)',
          { y: 10, opacity: 0.5 },
          { y: 0, opacity: 1, duration: 0.32, stagger: 0.018, ease: 'power2.out' }
        );
      });
      return () => context.revert();
    }, [monthKey, loading]);

    useEffect(() => {
      if (!activeDate) return undefined;
      titleInput.current?.focus();

      function handleKeyDown(event) {
        if (event.key === 'Escape') closeDialog();
      }
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeDate]);

    function changeMonth(amount) {
      setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    }

    function goToToday() {
      const current = new Date();
      setToday(current);
      setViewMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    }

    function setDateTasks(date, tasks) {
      setTasksByDate((current) => ({ ...current, [date]: tasks }));
      setDayErrors((current) => ({ ...current, [date]: '' }));
    }

    async function saveTasks(date, tasks) {
      setSavingDates((current) => ({ ...current, [date]: true }));
      setDayErrors((current) => ({ ...current, [date]: '' }));
      try {
        const response = await fetch(`/api/tasks/${date}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setDateTasks(date, tasks);
        return true;
      } catch {
        setDayErrors((current) => ({ ...current, [date]: 'Chưa lưu được. Hãy thử lại.' }));
        return false;
      } finally {
        setSavingDates((current) => ({ ...current, [date]: false }));
      }
    }

    function openDialog(date) {
      setNewTitle('');
      setActiveDate(date);
    }

    function closeDialog() {
      setActiveDate('');
      setNewTitle('');
    }

    async function addTask(event) {
      event.preventDefault();
      const title = newTitle.trim();
      if (!title || !activeDate || savingDates[activeDate]) return;
      if (title.length > MAX_TASK_TITLE_LENGTH || selectedTasks.length >= MAX_TASKS_PER_DAY) return;

      const task = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title,
        done: false
      };
      if (await saveTasks(activeDate, [...selectedTasks, task])) closeDialog();
    }

    async function toggleTask(date, taskId) {
      if (savingDates[date]) return;
      const tasks = tasksByDate[date] || [];
      await saveTasks(date, tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ));
    }

    async function removeTask(date, taskId) {
      if (savingDates[date]) return;
      const tasks = tasksByDate[date] || [];
      await saveTasks(date, tasks.filter((task) => task.id !== taskId));
    }

    return h('div', { className: 'page-shell' },
      h('div', { className: 'container' },
        h('header', { className: 'hero' },
          h('div', { className: 'hero-copy' },
            h('span', { className: 'eyebrow' },
              h('span', { className: 'eyebrow-dot', 'aria-hidden': 'true' }),
              'GÓC NHỎ CỦA BẠN'
            ),
            h('h1', null, 'Tháng mới,', h('br'), h('span', null, 'việc hay mỗi ngày.')),
            h('p', { className: 'hero-description' },
              'Sắp xếp lịch trình tháng này thật nhẹ nhàng. Thêm việc cần làm vào từng ngày và dễ dàng theo dõi tiến độ.'
            ),
            h('div', { className: 'month-progress', 'aria-live': 'polite' },
              h('span', { className: 'progress-number' }, String(completeCount)),
              h('span', { className: 'progress-copy' },
                h('strong', null, `việc đã hoàn thành · ${pendingCount} việc đang chờ`),
                h('span', null, 'Mỗi việc hoàn thành là một bước tiến nhỏ.')
              )
            )
          ),
          h('aside', { className: 'clock-panel', 'aria-label': 'Ngày hôm nay' },
            h('div', { className: 'clock-label' },
              h('span', { className: 'clock-indicator', 'aria-hidden': 'true' }),
              'HÔM NAY'
            ),
            h('time', { className: 'today-number' },
              pad(today.getDate()),
              h('span', { className: 'today-month' }, MONTHS[today.getMonth()])
            ),
            h('div', { className: 'clock-date' },
              `${WEEKDAYS[(today.getDay() + 6) % 7]}, ${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`
            ),
            h('div', { className: 'clock-lunar-date' },
              `Âm lịch: ${lunarDateLabel(todayLunarDate)}`
            ),
            h('div', { className: 'clock-decoration', 'aria-hidden': 'true' })
          )
        ),
        loadError && h('div', { className: 'banner', role: 'alert' },
          h('span', null, loadError),
          h('button', {
            type: 'button',
            className: 'btn btn-retry',
            onClick: () => setRefreshToken((current) => current + 1)
          }, 'Thử tải lại')
        ),
        h('main', { className: 'calendar-section', 'aria-label': 'Lịch trình theo tháng' },
          h('div', { className: 'calendar-toolbar' },
            h('div', { className: 'month-heading' },
              h('span', { className: 'section-kicker' }, 'KẾ HOẠCH CỦA BẠN'),
              h('h2', { 'aria-live': 'polite' }, `${MONTHS[month]} ${year}`)
            ),
            h('div', { className: 'calendar-controls' },
              h('button', {
                type: 'button',
                className: 'btn btn-today',
                onClick: goToToday,
                'aria-label': 'Về tháng hiện tại'
              }, 'Hôm nay'),
              h('div', { className: 'month-arrows' },
                h('button', {
                  type: 'button',
                  className: 'icon-button',
                  onClick: () => changeMonth(-1),
                  'aria-label': 'Tháng trước'
                }, '‹'),
                h('button', {
                  type: 'button',
                  className: 'icon-button',
                  onClick: () => changeMonth(1),
                  'aria-label': 'Tháng sau'
                }, '›')
              )
            )
          ),
          h('div', { className: 'calendar-grid', 'aria-busy': loading },
            WEEKDAYS.map((day, index) => h('div', { className: 'weekday', key: day },
              h('span', { className: 'weekday-full' }, day),
              h('span', { className: 'weekday-short' }, ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index])
            )),
            calendarDays.map((day, index) => {
              if (!day) return h('div', { className: 'calendar-cell is-empty', key: `empty-${index}` });
              const date = dateKey(year, month, day);
              const lunarDate = toLunarDate(day, month + 1, year);
              const tasks = tasksByDate[date] || [];
              const isToday = date === todayKey;
              const visibleTasks = tasks.slice(0, 2);
              const extraTasks = tasks.length - visibleTasks.length;

              return h('section', {
                className: `calendar-cell${isToday ? ' is-today' : ''}${tasks.length ? ' has-tasks' : ''}`,
                key: date,
                role: 'group',
                tabIndex: 0,
                'aria-label': `${day} ${MONTHS[month]}, ngày ${lunarDateLabel(lunarDate)} âm lịch${tasks.length ? `, ${tasks.length} công việc` : ''}`,
                onClick: (event) => {
                  if (!event.target.closest('button')) openDialog(date);
                },
                onKeyDown: (event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    openDialog(date);
                  }
                }
              },
              h('div', { className: 'cell-top' },
                h('div', { className: 'cell-date-labels' },
                  h('span', { className: `date-number${isToday ? ' today-number-badge' : ''}` }, day),
                  h('span', {
                    className: 'lunar-date',
                    title: `Ngày ${lunarDateLabel(lunarDate)} âm lịch`
                  }, lunarDateLabel(lunarDate))
                ),
                h('button', {
                  type: 'button',
                  className: 'add-task-button',
                  onClick: () => openDialog(date),
                  'aria-label': `Thêm công việc ngày ${day}`
                }, '+')
              ),
              h('div', { className: 'cell-tasks' },
                visibleTasks.map((task) => h('div', {
                  className: `task-chip${task.done ? ' is-done' : ''}`,
                  key: task.id
                },
                h('button', {
                  type: 'button',
                  className: 'task-toggle',
                  disabled: Boolean(savingDates[date]),
                  onClick: () => toggleTask(date, task.id),
                  'aria-label': `${task.done ? 'Đánh dấu chưa xong' : 'Hoàn thành'}: ${task.title}`,
                  title: task.title
                },
                h('span', { className: 'task-check', 'aria-hidden': 'true' }, task.done ? '✓' : ''),
                h('span', { className: 'task-title' }, task.title)),
                h('button', {
                  type: 'button',
                  className: 'task-delete',
                  disabled: Boolean(savingDates[date]),
                  onClick: () => removeTask(date, task.id),
                  'aria-label': `Xóa công việc: ${task.title}`
                }, '×'))),
                extraTasks > 0 && h('span', { className: 'more-tasks' }, `+${extraTasks} việc nữa`),
                dayErrors[date] && h('span', { className: 'cell-error', role: 'status' }, dayErrors[date])
              )
              );
            })
          ),
          loading && h('p', { className: 'loading-note', role: 'status' }, 'Đang tải lịch trình...'),
          h('div', { className: 'calendar-legend' },
            h('span', { className: 'legend-item' },
              h('span', { className: 'legend-dot legend-today', 'aria-hidden': 'true' }),
              'Hôm nay'
            ),
            h('span', { className: 'legend-item' },
              h('span', { className: 'legend-dot legend-task', 'aria-hidden': 'true' }),
              'Công việc'
            ),
            h('span', { className: 'legend-hint' }, 'Nhấn + để thêm việc vào ngày bất kỳ')
          )
        ),
        h('footer', { className: 'footer-note' },
          h('span', { className: 'footer-sparkle', 'aria-hidden': 'true' }, '✳'),
          'Những điều nhỏ bé cũng xứng đáng được ghi lại.'
        )
      ),
      activeDate && h('div', {
        className: 'dialog-backdrop',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) closeDialog();
        }
      },
      h('section', {
        className: 'task-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dialog-title'
      },
      h('button', {
        type: 'button',
        className: 'dialog-close',
        onClick: closeDialog,
        'aria-label': 'Đóng'
      }, '×'),
      h('span', { className: 'section-kicker' }, 'THÊM VÀO LỊCH'),
      h('h2', { id: 'dialog-title' }, `${pad(Number(activeDate.slice(-2)))}/${pad(month + 1)}/${year}`),
      h('p', { className: 'dialog-lunar-date' },
        `Âm lịch: ${lunarDateLabel(toLunarDate(
          Number(activeDate.slice(-2)),
          Number(activeDate.slice(5, 7)),
          Number(activeDate.slice(0, 4))
        ))}`
      ),
      h('p', { className: 'dialog-description' }, 'Việc gì bạn muốn nhớ làm vào ngày này?'),
      dayErrors[activeDate] && h('p', { className: 'dialog-error', role: 'alert' }, dayErrors[activeDate]),
      selectedTasks.length > 0 && h('div', { className: 'dialog-task-list' },
        h('h3', null, 'Việc trong ngày này'),
        selectedTasks.map((task) => h('div', {
          className: `dialog-task${task.done ? ' is-done' : ''}`,
          key: task.id
        },
        h('button', {
          type: 'button',
          className: 'task-toggle',
          disabled: Boolean(savingDates[activeDate]),
          onClick: () => toggleTask(activeDate, task.id),
          'aria-label': `${task.done ? 'Đánh dấu chưa xong' : 'Hoàn thành'}: ${task.title}`
        },
        h('span', { className: 'task-check', 'aria-hidden': 'true' }, task.done ? '✓' : ''),
        h('span', { className: 'task-title' }, task.title)),
        h('button', {
          type: 'button',
          className: 'dialog-task-delete',
          disabled: Boolean(savingDates[activeDate]),
          onClick: () => removeTask(activeDate, task.id),
          'aria-label': `Xóa công việc: ${task.title}`
        }, 'Xóa')))
      ),
      h('form', { onSubmit: addTask },
        h('label', { className: 'sr-only', htmlFor: 'new-task-title' }, 'Tên công việc'),
        h('input', {
          ref: titleInput,
          id: 'new-task-title',
          className: 'task-input',
          type: 'text',
          maxLength: MAX_TASK_TITLE_LENGTH,
          placeholder: 'Ví dụ: Họp nhóm lúc 10 giờ',
          value: newTitle,
          onChange: (event) => setNewTitle(event.target.value),
          required: true
        }),
        h('div', { className: 'dialog-footer' },
          h('span', { className: 'input-counter' }, `${newTitle.length}/${MAX_TASK_TITLE_LENGTH}`),
          h('button', {
            type: 'submit',
            className: 'btn btn-save',
            disabled: !newTitle.trim() || Boolean(savingDates[activeDate]) ||
              selectedTasks.length >= MAX_TASKS_PER_DAY
          }, savingDates[activeDate] ? 'Đang lưu...' : 'Thêm công việc')
        ),
        selectedTasks.length >= MAX_TASKS_PER_DAY &&
          h('p', { className: 'dialog-error', role: 'status' }, 'Ngày này đã đạt giới hạn 20 công việc.')
      ))
      ),
      h('div', { className: 'sr-only', 'aria-live': 'polite' },
        `${monthTasks.length} công việc trong tháng`
      )
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(AuthenticatedApp));
})();
