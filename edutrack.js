/**
 * ============================================================
 * EduTrack – برنامج تدبير حراسة البكالوريا  v5.0
 * ملف JavaScript الرئيسي
 * ============================================================
 */

'use strict';

// ============================================================
// STATE
// ============================================================
const STATE_KEY = 'edutrack_v5';

let state = {
  teachers:   [],     // [{ id, name, mat, subject, school, group, notes }]
  schedule:   {},     // { "examType_session_room": { A: id, B: id } }
  numRooms:   10,
  numSessions: 3,
  info: {
    j_academie: '', j_direction: '', j_etablissement: '',
    j_ville: '', j_annee: '2024/2025', j_session: 'دورة ماي 2025', j_centre: '',
    w_academie: '', w_direction: '', w_etablissement: '',
    w_ville: '', w_annee: '2024/2025', w_session: 'دورة يونيو 2025', w_centre: '',
    j_exams: [
      { day: 'الاثنين',    period: 'صباحا', idx: 1, sci: 'اللغة الفرنسية',     lit: 'اللغة الفرنسية',     from: '08:00', to: '10:00' },
      { day: 'الاثنين',    period: 'صباحا', idx: 2, sci: 'التربية الإسلامية',  lit: 'التربية الإسلامية',  from: '10:30', to: '12:30' },
      { day: 'الاثنين',    period: 'مساء',  idx: 3, sci: 'اللغة العربية',      lit: 'الفلسفة',             from: '15:00', to: '17:00' },
    ],
    w_exams: [
      { day: 'الخميس',     period: 'صباحا', idx: 1, sci: 'الفيزياء والكيمياء', lit: 'اللغة العربية',       from: '08:00', to: '10:00' },
      { day: 'الخميس',     period: 'مساء',  idx: 2, sci: 'اللغة الإنجليزية',   lit: 'اللغة الإنجليزية',   from: '15:00', to: '17:00' },
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
    // Save exam rows
    state.info.j_exams = this._readExamRows('j');
    state.info.w_exams = this._readExamRows('w');
    saveState();
    toast('تم حفظ المعطيات بنجاح ✓', 'success');
  },

  _readExamRows(prefix) {
    const rows = [];
    document.querySelectorAll(`#${prefix}_exams_body tr`).forEach(tr => {
      const inputs = tr.querySelectorAll('input, select');
      if (inputs.length >= 7) {
        rows.push({
          day:    inputs[0].value,
          period: inputs[1].value,
          idx:    inputs[2].value,
          sci:    inputs[3].value,
          lit:    inputs[4].value,
          from:   inputs[5].value,
          to:     inputs[6].value,
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
  // TEACHERS
  // ----------------------------------------------------------
  addTeacher() {
    const name = document.getElementById('t_name').value.trim();
    if (!name) { toast('يرجى إدخال اسم الأستاذ', 'error'); return; }

    const teacher = {
      id:      Date.now(),
      name,
      mat:     document.getElementById('t_mat').value.trim(),
      subject: document.getElementById('t_subject').value,
      school:  document.getElementById('t_school').value.trim(),
      group:   document.getElementById('t_group').value,
      notes:   document.getElementById('t_notes').value.trim(),
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
  },

  _renderTeacherGroup(list, bodyId, group) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="es-icon">📋</div><p>لا يوجد أساتذة في المجموعة ${group}</p></div></td></tr>`;
      return;
    }
    body.innerHTML = list.map((t, i) => `
      <tr class="row-${group.toLowerCase()}">
        <td><strong>${i + 1}</strong></td>
        <td style="text-align:right;font-weight:600">${this._esc(t.name)}</td>
        <td>${this._esc(t.mat) || '—'}</td>
        <td><span class="badge badge-${group === 'A' ? 'a' : 'b'}">${this._esc(t.subject) || '—'}</span></td>
        <td style="font-size:12px">${this._esc(t.school) || '—'}</td>
        <td class="no-print">
          <button class="btn btn-danger btn-sm" onclick="App.removeTeacher(${t.id})">✕</button>
        </td>
      </tr>
    `).join('');
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

        // Map column headers (Arabic/French/English variations)
        const colMap = this._detectColumns(Object.keys(rows[0]));
        if (!colMap.name) { toast('لم يُعثر على عمود "الاسم" في الملف', 'error'); return; }

        let added = 0, skipped = 0;
        const addedNames = [];

        rows.forEach(row => {
          const name  = String(row[colMap.name] || '').trim();
          const group = String(row[colMap.group] || 'A').trim().toUpperCase();
          if (!name) { skipped++; return; }
          if (!['A','B'].includes(group)) { skipped++; return; }

          // Avoid duplicates
          if (state.teachers.find(t => t.name === name)) { skipped++; return; }

          state.teachers.push({
            id:      Date.now() + added,
            name,
            mat:     String(row[colMap.mat]     || '').trim(),
            subject: String(row[colMap.subject] || '').trim(),
            school:  String(row[colMap.school]  || '').trim(),
            group,
            notes:   '',
          });
          added++;
          addedNames.push(name);
        });

        saveState();
        this.refreshTeachers();
        this._updateInvTeacherSelect();

        if (added > 0) {
          toast(`✅ تمت إضافة ${added} أستاذ بنجاح${skipped ? ` (تجاهل ${skipped})` : ''}`, 'success');
          // Auto-assign after import
          setTimeout(() => {
            if (state.schedule && Object.keys(state.schedule).length === 0) {
              toast('💡 يمكنك الآن الذهاب إلى "جدول الحراسة" للتوزيع التلقائي', '');
            }
          }, 2000);
        } else {
          toast('لم تتم إضافة أي أستاذ. تحقق من تنسيق الملف.', 'warn');
        }

      } catch (err) {
        console.error(err);
        toast('حدث خطأ أثناء قراءة الملف: ' + err.message, 'error');
      }
    };

    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  },

  _detectColumns(keys) {
    const normalize = s => String(s).toLowerCase().trim()
      .replace(/[\u0600-\u06FF]/g, m => m)  // keep Arabic
      .replace(/\s+/g, ' ');

    const find = (...patterns) => keys.find(k => {
      const nk = normalize(k);
      return patterns.some(p => nk.includes(p));
    });

    return {
      name:    find('اسم', 'nom', 'name', 'prénom'),
      mat:     find('تأجير', 'matricule', 'mat', 'rh'),
      subject: find('ماد', 'matière', 'subject', 'matieres'),
      group:   find('مجموع', 'groupe', 'group', 'grp'),
      school:  find('مؤسس', 'établissement', 'school', 'etab'),
    };
  },

  downloadExcelTemplate() {
    if (!window.XLSX) { toast('مكتبة SheetJS غير متاحة', 'error'); return; }
    const data = [
      ['الاسم',              'رقم التأجير', 'المادة',       'المجموعة', 'المؤسسة'],
      ['محمد الأمين بلهاشمي', 'AB1234567',  'الرياضيات',    'A',        'ثانوية المثال'],
      ['فاطمة الزهراء العمري','BC7654321',  'اللغة الفرنسية','B',        'ثانوية المثال'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأساتذة');
    XLSX.writeFile(wb, 'نموذج_أساتذة_EduTrack.xlsx');
    toast('تم تحميل النموذج ✓', 'success');
  },

  // ----------------------------------------------------------
  // SCHEDULE
  // ----------------------------------------------------------
  renderSchedule() {
    const examType = document.getElementById('sched_exam_type').value;
    const rooms    = parseInt(document.getElementById('sched_rooms').value)    || 10;
    const sessions = parseInt(document.getElementById('sched_sessions').value) || 3;

    state.numRooms    = rooms;
    state.numSessions = sessions;
    saveState();

    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');

    // Room labels: Salle 1 … Salle N  +  special tasks
    const salles = Array.from({ length: rooms }, (_, i) => `Salle ${i + 1}`);
    const tasks  = ['مداومة 1', 'مداومة 2', 'احتياط 1', 'احتياط 2', 'كتابة'];
    const allRooms = [...salles, ...tasks];

    // Build thead
    let sessionHeaders = '';
    let groupHeaders   = '';
    for (let s = 1; s <= sessions; s++) {
      sessionHeaders += `<th colspan="2">الحصة ${s}</th>`;
      groupHeaders   += `<th class="th-a">A</th><th class="th-b">B</th>`;
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

    const html = `
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

    const filled  = Object.values(state.schedule).filter(c => c.A || c.B).length;
    const needed  = allRooms.length * sessions * 2;
    const statusEl = document.getElementById('sched_status');
    if (statusEl) {
      const pct = needed > 0 ? Math.round(filled / (allRooms.length * sessions) * 50) : 0;
      statusEl.textContent = `${filled} خلية مملوءة`;
    }
  },

  _makeSelect(teachers, key, group, selectedId) {
    const cls = selectedId ? `sched-select filled-${group.toLowerCase()}` : 'sched-select';
    const opts = teachers.map(t =>
      `<option value="${t.id}" ${String(t.id) === String(selectedId) ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    return `<select class="${cls}" onchange="App.setCell('${key}','${group}',this.value);this.className='sched-select${this.value?` filled-${group.toLowerCase()}`:``}'">
      <option value="">— اختر —</option>${opts}
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

    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');

    if (!gA.length || !gB.length) {
      toast('يجب إضافة أساتذة في كلا المجموعتين أولاً', 'error');
      return;
    }

    // Shuffle for fairness
    const shuffleA = [...gA].sort(() => Math.random() - 0.5);
    const shuffleB = [...gB].sort(() => Math.random() - 0.5);

    let ai = 0, bi = 0;
    for (let s = 1; s <= sessions; s++) {
      for (let r = 1; r <= rooms; r++) {
        const key = `${examType}_${s}_Salle ${r}`;
        state.schedule[key] = {
          A: String(shuffleA[ai % shuffleA.length].id),
          B: String(shuffleB[bi % shuffleB.length].id),
        };
        ai++; bi++;
      }
    }
    saveState();
    this.renderSchedule();
    toast(`✅ تم التوزيع التلقائي لـ ${rooms} قاعة × ${sessions} حصص`, 'success');
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
    for (let r = 1; r <= rooms; r++) {
      for (let s = 1; s <= sessions; s++) {
        const key  = `${examType}_${s}_Salle ${r}`;
        const cell = state.schedule[key] || {};
        if (!cell.A) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب من المجموعة A`);
        if (!cell.B) issues.push(`Salle ${r} / الحصة ${s}: لا يوجد مراقب من المجموعة B`);
      }
    }

    const el = document.getElementById('verify_result');
    if (!el) return;
    if (issues.length === 0) {
      el.innerHTML = '<div class="alert alert-success">✅ التوزيع صحيح — جميع القاعات مزودة بمراقبَين</div>';
    } else {
      el.innerHTML = `
        <div class="alert alert-error">⚠️ يوجد ${issues.length} مشكلة في التوزيع</div>
        <ul style="margin: 8px 0 0 24px; font-size:13px; color:var(--red); line-height:2">
          ${issues.slice(0, 25).map(i => `<li>${i}</li>`).join('')}
          ${issues.length > 25 ? `<li>...و ${issues.length - 25} مشاكل إضافية</li>` : ''}
        </ul>`;
    }
  },

  // ----------------------------------------------------------
  // INVITATIONS
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
    const today     = new Date().toLocaleDateString('ar-MA-u-ca-gregory');

    let html = `<div class="alert alert-info no-print" style="margin-bottom:16px">
      ℹ️ تم توليد <strong>${teachers.length}</strong> استدعاء.
      اضغط <strong>🖨️ طباعة</strong> من الشريط العلوي للطباعة.
    </div>`;

    teachers.forEach(t => {
      // Collect this teacher's assignments
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

      // Sort by session number
      assignments.sort((a, b) => Number(a.session) - Number(b.session));

      html += `
        <div class="invitation-card">
          <div class="inv-ksa-header">
            <div class="crown">🇲🇦</div>
            <div style="font-size:11px;color:#888;margin-bottom:4px">المملكة المغربية – وزارة التربية الوطنية</div>
            <h3>${academie}</h3>
            <div class="sub">${direction}</div>
            <div class="sub" style="font-weight:700;margin-top:4px">${etab} – ${ville}</div>
          </div>

          <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:12.5px;flex-wrap:wrap;gap:8px">
            <div><strong>${ville}، في: </strong>${today}</div>
            <div style="background:var(--navy);color:white;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700">
              ${examLabel}
            </div>
          </div>

          <div class="inv-data-row"><span class="lbl">إلى السيد(ة):</span><span class="val">${this._esc(t.name)}</span></div>
          <div class="inv-data-row"><span class="lbl">رقم التأجير:</span><span class="val">${this._esc(t.mat) || '—'}</span></div>
          <div class="inv-data-row"><span class="lbl">مقر العمل:</span><span class="val">${this._esc(t.school) || etab}</span></div>
          <div class="inv-data-row"><span class="lbl">المادة:</span><span class="val">${this._esc(t.subject) || '—'}</span></div>
          <div class="inv-data-row">
            <span class="lbl">المجموعة:</span>
            <span class="val badge badge-${t.group === 'A' ? 'a' : 'b'}">المجموعة ${t.group}</span>
          </div>

          <p style="margin:14px 0 6px;font-size:13px">
            <strong>الموضوع:</strong>
            استدعاء للمشاركة في حراسة ${examLabel} – ${session}
          </p>
          <p style="font-size:12.5px;color:var(--gray)">
            يُرجى التفضل بالحضور في مركز الامتحان: <strong>${centre}</strong>،
            في التواريخ والأوقات المحددة أدناه:
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
                    <td>مراقب – المجموعة ${t.group}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          ` : `<div class="alert alert-warn" style="margin-top:12px">
            لم يُسنَد لهذا الأستاذ أي قاعة بعد. يرجى التوزيع في جدول الحراسة.
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
  // REPORTS
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
          <div class="doc-header">
            <div class="country">المملكة المغربية – وزارة التربية الوطنية – ${academie} – ${direction}</div>
            <h2>${repType === 'report' ? 'محضر القيام بالمهام المسندة أثناء' : 'جدول التوزيع اليومي للمراقبين –'} ${examLabel}</h2>
            <div class="doc-sub">${etab} &nbsp;|&nbsp; ${session} &nbsp;|&nbsp; الحصة ${sess}</div>
          </div>`;

      if (repType === 'report') {
        html += `
          <table>
            <thead>
              <tr>
                <th style="width:60px">رقم القاعة</th>
                <th>المراقب الأول – المجموعة A</th>
                <th>رقم التأجير</th>
                <th>المراقب الثاني – المجموعة B</th>
                <th>رقم التأجير</th>
                <th style="min-width:90px">توقيع A</th>
                <th style="min-width:90px">توقيع B</th>
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
        // Distribution report: highlight duplicate pairs
        const pairCount = {};
        for (let r = 1; r <= rooms; r++) {
          const key = `${examType}_${sess}_Salle ${r}`;
          const cell = state.schedule[key] || {};
          const pk = `${cell.A}|${cell.B}`;
          if (cell.A && cell.B) pairCount[pk] = (pairCount[pk] || 0) + 1;
        }

        html += `
          <table>
            <thead>
              <tr>
                <th>القاعة</th>
                <th>المراقب A</th>
                <th>التأجير</th>
                <th>المراقب B</th>
                <th>التأجير</th>
                <th>عدد اللقاءات</th>
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
          <p class="text-muted no-print" style="margin-top:10px">⚠️ الصفوف الصفراء تشير إلى تكرار نفس الزوج في أكثر من قاعة</p>`;
      }

      // Signatures
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

    // Progress
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
                <div class="text-muted" style="margin-bottom:4px">A: ${gA.length} أستاذ</div>
                <div class="progress-bar"><div class="progress-fill fill-green" style="width:${state.teachers.length ? Math.round(gA.length/state.teachers.length*100) : 0}%"></div></div>
              </div>
              <div style="flex:1">
                <div class="text-muted" style="margin-bottom:4px">B: ${gB.length} أستاذ</div>
                <div class="progress-bar"><div class="progress-fill fill-red" style="width:${state.teachers.length ? Math.round(gB.length/state.teachers.length*100) : 0}%"></div></div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Subjects
    const subjEl = document.getElementById('d_subjects');
    if (subjEl) {
      if (!state.teachers.length) {
        subjEl.innerHTML = '<div class="empty-state"><div class="es-icon">📚</div><p>أضف أساتذة لعرض الإحصاءات</p></div>';
      } else {
        const subj = {};
        state.teachers.forEach(t => {
          if (t.subject) subj[t.subject] = (subj[t.subject] || 0) + 1;
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
      ['d_total',   total],
      ['d_groupA',  gA.length],
      ['d_groupB',  gB.length],
      ['d_rooms',   rooms],
      ['si_total',  total],
      ['si_rooms',  rooms],
      ['si_a',      gA.length],
      ['si_b',      gB.length],
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  },

  // ----------------------------------------------------------
  // PRINT
  // ----------------------------------------------------------
  printActive() {
    window.print();
  },

  // ----------------------------------------------------------
  // EXPORT / IMPORT JSON
  // ----------------------------------------------------------
  exportData() {
    this.saveInfo(); // ensure latest info is captured
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
      'هل تريد حذف جميع البيانات (الأساتذة، الجداول، المعطيات)؟ لا يمكن التراجع عن هذا الإجراء.',
      () => {
        state.teachers  = [];
        state.schedule  = {};
        saveState();
        this.refreshTeachers();
        this.updateStats();
        this.updateDashboard();
        this._updateInvTeacherSelect();
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
  // TOAST
  // ----------------------------------------------------------
  // (Exposed globally via helper below)

  // ----------------------------------------------------------
  // UTILS
  // ----------------------------------------------------------
  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
// CLOSE MODAL ON OVERLAY CLICK
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal_overlay').addEventListener('click', function (e) {
    if (e.target === this) App.closeModal();
  });

  // Init app
  App.init();
});
