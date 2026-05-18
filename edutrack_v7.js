/**
 * ============================================================
 * EduTrack – برنامج تدبير حراسة البكالوريا  v7.0
 *
 * التعديلات الرئيسية في v7:
 * 1. الاستدعاء = وثيقة حضور رسمية (اليوم + التاريخ + الفترات) بدون قاعات
 * 2. جدول الامتحانات: كل يوم = فترة صباحية + فترة مسائية (علمي / أدبي)
 * 3. رموز المواد داخلية فقط — الوثائق تعرض الأسماء العربية الكاملة
 * 4. فصل واضح: استدعاء حضور ≠ وثيقة توزيع القاعات
 * 5. منطق مسلك: علمي / أدبي / مشترك
 * ============================================================
 */


// ============================================================
// SUBJECT CODES – داخلي فقط، لا تظهر في الوثائق
// ============================================================
const SUBJECT_CODES = {
  'AR':   'اللغة العربية',
  'FR':   'اللغة الفرنسية',
  'ANG':  'اللغة الإنجليزية',
  'ESP':  'التربية البدنية',
  'MAT':  'الرياضيات',
  'PC':   'الفيزياء والكيمياء',
  'SVT':  'علوم الحياة والأرض',
  'HG':   'التاريخ والجغرافيا',
  'PHIL': 'الفلسفة',
  'EI':   'التربية الإسلامية',
  'INF':  'الإعلاميات',
  'ISL':  'الفقه والأصول',
  'MATH_LIT': 'الرياضيات (أدبي)',
};

const SUBJECT_NAME_TO_CODE = {};
Object.entries(SUBJECT_CODES).forEach(([code, name]) => {
  SUBJECT_NAME_TO_CODE[name] = code;
});

/** إرجاع الاسم العربي الكامل من رمز أو اسم */
function subjectDisplayName(codeOrName) {
  if (!codeOrName) return '';
  const upper = String(codeOrName).trim().toUpperCase();
  if (SUBJECT_CODES[upper]) return SUBJECT_CODES[upper];
  return String(codeOrName).trim(); // إذا كان اسماً عربياً أصلاً
}

/** تطبيع الرمز */
function normalizeSubjectCode(subjectOrCode) {
  if (!subjectOrCode) return '';
  const s = String(subjectOrCode).trim().toUpperCase();
  if (SUBJECT_CODES[s]) return s;
  const code = SUBJECT_NAME_TO_CODE[subjectOrCode.trim()];
  if (code) return code;
  for (const [c, name] of Object.entries(SUBJECT_CODES)) {
    if (name.includes(subjectOrCode.trim()) || subjectOrCode.trim().includes(name)) return c;
  }
  return s.substring(0, 8);
}

// ============================================================
// STATE
// ============================================================
const STATE_KEY = 'edutrack_v7';

/*
  بنية جدول الامتحانات الجديدة:
  examDays: [
    {
      day: 'الاثنين',
      date: '2026-06-08',         // تاريخ اليوم
      morning: {                   // الفترة الصباحية
        subjectSci: 'اللغة الفرنسية',
        subjectLit: 'اللغة الفرنسية',
        from: '08:00', to: '10:00',
        track: 'both'  // 'sci' | 'lit' | 'both'
      } | null,
      afternoon: {                 // الفترة المسائية
        subjectSci: 'الرياضيات',
        subjectLit: '---',
        from: '15:00', to: '17:00',
        track: 'sci'
      } | null
    }, ...
  ]
*/
let state = {
  teachers:    [],
  schedule:    {},
  numRooms:    10,
  numSessions: 3,
  examSubject: '',
  info: {
    j_academie:      '',
    j_direction:     '',
    j_etablissement: '',
    j_ville:         '',
    j_annee:         '2024/2025',
    j_session:       'دورة ماي 2025',
    j_centre:        '',
    w_academie:      '',
    w_direction:     '',
    w_etablissement: '',
    w_ville:         '',
    w_annee:         '2024/2025',
    w_session:       'دورة يونيو 2025',
    w_centre:        '',
    j_examDays: [
      {
        day:  'الاثنين',
        date: '2026-06-08',
        sessions: [
          { period: 'morning',   subject: 'اللغة الفرنسية',  sciFrom: '08:00', sciTo: '10:00', litFrom: '08:00', litTo: '10:00' },
          { period: 'afternoon', subject: 'اللغة العربية',    sciFrom: '15:00', sciTo: '17:00', litFrom: '15:00', litTo: '17:00' },
        ],
      },
      {
        day:  'الثلاثاء',
        date: '2026-06-09',
        sessions: [
          { period: 'morning',   subject: 'الرياضيات',        sciFrom: '', sciTo: '', litFrom: '08:00', litTo: '10:00' },
          { period: 'morning',   subject: 'الفيزياء والكيمياء', sciFrom: '08:00', sciTo: '10:00', litFrom: '', litTo: '' },
          { period: 'afternoon', subject: 'التاريخ والجغرافيا', sciFrom: '15:00', sciTo: '17:00', litFrom: '15:00', litTo: '17:00' },
        ],
      },
    ],
    w_examDays: [
      {
        day:  'الخميس',
        date: '2026-06-18',
        sessions: [
          { period: 'morning',   subject: 'الفيزياء والكيمياء', sciFrom: '08:00', sciTo: '10:00', litFrom: '', litTo: '' },
          { period: 'afternoon', subject: 'اللغة الإنجليزية',   sciFrom: '15:00', sciTo: '17:00', litFrom: '15:00', litTo: '17:00' },
        ],
      },
    ],
  },
};

// ============================================================
// PERSIST
// ============================================================
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = deepMerge(state, saved);
    }
  } catch (_) {}
}

function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

/** تنسيق التاريخ من YYYY-MM-DD إلى DD/MM/YYYY */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

// ============================================================
// EXEMPTION UTILS
// ============================================================
function isTeacherExempt(teacher, examSubjectCode) {
  if (!examSubjectCode || !teacher.subjectCode) return false;
  return teacher.subjectCode.toUpperCase() === examSubjectCode.toUpperCase();
}

function isTeacherAvailable(teacher, examSubjectCode) {
  if (teacher.forceAssign) return true;
  return !isTeacherExempt(teacher, examSubjectCode);
}

// ============================================================
// APP
// ============================================================
const App = {

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  init() {
    loadState();
    this._bindNavTabs();
    this._populateInfoFields();
    this._renderExamDaysTables();
    this.refreshTeachers();
    this.updateStats();
    this._updateInvTeacherSelect();
    this._populateExamSubjectSelect();
    this.goTab('dashboard');
  },

  // ----------------------------------------------------------
  // NAV
  // ----------------------------------------------------------
  _bindNavTabs() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.goTab(btn.dataset.tab));
    });
  },

  goTab(tab) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('tab-' + tab);
    if (sec) sec.classList.add('active');
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    if (tab === 'dashboard')   this.updateDashboard();
    if (tab === 'invitations') { this.updateStats(); this._updateInvTeacherSelect(); }
    if (tab === 'schedule')    this._populateExamSubjectSelect();
  },

  // ----------------------------------------------------------
  // GENERAL INFO
  // ----------------------------------------------------------
  _infoFields: [
    'j_academie','j_direction','j_etablissement','j_ville','j_annee','j_session','j_centre',
    'w_academie','w_direction','w_etablissement','w_ville','w_annee','w_session','w_centre',
  ],

  _populateInfoFields() {
    this._infoFields.forEach(id => {
      const el = document.getElementById(id);
      if (el && state.info[id] !== undefined) el.value = state.info[id];
    });
  },

  saveInfo() {
    this._infoFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) state.info[id] = el.value.trim();
    });
    state.info.j_examDays = this._readExamDays('j');
    state.info.w_examDays = this._readExamDays('w');
    saveState();
    toast('تم حفظ المعطيات بنجاح ✓', 'success');
  },

  // ----------------------------------------------------------
  // EXAM DAYS TABLE – بنية جديدة: كل يوم → مصفوفة حصص (مادة + توقيت علمي/أدبي)
  // ----------------------------------------------------------
  _renderExamDaysTables() {
    ['j', 'w'].forEach(p => {
      const body = document.getElementById(`${p}_examdays_body`);
      if (!body) return;
      body.innerHTML = '';
      const days = state.info[`${p}_examDays`] || [];
      days.forEach(d => body.appendChild(this._createExamDayRow(d)));
    });
  },

  /** يبني صف يوم كامل مع جميع حصصه – باستخدام DOM مباشرةً */
  _createExamDayRow(data) {
    data = data || {};
    const sessions = data.sessions || [
      { period: 'morning', subject: '', sciFrom: '08:00', sciTo: '10:00', litFrom: '08:00', litTo: '10:00' }
    ];

    const tr = document.createElement('tr');

    // خلية اليوم والتاريخ
    const tdInfo = document.createElement('td');
    tdInfo.className = 'examday-info-cell';
    tdInfo.style.cssText = 'vertical-align:top;padding:10px 8px;min-width:170px';

    const dayInput = document.createElement('input');
    dayInput.className = 'form-control sm';
    dayInput.type = 'text';
    dayInput.value = data.day || '';
    dayInput.placeholder = 'الاثنين...';
    dayInput.style.cssText = 'width:110px;margin-bottom:6px;display:block';

    const dateInput = document.createElement('input');
    dateInput.className = 'form-control sm';
    dateInput.type = 'date';
    dateInput.value = data.date || '';
    dateInput.style.cssText = 'width:150px;margin-bottom:8px;display:block';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-success btn-sm w-full';
    addBtn.style.fontSize = '11px';
    addBtn.textContent = '➕ إضافة حصة';
    addBtn.onclick = function() { App._addSessionToDay(this); };

    tdInfo.appendChild(dayInput);
    tdInfo.appendChild(dateInput);
    tdInfo.appendChild(addBtn);

    // خلية الحصص
    const tdSessions = document.createElement('td');
    tdSessions.style.cssText = 'padding:6px;vertical-align:top';
    const container = document.createElement('div');
    container.className = 'sessions-container';
    sessions.forEach((s, i) => container.appendChild(this._sessionRowHtml(s, i)));
    tdSessions.appendChild(container);

    // زر الحذف
    const tdDel = document.createElement('td');
    tdDel.style.cssText = 'vertical-align:top;padding:10px 6px;text-align:center';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm btn-icon';
    delBtn.title = 'حذف اليوم';
    delBtn.textContent = '✕';
    delBtn.onclick = function() { this.closest('tr').remove(); };
    tdDel.appendChild(delBtn);

    tr.appendChild(tdInfo);
    tr.appendChild(tdSessions);
    tr.appendChild(tdDel);
    return tr;
  },

  /** HTML لحصة واحدة داخل اليوم */
  _sessionRowHtml(s, idx) {
    s   = s   || {};
    idx = idx || 0;
    const per = s.period || 'morning';
    const subj = this._esc(s.subject || '');

    const noSci = !s.sciFrom && !s.sciTo;
    const noLit = !s.litFrom && !s.litTo;
    const sciStyle = noSci ? 'opacity:0.35;pointer-events:none' : '';
    const litStyle = noLit ? 'opacity:0.35;pointer-events:none' : '';
    const sciChecked = noSci ? 'checked' : '';
    const litChecked = noLit ? 'checked' : '';

    const div = document.createElement('div');
    div.className = 'session-block';
    div.dataset.idx = idx;

    const periodSel = document.createElement('select');
    periodSel.className = 'form-control sm session-period';
    periodSel.style.width = '120px';
    [['morning','🕗 صباحاً'],['afternoon','🕒 مساءً']].forEach(([v, label]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = label;
      if (per === v) opt.selected = true;
      periodSel.appendChild(opt);
    });

    const subjInput = document.createElement('input');
    subjInput.className = 'form-control sm session-subject';
    subjInput.type = 'text';
    subjInput.value = s.subject || '';
    subjInput.placeholder = 'اسم المادة...';
    subjInput.style.cssText = 'flex:1;min-width:160px';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm btn-icon';
    delBtn.style.flexShrink = '0';
    delBtn.title = 'حذف الحصة';
    delBtn.textContent = '−';
    delBtn.onclick = function() { this.closest('.session-block').remove(); };

    const header = document.createElement('div');
    header.className = 'session-header';
    header.appendChild(periodSel);
    header.appendChild(subjInput);
    header.appendChild(delBtn);

    const mkTrack = (label, color, trackClass, naClass, naChecked, fromVal, toVal, divStyle) => {
      const wrap = document.createElement('div');
      wrap.className = 'time-track';

      const lbl = document.createElement('label');
      lbl.className = 'track-label';
      lbl.style.color = color;
      const dot = document.createElement('span');
      dot.className = 'track-dot';
      dot.style.background = color;
      dot.textContent = label;
      lbl.appendChild(dot);
      lbl.appendChild(document.createTextNode(' ' + (label === 'ع' ? 'علمي' : 'أدبي')));

      const naLabel = document.createElement('label');
      naLabel.className = 'track-na';
      const naCb = document.createElement('input');
      naCb.type = 'checkbox';
      naCb.className = naClass;
      if (naChecked) naCb.checked = true;
      naCb.addEventListener('change', function() { App._toggleNa(this, trackClass.replace('-times','')); });
      naLabel.appendChild(naCb);
      naLabel.appendChild(document.createTextNode(' غير معني'));

      const timesDiv = document.createElement('div');
      timesDiv.className = 'time-inputs ' + trackClass;
      if (divStyle) timesDiv.style.cssText = divStyle;

      const fromIn = document.createElement('input');
      fromIn.className = 'form-control sm ' + trackClass.replace('-times','-from');
      fromIn.type = 'time'; fromIn.value = fromVal;
      fromIn.style.width = '90px';

      const arrow = document.createElement('span');
      arrow.className = 'track-arrow';
      arrow.textContent = '→';

      const toIn = document.createElement('input');
      toIn.className = 'form-control sm ' + trackClass.replace('-times','-to');
      toIn.type = 'time'; toIn.value = toVal;
      toIn.style.width = '90px';

      timesDiv.appendChild(fromIn);
      timesDiv.appendChild(arrow);
      timesDiv.appendChild(toIn);

      wrap.appendChild(lbl);
      wrap.appendChild(naLabel);
      wrap.appendChild(timesDiv);
      return wrap;
    };

    const timesContainer = document.createElement('div');
    timesContainer.className = 'session-times';
    timesContainer.appendChild(mkTrack(
      'ع','#1a6b3c','sci-times','sci-na-cb', noSci,
      s.sciFrom||'08:00', s.sciTo||'10:00', sciStyle
    ));
    timesContainer.appendChild(mkTrack(
      'أ','#c0392b','lit-times','lit-na-cb', noLit,
      s.litFrom||'08:00', s.litTo||'10:00', litStyle
    ));

    div.appendChild(header);
    div.appendChild(timesContainer);
    return div;
  },

  /** تفعيل/تعطيل حقول التوقيت عند الضغط على "غير معني" */
  _toggleNa(checkbox, track) {
    const block = checkbox.closest('.session-block');
    const timesDiv = block.querySelector('.' + track + '-times');
    if (timesDiv) {
      timesDiv.style.opacity = checkbox.checked ? '0.35' : '1';
      timesDiv.style.pointerEvents = checkbox.checked ? 'none' : '';
    }
  },

  /** إضافة حصة جديدة داخل يوم موجود */
  _addSessionToDay(btn) {
    const container = btn.closest('tr').querySelector('.sessions-container');
    if (!container) return;
    const idx = container.querySelectorAll('.session-block').length;
    container.appendChild(this._sessionRowHtml({}, idx));
  },

  addExamDay(prefix) {
    const body = document.getElementById(`${prefix}_examdays_body`);
    if (body) body.appendChild(this._createExamDayRow({}));
  },

  _readExamDays(prefix) {
    const days = [];
    document.querySelectorAll(`#${prefix}_examdays_body > tr`).forEach(tr => {
      const dayInput  = tr.querySelector('input[type="text"]');
      const dateInput = tr.querySelector('input[type="date"]');
      const day  = dayInput?.value.trim()  || '';
      const date = dateInput?.value.trim() || '';
      if (!day && !date) return;

      const sessions = [];
      tr.querySelectorAll('.session-block').forEach(block => {
        const period  = block.querySelector('.session-period')?.value  || 'morning';
        const subject = block.querySelector('.session-subject')?.value.trim() || '';

        const sciNa = block.querySelector('.sci-na-cb')?.checked;
        const litNa = block.querySelector('.lit-na-cb')?.checked;

        sessions.push({
          period,
          subject,
          sciFrom: sciNa ? '' : (block.querySelector('.sci-from')?.value || ''),
          sciTo:   sciNa ? '' : (block.querySelector('.sci-to')?.value   || ''),
          litFrom: litNa ? '' : (block.querySelector('.lit-from')?.value || ''),
          litTo:   litNa ? '' : (block.querySelector('.lit-to')?.value   || ''),
        });
      });

      days.push({ day, date, sessions });
    });
    return days;
  },

  // ----------------------------------------------------------
  // EXAM SUBJECT SELECT
  // ----------------------------------------------------------
  _populateExamSubjectSelect() {
    const sel = document.getElementById('sched_exam_subject');
    if (!sel) return;
    const current = sel.value || state.examSubject || '';
    sel.innerHTML = '<option value="">-- لا استثناء --</option>';
    Object.entries(SUBJECT_CODES).forEach(([code, name]) => {
      sel.innerHTML += `<option value="${code}" ${current === code ? 'selected' : ''}>${name}</option>`;
    });
    if (current) sel.value = current;
  },

  setExamSubject() {
    const sel = document.getElementById('sched_exam_subject');
    if (!sel) return;
    state.examSubject = sel.value;
    saveState();
    this.refreshTeachers();
    this._updateExemptionPanel();
    const name = state.examSubject ? subjectDisplayName(state.examSubject) : '';
    toast(name
      ? `✓ مادة الامتحان: ${name} — أساتذتها في الاحتياط`
      : 'تم إلغاء الاستثناء', name ? 'warn' : '');
  },

  _updateExemptionPanel() {
    const panel = document.getElementById('exemption_panel');
    if (!panel) return;
    if (!state.examSubject) {
      panel.innerHTML = '<div class="alert alert-info">لم تُحدَّد مادة الامتحان — لا يوجد استثناء تلقائي</div>';
      return;
    }
    const subjectName = subjectDisplayName(state.examSubject);
    const exempted = state.teachers.filter(t => isTeacherExempt(t, state.examSubject));

    panel.innerHTML = `
      <div class="alert alert-warn" style="margin-bottom:12px">
        ⚠️ مادة الامتحان: <strong>${subjectName}</strong> —
        <strong>${exempted.length}</strong> أستاذ في الاحتياط تلقائياً
      </div>
      ${exempted.length === 0
        ? '<p class="text-muted">لا يوجد أساتذة بهذه المادة في القائمة</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>#</th><th>الاسم</th><th>التأجير</th><th>المجموعة</th><th>الحالة</th><th>التكليف</th></tr></thead>
            <tbody>
              ${exempted.map((t, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td style="text-align:right;font-weight:600">${this._esc(t.name)}</td>
                  <td>${this._esc(t.mat) || '—'}</td>
                  <td><span class="badge badge-${t.group === 'A' ? 'a' : 'b'}">${t.group}</span></td>
                  <td>${t.forceAssign
                    ? '<span class="badge" style="background:#d4edda;color:#155724">مكلّف</span>'
                    : '<span class="badge" style="background:#f8d7da;color:#721c24">احتياط</span>'}</td>
                  <td>
                    <button class="btn btn-sm ${t.forceAssign ? 'btn-danger' : 'btn-gold'}"
                      onclick="App.toggleForceAssign(${t.id})">
                      ${t.forceAssign ? '↩ إرجاع للاحتياط' : '✋ تكليف'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>`}
    `;
  },

  toggleForceAssign(teacherId) {
    const t = state.teachers.find(t => String(t.id) === String(teacherId));
    if (!t) return;
    t.forceAssign = !t.forceAssign;
    saveState();
    this._updateExemptionPanel();
    toast(t.forceAssign ? `✓ ${t.name} — مكلّف بالحراسة` : `↩ ${t.name} — أُعيد للاحتياط`,
      t.forceAssign ? 'success' : 'warn');
  },

  // ----------------------------------------------------------
  // TEACHERS
  // ----------------------------------------------------------
  addTeacher() {
    const name = document.getElementById('t_name').value.trim();
    if (!name) { toast('يرجى إدخال اسم الأستاذ', 'error'); return; }

    const subjectRaw  = document.getElementById('t_subject').value;
    const subjectCode = normalizeSubjectCode(subjectRaw);

    const teacher = {
      id:          Date.now(),
      name,
      mat:         document.getElementById('t_mat').value.trim(),
      subject:     SUBJECT_CODES[subjectCode] || subjectRaw, // دائماً الاسم العربي
      subjectCode,
      school:      document.getElementById('t_school').value.trim(),
      group:       document.getElementById('t_group').value,
      notes:       document.getElementById('t_notes').value.trim(),
      forceAssign: false,
    };

    state.teachers.push(teacher);
    saveState();
    this.refreshTeachers();
    this._updateInvTeacherSelect();
    this.clearTeacherForm();
    toast(`تمت إضافة ${name}`, 'success');
  },

  removeTeacher(id) {
    state.teachers = state.teachers.filter(t => t.id !== id);
    saveState();
    this.refreshTeachers();
    this._updateInvTeacherSelect();
    toast('تم حذف الأستاذ', '');
  },

  clearTeacherForm() {
    ['t_name','t_mat','t_school','t_notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const s = document.getElementById('t_subject'); if (s) s.value = '';
    const g = document.getElementById('t_group');   if (g) g.value = 'A';
  },

  refreshTeachers() {
    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');
    const ca = document.getElementById('count_a'); if (ca) ca.textContent = gA.length;
    const cb = document.getElementById('count_b'); if (cb) cb.textContent = gB.length;
    this._renderTeacherGroup(gA, 'teachers_a_body');
    this._renderTeacherGroup(gB, 'teachers_b_body');
    this._updateExemptionPanel();
  },

  _renderTeacherGroup(list, bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="es-icon">📋</div><p>لا يوجد أساتذة</p></div></td></tr>`;
      return;
    }
    body.innerHTML = list.map((t, i) => {
      const exempt = isTeacherExempt(t, state.examSubject);
      return `<tr class="row-${t.group.toLowerCase()}" style="${exempt && !t.forceAssign ? 'background:#fff9e6' : ''}">
        <td><strong>${i + 1}</strong></td>
        <td style="text-align:right;font-weight:600">${this._esc(t.name)}</td>
        <td>${this._esc(t.mat) || '—'}</td>
        <td style="font-size:12px">${this._esc(t.subject) || '—'}</td>
        <td style="font-size:12px">${this._esc(t.school) || '—'}</td>
        <td class="no-print">
          ${exempt
            ? `<span class="badge" style="background:${t.forceAssign ? '#d4edda' : '#f8d7da'};color:${t.forceAssign ? '#155724' : '#721c24'};font-size:10px">
                ${t.forceAssign ? 'مكلّف' : 'احتياط'}
              </span>`
            : ''}
          <button class="btn btn-danger btn-sm" onclick="App.removeTeacher(${t.id})" style="margin-right:4px">✕</button>
        </td>
      </tr>`;
    }).join('');
  },

  // ----------------------------------------------------------
  // EXCEL IMPORT
  // ----------------------------------------------------------
  handleExcelDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file) this._parseExcelFile(file);
  },

  handleExcelFile(event) {
    const file = event.target.files[0];
    if (file) this._parseExcelFile(file);
    event.target.value = '';
  },

  _parseExcelFile(file) {
    if (!window.XLSX) { toast('مكتبة SheetJS غير محملة', 'error'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = ext === 'csv'
          ? XLSX.read(e.target.result, { type: 'string' })
          : XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!rows.length) { toast('الملف فارغ', 'error'); return; }

        const colMap = this._detectColumns(Object.keys(rows[0]));
        if (!colMap.name) { toast('لم يُعثر على عمود "الاسم"', 'error'); return; }

        let added = 0, skipped = 0;
        rows.forEach(row => {
          const name  = String(row[colMap.name]  || '').trim();
          const group = String(row[colMap.group] || 'A').trim().toUpperCase();
          if (!name || !['A','B'].includes(group)) { skipped++; return; }
          if (state.teachers.find(t => t.name === name)) { skipped++; return; }

          const subjectRaw  = String(row[colMap.subject] || '').trim();
          const subjectCode = normalizeSubjectCode(subjectRaw);
          state.teachers.push({
            id:          Date.now() + added,
            name,
            mat:         String(row[colMap.mat]    || '').trim(),
            subject:     SUBJECT_CODES[subjectCode] || subjectRaw,
            subjectCode,
            school:      String(row[colMap.school] || '').trim(),
            group,
            notes:       '',
            forceAssign: false,
          });
          added++;
        });

        saveState();
        this.refreshTeachers();
        this._updateInvTeacherSelect();
        toast(`✅ تمت إضافة ${added} أستاذ${skipped ? ` (تجاهل ${skipped})` : ''}`, 'success');
      } catch (err) {
        toast('خطأ في قراءة الملف: ' + err.message, 'error');
      }
    };
    if (ext === 'csv') reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  },

  _detectColumns(keys) {
    const find = (...patterns) => keys.find(k => {
      const nk = String(k).toLowerCase().trim();
      return patterns.some(p => nk.includes(p));
    });
    return {
      name:    find('اسم', 'nom', 'name'),
      mat:     find('تأجير', 'matricule', 'mat'),
      subject: find('ماد', 'matière', 'subject', 'code'),
      group:   find('مجموع', 'groupe', 'group'),
      school:  find('مؤسس', 'etablissement', 'school'),
    };
  },

  downloadExcelTemplate() {
    if (!window.XLSX) { toast('SheetJS غير متاحة', 'error'); return; }
    const data = [
      ['الاسم الكامل', 'رقم التأجير', 'المادة', 'المجموعة', 'المؤسسة'],
      ['محمد الأمين بلهاشمي', 'AB1234567', 'الرياضيات',         'A', 'ثانوية النموذج'],
      ['فاطمة الزهراء العمري','BC7654321', 'اللغة الفرنسية',    'B', 'ثانوية النموذج'],
      ['أحمد بنسالم',          'CD1122334', 'علوم الحياة والأرض','A', 'ثانوية النموذج'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأساتذة');
    XLSX.writeFile(wb, 'نموذج_أساتذة_EduTrack.xlsx');
    toast('تم تحميل النموذج ✓', 'success');
  },

  // ----------------------------------------------------------
  // SCHEDULE TABLE
  // ----------------------------------------------------------
  renderSchedule() {
    const examType = document.getElementById('sched_exam_type').value;
    const rooms    = parseInt(document.getElementById('sched_rooms').value)    || 10;
    const sessions = parseInt(document.getElementById('sched_sessions').value) || 3;

    state.numRooms    = rooms;
    state.numSessions = sessions;
    state.examSubject = document.getElementById('sched_exam_subject')?.value || state.examSubject;
    saveState();

    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');

    const salles   = Array.from({ length: rooms }, (_, i) => `Salle ${i + 1}`);
    const tasks    = ['مداومة 1', 'مداومة 2', 'احتياط 1', 'احتياط 2', 'كتابة'];
    const allRooms = [...salles, ...tasks];

    let sessionHeaders = '';
    let groupHeaders   = '';
    for (let s = 1; s <= sessions; s++) {
      sessionHeaders += `<th colspan="2">الحصة ${s}</th>`;
      groupHeaders   += `<th class="th-a">مراقب 1</th><th class="th-b">مراقب 2</th>`;
    }

    let rows = '';
    allRooms.forEach(room => {
      const isTask = tasks.includes(room);
      rows += `<tr>
        <td style="font-weight:700;background:#f8fafd;min-width:90px;white-space:nowrap;font-size:12.5px">
          ${isTask ? `<span class="badge badge-gold">${room}</span>` : room}
        </td>`;
      for (let s = 1; s <= sessions; s++) {
        const key  = `${examType}_${s}_${encodeURIComponent(room)}`;
        const cell = state.schedule[key] || { A: '', B: '' };
        rows += `<td style="padding:4px 5px">${this._makeSelect(gA, key, 'A', cell.A)}</td>`;
        rows += `<td style="padding:4px 5px">${this._makeSelect(gB, key, 'B', cell.B)}</td>`;
      }
      rows += '</tr>';
    });

    document.getElementById('schedule_container').innerHTML = `
      <table class="sched-table">
        <thead>
          <tr><th rowspan="2" style="min-width:90px">القاعة / المهمة</th>${sessionHeaders}</tr>
          <tr>${groupHeaders}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    const filled = Object.values(state.schedule).filter(c => c.A || c.B).length;
    const st = document.getElementById('sched_status');
    if (st) st.textContent = `${filled} خلية مملوءة`;
    this._updateExemptionPanel();
  },

  _makeSelect(teachers, key, group, selectedId) {
    const available = teachers.filter(t => isTeacherAvailable(t, state.examSubject));
    const reserve   = teachers.filter(t => isTeacherExempt(t, state.examSubject) && !t.forceAssign);

    const makeOpts = (list) => list.map(t => {
      const isRes = isTeacherExempt(t, state.examSubject) && !t.forceAssign;
      return `<option value="${t.id}" ${String(t.id) === String(selectedId) ? 'selected' : ''}
        style="${isRes ? 'color:#856404;background:#fff3cd' : ''}">
        ${t.name}${isRes ? ' ⚠️' : ''}
      </option>`;
    }).join('');

    const cls = selectedId ? `sched-select filled-${group.toLowerCase()}` : 'sched-select';
    return `<select class="${cls}"
      onchange="App.setCell('${key}','${group}',this.value);this.className='sched-select'+(this.value?' filled-${group.toLowerCase()}':'')">
      <option value="">— اختر —</option>
      ${available.length ? `<optgroup label="✅ متاحون">${makeOpts(available)}</optgroup>` : ''}
      ${reserve.length  ? `<optgroup label="⚠️ احتياط">${makeOpts(reserve)}</optgroup>` : ''}
    </select>`;
  },

  setCell(key, group, value) {
    if (!state.schedule[key]) state.schedule[key] = { A: '', B: '' };
    state.schedule[key][group] = value;
    saveState();
  },

  autoAssign() {
    const rooms    = parseInt(document.getElementById('sched_rooms').value)    || 10;
    const sessions = parseInt(document.getElementById('sched_sessions').value) || 3;
    const examType = document.getElementById('sched_exam_type').value;
    state.examSubject = document.getElementById('sched_exam_subject')?.value || state.examSubject;

    const useA = state.teachers.filter(t => t.group === 'A' && isTeacherAvailable(t, state.examSubject));
    const useB = state.teachers.filter(t => t.group === 'B' && isTeacherAvailable(t, state.examSubject));
    const allA = state.teachers.filter(t => t.group === 'A');
    const allB = state.teachers.filter(t => t.group === 'B');

    if (!allA.length || !allB.length) { toast('أضف أساتذة أولاً', 'error'); return; }
    if (!useA.length || !useB.length) toast('⚠️ أساتذة متاحون غير كافيين — سيُستعمل الاحتياط', 'warn');

    const poolA = useA.length ? useA : allA;
    const poolB = useB.length ? useB : allB;

    const cntA = {}, cntB = {};
    const histA = {}, histB = {};
    poolA.forEach(t => cntA[t.id] = 0);
    poolB.forEach(t => cntB[t.id] = 0);

    for (let s = 1; s <= sessions; s++) {
      const sA = [...poolA].sort((a, b) => (cntA[a.id] || 0) - (cntA[b.id] || 0) || Math.random() - 0.5);
      const sB = [...poolB].sort((a, b) => (cntB[a.id] || 0) - (cntB[b.id] || 0) || Math.random() - 0.5);
      let ai = 0, bi = 0;
      for (let r = 1; r <= rooms; r++) {
        const room = `Salle ${r}`;
        const key  = `${examType}_${s}_${room}`;
        if (!histA[room]) histA[room] = new Set();
        if (!histB[room]) histB[room] = new Set();
        let tA = sA.find((t, i) => i >= ai && !histA[room].has(t.id)) || sA[ai % sA.length];
        let tB = sB.find((t, i) => i >= bi && !histB[room].has(t.id)) || sB[bi % sB.length];
        state.schedule[key] = { A: String(tA.id), B: String(tB.id) };
        histA[room].add(tA.id); histB[room].add(tB.id);
        cntA[tA.id] = (cntA[tA.id] || 0) + 1;
        cntB[tB.id] = (cntB[tB.id] || 0) + 1;
        ai++; bi++;
      }
    }
    saveState();
    this.renderSchedule();
    toast(`✅ التوزيع الذكي: ${rooms} قاعة × ${sessions} حصص`, 'success');
  },

  clearSchedule() {
    this.showConfirm('مسح جدول الحراسة', 'هل تريد مسح جميع التوزيعات؟', () => {
      state.schedule = {};
      saveState();
      this.renderSchedule();
      toast('تم مسح التوزيع', '');
    });
  },

  validateSchedule() {
    const rooms    = parseInt(document.getElementById('sched_rooms').value) || 10;
    const sessions = parseInt(document.getElementById('sched_sessions').value) || 3;
    const examType = document.getElementById('sched_exam_type').value;
    const issues = [];
    for (let r = 1; r <= rooms; r++) {
      for (let s = 1; s <= sessions; s++) {
        const key  = `${examType}_${s}_Salle ${r}`;
        const cell = state.schedule[key] || {};
        if (!cell.A) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب 1`);
        if (!cell.B) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب 2`);
      }
    }
    const el = document.getElementById('verify_result');
    if (!el) return;
    el.innerHTML = issues.length === 0
      ? '<div class="alert alert-success">✅ التوزيع صحيح</div>'
      : `<div class="alert alert-error">⚠️ ${issues.length} مشكلة</div>
         <ul style="margin:8px 0 0 24px;font-size:13px;color:var(--red);line-height:2">
           ${issues.slice(0,25).map(i => `<li>${i}</li>`).join('')}
         </ul>`;
  },

  // ----------------------------------------------------------
  // ★★★ INVITATIONS – وثيقة حضور رسمية بالأيام والفترات ★★★
  // ----------------------------------------------------------
  _updateInvTeacherSelect() {
    const sel = document.getElementById('inv_teacher');
    if (!sel) return;
    sel.innerHTML = '<option value="">— جميع الأساتذة —</option>';
    state.teachers.forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${t.name} (${t.group})</option>`;
    });
  },

  generateInvitations() {
    const examType  = document.getElementById('inv_exam_type').value;
    const invGroup  = document.getElementById('inv_group').value;
    const invTeacher= document.getElementById('inv_teacher').value;

    let teachers = [...state.teachers];
    if (invGroup !== 'all') teachers = teachers.filter(t => t.group === invGroup);
    if (invTeacher)         teachers = teachers.filter(t => String(t.id) === invTeacher);
    if (!teachers.length)  { toast('لا يوجد أساتذة', 'error'); return; }

    const info = state.info;

    // اختيار بيانات الامتحان المناسب
    const prefixes = examType === 'both' ? ['j','w'] : [examType === 'watani' ? 'w' : 'j'];

    const container = document.getElementById('invitations_container');
    const today = new Date().toLocaleDateString('ar-MA-u-ca-gregory');

    let html = `<div class="alert alert-info no-print" style="margin-bottom:16px">
      ℹ️ تم توليد <strong>${teachers.length}</strong> استدعاء —
      <button class="btn btn-success btn-sm" onclick="App.printInvitationsAction()">🖨️ طباعة الكل</button>
    </div>`;

    teachers.forEach(t => {
      prefixes.forEach(prefix => {
        const academie  = info[`${prefix}_academie`]      || '—';
        const direction = info[`${prefix}_direction`]     || '—';
        const etab      = info[`${prefix}_etablissement`] || '—';
        const ville     = info[`${prefix}_ville`]         || '—';
        const session   = info[`${prefix}_session`]       || '—';
        const annee     = info[`${prefix}_annee`]         || '—';
        const centre    = info[`${prefix}_centre`]        || etab;
        const examDays  = info[`${prefix}_examDays`]      || [];

        const examLabel = prefix === 'j'
          ? 'الامتحان الجهوي الموحد'
          : 'الامتحان الوطني الموحد لنيل شهادة الباكالوريا';

        // بناء جدول الاستدعاء: اليوم+التاريخ ثم مادة+توقيت لكل حصة
        // نجمع الحصص الصباحية والمسائية لكل يوم
        const tableRows = examDays.map(dayObj => {
          const sessions = dayObj.sessions || [];
          const mSessions = sessions.filter(s => s.period === 'morning');
          const aSessions = sessions.filter(s => s.period === 'afternoon');

          const esc = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
          const renderSessions = (list) => {
            if (!list.length) return '<span class="period-empty">—</span>';
            return list.map(s => {
              const hasSci  = s.sciFrom && s.sciTo;
              const hasLit  = s.litFrom && s.litTo;
              const sciSame = hasSci && hasLit && s.sciFrom === s.litFrom && s.sciTo === s.litTo;
              return `<div class="inv-session-item">
                <div class="inv-session-subject">${esc(s.subject) || '—'}</div>
                ${sciSame
                  ? `<div class="inv-time-shared">${s.sciFrom} → ${s.sciTo}</div>`
                  : `${hasSci ? `<div class="inv-time-sci"><span class="inv-track-badge sci">ع</span> ${s.sciFrom} → ${s.sciTo}</div>` : ''}
                     ${hasLit ? `<div class="inv-time-lit"><span class="inv-track-badge lit">أ</span> ${s.litFrom} → ${s.litTo}</div>` : ''}`
                }
              </div>`;
            }).join('');
          };

          return `<tr>
            <td class="inv-table-daydate">
              <div class="inv-day-name">${esc(dayObj.day)}</div>
              <div class="inv-day-date">${formatDate(dayObj.date)}</div>
            </td>
            <td class="inv-table-period">${renderSessions(mSessions)}</td>
            <td class="inv-table-period">${renderSessions(aSessions)}</td>
          </tr>`;
        }).join('');

        html += `
          <div class="invitation-card">
            ${this._officialHeader(academie, direction, etab)}

            <div class="inv-date-row">
              <span><strong>${ville}، في:</strong> ${today}</span>
              <span class="exam-badge">${examLabel}</span>
            </div>

            <div class="inv-to-section">
              <div class="inv-data-row">
                <span class="lbl">إلى السيد/ة:</span>
                <span class="val">${this._esc(t.name)}</span>
              </div>
              <div class="inv-data-row">
                <span class="lbl">رقم التأجير:</span>
                <span class="val">${this._esc(t.mat) || '—'}</span>
              </div>
              <div class="inv-data-row">
                <span class="lbl">مادة التدريس:</span>
                <span class="val">${this._esc(t.subject) || '—'}</span>
              </div>
              <div class="inv-data-row">
                <span class="lbl">مقر العمل:</span>
                <span class="val">${this._esc(t.school) || etab}</span>
              </div>
            </div>

            <div class="inv-subject-line">
              <strong>الموضوع:</strong>
              استدعاء للمشاركة في حراسة ${examLabel}
            </div>
            <p class="inv-body-text">
              يُشرّفني دعوتكم للحضور إلى مركز الامتحان:
              <strong>${centre}</strong> خلال أيام انعقاد الامتحان وفق البرنامج التالي.
              السنة الدراسية: <strong>${annee}</strong> — ${session}
            </p>

            ${examDays.length > 0 ? `
              <table class="inv-schedule-table">
                <thead>
                  <tr>
                    <th style="width:30%">اليوم والتاريخ</th>
                    <th style="width:35%">الفترة الصباحية</th>
                    <th style="width:35%">الفترة المسائية</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            ` : `<div class="alert alert-warn">لم يُضَف أي يوم في جدول الامتحانات. يرجى ملء المعطيات العامة أولاً.</div>`}

            <p class="inv-note">
              ملاحظة: يُرجى الحضور قبل بدء كل فترة بـ <strong>30 دقيقة</strong> على الأقل.
            </p>

            <div class="inv-signature">
              <div class="sig-box">
                <p>مدير(ة) مركز الامتحان</p>
                <div class="sig-line">التوقيع والختم</div>
              </div>
              <div class="sig-box">
                <p>ختم المؤسسة</p>
                <div class="stamp-circle"></div>
              </div>
            </div>
          </div>`;
      });
    });

    container.innerHTML = html;
    toast(`✅ تم توليد ${teachers.length * prefixes.length} استدعاء`, 'success');
  },

  /** نص المادة للفترة: يعرض العلمي والأدبي إذا اختلفا */
  _periodSubjectLabel(period) {
    if (!period) return '—';
    const sci = (period.subjectSci || '').trim();
    const lit = (period.subjectLit || '').trim();
    const noSci = !sci || sci === '---' || sci === '—';
    const noLit = !lit || lit === '---' || lit === '—';

    if (noSci && noLit) return '—';
    if (noSci) return `أدبي: ${lit}`;
    if (noLit) return `علمي: ${sci}`;
    if (sci === lit) return sci;
    return `علمي: ${sci} / أدبي: ${lit}`;
  },

  printInvitations() {
    this.generateInvitations();
    setTimeout(() => window.print(), 400);
  },
  printInvitationsAction() { this.printInvitations(); },

  // ----------------------------------------------------------
  // REPORTS – وثيقة التوزيع (للإدارة فقط)
  // ----------------------------------------------------------
  generateReport() {
    const examType  = document.getElementById('rep_exam_type').value;
    const sessionV  = document.getElementById('rep_session').value;
    const repType   = document.getElementById('rep_type').value;
    const container = document.getElementById('report_container');

    const info      = state.info;
    const prefix    = examType === 'watani' ? 'w' : 'j';
    const etab      = info[`${prefix}_etablissement`] || '—';
    const session   = info[`${prefix}_session`]       || '—';
    const academie  = info[`${prefix}_academie`]      || '—';
    const direction = info[`${prefix}_direction`]     || '—';
    const examLabel = examType === 'jehowi'
      ? 'الامتحان الجهوي الموحد'
      : 'الامتحان الوطني الموحد لنيل شهادة الباكالوريا';

    const sessions = sessionV === 'all'
      ? Array.from({ length: state.numSessions }, (_, i) => i + 1)
      : [parseInt(sessionV)];

    const rooms = parseInt(document.getElementById('sched_rooms')?.value) || state.numRooms || 10;
    let html = '';

    sessions.forEach((sess, idx) => {
      const isLast = idx === sessions.length - 1;
      html += `<div class="card doc-print-page" style="${!isLast ? 'page-break-after:always' : ''}">
        <div class="card-body">
          ${this._officialHeader(academie, direction, etab)}
          <div class="doc-title-block">
            <h2>${repType === 'report' ? 'محضر القيام بالمهام المسندة أثناء' : 'جدول التوزيع اليومي للمراقبين –'} ${examLabel}</h2>
            <div class="doc-sub-info">
              <span>الدورة: <strong>${session}</strong></span>
              <span>الحصة: <strong>${sess}</strong></span>
              <span>المؤسسة: <strong>${etab}</strong></span>
            </div>
          </div>`;

      if (repType === 'report') {
        html += `<table><thead><tr>
          <th style="width:60px">رقم القاعة</th>
          <th>مراقب 1</th><th>رقم التأجير</th>
          <th>مراقب 2</th><th>رقم التأجير</th>
          <th style="min-width:90px">توقيع م.1</th>
          <th style="min-width:90px">توقيع م.2</th>
        </tr></thead><tbody>`;
        for (let r = 1; r <= rooms; r++) {
          const key = `${examType}_${sess}_Salle ${r}`;
          const cell = state.schedule[key] || {};
          const tA = state.teachers.find(t => String(t.id) === String(cell.A));
          const tB = state.teachers.find(t => String(t.id) === String(cell.B));
          html += `<tr>
            <td><strong>Salle ${r}</strong></td>
            <td style="text-align:right">${tA ? this._esc(tA.name) : '<span style="color:#ccc">—</span>'}</td>
            <td>${tA ? this._esc(tA.mat) || '—' : ''}</td>
            <td style="text-align:right">${tB ? this._esc(tB.name) : '<span style="color:#ccc">—</span>'}</td>
            <td>${tB ? this._esc(tB.mat) || '—' : ''}</td>
            <td>&nbsp;</td><td>&nbsp;</td>
          </tr>`;
        }
        html += `</tbody></table>`;
      } else {
        const pairCount = {};
        for (let r = 1; r <= rooms; r++) {
          const key  = `${examType}_${sess}_Salle ${r}`;
          const cell = state.schedule[key] || {};
          const pk = `${cell.A}|${cell.B}`;
          if (cell.A && cell.B) pairCount[pk] = (pairCount[pk] || 0) + 1;
        }
        html += `<table><thead><tr>
          <th>القاعة</th><th>مراقب 1</th><th>التأجير</th>
          <th>مراقب 2</th><th>التأجير</th><th>اللقاءات</th>
        </tr></thead><tbody>`;
        for (let r = 1; r <= rooms; r++) {
          const key  = `${examType}_${sess}_Salle ${r}`;
          const cell = state.schedule[key] || {};
          const tA   = state.teachers.find(t => String(t.id) === String(cell.A));
          const tB   = state.teachers.find(t => String(t.id) === String(cell.B));
          const pk   = `${cell.A}|${cell.B}`;
          const cnt  = cell.A && cell.B ? pairCount[pk] : 0;
          const dup  = cnt > 1;
          html += `<tr ${dup ? 'style="background:#fff3cd"' : ''}>
            <td><strong>Salle ${r}</strong></td>
            <td style="text-align:right">${tA ? this._esc(tA.name) : '—'}</td>
            <td>${tA ? this._esc(tA.mat) || '—' : ''}</td>
            <td style="text-align:right">${tB ? this._esc(tB.name) : '—'}</td>
            <td>${tB ? this._esc(tB.mat) || '—' : ''}</td>
            <td><span class="badge ${dup ? 'badge-b' : 'badge-a'}">${cnt || '—'}</span></td>
          </tr>`;
        }
        html += `</tbody></table>`;
      }

      html += `
          <div class="inv-signature" style="margin-top:30px">
            <div class="sig-box"><p>مدير(ة) المؤسسة</p><div class="sig-line">التوقيع</div></div>
            <div class="sig-box"><p>ختم المؤسسة</p><div class="stamp-circle"></div></div>
          </div>
        </div></div>`;
    });

    container.innerHTML = html;
    toast('✅ تم توليد الوثيقة', 'success');
  },

  // ----------------------------------------------------------
  // OFFICIAL HEADER – الرأسية الرسمية
  // ----------------------------------------------------------
  _officialHeader(academie, direction, etab) {
    const LOGO = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEinqtsDMAt2ugkrLRxZZOkZuP7_-emLaG_zpAZtgrOAIywHFnCsu7a-wotYfTAFYnCZ14tY6XwzgrIki_JyaRvPHH2XvR54GfarhBkykFPPnpdm9gQ04iU7mV55ng3rtmIRfiskqTUzO1nBnTfUV6lOd_tizoRwZjET94Xm2QHBs_edTwNk49wtanBd1K-U/s2048/1000141739.jpg';
    return `
      <div class="official-header">
        <div class="oh-row">
          <div class="oh-logo">
            <img src="${LOGO}" alt="شعار الوزارة" class="ministry-logo" onerror="this.style.display='none'">
          </div>
          <div class="oh-center">
            <div class="oh-country">المملكة المغربية</div>
            <div class="oh-ministry">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            ${academie  ? `<div class="oh-line">${this._esc(academie)}</div>`  : ''}
            ${direction ? `<div class="oh-line">${this._esc(direction)}</div>` : ''}
            ${etab      ? `<div class="oh-etab">${this._esc(etab)}</div>`      : ''}
          </div>
          <div class="oh-logo">
            <img src="${LOGO}" alt="شعار" class="ministry-logo" onerror="this.style.display='none'">
          </div>
        </div>
        <div class="oh-separator"></div>
      </div>`;
  },

  // ----------------------------------------------------------
  // PRINT ACTIONS
  // ----------------------------------------------------------
  printActive()           { window.print(); },
  printReportAction()     { this.generateReport(); setTimeout(() => window.print(), 400); },
  previewBeforePrint()    { toast('💡 تحقق من المعاينة ثم اضغط Ctrl+P', 'warn'); window.print(); },

  // ----------------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------------
  updateDashboard() {
    this.updateStats();
    const gA       = state.teachers.filter(t => t.group === 'A');
    const gB       = state.teachers.filter(t => t.group === 'B');
    const rooms    = state.numRooms || 10;
    const sessions = state.numSessions || 3;
    const total    = rooms * sessions;
    const assigned = Object.values(state.schedule).filter(c => c.A && c.B).length;
    const pct      = total > 0 ? Math.round(assigned / total * 100) : 0;

    const progEl = document.getElementById('d_progress');
    if (progEl) {
      if (!state.teachers.length) {
        progEl.innerHTML = '<div class="empty-state"><div class="es-icon">📈</div><p>لا توجد بيانات</p></div>';
      } else {
        const exemptCount = state.examSubject
          ? state.teachers.filter(t => isTeacherExempt(t, state.examSubject) && !t.forceAssign).length : 0;
        progEl.innerHTML = `
          <div style="margin-bottom:16px">
            <div class="flex-between" style="margin-bottom:6px">
              <span style="font-size:13px;font-weight:700">القاعات الموزعة</span>
              <span class="badge badge-${pct >= 100 ? 'a' : 'navy'}">${assigned} / ${total}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill fill-${pct >= 100 ? 'green' : 'gold'}" style="width:${Math.min(pct,100)}%"></div></div>
            <div class="text-muted" style="margin-top:4px">${pct}% مكتمل</div>
          </div>
          <div style="display:flex;gap:12px;margin-bottom:12px">
            <div style="flex:1">
              <div class="text-muted" style="margin-bottom:4px">مراقب 1: ${gA.length}</div>
              <div class="progress-bar"><div class="progress-fill fill-green" style="width:${state.teachers.length ? Math.round(gA.length/state.teachers.length*100) : 0}%"></div></div>
            </div>
            <div style="flex:1">
              <div class="text-muted" style="margin-bottom:4px">مراقب 2: ${gB.length}</div>
              <div class="progress-bar"><div class="progress-fill fill-red" style="width:${state.teachers.length ? Math.round(gB.length/state.teachers.length*100) : 0}%"></div></div>
            </div>
          </div>
          ${exemptCount > 0 ? `<div class="alert alert-warn" style="margin:0;font-size:12.5px">
            🔒 ${exemptCount} أستاذ في الاحتياط (${subjectDisplayName(state.examSubject)})
          </div>` : ''}`;
      }
    }

    const subjEl = document.getElementById('d_subjects');
    if (subjEl) {
      if (!state.teachers.length) {
        subjEl.innerHTML = '<div class="empty-state"><div class="es-icon">📚</div><p>أضف أساتذة</p></div>';
      } else {
        const subj = {};
        state.teachers.forEach(t => {
          const key = t.subject || 'غير محدد';
          subj[key] = (subj[key] || 0) + 1;
        });
        const sorted = Object.entries(subj).sort((a, b) => b[1] - a[1]);
        const max = sorted[0]?.[1] || 1;
        subjEl.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
            ${sorted.map(([s, c]) => `
              <div>
                <div class="flex-between" style="margin-bottom:5px">
                  <span style="font-size:13px;font-weight:600">${this._esc(s)}</span>
                  <span class="badge badge-navy">${c}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill fill-gold" style="width:${Math.round(c/max*100)}%"></div></div>
              </div>`).join('')}
          </div>`;
      }
    }
  },

  updateStats() {
    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');
    [
      ['d_total', state.teachers.length], ['d_groupA', gA.length],
      ['d_groupB', gB.length], ['d_rooms', state.numRooms || 10],
      ['si_total', state.teachers.length], ['si_rooms', state.numRooms || 10],
      ['si_a', gA.length], ['si_b', gB.length],
    ].forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  },

  // ----------------------------------------------------------
  // EXPORT / IMPORT
  // ----------------------------------------------------------
  exportData() {
    this.saveInfo();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `EduTrack_${new Date().toLocaleDateString('fr-MA').replace(/\//g,'-')}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast('✅ تم تصدير البيانات', 'success');
  },

  importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          state = deepMerge(state, data);
          state.teachers.forEach(t => {
            if (!t.subjectCode && t.subject) t.subjectCode = normalizeSubjectCode(t.subject);
            if (!t.subject && t.subjectCode) t.subject = subjectDisplayName(t.subjectCode);
          });
          saveState();
          this._populateInfoFields();
          this._renderExamDaysTables();
          this.refreshTeachers();
          this.updateStats();
          this._updateInvTeacherSelect();
          this.updateDashboard();
          toast('✅ تم استيراد البيانات', 'success');
        } catch (err) { toast('خطأ: ' + err.message, 'error'); }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  clearAll() {
    this.showConfirm('🗑️ مسح جميع البيانات', 'لا يمكن التراجع عن هذا الإجراء.', () => {
      state.teachers = []; state.schedule = {}; state.examSubject = '';
      saveState();
      this.refreshTeachers(); this.updateStats();
      this.updateDashboard(); this._updateInvTeacherSelect();
      this._updateExemptionPanel();
      document.getElementById('schedule_container').innerHTML =
        '<div class="empty-state" style="padding:60px"><div class="es-icon">📋</div><p>تم مسح الجدول</p></div>';
      toast('تم مسح جميع البيانات', '');
    });
  },

  // ----------------------------------------------------------
  // MODAL / TOAST / UTILS
  // ----------------------------------------------------------
  showConfirm(title, body, onConfirm) {
    document.getElementById('modal_title').innerHTML = title;
    document.getElementById('modal_body').innerHTML  = `<p style="font-size:14px;line-height:1.7;color:var(--gray)">${body}</p>`;
    document.getElementById('modal_confirm').onclick = () => { this.closeModal(); onConfirm(); };
    document.getElementById('modal_overlay').classList.add('open');
  },
  closeModal() { document.getElementById('modal_overlay').classList.remove('open'); },

  _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = '') {
  const wrap = document.getElementById('toast_container');
  const div  = document.createElement('div');
  div.className = `toast ${{ success:'t-success', error:'t-error', warn:'t-warn' }[type] || ''}`;
  div.innerHTML = `<span>${{ success:'✅', error:'❌', warn:'⚠️' }[type] || 'ℹ️'}</span><span style="flex:1">${msg}</span>`;
  wrap.appendChild(div);
  setTimeout(() => { div.classList.add('toast-out'); setTimeout(() => div.remove(), 300); }, 3500);
}

// Make App globally accessible for inline onclick handlers
window.App = App;
window.toast = toast;

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal_overlay').addEventListener('click', function(e) {
    if (e.target === this) App.closeModal();
  });
  App.init();
});
