// ============================================================
//  Water Bills System — Application Script
//  - Airtable license verification
//  - Firebase Firestore data layer
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, where, getDocs, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ============================================================
//  AIRTABLE LICENSE CONFIG
// ============================================================
const AIRTABLE_CONFIG = {
  API_KEY: 'patShiD5D2ldM9B1G.2c88ced51a8b03ce0f77501ec9508195f4eb072851179c645bbf729472777f07',
  BASE_ID: 'appF7JQVJC7UsvLVB',
  TABLE_NAME: 'Licenses'
};

const LS_LICENSE_KEYS = {
  key: 'wb_license_key',
  device: 'wb_device_id',
  lastSuccess: 'wb_last_verify',
  client: 'wb_license_client',
  expiry: 'wb_license_expiry',
};

const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PERIODIC_CHECK_MS = 30 * 60 * 1000;     // 30 minutes

// ============================================================
//  LicenseManager — Airtable client
// ============================================================
class LicenseManager {
  constructor(config) {
    this.apiKey = config.API_KEY;
    this.baseId = config.BASE_ID;
    this.tableName = config.TABLE_NAME;
    this.endpoint = `https://api.airtable.com/v0/${this.baseId}/${encodeURIComponent(this.tableName)}`;
    this.currentRecordId = null;
    this.currentRecord = null;
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Generate or retrieve a unique device ID
  getDeviceId() {
    let id = localStorage.getItem(LS_LICENSE_KEYS.device);
    if (!id) {
      id = 'dev_' + Date.now().toString(36) + '_' +
        Math.random().toString(36).slice(2, 10);
      localStorage.setItem(LS_LICENSE_KEYS.device, id);
    }
    return id;
  }

  // Look up the license record by License Key
  async _findRecord(licenseKey) {
    const formula = encodeURIComponent(`{License Key} = "${licenseKey}"`);
    const url = `${this.endpoint}?filterByFormula=${formula}&maxRecords=1`;
    const res = await fetch(url, { headers: this._headers() });
    if (!res.ok) {
      throw new Error(`Airtable HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.records || data.records.length === 0) return null;
    return data.records[0];
  }

  // Verify a license key — returns { ok, error, record }
  async verify(licenseKey) {
    const key = (licenseKey || '').trim();
    if (!key) return { ok: false, error: 'يرجى إدخال مفتاح الترخيص' };

    let record;
    try {
      record = await this._findRecord(key);
    } catch (err) {
      throw new Error('تعذر الاتصال بخادم التحقق: ' + err.message);
    }

    if (!record) {
      return { ok: false, error: 'مفتاح الترخيص غير موجود' };
    }

    this.currentRecordId = record.id;
    this.currentRecord = record;
    const fields = record.fields || {};

    const status = (fields['Status'] || '').toLowerCase();
    if (status === 'blocked') {
      return { ok: false, error: 'هذا الترخيص محظور — يرجى التواصل مع المطور' };
    }
    if (status === 'expired') {
      return { ok: false, error: 'انتهت صلاحية هذا الترخيص — يرجى التجديد' };
    }
    if (status !== 'active') {
      return { ok: false, error: 'حالة الترخيص غير مفعّلة' };
    }

    // Expiry date check
    const expiryStr = fields['Expiry Date'];
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(expiry.getTime()) && expiry < today) {
        // Auto-mark expired in Airtable
        try { await this.updateStatus('expired'); } catch {}
        return { ok: false, error: 'انتهت صلاحية هذا الترخيص بتاريخ ' + expiryStr };
      }
    }

    // Devices check
    const deviceId = this.getDeviceId();
    const devicesRaw = fields['Devices'] || '';
    const devices = devicesRaw
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const maxDevices = Number(fields['Max Devices'] || 1);

    if (!devices.includes(deviceId)) {
      if (devices.length >= maxDevices) {
        return {
          ok: false,
          error: `تم تجاوز الحد الأقصى للأجهزة المسموح بها (${maxDevices}). يرجى التواصل مع المطور.`
        };
      }
      devices.push(deviceId);
      try {
        await this.updateDevices(devices);
      } catch (err) {
        console.warn('Failed to register device:', err);
      }
    }

    // Update last check
    try { await this.updateLastCheck(); } catch {}

    // Persist client-side info
    localStorage.setItem(LS_LICENSE_KEYS.lastSuccess, String(Date.now()));
    localStorage.setItem(LS_LICENSE_KEYS.client, fields['Client Name'] || '');
    localStorage.setItem(LS_LICENSE_KEYS.expiry, fields['Expiry Date'] || '');

    return { ok: true, record, fields };
  }

  async _patchFields(fields) {
    if (!this.currentRecordId) throw new Error('No record loaded');
    const url = `${this.endpoint}/${this.currentRecordId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this._headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Airtable PATCH HTTP ${res.status} ${txt}`);
    }
    return await res.json();
  }

  async updateDevices(devices) {
    return this._patchFields({ 'Devices': devices.join('\n') });
  }

  async updateStatus(status) {
    return this._patchFields({ 'Status': status });
  }

  async updateLastCheck() {
    const now = new Date().toISOString().split('T')[0];
    return this._patchFields({ 'Last Check': now });
  }
}

const licenseManager = new LicenseManager(AIRTABLE_CONFIG);

// ============================================================
//  License screen UI
// ============================================================
function showLicenseScreen(errorMsg) {
  const screen = document.getElementById('license-screen');
  const app = document.getElementById('app');
  screen.classList.remove('hidden');
  app.classList.add('hidden');
  const errEl = document.getElementById('license-error');
  if (errorMsg) {
    errEl.textContent = errorMsg;
    errEl.classList.add('show');
  } else {
    errEl.textContent = '';
    errEl.classList.remove('show');
  }
}

function hideLicenseScreen() {
  document.getElementById('license-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

async function activateLicense() {
  const input = document.getElementById('license-key-input');
  const btn = document.getElementById('license-activate-btn');
  const txt = document.getElementById('license-btn-text');
  const key = (input?.value || '').trim();
  if (!key) {
    showLicenseScreen('يرجى إدخال مفتاح الترخيص');
    return;
  }
  btn.disabled = true;
  txt.innerHTML = '<span class="license-spinner"></span> جاري التحقق...';
  try {
    const result = await licenseManager.verify(key);
    if (result.ok) {
      localStorage.setItem(LS_LICENSE_KEYS.key, key);
      hideLicenseScreen();
      await bootApp();
    } else {
      showLicenseScreen(result.error);
    }
  } catch (err) {
    showLicenseScreen(err.message || 'حدث خطأ أثناء التحقق');
  } finally {
    btn.disabled = false;
    txt.textContent = 'تفعيل الترخيص';
  }
}

window.changeLicense = function() {
  if (!confirm('هل تريد تغيير مفتاح الترخيص؟ ستحتاج إلى إدخال مفتاح جديد.')) return;
  localStorage.removeItem(LS_LICENSE_KEYS.key);
  localStorage.removeItem(LS_LICENSE_KEYS.lastSuccess);
  localStorage.removeItem(LS_LICENSE_KEYS.client);
  localStorage.removeItem(LS_LICENSE_KEYS.expiry);
  location.reload();
};

function startPeriodicCheck() {
  setInterval(async () => {
    const key = localStorage.getItem(LS_LICENSE_KEYS.key);
    if (!key) return;
    try {
      const result = await licenseManager.verify(key);
      if (!result.ok) {
        alert('انتهت صلاحية الترخيص: ' + result.error);
        localStorage.removeItem(LS_LICENSE_KEYS.key);
        location.reload();
      }
    } catch (err) {
      // Network failure — silently keep working within grace window
      console.warn('Periodic license check failed:', err.message);
    }
  }, PERIODIC_CHECK_MS);
}

function updateLicenseInfoInSettings() {
  const client = localStorage.getItem(LS_LICENSE_KEYS.client) || '—';
  const expiry = localStorage.getItem(LS_LICENSE_KEYS.expiry) || '—';
  const key = localStorage.getItem(LS_LICENSE_KEYS.key) || '—';
  const cEl = document.getElementById('license-client');
  const eEl = document.getElementById('license-expiry');
  const kEl = document.getElementById('license-key-display');
  if (cEl) cEl.textContent = client;
  if (eEl) eEl.textContent = expiry;
  if (kEl) {
    if (key && key.length > 12) {
      kEl.textContent = key.slice(0, 4) + '••••' + key.slice(-4);
    } else {
      kEl.textContent = key;
    }
  }
}

async function initLicense() {
  // ربط الفورم بحدث الإرسال
  const form = document.getElementById('license-form');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      activateLicense();
    });
  }

  const savedKey = localStorage.getItem(LS_LICENSE_KEYS.key);
  if (!savedKey) {
    showLicenseScreen();
    return false;
  }

  try {
    const result = await licenseManager.verify(savedKey);
    if (result.ok) {
      hideLicenseScreen();
      return true;
    } else {
      localStorage.removeItem(LS_LICENSE_KEYS.key);
      showLicenseScreen(result.error);
      return false;
    }
  } catch (err) {
    // Offline mode: allow up to 24h since last successful check
    const lastSuccess = Number(localStorage.getItem(LS_LICENSE_KEYS.lastSuccess) || 0);
    const elapsed = Date.now() - lastSuccess;
    if (lastSuccess && elapsed < OFFLINE_GRACE_MS) {
      console.warn('Offline mode — license check skipped:', err.message);
      hideLicenseScreen();
      return true;
    }
    showLicenseScreen('تعذر الاتصال بخادم التحقق. يرجى التحقق من الاتصال بالإنترنت.');
    return false;
  }
}

// ============================================================
//  Original Application — State & Helpers
// ============================================================
const state = {
  firebaseApp: null,
  db: null,
  subscribers: [],
  invoices: [],
  association: {
    name: 'جمعية مياه',
    address: '',
    phone: '',
    currency: 'درهم',
    defaultPrice: 5,
    logo: null,
  },
  currentTab: 'dashboard',
  editingSubscriberId: null,
  unsubSubscribers: null,
  unsubInvoices: null,
};

const LS_KEYS = {
  firebase: 'water_bills_firebase_config',
  assoc: 'water_bills_association',
  theme: 'water_bills_theme',
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n || 0).toLocaleString('en-US');
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, type = 'success') {
  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };
  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast-enter pointer-events-auto ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 min-w-[240px]`;
  el.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4"></i><span class="text-sm">${escapeHtml(msg)}</span>`;
  $('toast-container').appendChild(el);
  lucide.createIcons();
  setTimeout(() => el.remove(), 3500);
}

// ===== Theme =====
function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  lucide.createIcons();
}
function initTheme() {
  const saved = localStorage.getItem(LS_KEYS.theme) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
  $('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem(LS_KEYS.theme, next);
    applyTheme(next);
  });
}

// ===== Tabs =====
window.switchTab = function(name) {
  state.currentTab = name;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  $(`tab-${name}`).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === name) {
      btn.classList.add('text-brand-600', 'border-brand-600');
      btn.classList.remove('text-slate-500', 'border-transparent');
    } else {
      btn.classList.remove('text-brand-600', 'border-brand-600');
      btn.classList.add('text-slate-500', 'border-transparent');
    }
  });
};

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  switchTab('dashboard');
}

// ===== Connection status =====
function setConnectionStatus(connected) {
  const el = $('connection-status');
  if (connected) {
    el.className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
    el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>متصل</span>';
    $('config-warning').classList.add('hidden');
  } else {
    el.className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span>غير متصل</span>';
    $('config-warning').classList.remove('hidden');
  }
}

// ===== Firebase =====
function loadFirebaseConfig() {
  try {
    const raw = localStorage.getItem(LS_KEYS.firebase);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveFirebaseConfig(cfg) {
  localStorage.setItem(LS_KEYS.firebase, JSON.stringify(cfg));
}

window.clearFirebaseConfig = function() {
  if (!confirm('هل تريد فعلاً حذف إعدادات Firebase؟ سيتم قطع الاتصال.')) return;
  localStorage.removeItem(LS_KEYS.firebase);
  ['cfg-apiKey','cfg-authDomain','cfg-projectId','cfg-storageBucket','cfg-messagingSenderId','cfg-appId'].forEach(id => $(id).value = '');
  if (state.unsubSubscribers) state.unsubSubscribers();
  if (state.unsubInvoices) state.unsubInvoices();
  state.firebaseApp = null;
  state.db = null;
  state.subscribers = [];
  state.invoices = [];
  renderAll();
  setConnectionStatus(false);
  toast('تم حذف إعدادات Firebase', 'info');
};

async function initFirebase(config) {
  try {
    if (state.unsubSubscribers) state.unsubSubscribers();
    if (state.unsubInvoices) state.unsubInvoices();

    state.firebaseApp = initializeApp(config, 'water-bills-' + Date.now());
    state.db = getFirestore(state.firebaseApp);

    // Subscribe to subscribers
    state.unsubSubscribers = onSnapshot(
      query(collection(state.db, 'subscribers'), orderBy('createdAt', 'desc')),
      (snap) => {
        state.subscribers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSubscribers();
        renderBillingSelect();
        renderDashboard();
      },
      (err) => {
        console.error(err);
        toast('خطأ في الاتصال بـ Firestore: ' + err.message, 'error');
      }
    );

    // Subscribe to invoices
    state.unsubInvoices = onSnapshot(
      query(collection(state.db, 'invoices'), orderBy('createdAt', 'desc')),
      (snap) => {
        state.invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderInvoices();
        renderDashboard();
      },
      (err) => {
        console.error(err);
        toast('خطأ في الاتصال بـ Firestore: ' + err.message, 'error');
      }
    );

    setConnectionStatus(true);
    return true;
  } catch (e) {
    console.error(e);
    toast('فشل تهيئة Firebase: ' + e.message, 'error');
    setConnectionStatus(false);
    return false;
  }
}

function fillFirebaseForm(cfg) {
  $('cfg-apiKey').value = cfg?.apiKey || '';
  $('cfg-authDomain').value = cfg?.authDomain || '';
  $('cfg-projectId').value = cfg?.projectId || '';
  $('cfg-storageBucket').value = cfg?.storageBucket || '';
  $('cfg-messagingSenderId').value = cfg?.messagingSenderId || '';
  $('cfg-appId').value = cfg?.appId || '';
}

function bindFirebaseForm() {
  $('firebase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cfg = {
      apiKey: $('cfg-apiKey').value.trim(),
      authDomain: $('cfg-authDomain').value.trim(),
      projectId: $('cfg-projectId').value.trim(),
      storageBucket: $('cfg-storageBucket').value.trim(),
      messagingSenderId: $('cfg-messagingSenderId').value.trim(),
      appId: $('cfg-appId').value.trim(),
    };
    if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
      toast('الحقول المعلمة بـ * إجبارية', 'error');
      return;
    }
    saveFirebaseConfig(cfg);
    const ok = await initFirebase(cfg);
    if (ok) toast('تم الاتصال بـ Firebase بنجاح', 'success');
  });
}

// ===== Association settings =====
function loadAssociation() {
  try {
    const raw = localStorage.getItem(LS_KEYS.assoc);
    if (raw) Object.assign(state.association, JSON.parse(raw));
  } catch {}
}
function saveAssociation() {
  localStorage.setItem(LS_KEYS.assoc, JSON.stringify(state.association));
}
function fillAssociationForm() {
  $('assoc-name').value = state.association.name || '';
  $('assoc-address').value = state.association.address || '';
  $('assoc-phone').value = state.association.phone || '';
  $('assoc-currency').value = state.association.currency || 'درهم';
  $('assoc-price').value = state.association.defaultPrice || '';
  const preview = $('logo-preview');
  if (state.association.logo) {
    preview.innerHTML = `<img src="${state.association.logo}" class="w-full h-full object-contain" />`;
  } else {
    preview.innerHTML = '<i data-lucide="image" class="w-6 h-6 text-slate-400"></i>';
    lucide.createIcons();
  }
}

function bindAssociationForm() {
  $('association-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.association.name = $('assoc-name').value.trim() || 'جمعية مياه';
    state.association.address = $('assoc-address').value.trim();
    state.association.phone = $('assoc-phone').value.trim();
    state.association.currency = $('assoc-currency').value.trim() || 'درهم';
    state.association.defaultPrice = parseFloat($('assoc-price').value) || 0;
    saveAssociation();
    toast('تم حفظ بيانات الجمعية', 'success');
  });

  $('assoc-logo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast('حجم الصورة يجب أن يكون أقل من 500KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.association.logo = ev.target.result;
      saveAssociation();
      fillAssociationForm();
      toast('تم رفع الشعار', 'success');
    };
    reader.readAsDataURL(file);
  });
}

window.removeLogo = function() {
  state.association.logo = null;
  saveAssociation();
  fillAssociationForm();
};

// ===== Subscribers CRUD =====
window.openSubscriberModal = function(sub) {
  state.editingSubscriberId = sub?.id || null;
  $('subscriber-modal-title').textContent = sub ? 'تعديل منخرط' : 'إضافة منخرط';
  $('sub-id').value = sub?.id || '';
  $('sub-meter').value = sub?.meter || '';
  $('sub-name').value = sub?.name || '';
  $('sub-address').value = sub?.address || '';
  $('sub-phone').value = sub?.phone || '';
  $('sub-join-date').value = sub?.joinDate || new Date().toISOString().split('T')[0];
  $('subscriber-modal').classList.remove('hidden');
  $('subscriber-modal').classList.add('flex');
};

window.closeSubscriberModal = function() {
  $('subscriber-modal').classList.add('hidden');
  $('subscriber-modal').classList.remove('flex');
  state.editingSubscriberId = null;
};

function bindSubscriberForm() {
  $('subscriber-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.db) { toast('يرجى ضبط Firebase أولاً', 'error'); return; }

    const meter = $('sub-meter').value.trim();
    const data = {
      meter,
      name: $('sub-name').value.trim(),
      address: $('sub-address').value.trim(),
      phone: $('sub-phone').value.trim(),
      joinDate: $('sub-join-date').value,
    };

    // Check uniqueness on meter
    const dup = state.subscribers.find(s => s.meter === meter && s.id !== state.editingSubscriberId);
    if (dup) { toast('رقم العداد موجود مسبقاً', 'error'); return; }

    try {
      if (state.editingSubscriberId) {
        await updateDoc(doc(state.db, 'subscribers', state.editingSubscriberId), data);
        toast('تم تحديث المنخرط', 'success');
      } else {
        await addDoc(collection(state.db, 'subscribers'), { ...data, createdAt: serverTimestamp() });
        toast('تمت إضافة المنخرط', 'success');
      }
      closeSubscriberModal();
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  });
}

window.deleteSubscriber = async function(id, name) {
  if (!confirm(`هل تريد حذف المنخرط "${name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
  try {
    await deleteDoc(doc(state.db, 'subscribers', id));
    toast('تم حذف المنخرط', 'success');
  } catch (err) {
    toast('خطأ: ' + err.message, 'error');
  }
};

function renderSubscribers() {
  const search = ($('subscribers-search').value || '').trim().toLowerCase();
  const filtered = state.subscribers.filter(s =>
    !search ||
    (s.name || '').toLowerCase().includes(search) ||
    (s.meter || '').toLowerCase().includes(search) ||
    (s.phone || '').toLowerCase().includes(search)
  );
  const tbody = $('subscribers-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">${search ? 'لا توجد نتائج' : 'لا يوجد منخرطون — اضغط "إضافة منخرط" للبدء'}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(s => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(s.meter)}</td>
      <td class="px-4 py-3 font-medium">${escapeHtml(s.name)}</td>
      <td class="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">${escapeHtml(s.address || '—')}</td>
      <td class="px-4 py-3 text-slate-500 text-xs font-mono hidden md:table-cell">${escapeHtml(s.phone || '—')}</td>
      <td class="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">${escapeHtml(s.joinDate || '—')}</td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-end gap-1">
          <button onclick='editSubscriber(${JSON.stringify(s.id)})' class="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="تعديل">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
          <button onclick='deleteSubscriber(${JSON.stringify(s.id)}, ${JSON.stringify(s.name)})' class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" title="حذف">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

window.editSubscriber = function(id) {
  const sub = state.subscribers.find(s => s.id === id);
  if (sub) openSubscriberModal(sub);
};

// ===== Billing =====
function renderBillingSelect() {
  const sel = $('bill-subscriber');
  const current = sel.value;
  sel.innerHTML = '<option value="">اختر منخرطاً...</option>' +
    state.subscribers.map(s => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.meter)}</option>`).join('');
  sel.value = current;
}

function getLastReadingForSubscriber(subId) {
  const subInvoices = state.invoices
    .filter(i => i.subscriberId === subId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return subInvoices[0]?.currentReading ?? 0;
}

function updateBillingPreview() {
  const subId = $('bill-subscriber').value;
  const prev = subId ? getLastReadingForSubscriber(subId) : 0;
  const curr = parseFloat($('bill-current').value) || 0;
  const price = parseFloat($('bill-price').value) || 0;
  const cons = Math.max(0, curr - prev);
  const total = cons * price;
  $('bill-previous').value = prev;
  $('preview-prev').textContent = fmtInt(prev);
  $('preview-curr').textContent = fmtInt(curr);
  $('preview-cons').textContent = fmtInt(cons);
  $('preview-price').textContent = fmt(price);
  $('preview-total').textContent = fmt(total) + ' ' + (state.association.currency || '');
}

function bindBillingForm() {
  $('bill-subscriber').addEventListener('change', updateBillingPreview);
  $('bill-current').addEventListener('input', updateBillingPreview);
  $('bill-price').addEventListener('input', updateBillingPreview);

  $('billing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.db) { toast('يرجى ضبط Firebase أولاً', 'error'); return; }

    const subId = $('bill-subscriber').value;
    const sub = state.subscribers.find(s => s.id === subId);
    if (!sub) { toast('اختر منخرطاً', 'error'); return; }

    const previousReading = getLastReadingForSubscriber(subId);
    const currentReading = parseFloat($('bill-current').value);
    const pricePerCubic = parseFloat($('bill-price').value);

    if (currentReading < previousReading) {
      if (!confirm('القراءة الحالية أقل من السابقة. هل تريد المتابعة على أي حال؟')) return;
    }

    const consumption = Math.max(0, currentReading - previousReading);
    const amount = consumption * pricePerCubic;

    const invoice = {
      subscriberId: subId,
      subscriberName: sub.name,
      subscriberMeter: sub.meter,
      subscriberAddress: sub.address || '',
      subscriberPhone: sub.phone || '',
      previousReading,
      currentReading,
      consumption,
      pricePerCubic,
      amount,
      date: $('bill-date').value,
      notes: $('bill-notes').value.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      const ref = await addDoc(collection(state.db, 'invoices'), invoice);
      toast('تم إنشاء الفاتورة بنجاح', 'success');
      // Reset form
      $('billing-form').reset();
      $('bill-date').value = new Date().toISOString().split('T')[0];
      $('bill-price').value = state.association.defaultPrice;
      updateBillingPreview();
      // Open print
      showInvoice({ id: ref.id, ...invoice });
    } catch (err) {
      toast('خطأ: ' + err.message, 'error');
    }
  });
}

// ===== Invoices list =====
function renderInvoices() {
  const search = ($('invoices-search').value || '').trim().toLowerCase();
  const filtered = state.invoices.filter(i =>
    !search ||
    (i.subscriberName || '').toLowerCase().includes(search) ||
    (i.subscriberMeter || '').toLowerCase().includes(search)
  );
  const tbody = $('invoices-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">${search ? 'لا توجد نتائج' : 'لا توجد فواتير بعد'}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(i => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
      <td class="px-4 py-3 text-xs">${escapeHtml(i.date || '—')}</td>
      <td class="px-4 py-3 font-medium">${escapeHtml(i.subscriberName)}</td>
      <td class="px-4 py-3 font-mono text-xs hidden md:table-cell">${escapeHtml(i.subscriberMeter)}</td>
      <td class="px-4 py-3 hidden md:table-cell"><span class="font-mono">${fmtInt(i.consumption)}</span> <span class="text-xs text-slate-400">م³</span></td>
      <td class="px-4 py-3 font-mono font-semibold">${fmt(i.amount)}</td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-end gap-1">
          <button onclick='viewInvoice(${JSON.stringify(i.id)})' class="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30 text-brand-600" title="عرض وطباعة">
            <i data-lucide="printer" class="w-4 h-4"></i>
          </button>
          <button onclick='deleteInvoice(${JSON.stringify(i.id)})' class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600" title="حذف">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

window.viewInvoice = function(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (inv) showInvoice(inv);
};

window.deleteInvoice = async function(id) {
  if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
  try {
    await deleteDoc(doc(state.db, 'invoices', id));
    toast('تم حذف الفاتورة', 'success');
  } catch (err) {
    toast('خطأ: ' + err.message, 'error');
  }
};

// ===== Invoice print modal =====
function showInvoice(inv) {
  $('inv-assoc-name').textContent = state.association.name || 'جمعية مياه';
  $('inv-assoc-address').textContent = state.association.address || '';
  $('inv-assoc-phone').textContent = state.association.phone ? 'الهاتف: ' + state.association.phone : '';
  if (state.association.logo) {
    $('inv-logo').src = state.association.logo;
    $('inv-logo-wrap').classList.remove('hidden');
  } else {
    $('inv-logo-wrap').classList.add('hidden');
  }
  $('inv-number').textContent = (inv.id || '').slice(0, 8).toUpperCase();
  $('inv-date').textContent = inv.date || '—';
  $('inv-sub-name').textContent = inv.subscriberName || '—';
  $('inv-sub-address').textContent = inv.subscriberAddress || '';
  $('inv-meter').textContent = inv.subscriberMeter || '—';
  $('inv-phone').textContent = inv.subscriberPhone || '—';
  $('inv-prev').textContent = fmtInt(inv.previousReading);
  $('inv-curr').textContent = fmtInt(inv.currentReading);
  $('inv-cons').textContent = fmtInt(inv.consumption);
  $('inv-price').textContent = fmt(inv.pricePerCubic);
  $('inv-amount').textContent = fmt(inv.amount);
  $('inv-total').textContent = fmt(inv.amount);
  $('inv-currency').textContent = state.association.currency || 'درهم';
  const notes = $('inv-notes');
  if (inv.notes) {
    notes.textContent = 'ملاحظات: ' + inv.notes;
    notes.classList.remove('hidden');
  } else {
    notes.classList.add('hidden');
  }
  $('invoice-modal').classList.remove('hidden');
  $('invoice-modal').classList.add('flex');
  lucide.createIcons();
}

window.closeInvoiceModal = function() {
  $('invoice-modal').classList.add('hidden');
  $('invoice-modal').classList.remove('flex');
};

// ===== Dashboard =====
function renderDashboard() {
  $('stat-subscribers').textContent = fmtInt(state.subscribers.length);
  $('stat-invoices').textContent = fmtInt(state.invoices.length);
  const totalCons = state.invoices.reduce((s, i) => s + (i.consumption || 0), 0);
  const totalAmt = state.invoices.reduce((s, i) => s + (i.amount || 0), 0);
  $('stat-consumption').textContent = fmtInt(totalCons);
  $('stat-revenue').textContent = fmt(totalAmt) + ' ' + (state.association.currency || '');

  const recent = [...state.invoices].slice(0, 5);
  const wrap = $('dashboard-recent');
  if (recent.length === 0) {
    wrap.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">لا توجد فواتير بعد</div>';
  } else {
    wrap.innerHTML = recent.map(i => `
      <div class="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
            <i data-lucide="receipt" class="w-5 h-5 text-brand-600"></i>
          </div>
          <div class="min-w-0">
            <p class="font-medium truncate">${escapeHtml(i.subscriberName)}</p>
            <p class="text-xs text-slate-500">${escapeHtml(i.date || '')} • ${fmtInt(i.consumption)} م³</p>
          </div>
        </div>
        <div class="text-left shrink-0">
          <p class="font-bold font-mono">${fmt(i.amount)}</p>
          <p class="text-xs text-slate-400">${escapeHtml(state.association.currency || '')}</p>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }
}

function renderAll() {
  renderSubscribers();
  renderBillingSelect();
  renderInvoices();
  renderDashboard();
  fillAssociationForm();
}

// ============================================================
//  Search input bindings
// ============================================================
function bindSearchInputs() {
  $('subscribers-search').addEventListener('input', renderSubscribers);
  $('invoices-search').addEventListener('input', renderInvoices);
}

// ============================================================
//  Boot the app (after license is verified)
// ============================================================
async function bootApp() {
  if (window.__waterBillsBooted) {
    updateLicenseInfoInSettings();
    return;
  }
  window.__waterBillsBooted = true;

  lucide.createIcons();
  initTheme();
  initTabs();

  bindFirebaseForm();
  bindAssociationForm();
  bindSubscriberForm();
  bindBillingForm();
  bindSearchInputs();

  loadAssociation();
  fillAssociationForm();

  // default values
  $('bill-date').value = new Date().toISOString().split('T')[0];
  $('bill-price').value = state.association.defaultPrice || '';

  const cfg = loadFirebaseConfig();
  if (cfg) {
    fillFirebaseForm(cfg);
    initFirebase(cfg);
  } else {
    setConnectionStatus(false);
  }

  renderAll();
  updateLicenseInfoInSettings();
  startPeriodicCheck();
}

// ============================================================
//  Entry point
// ============================================================
async function init() {
  // Make sure Lucide icons render in the license screen too
  if (window.lucide) lucide.createIcons();
  const ok = await initLicense();
  if (ok) await bootApp();
}

init();
