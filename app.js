'use strict';
const STAGES = ['جديد', 'تم التواصل', 'معاينة', 'تفاوض', 'تم البيع', 'خسارة'];
const SOURCES = ['فيسبوك', 'إنستجرام', 'واتساب', 'إحالة', 'موقع إلكتروني'];
const KEY = 'geo_demo_leads';

// بيانات تجريبية للعرض فقط
const SAMPLE = [
  { id: 1, name: 'أحمد محمود', phone: '01000000001', source: 'فيسبوك', budget: 2500000, stage: 'جديد' },
  { id: 2, name: 'سارة علي', phone: '01000000002', source: 'إحالة', budget: 4200000, stage: 'معاينة' },
  { id: 3, name: 'محمد حسن', phone: '01000000003', source: 'واتساب', budget: 3100000, stage: 'تفاوض' },
  { id: 4, name: 'منى خالد', phone: '01000000004', source: 'إنستجرام', budget: 1800000, stage: 'تم البيع' },
];
const OTHER = {
  marketing: { title: 'التسويق', cols: ['الحملة', 'المنصة', 'الحالة'], rows: [['حملة العاصمة الإدارية', 'فيسبوك', 'نشطة'], ['حملة الساحل الشمالي', 'إنستجرام', 'متوقفة']] },
  hr: { title: 'الموارد البشرية', cols: ['الموظف', 'القسم', 'الحالة'], rows: [['موظف تجريبي ١', 'المبيعات', 'حاضر'], ['موظف تجريبي ٢', 'التسويق', 'إجازة']] },
  creative: { title: 'الاستوديو الإبداعي', cols: ['المشروع', 'المصمم', 'الحالة'], rows: [['بروشور مشروع أ', 'مصمم ١', 'قيد التنفيذ'], ['فيديو ترويجي', 'مصمم ٢', 'مراجعة']] },
};
const NAV = [['dashboard', 'لوحة التحكم'], ['sales', 'المبيعات'], ['pipeline', 'مسار العملاء'], ['marketing', 'التسويق'], ['hr', 'الموارد البشرية'], ['creative', 'الاستوديو الإبداعي']];

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('ar-EG') + ' ج.م';

let leads = load();
let current = 'dashboard';

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(d)) return d; } catch (e) {}
  return SAMPLE.map((x) => ({ ...x }));
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(leads)); } catch (e) {} }

/* ---------- login ---------- */
$('#togglePw').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; };
$('#loginForm').onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = String(f.get('email') || '').trim();
  if (!email || !f.get('password')) { $('#loginError').hidden = false; return; }
  $('#loginError').hidden = true;
  $('#userName').textContent = email;
  $('#login').hidden = true; $('#app').hidden = false;
  go('dashboard');
};
$('#logout').onclick = () => { $('#app').hidden = true; $('#login').hidden = false; $('#loginForm').reset(); };

/* ---------- navigation ---------- */
function go(v) {
  current = v;
  $('#nav').innerHTML = NAV.map(([k, l]) => `<button data-v="${k}" class="${k === v ? 'on' : ''}">${l}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach((b) => (b.onclick = () => go(b.dataset.v)));
  $('#title').textContent = NAV.find((n) => n[0] === v)[1];
  const views = { dashboard, sales, pipeline };
  (views[v] || other)(v);
}

/* ---------- views ---------- */
function dashboard() {
  const won = leads.filter((l) => l.stage === 'تم البيع').length;
  const total = leads.reduce((s, l) => s + Number(l.budget || 0), 0);
  const max = Math.max(1, ...STAGES.map((s) => leads.filter((l) => l.stage === s).length));
  $('#view').innerHTML = `
    <div class="stats">
      <div class="card stat"><b>${leads.length}</b><span>إجمالي العملاء المحتملين</span></div>
      <div class="card stat"><b>${won}</b><span>صفقات مغلقة</span></div>
      <div class="card stat"><b>${leads.length ? Math.round((won / leads.length) * 100) : 0}%</b><span>نسبة التحويل</span></div>
      <div class="card stat"><b style="font-size:1.1rem">${money(total)}</b><span>مجموع الميزانيات</span></div>
    </div>
    <div class="card"><h3>العملاء حسب المرحلة</h3>
      ${STAGES.map((s) => { const n = leads.filter((l) => l.stage === s).length; return `<div class="bar-row"><span>${s}</span><div class="bar"><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`; }).join('')}
    </div>`;
}

function sales() {
  $('#view').innerHTML = `
    <form id="addLead" class="card form-grid">
      <label>الاسم<input name="name" required></label>
      <label>الهاتف<input name="phone" dir="ltr" required></label>
      <label>المصدر<select name="source">${SOURCES.map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label>الميزانية<input name="budget" type="number" min="0"></label>
      <button class="btn">إضافة عميل</button>
    </form>
    <div class="card">
      <div class="toolbar">
        <input id="q" placeholder="بحث بالاسم أو الهاتف">
        <select id="fs"><option value="">كل المراحل</option>${STAGES.map((s) => `<option>${s}</option>`).join('')}</select>
        <button id="csv" class="btn sec">تصدير CSV</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>المصدر</th><th>الميزانية</th><th>المرحلة</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    </div>`;
  $('#addLead').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name')).trim(), phone = String(f.get('phone')).trim();
    if (!name || !phone) return;
    leads.unshift({ id: Date.now(), name, phone, source: f.get('source'), budget: Number(f.get('budget') || 0), stage: STAGES[0] });
    save(); sales();
  };
  $('#q').oninput = rows; $('#fs').onchange = rows; $('#csv').onclick = exportCsv;
  rows();
}

function rows() {
  const q = $('#q').value.trim().toLowerCase(), fs = $('#fs').value;
  const list = leads.filter((l) => (!fs || l.stage === fs) && (!q || l.name.toLowerCase().includes(q) || l.phone.includes(q)));
  $('#rows').innerHTML = list.length ? list.map((l) => `
    <tr><td>${esc(l.name)}</td><td dir="ltr">${esc(l.phone)}</td><td>${esc(l.source)}</td><td>${money(l.budget)}</td>
    <td><select data-id="${l.id}" class="stg">${STAGES.map((s) => `<option ${s === l.stage ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    <td><button class="ghost del" data-id="${l.id}" aria-label="حذف">🗑</button></td></tr>`).join('')
    : `<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>`;
  document.querySelectorAll('.stg').forEach((s) => (s.onchange = () => { leads.find((l) => l.id == s.dataset.id).stage = s.value; save(); }));
  document.querySelectorAll('.del').forEach((b) => (b.onclick = () => { if (confirm('حذف هذا العميل؟')) { leads = leads.filter((l) => l.id != b.dataset.id); save(); rows(); } }));
}

function exportCsv() {
  const safe = (v) => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const csv = '\uFEFF' + [['الاسم', 'الهاتف', 'المصدر', 'الميزانية', 'المرحلة']].concat(leads.map((l) => [l.name, l.phone, l.source, l.budget, l.stage])).map((r) => r.map(safe).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'leads.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function pipeline() {
  $('#view').innerHTML = `<div class="kanban">${STAGES.map((s) => {
    const items = leads.filter((l) => l.stage === s);
    return `<div class="col"><h3>${s} (${items.length})</h3>${items.map((l) => `<div class="item"><b>${esc(l.name)}</b><br><span class="muted">${money(l.budget)}</span></div>`).join('') || '<div class="empty">—</div>'}</div>`;
  }).join('')}</div>`;
}

function other(v) {
  const o = OTHER[v];
  $('#view').innerHTML = `<div class="card"><p class="muted">بيانات تجريبية للعرض فقط.</p><div class="table-wrap"><table><thead><tr>${o.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${o.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
