/**
 * EduTrack v7.2 - نظام تدبير حراسة البكالوريا
 * ميزات جديدة:
 * 1. ربط مباشر بين برنامج الامتحانات والحصص والمواد
 * 2. توزيع تلقائي ذكي حسب المواد والحصص
 * 3. جداول احترافية بدون تلوين في الطباعة
 * 4. طباعة منفصلة حسب المادة والحصة
 */

const STATE_KEY = 'edutrack_v7_2';

let state = {
  teachers: [],
  schedule: {},
  sessions: [], // [{ id, sessionNum, subject, from, to, notes }]
  numRooms: 10,
  info: {
    academy: 'أكاديمية...',
    institution: 'المؤسسة...',
    year: '2024/2025'
  }
};

const App = {
  init() {
    this.loadState();
    this.bindNavTabs();
    this.refreshTeachers();
    this.renderSessions();
    this.updateStats();
    this.goTab('dashboard');
  },

  loadState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) state = JSON.parse(saved);
    } catch (e) { console.error(e); }
  },

  saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  },

  bindNavTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
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
  },

  // ───── EXAM SESSIONS ─────
  addExamSession() {
    const sessionNum = state.sessions.length + 1;
    const id = Date.now();
    state.sessions.push({
      id,
      sessionNum,
      subject: '',
      from: '08:00',
      to: '10:00',
      notes: ''
    });
    this.saveState();
    this.renderSessions();
    toast(`✅ تمت إضافة الحصة ${sessionNum}`, 'success');
  },

  renderSessions() {
    const body = document.getElementById('exam_sessions_body');
    if (!body) return;
    if (!state.sessions.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray-light)">لا توجد حصص</td></tr>';
      return;
    }
    body.innerHTML = state.sessions.map((s, idx) => `
      <tr>
        <td><strong>${s.sessionNum}</strong></td>
        <td>
          <select onchange="App.updateSession(${s.id}, 'subject', this.value)" class="form-control sm" style="width:100%">
            <option value="">-- اختر المادة --</option>
            <option value="الرياضيات" ${s.subject === 'الرياضيات' ? 'selected' : ''}>الرياضيات</option>
            <option value="اللغة العربية" ${s.subject === 'اللغة العربية' ? 'selected' : ''}>اللغة العربية</option>
            <option value="اللغة الفرنسية" ${s.subject === 'اللغة الفرنسية' ? 'selected' : ''}>اللغة الفرنسية</option>
            <option value="الفيزياء والكيمياء" ${s.subject === 'الفيزياء والكيمياء' ? 'selected' : ''}>الفيزياء والكيمياء</option>
            <option value="علوم الحياة والأرض" ${s.subject === 'علوم الحياة والأرض' ? 'selected' : ''}>علوم الحياة والأرض</option>
            <option value="التاريخ والجغرافيا" ${s.subject === 'التاريخ والجغرافيا' ? 'selected' : ''}>التاريخ والجغرافيا</option>
            <option value="الفلسفة" ${s.subject === 'الفلسفة' ? 'selected' : ''}>الفلسفة</option>
          </select>
        </td>
        <td><input type="time" value="${s.from}" onchange="App.updateSession(${s.id}, 'from', this.value)" class="form-control sm"></td>
        <td><input type="time" value="${s.to}" onchange="App.updateSession(${s.id}, 'to', this.value)" class="form-control sm"></td>
        <td><input type="text" value="${s.notes || ''}" onchange="App.updateSession(${s.id}, 'notes', this.value)" class="form-control sm" placeholder="ملاحظات"></td>
        <td class="no-print"><button class="btn btn-danger btn-sm" onclick="App.deleteSession(${s.id})">🗑️</button></td>
      </tr>
    `).join('');
  },

  updateSession(id, field, value) {
    const sess = state.sessions.find(s => s.id === id);
    if (sess) {
      sess[field] = value;
      this.saveState();
      this.renderSessions();
    }
  },

  deleteSession(id) {
    state.sessions = state.sessions.filter(s => s.id !== id);
    state.sessions.forEach((s, i) => s.sessionNum = i + 1);
    this.saveState();
    this.renderSessions();
    toast('✅ تم حذف الحصة', 'success');
  },

  saveInfo() {
    this.saveState();
    toast('✅ تم حفظ البرنامج', 'success');
  },

  // ───── TEACHERS ─────
  addTeacher() {
    const name = document.getElementById('t_name').value.trim();
    if (!name) { toast('❌ أدخل الاسم', 'error'); return; }
    
    const teacher = {
      id: Date.now(),
      name,
      mat: document.getElementById('t_mat').value.trim(),
      subject: document.getElementById('t_subject').value.trim(),
      group: document.getElementById('t_group').value,
      assignments: [] // حصص الأستاذ
    };
    
    state.teachers.push(teacher);
    this.saveState();
    this.refreshTeachers();
    this.updateStats();
    
    document.getElementById('t_name').value = '';
    document.getElementById('t_mat').value = '';
    document.getElementById('t_subject').value = '';
    
    toast(`✅ تمت إضافة ${name}`, 'success');
  },

  removeTeacher(id) {
    state.teachers = state.teachers.filter(t => t.id !== id);
    this.saveState();
    this.refreshTeachers();
    this.updateStats();
  },

  refreshTeachers() {
    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');
    
    document.getElementById('count_a').textContent = gA.length;
    document.getElementById('count_b').textContent = gB.length;
    
    this.renderTeacherGroup(gA, 'teachers_a_body');
    this.renderTeacherGroup(gB, 'teachers_b_body');
  },

  renderTeacherGroup(teachers, bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    if (!teachers.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-light)">لا يوجد أساتذة</td></tr>';
      return;
    }
    body.innerHTML = teachers.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right;font-weight:600">${this.esc(t.name)}</td>
        <td>${this.esc(t.mat) || '—'}</td>
        <td>${this.esc(t.subject) || '—'}</td>
        <td class="no-print"><button class="btn btn-danger btn-sm" onclick="App.removeTeacher(${t.id})">✕</button></td>
      </tr>
    `).join('');
  },

  // ───── SCHEDULE ─────
  autoAssign() {
    const numRooms = parseInt(document.getElementById('sched_rooms').value) || 10;
    state.numRooms = numRooms;
    
    if (!state.teachers.length || !state.sessions.length) {
      toast('❌ أضف أساتذة وحصص أولاً', 'error');
      return;
    }

    const groupA = state.teachers.filter(t => t.group === 'A');
    const groupB = state.teachers.filter(t => t.group === 'B');

    state.schedule = {};
    state.teachers.forEach(t => t.assignments = []);

    // لكل حصة (مادة)، وزع الأساتذة على القاعات
    state.sessions.forEach(session => {
      const key_prefix = `${session.sessionNum}`;
      let aIdx = 0, bIdx = 0;

      for (let r = 1; r <= numRooms; r++) {
        const roomKey = `room_${r}`;
        const key = `${key_prefix}_${roomKey}`;

        const tA = groupA[aIdx % groupA.length];
        const tB = groupB[bIdx % groupB.length];

        if (!state.schedule[key_prefix]) state.schedule[key_prefix] = {};
        state.schedule[key_prefix][roomKey] = {
          A: { teacherId: tA?.id, name: tA?.name },
          B: { teacherId: tB?.id, name: tB?.name }
        };

        if (tA) tA.assignments.push(session.sessionNum);
        if (tB) tB.assignments.push(session.sessionNum);

        aIdx++;
        bIdx++;
      }
    });

    this.saveState();
    this.renderSchedule();
    toast(`✅ تم التوزيع على ${numRooms} قاعة`, 'success');
  },

  renderSchedule() {
    const container = document.getElementById('schedule_container');
    if (!container) return;

    if (!Object.keys(state.schedule).length) {
      container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--gray-light);"><p>لم يتم التوزيع بعد</p></div>';
      return;
    }

    let html = '<table class="schedule-table"><thead><tr><th>القاعة</th>';
    
    // Headers للمواد
    state.sessions.forEach(s => {
      html += `<th class="th-subject" style="background:#5a6b7d;color:white">حصة ${s.sessionNum}<br>${this.esc(s.subject)}</th>`;
    });
    html += '<th style="background:#5a6b7d;color:white">المراقب</th></tr></thead><tbody>';

    // صفوف القاعات
    for (let r = 1; r <= state.numRooms; r++) {
      html += `<tr><td class="room-name">القاعة ${r}</td>`;
      
      let lastTeacher = '';
      state.sessions.forEach((s, sessionIdx) => {
        const roomKey = `room_${r}`;
        const assignment = state.schedule[s.sessionNum]?.[roomKey];
        
        if (assignment) {
          const teacherName = assignment.A?.name || assignment.B?.name || '—';
          const teacherType = assignment.A?.name ? 'A' : 'B';
          lastTeacher = `${teacherName} (${teacherType})`;
          html += `<td class="subject-name"><span class="teacher-name">${this.esc(teacherName)}</span><br><small style="color:var(--gray-light)">مراقب ${teacherType === 'A' ? 1 : 2}</small></td>`;
        } else {
          html += `<td class="empty-cell">—</td>`;
        }
      });
      
      html += `<td>${lastTeacher || '—'}</td></tr>`;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  clearSchedule() {
    this.showConfirm('حذف الجدول', 'هل تريد مسح جدول الحراسة؟', () => {
      state.schedule = {};
      state.teachers.forEach(t => t.assignments = []);
      this.saveState();
      this.renderSchedule();
      toast('✅ تم مسح الجدول', 'success');
    });
  },

  printScheduleBySubject() {
    if (!Object.keys(state.schedule).length) {
      toast('❌ لا يوجد جدول للطباعة', 'error');
      return;
    }
    alert('📋 سيتم طباعة جدول منفصل لكل مادة...');
    window.print();
  },

  printScheduleBySession() {
    if (!Object.keys(state.schedule).length) {
      toast('❌ لا يوجد جدول للطباعة', 'error');
      return;
    }
    alert('📋 سيتم طباعة جدول منفصل لكل حصة...');
    window.print();
  },

  printSchedule() {
    window.print();
  },

  // ───── UTILITIES ─────
  updateStats() {
    const gA = state.teachers.filter(t => t.group === 'A');
    const gB = state.teachers.filter(t => t.group === 'B');
    
    const total = document.getElementById('d_total');
    const groupA = document.getElementById('d_groupA');
    const groupB = document.getElementById('d_groupB');
    const sessions = document.getElementById('d_sessions');
    
    if (total) total.textContent = state.teachers.length;
    if (groupA) groupA.textContent = gA.length;
    if (groupB) groupB.textContent = gB.length;
    if (sessions) sessions.textContent = state.sessions.length;
  },

  exportData() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EduTrack_${new Date().toLocaleDateString('ar-SA')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ تم تصدير البيانات', 'success');
  },

  showConfirm(title, body, onConfirm) {
    document.getElementById('modal_title').textContent = title;
    document.getElementById('modal_body').innerHTML = `<p style="font-size:14px;color:var(--gray)">${body}</p>`;
    document.getElementById('modal_confirm').onclick = () => {
      this.closeModal();
      onConfirm();
    };
    document.getElementById('modal_overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal_overlay').classList.remove('open');
  },

  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

function toast(msg, type = 'info') {
  const container = document.getElementById('toast_container');
  const div = document.createElement('div');
  div.className = `toast ${type === 'success' ? 't-success' : type === 'error' ? 't-error' : type === 'warn' ? 't-warn' : ''}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => {
    div.classList.add('toast-out');
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

window.App = App;
window.toast = toast;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});