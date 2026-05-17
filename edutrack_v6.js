/**
 * ============================================================
 * EduTrack – برنامج تدبير حراسة البكالوريا  v6.0
 * ملف JavaScript الرئيسي – النسخة المحسّنة
 *
 * التعديلات الجديدة:
 * 1. نظام استثناء الأساتذة حسب مادة الامتحان (احتياط تلقائي)
 * 2. رموز المواد: PHIL, EI, PC, SVT, FR, ESP, MAT, HG, ANG, INF
 * 3. توزيع ذكي يمنع تعيين الأستاذ في مادة تخصصه
 * 4. مراقب 1 / مراقب 2 بدلاً من مجموعة A / B
 * 5. رأسية رسمية احترافية في كل وثيقة مطبوعة
 * 6. طباعة احترافية A4 كاملة
 * ============================================================
 */

'use strict';

// ============================================================
// SUBJECT CODES MAP – رموز المواد المعتمدة
// ============================================================
const SUBJECT_CODES = {
  'PHIL': 'الفلسفة',
  'EI':   'التربية الإسلامية',
  'PC':   'الفيزياء والكيمياء',
  'SVT':  'علوم الحياة والأرض',
  'FR':   'اللغة الفرنسية',
  'ESP':  'التربية البدنية',
  'MAT':  'الرياضيات',
  'HG':   'التاريخ والجغرافيا',
  'ANG':  'اللغة الإنجليزية',
  'INF':  'الإعلاميات',
  'AR':   'اللغة العربية',
  'ISL':  'الفقه والأصول',
};

// كل الأسماء العربية مقابل الرموز للمقارنة
const SUBJECT_NAME_TO_CODE = {};
Object.entries(SUBJECT_CODES).forEach(([code, name]) => {
  SUBJECT_NAME_TO_CODE[name] = code;
});

// ============================================================
// STATE
// ============================================================
const STATE_KEY = 'edutrack_v6';

let state = {
  teachers:    [],   // [{ id, name, mat, subject, subjectCode, school, group, notes, forceAssign }]
  schedule:    {},   // { "examType_session_room": { A: id, B: id } }
  numRooms:    10,
  numSessions: 3,
  examSubject: '',   // مادة الامتحان الحالية (رمز)
  info: {
    j_academie: '', j_direction: '', j_etablissement: '',
    j_ville: '', j_annee: '2024/2025', j_session: 'دورة ماي 2025', j_centre: '',
    w_academie: '', w_direction: '', w_etablissement: '',
    w_ville: '', w_annee: '2024/2025', w_session: 'دورة يونيو 2025', w_centre: '',
    j_exams: [
      { day: 'الاثنين',  period: 'صباحا', idx: 1, sci: 'اللغة الفرنسية',     lit: 'اللغة الفرنسية',     code: 'FR',  from: '08:00', to: '10:00' },
      { day: 'الاثنين',  period: 'صباحا', idx: 2, sci: 'التربية الإسلامية',  lit: 'التربية الإسلامية',  code: 'EI',  from: '10:30', to: '12:30' },
      { day: 'الاثنين',  period: 'مساء',  idx: 3, sci: 'اللغة العربية',      lit: 'الفلسفة',             code: 'AR',  from: '15:00', to: '17:00' },
    ],
    w_exams: [
      { day: 'الخميس',   period: 'صباحا', idx: 1, sci: 'الفيزياء والكيمياء', lit: 'اللغة العربية',       code: 'PC',  from: '08:00', to: '10:00' },
      { day: 'الخميس',   period: 'مساء',  idx: 2, sci: 'اللغة الإنجليزية',   lit: 'اللغة الإنجليزية',   code: 'ANG', from: '15:00', to: '17:00' },
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

// ============================================================
// SUBJECT UTILS – دوال مساعدة للمواد
// ============================================================
/**
 * يحوّل اسم المادة أو رمزها إلى رمز موحّد
 */
function normalizeSubjectCode(subjectOrCode) {
  if (!subjectOrCode) return '';
  const s = subjectOrCode.trim().toUpperCase();
  // إذا كان رمزاً مباشرة
  if (SUBJECT_CODES[s]) return s;
  // إذا كان اسماً عربياً
  const code = SUBJECT_NAME_TO_CODE[subjectOrCode.trim()];
  if (code) return code;
  // ابحث بشكل جزئي
  for (const [code2, name] of Object.entries(SUBJECT_CODES)) {
    if (name.includes(subjectOrCode.trim()) || subjectOrCode.trim().includes(name)) return code2;
  }
  return subjectOrCode.trim().toUpperCase().substring(0, 6);
}

/**
 * هل يجب وضع الأستاذ احتياطاً بسبب مادته؟
 */
function isTeacherExempt(teacher, examSubjectCode) {
  if (!examSubjectCode || !teacher.subjectCode) return false;
  return teacher.subjectCode.toUpperCase() === examSubjectCode.toUpperCase();
}

/**
 * هل الأستاذ متاح للتوزيع؟ (ليس احتياطاً أو مكلّف بالمدير)
 */
function isTeacherAvailable(teacher, examSubjectCode) {
  if (teacher.forceAssign) return true;  // مكلّف يدوياً
  return !isTeacherExempt(teacher, examSubjectCode);
}

// ============================================================
// MAIN APP OBJECT
// ============================================================
const App = {

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  init() {
    loadState();
    this._bindNavTabs();
    this._populateInfoFields();
    this._renderExamTables();
    this.refreshTeachers();
    this.updateStats();
    this._updateInvTeacherSelect();
    this._populateExamSubjectSelect();
    this.goTab('dashboard');
  },

  // ----------------------------------------------------------
  // NAVIGATION
  // ----------------------------------------------------------
  _bindNavTabs() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.goTab(btn.dataset.tab));
    });
  },

  goTab(tabName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const section = document.getElementById('tab-' + tabName);
    if (section) section.classList.add('active');

    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    if (tabName === 'dashboard')   this.updateDashboard();
    if (tabName === 'invitations') { this.updateStats(); this._updateInvTeacherSelect(); }
    if (tabName === 'schedule')    this._populateExamSubjectSelect();
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
      if (el && state.info[id]) el.value = state.info[id];
    });
  },

  saveInfo() {
    this._infoFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) state.info[id] = el.value.trim();
    });
    state.info.j_exams = this._readExamRows('j');
    state.info.w_exams = this._readExamRows('w');
    saveState();
    toast('تم حفظ المعطيات بنجاح ✓', 'success');
  },

  _readExamRows(prefix) {
    const rows = [];
    document.querySelectorAll(`#${prefix}_exams_body tr`).forEach(tr => {
      const inputs = tr.querySelectorAll('input, select');
      if (inputs.length >= 8) {
        rows.push({
          day:    inputs[0].value,
          period: inputs[1].value,
          idx:    inputs[2].value,
          sci:    inputs[3].value,
          lit:    inputs[4].value,
          code:   inputs[5].value.trim().toUpperCase(),
          from:   inputs[6].value,
          to:     inputs[7].value,
        });
      }
    });
    return rows;
  },

  _renderExamTables() {
    ['j','w'].forEach(p => {
      const body = document.getElementById(`${p}_exams_body`);
      if (!body) return;
      body.innerHTML = '';
      const rows = state.info[`${p}_exams`] || [];
      rows.forEach(r => body.appendChild(this._createExamRow(r)));
    });
  },

  _createExamRow(data = {}) {
    const codeOptions = Object.entries(SUBJECT_CODES).map(([code, name]) =>
      `<option value="${code}" ${data.code === code ? 'selected' : ''}>${code} – ${name}</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="form-control sm" type="text" value="${data.day || ''}" placeholder="اليوم" style="width:90px"></td>
      <td><select class="form-control sm" style="width:90px">
        <option ${data.period === 'صباحا' ? 'selected' : ''}>صباحا</option>
        <option ${data.period === 'مساء'  ? 'selected' : ''}>مساء</option>
      </select></td>
      <td><input class="form-control sm" type="number" value="${data.idx || 1}" min="1" style="width:50px"></td>
      <td><input class="form-control sm" type="text" value="${data.sci || ''}" placeholder="المادة – علميون" style="width:140px"></td>
      <td><input class="form-control sm" type="text" value="${data.lit || ''}" placeholder="المادة – أدبيون" style="width:140px"></td>
      <td><select class="form-control sm" style="width:130px"><option value="">-- الرمز --</option>${codeOptions}</select></td>
      <td><input class="form-control sm" type="time" value="${data.from || '08:00'}" style="width:90px"></td>
      <td><input class="form-control sm" type="time" value="${data.to || '10:00'}" style="width:90px"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    return tr;
  },

  addExamRow(prefix) {
    const body = document.getElementById(`${prefix}_exams_body`);
    if (body) body.appendChild(this._createExamRow({ idx: body.children.length + 1 }));
  },

  // ----------------------------------------------------------
  // EXAM SUBJECT SELECT – مادة الامتحان للاستثناء
  // ----------------------------------------------------------
  _populateExamSubjectSelect() {
    const sel = document.getElementById('sched_exam_subject');
    if (!sel) return;
    const current = sel.value || state.examSubject || '';
    sel.innerHTML = '<option value="">-- لا استثناء --</option>';
    Object.entries(SUBJECT_CODES).forEach(([code, name]) => {
      sel.innerHTML += `<option value="${code}" ${current === code ? 'selected' : ''}>${code} – ${name}</option>`;
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
    toast(state.examSubject
      ? `✓ مادة الامتحان: ${SUBJECT_CODES[state.examSubject] || state.examSubject} — أساتذتها في الاحتياط`
      : 'تم إلغاء الاستثناء', state.examSubject ? 'warn' : '');
  },

  _updateExemptionPanel() {
    const panel = document.getElementById('exemption_panel');
    if (!panel) return;

    if (!state.examSubject) {
      panel.innerHTML = '<div class="alert alert-info">لم تُحدَّد مادة الامتحان — لا يوجد استثناء تلقائي</div>';
      return;
    }

    const subjectName = SUBJECT_CODES[state.examSubject] || state.examSubject;
    const exempted = state.teachers.filter(t => isTeacherExempt(t, state.examSubject));
    const forced   = exempted.filter(t => t.forceAssign);
    const onReserve = exempted.filter(t => !t.forceAssign);

    panel.innerHTML = `
      <div class="alert alert-warn" style="margin-bottom:12px">
        ⚠️ مادة الامتحان: <strong>${subjectName} (${state.examSubject})</strong> —
        <strong>${exempted.length}</strong> أستاذ في الاحتياط تلقائياً
      </div>
      ${exempted.length === 0 ? '<p class="text-muted">لا يوجد أساتذة بهذه المادة</p>' : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>التأجير</th>
                <th>المجموعة</th>
                <th>الحالة</th>
                <th>التكليف</th>
              </tr>
            </thead>
            <tbody>
              ${exempted.map((t, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td style="text-align:right;font-weight:600">${this._esc(t.name)}</td>
                  <td>${this._esc(t.mat) || '—'}</td>
                  <td><span class="badge badge-${t.group === 'A' ? 'a' : 'b'}">${t.group}</span></td>
                  <td>
                    ${t.forceAssign
                      ? '<span class="badge" style="background:#fff3cd;color:#856404">مكلّف بالحراسة</span>'
                      : '<span class="badge" style="background:#f8d7da;color:#721c24">احتياط</span>'}
                  </td>
                  <td>
                    <button class="btn btn-sm ${t.forceAssign ? 'btn-danger' : 'btn-gold'}"
                      onclick="App.toggleForceAssign(${t.id})">
                      ${t.forceAssign ? '↩ إرجاع للاحتياط' : '✋ تكليف بالحراسة'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  },

  toggleForceAssign(teacherId) {
    const t = state.teachers.find(t => String(t.id) === String(teacherId));
    if (!t) return;
    t.forceAssign = !t.forceAssign;
    saveState();
    this._updateExemptionPanel();
    toast(t.forceAssign
      ? `✓ ${t.name} — مكلّف بالحراسة`
      : `↩ ${t.name} — أُعيد للاحتياط`, t.forceAssign ? 'success' : 'warn');
  },

  // ----------------------------------------------------------
  // TEACHERS
  // ----------------------------------------------------------
  addTeacher() {
    const name = document.getElementById('t_name').value.trim();
    if (!name) { toast('يرجى إدخال اسم الأستاذ', 'error'); return; }

    const subjectRaw = document.getElementById('t_subject').value;
    const subjectCode = normalizeSubjectCode(subjectRaw);

    const teacher = {
      id:          Date.now(),
      name,
      mat:         document.getElementById('t_mat').value.trim(),
      subject:     SUBJECT_CODES[subjectCode] || subjectRaw,
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
    toast(`تمت إضافة ${name} إلى المجموعة ${teacher.group}`, 'success');
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
    const subj = document.getElementById('t_subject');
    if (subj) subj.value = '';
    const grp = document.getElementById('t_group');
    if (grp) grp.value = 'A';
  },

  refreshTeachers() {
    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');

    const ca = document.getElementById('count_a');
    const cb = document.getElementById('count_b');
    if (ca) ca.textContent = gA.length;
    if (cb) cb.textContent = gB.length;

    this._renderTeacherGroup(gA, 'teachers_a_body', 'A');
    this._renderTeacherGroup(gB, 'teachers_b_body', 'B');
    this._updateExemptionPanel();
  },

  _renderTeacherGroup(list, bodyId, group) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="es-icon">📋</div><p>لا يوجد أساتذة في المجموعة ${group}</p></div></td></tr>`;
      return;
    }
    body.innerHTML = list.map((t, i) => {
      const isExempt = isTeacherExempt(t, state.examSubject);
      const rowStyle = isExempt && !t.forceAssign ? 'background:#fff9e6' : '';
      return `
        <tr class="row-${group.toLowerCase()}" style="${rowStyle}">
          <td><strong>${i + 1}</strong></td>
          <td style="text-align:right;font-weight:600">${this._esc(t.name)}</td>
          <td>${this._esc(t.mat) || '—'}</td>
          <td>
            <span class="badge" style="background:var(--navy-bg);color:var(--navy);font-size:11px;font-weight:800">
              ${this._esc(t.subjectCode) || '—'}
            </span>
          </td>
          <td style="font-size:12px">${this._esc(t.subject) || '—'}</td>
          <td style="font-size:12px">${this._esc(t.school) || '—'}</td>
          <td class="no-print" style="white-space:nowrap">
            ${isExempt ? `<span class="badge ${t.forceAssign ? '' : ''}" style="background:${t.forceAssign ? '#d4edda' : '#f8d7da'};color:${t.forceAssign ? '#155724' : '#721c24'};margin-left:4px;font-size:10px">
              ${t.forceAssign ? 'مكلّف' : 'احتياط'}
            </span>` : ''}
            <button class="btn btn-danger btn-sm" onclick="App.removeTeacher(${t.id})">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ----------------------------------------------------------
  // EXCEL IMPORT (SheetJS)
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
    const isCSV = ext === 'csv';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let workbook;
        if (isCSV) {
          workbook = XLSX.read(e.target.result, { type: 'string' });
        } else {
          workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) { toast('الملف فارغ أو لا يحتوي على بيانات', 'error'); return; }

        const colMap = this._detectColumns(Object.keys(rows[0]));
        if (!colMap.name) { toast('لم يُعثر على عمود "الاسم" في الملف', 'error'); return; }

        let added = 0, skipped = 0;

        rows.forEach(row => {
          const name  = String(row[colMap.name] || '').trim();
          const group = String(row[colMap.group] || 'A').trim().toUpperCase();
          if (!name) { skipped++; return; }
          if (!['A','B'].includes(group)) { skipped++; return; }
          if (state.teachers.find(t => t.name === name)) { skipped++; return; }

          // استخرج الرمز من Excel (يمكن أن يكون رمزاً مثل SVT أو اسماً عربياً)
          const subjectRaw = String(row[colMap.subject] || '').trim();
          const subjectCode = normalizeSubjectCode(subjectRaw);

          state.teachers.push({
            id:          Date.now() + added,
            name,
            mat:         String(row[colMap.mat]  || '').trim(),
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

        if (added > 0) {
          toast(`✅ تمت إضافة ${added} أستاذ${skipped ? ` (تجاهل ${skipped})` : ''}`, 'success');
          if (state.examSubject) {
            const exempted = state.teachers.filter(t => isTeacherExempt(t, state.examSubject));
            if (exempted.length > 0) {
              setTimeout(() => toast(`⚠️ ${exempted.length} أستاذ في الاحتياط (مادة الامتحان)`, 'warn'), 1500);
            }
          }
        } else {
          toast('لم تتم إضافة أي أستاذ. تحقق من تنسيق الملف.', 'warn');
        }

      } catch (err) {
        console.error(err);
        toast('حدث خطأ أثناء قراءة الملف: ' + err.message, 'error');
      }
    };

    if (isCSV) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  },

  _detectColumns(keys) {
    const normalize = s => String(s).toLowerCase().trim().replace(/\s+/g, ' ');
    const find = (...patterns) => keys.find(k => {
      const nk = normalize(k);
      return patterns.some(p => nk.includes(p));
    });

    return {
      name:    find('اسم', 'nom', 'name', 'prénom'),
      mat:     find('تأجير', 'matricule', 'mat', 'rh'),
      subject: find('ماد', 'matière', 'subject', 'matieres', 'code'),
      group:   find('مجموع', 'groupe', 'group', 'grp'),
      school:  find('مؤسس', 'établissement', 'school', 'etab'),
    };
  },

  downloadExcelTemplate() {
    if (!window.XLSX) { toast('مكتبة SheetJS غير متاحة', 'error'); return; }
    const data = [
      ['الاسم', 'رقم التأجير', 'رمز المادة', 'المجموعة', 'المؤسسة'],
      ['محمد الأمين بلهاشمي', 'AB1234567', 'MAT', 'A', 'ثانوية المثال'],
      ['فاطمة الزهراء العمري','BC7654321', 'FR',  'B', 'ثانوية المثال'],
      ['أحمد بنسالم',          'CD1122334', 'SVT', 'A', 'ثانوية المثال'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأساتذة');
    XLSX.writeFile(wb, 'نموذج_أساتذة_EduTrack_v6.xlsx');
    toast('تم تحميل النموذج ✓', 'success');
  },

  // ----------------------------------------------------------
  // SCHEDULE – جدول الحراسة
  // ----------------------------------------------------------
  renderSchedule() {
    const examType    = document.getElementById('sched_exam_type').value;
    const rooms       = parseInt(document.getElementById('sched_rooms').value)    || 10;
    const sessions    = parseInt(document.getElementById('sched_sessions').value) || 3;

    state.numRooms    = rooms;
    state.numSessions = sessions;
    state.examSubject = document.getElementById('sched_exam_subject')?.value || state.examSubject;
    saveState();

    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');

    const salles  = Array.from({ length: rooms }, (_, i) => `Salle ${i + 1}`);
    const tasks   = ['مداومة 1', 'مداومة 2', 'احتياط 1', 'احتياط 2', 'كتابة'];
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

        const selA = this._makeSelect(gA, key, 'A', cell.A);
        const selB = this._makeSelect(gB, key, 'B', cell.B);

        rows += `<td style="padding:4px 5px">${selA}</td>`;
        rows += `<td style="padding:4px 5px">${selB}</td>`;
      }
      rows += '</tr>';
    });

    const exemptCount = state.examSubject
      ? state.teachers.filter(t => isTeacherExempt(t, state.examSubject) && !t.forceAssign).length
      : 0;

    const html = `
      ${exemptCount > 0 ? `<div class="alert alert-warn no-print" style="margin:12px 12px 0">
        ⚠️ <strong>${exemptCount}</strong> أستاذ في الاحتياط بسبب مادة الامتحان
        (${SUBJECT_CODES[state.examSubject] || state.examSubject})
        — انظر بطاقة الاحتياط أعلاه
      </div>` : ''}
      <table class="sched-table">
        <thead>
          <tr>
            <th rowspan="2" style="min-width:90px">القاعة / المهمة</th>
            ${sessionHeaders}
          </tr>
          <tr>${groupHeaders}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    document.getElementById('schedule_container').innerHTML = html;

    const filled = Object.values(state.schedule).filter(c => c.A || c.B).length;
    const statusEl = document.getElementById('sched_status');
    if (statusEl) statusEl.textContent = `${filled} خلية مملوءة`;

    this._updateExemptionPanel();
  },

  _makeSelect(teachers, key, group, selectedId) {
    const examSubject = state.examSubject;
    // فصل الأساتذة: متاحون / احتياط
    const available = teachers.filter(t => isTeacherAvailable(t, examSubject));
    const reserve   = teachers.filter(t => isTeacherExempt(t, examSubject) && !t.forceAssign);

    const makeOpts = (list) => list.map(t => {
      const isReserve = isTeacherExempt(t, examSubject) && !t.forceAssign;
      return `<option value="${t.id}" ${String(t.id) === String(selectedId) ? 'selected' : ''}
        style="${isReserve ? 'color:#856404;background:#fff3cd' : ''}">
        ${t.name}${isReserve ? ' (احتياط)' : ''}
      </option>`;
    }).join('');

    const cls = selectedId ? `sched-select filled-${group.toLowerCase()}` : 'sched-select';
    return `<select class="${cls}" onchange="App.setCell('${key}','${group}',this.value);this.className='sched-select${selectedId ? ` filled-${group.toLowerCase()}` : ''}'">
      <option value="">— اختر —</option>
      ${available.length ? `<optgroup label="✅ متاحون">${makeOpts(available)}</optgroup>` : ''}
      ${reserve.length  ? `<optgroup label="⚠️ احتياط (نفس المادة)">${makeOpts(reserve)}</optgroup>` : ''}
    </select>`;
  },

  setCell(key, group, value) {
    if (!state.schedule[key]) state.schedule[key] = { A: '', B: '' };
    state.schedule[key][group] = value;
    saveState();
  },

  // ----------------------------------------------------------
  // AUTO ASSIGN – توزيع تلقائي ذكي
  // ----------------------------------------------------------
  autoAssign() {
    const rooms    = parseInt(document.getElementById('sched_rooms').value)    || 10;
    const sessions = parseInt(document.getElementById('sched_sessions').value) || 3;
    const examType = document.getElementById('sched_exam_type').value;
    const examSubj = document.getElementById('sched_exam_subject')?.value || state.examSubject;

    state.examSubject = examSubj;

    // الأساتذة المتاحون (غير المستثنَين)، والمكلّفون يدوياً مسموح بهم
    const gA = state.teachers.filter(t => t.group === 'A' && isTeacherAvailable(t, examSubj));
    const gB = state.teachers.filter(t => t.group === 'B' && isTeacherAvailable(t, examSubj));

    const gA_all = state.teachers.filter(t => t.group === 'A');
    const gB_all = state.teachers.filter(t => t.group === 'B');

    if (!gA_all.length || !gB_all.length) {
      toast('يجب إضافة أساتذة في كلا المجموعتين أولاً', 'error');
      return;
    }

    // إذا لم يكن هناك أساتذة متاحون كافيون، نُنبّه ونستعمل الاحتياط
    const useA = gA.length > 0 ? gA : gA_all;
    const useB = gB.length > 0 ? gB : gB_all;

    if (gA.length === 0 || gB.length === 0) {
      toast('⚠️ عدد الأساتذة المتاحين غير كافٍ — سيُستعمل الاحتياط أيضاً', 'warn');
    }

    // خوارزمية ذكية: تتبع عدد الحصص لكل أستاذ وتجنب التكرار في نفس القاعة
    const sessionCountA = {};
    const sessionCountB = {};
    const roomHistoryA  = {};  // roomHistoryA[room] = Set of teacher IDs
    const roomHistoryB  = {};

    useA.forEach(t => { sessionCountA[t.id] = 0; });
    useB.forEach(t => { sessionCountB[t.id] = 0; });

    for (let s = 1; s <= sessions; s++) {
      // ترتيب حسب عدد الحصص (الأقل أولاً) ثم عشوائي
      const sortedA = [...useA].sort((a, b) =>
        (sessionCountA[a.id] || 0) - (sessionCountA[b.id] || 0) || Math.random() - 0.5);
      const sortedB = [...useB].sort((a, b) =>
        (sessionCountB[a.id] || 0) - (sessionCountB[b.id] || 0) || Math.random() - 0.5);

      let ai = 0, bi = 0;
      for (let r = 1; r <= rooms; r++) {
        const room = `Salle ${r}`;
        const key  = `${examType}_${s}_${room}`;

        if (!roomHistoryA[room]) roomHistoryA[room] = new Set();
        if (!roomHistoryB[room]) roomHistoryB[room] = new Set();

        // اختر أستاذاً لم يكن في نفس القاعة إن أمكن
        let tA = sortedA.find((t, idx) => idx >= ai && !roomHistoryA[room].has(t.id));
        if (!tA) tA = sortedA[ai % sortedA.length];

        let tB = sortedB.find((t, idx) => idx >= bi && !roomHistoryB[room].has(t.id));
        if (!tB) tB = sortedB[bi % sortedB.length];

        state.schedule[key] = {
          A: String(tA.id),
          B: String(tB.id),
        };

        roomHistoryA[room].add(tA.id);
        roomHistoryB[room].add(tB.id);
        sessionCountA[tA.id] = (sessionCountA[tA.id] || 0) + 1;
        sessionCountB[tB.id] = (sessionCountB[tB.id] || 0) + 1;
        ai++; bi++;
      }
    }

    saveState();
    this.renderSchedule();

    const exemptCount = examSubj
      ? state.teachers.filter(t => isTeacherExempt(t, examSubj) && !t.forceAssign).length
      : 0;

    toast(`✅ التوزيع الذكي: ${rooms} قاعة × ${sessions} حصص${exemptCount ? ` (${exemptCount} في الاحتياط)` : ''}`, 'success');
  },

  clearSchedule() {
    this.showConfirm('مسح جدول الحراسة', 'هل تريد مسح جميع توزيعات الجدول؟', () => {
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
    const exemptIssues = [];

    for (let r = 1; r <= rooms; r++) {
      for (let s = 1; s <= sessions; s++) {
        const key  = `${examType}_${s}_Salle ${r}`;
        const cell = state.schedule[key] || {};
        if (!cell.A) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب 1`);
        if (!cell.B) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب 2`);

        // فحص الأساتذة المستثنَين
        if (state.examSubject) {
          [cell.A, cell.B].forEach(tid => {
            if (!tid) return;
            const t = state.teachers.find(t => String(t.id) === String(tid));
            if (t && isTeacherExempt(t, state.examSubject) && !t.forceAssign) {
              exemptIssues.push(`⚠️ ${t.name} في قاعة Salle ${r} / الحصة ${s} (مادته: ${t.subject})`);
            }
          });
        }
      }
    }

    const el = document.getElementById('verify_result');
    if (!el) return;

    let html = '';
    if (issues.length === 0) {
      html += '<div class="alert alert-success">✅ التوزيع صحيح — جميع القاعات مزودة بمراقبَين</div>';
    } else {
      html += `<div class="alert alert-error">⚠️ يوجد ${issues.length} مشكلة في التوزيع</div>
        <ul style="margin:8px 0 0 24px;font-size:13px;color:var(--red);line-height:2">
          ${issues.slice(0, 25).map(i => `<li>${i}</li>`).join('')}
          ${issues.length > 25 ? `<li>...و ${issues.length - 25} مشاكل إضافية</li>` : ''}
        </ul>`;
    }
    if (exemptIssues.length > 0) {
      html += `<div class="alert alert-warn" style="margin-top:10px">⚠️ ${exemptIssues.length} أستاذ في قاعة رغم استثنائه:</div>
        <ul style="margin:8px 0 0 24px;font-size:13px;color:#856404;line-height:2">
          ${exemptIssues.map(i => `<li>${i}</li>`).join('')}
        </ul>`;
    }

    el.innerHTML = html;
  },

  // ----------------------------------------------------------
  // INVITATIONS – الاستدعاءات
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
    const invExamType = document.getElementById('inv_exam_type').value;
    const invGroup    = document.getElementById('inv_group').value;
    const invTeacher  = document.getElementById('inv_teacher').value;

    let teachers = [...state.teachers];
    if (invGroup !== 'all') teachers = teachers.filter(t => t.group === invGroup);
    if (invTeacher)         teachers = teachers.filter(t => String(t.id) === invTeacher);

    if (!teachers.length) { toast('لا يوجد أساتذة لعرض استدعاءاتهم', 'error'); return; }

    const container = document.getElementById('invitations_container');
    const info      = state.info;

    const examLabel = {
      jehowi: 'الامتحان الجهوي الموحد',
      watani: 'الامتحان الوطني الموحد لنيل شهادة الباكالوريا',
      both:   'الامتحان الجهوي الموحد والامتحان الوطني الموحد',
    }[invExamType] || '';

    const prefix    = invExamType === 'watani' ? 'w' : 'j';
    const academie  = info[`${prefix}_academie`]      || '—';
    const direction = info[`${prefix}_direction`]     || '—';
    const etab      = info[`${prefix}_etablissement`] || '—';
    const ville     = info[`${prefix}_ville`]         || '—';
    const session   = info[`${prefix}_session`]       || '—';
    const centre    = info[`${prefix}_centre`]        || etab;
    const annee     = info[`${prefix}_annee`]         || '—';
    const today     = new Date().toLocaleDateString('ar-MA-u-ca-gregory');

    let html = `<div class="alert alert-info no-print" style="margin-bottom:16px">
      ℹ️ تم توليد <strong>${teachers.length}</strong> استدعاء.
      استخدم الأزرار للطباعة.
    </div>`;

    teachers.forEach(t => {
      const assignments = [];
      Object.entries(state.schedule).forEach(([key, cell]) => {
        const parts   = key.split('_');
        const etype   = parts[0];
        const sess    = parts[1];
        const room    = decodeURIComponent(parts.slice(2).join('_'));
        const matches = (invExamType === 'both') || (etype === invExamType);
        if (!matches) return;
        if (String(cell[t.group]) === String(t.id)) {
          assignments.push({ session: sess, room });
        }
      });

      assignments.sort((a, b) => Number(a.session) - Number(b.session));

      // تحديد دور المراقب: مراقب 1 = A، مراقب 2 = B
      const roleLabel = t.group === 'A' ? 'مراقب 1' : 'مراقب 2';

      html += `
        <div class="invitation-card">
          ${this._officialHeader(academie, direction, etab)}

          <div class="inv-date-row">
            <span><strong>${ville}، في:</strong> ${today}</span>
            <span class="exam-badge">${examLabel}</span>
          </div>

          <div class="inv-to-section">
            <div class="inv-data-row"><span class="lbl">إلى السيد/ة:</span><span class="val">${this._esc(t.name)}</span></div>
            <div class="inv-data-row"><span class="lbl">رقم التأجير:</span><span class="val">${this._esc(t.mat) || '—'}</span></div>
            <div class="inv-data-row"><span class="lbl">مادة التدريس:</span><span class="val">${this._esc(t.subject) || '—'} ${t.subjectCode ? `(${t.subjectCode})` : ''}</span></div>
            <div class="inv-data-row"><span class="lbl">مقر العمل:</span><span class="val">${this._esc(t.school) || etab}</span></div>
            <div class="inv-data-row"><span class="lbl">الدور:</span>
              <span class="val">
                <span style="background:var(--navy);color:white;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">
                  ${roleLabel}
                </span>
              </span>
            </div>
          </div>

          <div class="inv-subject-line">
            <strong>الموضوع:</strong>
            استدعاء للمشاركة في حراسة ${examLabel} – ${session} – ${centre}
          </div>
          <p class="inv-body-text">
            يُرجى التفضل بالحضور في مركز الامتحان: <strong>${centre}</strong>
            في التواريخ والأوقات المحددة أدناه. السنة الدراسية: <strong>${annee}</strong>
          </p>

          ${assignments.length > 0 ? `
            <table class="inv-sessions-table">
              <thead>
                <tr>
                  <th>الحصة</th>
                  <th>القاعة / المهمة</th>
                  <th>الدور</th>
                </tr>
              </thead>
              <tbody>
                ${assignments.map(a => `
                  <tr>
                    <td>الحصة ${a.session}</td>
                    <td><strong>${this._esc(a.room)}</strong></td>
                    <td>${roleLabel}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          ` : `<div class="alert alert-warn" style="margin-top:12px">
            لم يُسنَد لهذا الأستاذ أي قاعة بعد — يرجى التوزيع في جدول الحراسة.
          </div>`}

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

    container.innerHTML = html;
    toast(`✅ تم توليد ${teachers.length} استدعاء`, 'success');
  },

  printInvitations() {
    this.generateInvitations();
    setTimeout(() => window.print(), 400);
  },

  // ----------------------------------------------------------
  // REPORTS – المحاضر والتوزيع
  // ----------------------------------------------------------
  generateReport() {
    const examType  = document.getElementById('rep_exam_type').value;
    const sessionV  = document.getElementById('rep_session').value;
    const repType   = document.getElementById('rep_type').value;
    const container = document.getElementById('report_container');

    const info     = state.info;
    const prefix   = examType === 'watani' ? 'w' : 'j';
    const etab     = info[`${prefix}_etablissement`] || '—';
    const session  = info[`${prefix}_session`]       || '—';
    const academie = info[`${prefix}_academie`]      || '—';
    const direction= info[`${prefix}_direction`]     || '—';
    const ville    = info[`${prefix}_ville`]         || '—';
    const examLabel= examType === 'jehowi'
      ? 'الامتحان الجهوي الموحد'
      : 'الامتحان الوطني الموحد لنيل شهادة الباكالوريا';

    const sessions = sessionV === 'all'
      ? Array.from({ length: state.numSessions }, (_, i) => i + 1)
      : [parseInt(sessionV)];

    const rooms = parseInt(document.getElementById('sched_rooms')?.value) || state.numRooms || 10;
    let html = '';

    sessions.forEach((sess, pageIdx) => {
      const isLast = pageIdx === sessions.length - 1;
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
        html += `
          <table>
            <thead>
              <tr>
                <th style="width:60px">رقم القاعة</th>
                <th>مراقب 1</th>
                <th>رقم التأجير</th>
                <th>مراقب 2</th>
                <th>رقم التأجير</th>
                <th style="min-width:90px">توقيع م.1</th>
                <th style="min-width:90px">توقيع م.2</th>
              </tr>
            </thead>
            <tbody>`;
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
          const pk   = `${cell.A}|${cell.B}`;
          if (cell.A && cell.B) pairCount[pk] = (pairCount[pk] || 0) + 1;
        }

        html += `
          <table>
            <thead>
              <tr>
                <th>القاعة</th>
                <th>مراقب 1</th>
                <th>التأجير</th>
                <th>مراقب 2</th>
                <th>التأجير</th>
                <th>اللقاءات</th>
              </tr>
            </thead>
            <tbody>`;
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
        html += `</tbody></table>
          <p class="text-muted no-print" style="margin-top:10px">⚠️ الصفوف الصفراء: نفس الزوج في أكثر من قاعة</p>`;
      }

      html += `
          <div class="inv-signature" style="margin-top:30px">
            <div class="sig-box">
              <p>مدير(ة) المؤسسة</p>
              <div class="sig-line">التوقيع</div>
            </div>
            <div class="sig-box">
              <p>ختم المؤسسة</p>
              <div class="stamp-circle"></div>
            </div>
          </div>
        </div>
      </div>`;
    });

    container.innerHTML = html;
    toast('✅ تم توليد الوثيقة', 'success');
  },

  // ----------------------------------------------------------
  // OFFICIAL HEADER – الرأسية الرسمية
  // الرابط: https://blogger.googleusercontent.com/img/b/R29vZ2xl/...
  // ----------------------------------------------------------
  _officialHeader(academie, direction, etab) {
    const LOGO_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEinqtsDMAt2ugkrLRxZZOkZuP7_-emLaG_zpAZtgrOAIywHFnCsu7a-wotYfTAFYnCZ14tY6XwzgrIki_JyaRvPHH2XvR54GfarhBkykFPPnpdm9gQ04iU7mV55ng3rtmIRfiskqTUzO1nBnTfUV6lOd_tizoRwZjET94Xm2QHBs_edTwNk49wtanBd1K-U/s2048/1000141739.jpg';
    return `
      <div class="official-header">
        <div class="oh-row">
          <div class="oh-logo">
            <img src="${LOGO_URL}" alt="شعار وزارة التربية الوطنية" class="ministry-logo" onerror="this.style.display='none'">
          </div>
          <div class="oh-center">
            <div class="oh-country">المملكة المغربية</div>
            <div class="oh-ministry">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            ${academie ? `<div class="oh-line">${academie}</div>` : ''}
            ${direction ? `<div class="oh-line">${direction}</div>` : ''}
            ${etab ? `<div class="oh-etab">${etab}</div>` : ''}
          </div>
          <div class="oh-logo oh-right-logo">
            <img src="${LOGO_URL}" alt="شعار" class="ministry-logo" onerror="this.style.display='none'">
          </div>
        </div>
        <div class="oh-separator"></div>
      </div>`;
  },

  // ----------------------------------------------------------
  // PRINT ACTIONS
  // ----------------------------------------------------------
  printActive() {
    window.print();
  },

  printInvitationsAction() {
    this.generateInvitations();
    setTimeout(() => window.print(), 400);
  },

  printReportAction() {
    this.generateReport();
    setTimeout(() => window.print(), 400);
  },

  previewBeforePrint() {
    toast('💡 تحقق من المعاينة ثم اضغط Ctrl+P للطباعة', 'warn');
    window.print();
  },

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
    const pct      = total > 0 ? Math.round((assigned / total) * 100) : 0;

    const exemptCount = state.examSubject
      ? state.teachers.filter(t => isTeacherExempt(t, state.examSubject) && !t.forceAssign).length
      : 0;

    const progEl = document.getElementById('d_progress');
    if (progEl) {
      if (!state.teachers.length) {
        progEl.innerHTML = '<div class="empty-state"><div class="es-icon">📈</div><p>لا توجد بيانات بعد</p></div>';
      } else {
        progEl.innerHTML = `
          <div style="margin-bottom:16px">
            <div class="flex-between mb-8" style="margin-bottom:6px">
              <span style="font-size:13px;font-weight:700">القاعات الموزعة</span>
              <span class="badge badge-${pct >= 100 ? 'a' : 'navy'}">${assigned} / ${total}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill fill-${pct >= 100 ? 'green' : 'gold'}" style="width:${Math.min(pct,100)}%"></div></div>
            <div class="text-muted" style="margin-top:4px">${pct}% مكتمل</div>
          </div>
          <div style="margin-bottom:16px">
            <div class="flex-between" style="margin-bottom:6px">
              <span style="font-size:13px;font-weight:700">توازن المجموعتين</span>
            </div>
            <div style="display:flex;gap:12px">
              <div style="flex:1">
                <div class="text-muted" style="margin-bottom:4px">مراقب 1: ${gA.length} أستاذ</div>
                <div class="progress-bar"><div class="progress-fill fill-green" style="width:${state.teachers.length ? Math.round(gA.length/state.teachers.length*100) : 0}%"></div></div>
              </div>
              <div style="flex:1">
                <div class="text-muted" style="margin-bottom:4px">مراقب 2: ${gB.length} أستاذ</div>
                <div class="progress-bar"><div class="progress-fill fill-red" style="width:${state.teachers.length ? Math.round(gB.length/state.teachers.length*100) : 0}%"></div></div>
              </div>
            </div>
          </div>
          ${exemptCount > 0 ? `
          <div style="margin-bottom:8px">
            <div class="flex-between" style="margin-bottom:6px">
              <span style="font-size:13px;font-weight:700">🔒 الاحتياط التلقائي</span>
              <span class="badge badge-gold">${exemptCount}</span>
            </div>
            <div class="text-muted">أستاذ في الاحتياط بسبب مادة الامتحان (${SUBJECT_CODES[state.examSubject] || state.examSubject})</div>
          </div>` : ''}
        `;
      }
    }

    const subjEl = document.getElementById('d_subjects');
    if (subjEl) {
      if (!state.teachers.length) {
        subjEl.innerHTML = '<div class="empty-state"><div class="es-icon">📚</div><p>أضف أساتذة لعرض الإحصاءات</p></div>';
      } else {
        const subj = {};
        state.teachers.forEach(t => {
          const key = t.subjectCode ? `${t.subjectCode} – ${t.subject || ''}` : (t.subject || 'غير محدد');
          subj[key] = (subj[key] || 0) + 1;
        });
        const sorted = Object.entries(subj).sort((a, b) => b[1] - a[1]);
        const max    = sorted[0]?.[1] || 1;
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
    const gA    = state.teachers.filter(t => t.group === 'A');
    const gB    = state.teachers.filter(t => t.group === 'B');
    const total = state.teachers.length;
    const rooms = state.numRooms || 10;

    [
      ['d_total',  total],
      ['d_groupA', gA.length],
      ['d_groupB', gB.length],
      ['d_rooms',  rooms],
      ['si_total', total],
      ['si_rooms', rooms],
      ['si_a',     gA.length],
      ['si_b',     gB.length],
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  },

  // ----------------------------------------------------------
  // EXPORT / IMPORT JSON
  // ----------------------------------------------------------
  exportData() {
    this.saveInfo();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `EduTrack_${new Date().toLocaleDateString('fr-MA').replace(/\//g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ تم تصدير البيانات', 'success');
  },

  importData() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          state = deepMerge(state, data);
          // Migrate old teachers without subjectCode
          state.teachers.forEach(t => {
            if (!t.subjectCode && t.subject) {
              t.subjectCode = normalizeSubjectCode(t.subject);
            }
          });
          saveState();
          this._populateInfoFields();
          this._renderExamTables();
          this.refreshTeachers();
          this.updateStats();
          this._updateInvTeacherSelect();
          this.updateDashboard();
          toast('✅ تم استيراد البيانات بنجاح', 'success');
        } catch (err) {
          toast('خطأ في قراءة الملف: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  // ----------------------------------------------------------
  // CLEAR ALL
  // ----------------------------------------------------------
  clearAll() {
    this.showConfirm(
      '🗑️ مسح جميع البيانات',
      'هل تريد حذف جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.',
      () => {
        state.teachers  = [];
        state.schedule  = {};
        state.examSubject = '';
        saveState();
        this.refreshTeachers();
        this.updateStats();
        this.updateDashboard();
        this._updateInvTeacherSelect();
        this._updateExemptionPanel();
        document.getElementById('schedule_container').innerHTML =
          '<div class="empty-state" style="padding:60px"><div class="es-icon">📋</div><p>تم مسح الجدول</p></div>';
        toast('تم مسح جميع البيانات', '');
      }
    );
  },

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  showConfirm(title, body, onConfirm) {
    document.getElementById('modal_title').innerHTML = title;
    document.getElementById('modal_body').innerHTML  = `<p style="font-size:14px;line-height:1.7;color:var(--gray)">${body}</p>`;
    const confirmBtn = document.getElementById('modal_confirm');
    confirmBtn.onclick = () => { this.closeModal(); onConfirm(); };
    document.getElementById('modal_overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal_overlay').classList.remove('open');
  },

  // ----------------------------------------------------------
  // UTILS
  // ----------------------------------------------------------
  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};

// ============================================================
// GLOBAL TOAST HELPER
// ============================================================
function toast(msg, type = '') {
  const wrap = document.getElementById('toast_container');
  const div  = document.createElement('div');
  const cls  = { success: 't-success', error: 't-error', warn: 't-warn' }[type] || '';
  const icon = { success: '✅', error: '❌', warn: '⚠️' }[type] || 'ℹ️';
  div.className = `toast ${cls}`;
  div.innerHTML = `<span>${icon}</span><span style="flex:1">${msg}</span>`;
  wrap.appendChild(div);
  setTimeout(() => {
    div.classList.add('toast-out');
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal_overlay').addEventListener('click', function (e) {
    if (e.target === this) App.closeModal();
  });
  App.init();
});
