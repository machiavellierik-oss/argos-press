// جريدة أرجوس — واجهة التطبيق
const CATS = { official: 'بيانات رسمية', war: 'سيناريوهات الحروب', events: 'أحداث اللعبة' };
const SKILLS = {
  intel: 'الاستخبارات والتجسس',
  diplomacy: 'التفاوض والتحالفات',
  econwar: 'الحرب الاقتصادية والدبلوماسية',
  analysis: 'التحليل الجيوسياسي',
  planning: 'التخطيط طويل المدى وإدارة الأزمات',
  resources: 'إدارة الموارد وتحليل البيانات',
};
const CLEARANCE_DESC = {
  'LEVEL 1': 'FIELD OPERATIVE', 'LEVEL 2': 'TACTICAL CLEARANCE', 'LEVEL 3': 'OPERATIONAL COMMAND',
  'LEVEL 4': 'STRATEGIC CLEARANCE', 'LEVEL 5': 'STRATEGIC COMMAND',
};
const STATUS_AR = { ACTIVE: 'نشط', INACTIVE: 'غير نشط', MIA: 'مفقود', KIA: 'قتيل' };
let COUNTRIES = [], CMAP = {}, me = null;
const app = document.getElementById('app');

// ---------- أدوات ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60); if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60); if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24); if (d < 30) return `منذ ${d} يوم`;
  return new Date(ts).toLocaleDateString('ar');
}
function countryOf(code) {
  if (code === 'HQ') return { flag: '🏛️', name: 'مقر أرجوس' };
  return CMAP[code] || { flag: '🏳️', name: code };
}
async function api(method, url, body) {
  const r = await fetch('/api' + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'حدث خطأ');
  return j;
}
async function uploadImage(file) {
  const fd = new FormData(); fd.append('image', file);
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'فشل رفع الصورة');
  return j.url;
}
const excerpt = (t, n = 140) => t.length > n ? t.slice(0, n) + '…' : t;

// ---------- الترويسة ----------
function renderTop() {
  document.getElementById('today').textContent =
    new Date().toLocaleDateString('ar', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const ub = document.getElementById('userbox');
  if (me) {
    const c = countryOf(me.country_code);
    ub.innerHTML = `${c.flag} <a href="#/dash">${esc(me.username)}</a> <a href="#" id="logout">خروج</a>`;
    document.getElementById('logout').onclick = async (e) => {
      e.preventDefault(); await api('POST', '/logout'); me = null; location.hash = '#/'; renderTop(); route();
    };
  } else {
    ub.innerHTML = `<a href="#/login">دخول</a> | <a href="#/register">إنشاء حساب</a>`;
  }
  const nav = document.getElementById('mainnav');
  const links = [
    ['#/', 'الرئيسية'], ['#/cat/official', 'بيانات رسمية'], ['#/cat/war', 'سيناريوهات الحروب'],
    ['#/cat/events', 'أحداث اللعبة'], ['#/dispatches', 'برقيات الدول'], ['#/dossiers', 'ملفات العملاء'],
    ...(me ? [['#/dash', 'لوحة التحكم']] : []),
  ];
  nav.innerHTML = links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
}

// ---------- الصفحة الرئيسية ----------
async function vHome() {
  app.innerHTML = '<p class="empty">جارٍ تحميل العدد…</p>';
  const [official, war, events, dispatches, dossiers] = await Promise.all([
    api('GET', '/articles?category=official&limit=1'),
    api('GET', '/articles?category=war&limit=3'),
    api('GET', '/articles?category=events&limit=3'),
    api('GET', '/dispatches?limit=4'),
    api('GET', '/dossiers'),
  ]);
  let h = '';
  if (official[0]) {
    const a = official[0], c = countryOf(a.author.country_code);
    h += `<div class="hero" onclick="location.hash='#/article/${a.id}'">
      ${a.image ? `<img src="${esc(a.image)}" alt="">` : `<div class="hero-ph"></div>`}
      <div class="hero-tx">
        <span class="badge gold">بيان رسمي</span>
        <h2>${esc(a.title)}</h2>
        <p>${esc(excerpt(a.body, 200))}</p>
        <div class="meta">${c.flag} ${esc(c.name)} · ${timeAgo(a.created_at)}</div>
      </div></div>`;
  }
  const sec = (title, items, cat) => items.length ? `
    <div class="sec-head"><h2>${title}</h2><a class="more" href="#/cat/${cat}">المزيد ←</a></div>
    <div class="grid">${items.map(cardHTML).join('')}</div>` : '';
  h += sec('سيناريوهات الحروب', war, 'war');
  h += sec('أحداث اللعبة', events, 'events');
  if (dispatches.length) {
    h += `<div class="sec-head"><h2>أحدث برقيات الدول</h2><a class="more" href="#/dispatches">الكل ←</a></div>`;
    h += dispatches.map(dispatchHTML).join('');
  }
  if (dossiers.length) {
    h += `<div class="sec-head"><h2>ملفات العملاء</h2><a class="more" href="#/dossiers">الكل ←</a></div>
      <div class="grid">${dossiers.slice(0, 3).map(dossierCardHTML).join('')}</div>`;
  }
  app.innerHTML = h || '<p class="empty">لا توجد أخبار بعد.</p>';
}
function cardHTML(a) {
  const c = countryOf(a.author.country_code);
  return `<div class="card" onclick="location.hash='#/article/${a.id}'">
    ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}
    <div class="card-tx">
      <span class="badge">${esc(a.category_label)}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(excerpt(a.body))}</p>
      <div class="meta"><span class="country-flag">${c.flag}</span> ${esc(c.name)} · ${timeAgo(a.created_at)}</div>
    </div></div>`;
}
function dispatchHTML(d) {
  const c = countryOf(d.author.country_code);
  return `<div class="dispatch">
    <div class="d-head">
      <span class="d-flag">${c.flag}</span>
      <div><div class="d-country">${esc(c.name)} <span class="stamp">برقية رسمية</span></div>
      <div class="d-user">@${esc(d.author.username)}</div></div>
      <span class="d-time">${timeAgo(d.created_at)}</span>
    </div>
    <p>${esc(d.body)}</p>
    ${d.image ? `<img src="${esc(d.image)}" alt="" loading="lazy">` : ''}
  </div>`;
}

// ---------- تصنيف ----------
async function vCat(cat) {
  app.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
  const items = await api('GET', `/articles?category=${cat}&limit=30`);
  app.innerHTML = `<div class="sec-head"><h2>${CATS[cat] || ''}</h2></div>` +
    (items.length ? `<div class="grid">${items.map(cardHTML).join('')}</div>` : '<p class="empty">لا توجد مواد في هذا القسم بعد.</p>');
}

// ---------- مقال ----------
async function vArticle(id) {
  app.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
  try {
    const a = await api('GET', `/articles/${id}`);
    const c = countryOf(a.author.country_code);
    const canDel = me && (me.id === a.author.id || me.role === 'admin');
    app.innerHTML = `<div class="article">
      <span class="badge ${a.category === 'official' ? 'gold' : ''}">${esc(a.category_label)}</span>
      <h1>${esc(a.title)}</h1>
      <div class="byline"><span class="country-flag">${c.flag}</span><strong>${esc(c.name)}</strong>
        <span>· @${esc(a.author.username)}</span><span>· ${timeAgo(a.created_at)}</span>
        ${canDel ? `<button class="btn danger" style="margin-inline-start:auto;padding:6px 16px" onclick="delArticle(${a.id})">حذف</button>` : ''}</div>
      ${a.image ? `<img class="lead-img" src="${esc(a.image)}" alt="">` : ''}
      <div class="body">${esc(a.body)}</div>
    </div>`;
  } catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
async function delArticle(id) {
  if (!confirm('حذف هذا المقال؟')) return;
  await api('DELETE', `/articles/${id}`); location.hash = '#/';
}

// ---------- البرقيات ----------
async function vDispatches() {
  app.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
  const items = await api('GET', '/dispatches?limit=40');
  app.innerHTML = `<div class="sec-head"><h2>برقيات الدول</h2>
    ${me ? '<a class="more" href="#/dash">+ برقية جديدة</a>' : '<a class="more" href="#/login">سجّل الدخول للتغريد باسم دولتك</a>'}</div>` +
    (items.length ? items.map(dispatchHTML).join('') : '<p class="empty">لا توجد برقيات بعد — كن أول من يصرّح باسم دولته.</p>');
}

// ---------- الدخول / التسجيل ----------
function vLogin() {
  app.innerHTML = `<div class="form"><h2>تسجيل الدخول</h2><div id="msg"></div>
    <div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" dir="ltr"></div>
    <div class="field"><label>كلمة المرور</label><input id="password" type="password"></div>
    <button class="btn" onclick="doLogin()">دخول</button>
    <p class="hint">ليس لديك حساب؟ <a href="#/register">أنشئ حسابًا واختر دولتك</a></p></div>`;
}
async function doLogin() {
  try {
    await api('POST', '/login', { email: val('email'), password: val('password') });
    me = (await api('GET', '/me')).user; renderTop(); location.hash = '#/';
  } catch (e) { msg(e.message, false); }
}
async function vRegister() {
  let taken = [];
  try { taken = await api('GET', '/taken-countries'); } catch (e) {}
  app.innerHTML = `<div class="form"><h2>إنشاء حساب لاعب</h2><div id="msg"></div>
    <div class="field"><label>اسم المستخدم</label><input id="username" dir="ltr" placeholder="مثال: napoleon_1900">
      <div class="hint">أحرف إنجليزية وأرقام و _ فقط (3-20)</div></div>
    <div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" dir="ltr"></div>
    <div class="field"><label>كلمة المرور</label><input id="password" type="password"><div class="hint">6 أحرف على الأقل</div></div>
    <div class="field"><label>الدولة التي ستلعب بها</label><select id="country">
      ${COUNTRIES.map((c) => `<option value="${c.code}"${taken.includes(c.code) ? ' disabled' : ''}>${c.flag} ${c.name}${taken.includes(c.code) ? ' — محجوزة' : ''}</option>`).join('')}</select>
      <div class="hint">كل دولة يحجزها لاعب واحد فقط — الدول المحجوزة تظهر معطّلة</div></div>
    <button class="btn" onclick="doRegister()">إنشاء الحساب</button></div>`;
}
async function doRegister() {
  try {
    const r = await api('POST', '/register', {
      username: val('username'), email: val('email'), password: val('password'), country_code: val('country'),
    });
    me = (await api('GET', '/me')).user; renderTop(); location.hash = '#/dash';
    if (r.role === 'admin') alert('أنت أول المسجّلين — مُنحت صلاحيات إدارة المقر (البيانات الرسمية).');
  } catch (e) { msg(e.message, false); }
}
const val = (id) => document.getElementById(id).value.trim();
function msg(t, ok) { document.getElementById('msg').innerHTML = `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>`; }

// ---------- لوحة التحكم ----------
async function vDash() {
  if (!me) { location.hash = '#/login'; return; }
  const c = countryOf(me.country_code);
  app.innerHTML = `<div class="sec-head"><h2>لوحة التحكم — ${c.flag} ${esc(c.name)}</h2></div>
    <div class="tabs">
      <button onclick="dashTab('new-d')" class="active">برقية جديدة</button>
      <button onclick="dashTab('new-a')">مقال جديد</button>
      <button onclick="dashTab('dossier')">ملفي الاستخباراتي</button>
      <button onclick="dashTab('mine')">منشوراتي</button>
    </div><div id="dashbody"></div>`;
  dashTab('new-d');
}
async function dashTab(t) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
  const btns = document.querySelectorAll('.tabs button');
  const body = document.getElementById('dashbody');
  if (t === 'new-d') {
    btns[0].classList.add('active');
    const c = countryOf(me.country_code);
    body.innerHTML = `<div class="form"><h2>برقية جديدة باسم ${c.flag} ${esc(c.name)}</h2><div id="msg"></div>
      <div class="field"><label>نص البرقية (500 حرف كحد أقصى)</label>
      <textarea id="dbody" maxlength="500" placeholder="مثال: تعلن ${esc(c.name)} عن تعبئة عامة على الحدود…"></textarea></div>
      <div class="field"><label>صورة مرفقة (اختياري)</label><input id="dimg" type="file" accept="image/*"></div>
      <button class="btn" onclick="sendDispatch()">نشر البرقية</button></div>`;
  } else if (t === 'new-a') {
    btns[1].classList.add('active');
    const cats = Object.entries(CATS).filter(([k]) => k !== 'official' || me.role === 'admin');
    body.innerHTML = `<div class="form"><h2>مقال جديد</h2><div id="msg"></div>
      <div class="field"><label>القسم</label><select id="acat">
        ${cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>العنوان</label><input id="atitle"></div>
      <div class="field"><label>نص المقال</label><textarea id="abody" style="min-height:220px" placeholder="اكتب سيناريو المعركة أو الحدث بالتفصيل…"></textarea></div>
      <div class="field"><label>صورة المقال (اختياري)</label><input id="aimg" type="file" accept="image/*"></div>
      <button class="btn" onclick="sendArticle()">نشر المقال</button></div>`;
  } else if (t === 'dossier') {
    btns[2].classList.add('active');
    body.innerHTML = '<p class="empty">جارٍ تحميل الملف…</p>';
    await vDashDossier(body);
  } else {
    btns[3].classList.add('active');
    body.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
    const [arts, disps] = await Promise.all([
      api('GET', '/articles?limit=100'), api('GET', '/dispatches?limit=100'),
    ]);
    const mine_a = arts.filter((a) => a.author.username === me.username);
    const mine_d = disps.filter((d) => d.author.username === me.username);
    body.innerHTML =
      `<h3>مقالاتي (${mine_a.length})</h3>` +
      (mine_a.map((a) => rowItem(`📰 ${esc(a.title)}`, `delArticle(${a.id})`)).join('') || '<p class="hint">لا توجد مقالات.</p>') +
      `<h3>برقياتي (${mine_d.length})</h3>` +
      (mine_d.map((d) => rowItem(`📜 ${esc(excerpt(d.body, 60))}`, `delDispatch(${d.id})`)).join('') || '<p class="hint">لا توجد برقيات.</p>');
  }
}
const rowItem = (t, fn) => `<div class="row-item"><span class="grow">${t}</span><button class="btn danger" style="padding:5px 14px" onclick="${fn}">حذف</button></div>`;
async function sendDispatch() {
  try {
    let image = null;
    const f = document.getElementById('dimg').files[0];
    if (f) { msg('جارٍ رفع الصورة…', true); image = await uploadImage(f); }
    await api('POST', '/dispatches', { body: val('dbody'), image });
    location.hash = '#/dispatches';
  } catch (e) { msg(e.message, false); }
}
async function sendArticle() {
  try {
    let image = null;
    const f = document.getElementById('aimg').files[0];
    if (f) { msg('جارٍ رفع الصورة…', true); image = await uploadImage(f); }
    const r = await api('POST', '/articles', { title: val('atitle'), body: val('abody'), category: val('acat'), image });
    location.hash = '#/article/' + r.id;
  } catch (e) { msg(e.message, false); }
}
async function delDispatch(id) {
  if (!confirm('حذف هذه البرقية؟')) return;
  await api('DELETE', `/dispatches/${id}`); dashTab('mine');
}

// ---------- التوجيه ----------
async function route() {
  const h = location.hash || '#/';
  renderTopActive(h);
  try {
    if (h === '#/' || h === '') await vHome();
    else if (h.startsWith('#/cat/')) await vCat(h.split('/')[2]);
    else if (h.startsWith('#/article/')) await vArticle(h.split('/')[2]);
    else if (h === '#/dispatches') await vDispatches();
    else if (h === '#/dossiers') await vDossiers();
    else if (h.startsWith('#/dossier/')) await vDossier(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/login') vLogin();
    else if (h === '#/register') await vRegister();
    else if (h === '#/dash') await vDash();
    else await vHome();
  } catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
  window.scrollTo(0, 0);
}
function renderTopActive(h) {
  document.querySelectorAll('.mainnav a').forEach((a) =>
    a.classList.toggle('active', a.getAttribute('href') === h.split('?')[0]));
}

// ---------- ملفات العملاء (الإنجازات) ----------
const dots = (n) => '●'.repeat(n) + `<span class="dots-off">${'●'.repeat(5 - n)}</span>`;
function dossierCardHTML(d) {
  const c = countryOf(d.country_code);
  return `<div class="card" onclick="location.hash='#/dossier/${esc(d.username)}'">
    <div class="dos-card-head">
      ${d.avatar ? `<img class="dos-card-av" src="${esc(d.avatar)}" alt="">` : `<div class="dos-card-flag">${c.flag}</div>`}
      <div class="grow">
        <div class="dos-card-name">${esc(d.username)}</div>
        <div class="hint">${d.alias ? `«${esc(d.alias)}» · ` : ''}${c.flag} ${esc(c.name)}</div>
      </div>
      <span class="status-badge ${esc(d.status)}">${STATUS_AR[d.status] || d.status}</span>
    </div>
    <div class="card-tx">
      <div class="hint">CLEARANCE: <b dir="ltr">${esc(d.clearance)}</b></div>
      <span class="more-link">فتح الملف الاستخباراتي ←</span>
    </div>
  </div>`;
}
async function vDossiers() {
  const list = await api('GET', '/dossiers');
  let h = `<div class="sec-head"><h2>ملفات العملاء</h2></div>
    <p class="hint" style="margin-top:-10px">سجلات استخباراتية مصنّفة للاعبي المحاكاة: العمليات، المناصب، الإنجازات، ومصفوفة المهارات.</p>`;
  h += list.length ? `<div class="grid">${list.map(dossierCardHTML).join('')}</div>`
    : '<p class="empty">لا توجد ملفات بعد — سيظهر ملف كل لاعب هنا فور تسجيله.</p>';
  app.innerHTML = h;
}
async function vDossier(username) {
  let r;
  try { r = await api('GET', '/dossier/' + encodeURIComponent(username)); }
  catch (e) { app.innerHTML = '<p class="empty">الملف غير موجود.</p>'; return; }
  const { user, dossier: d } = r;
  const c = countryOf(user.country_code);
  const isMine = me && me.username === user.username;
  const theaters = (d.theaters || []).map((t) => { const cc = countryOf(t); return `<div class="dos-row"><span class="dos-flag">${cc.flag}</span><span>${esc(cc.name)}</span></div>`; }).join('');
  const roles = (d.roles || []).map((x) => `<div class="dos-row"><span class="dos-bullet">▸</span><span>${esc(x)}</span></div>`).join('');
  const ach = (d.achievements || []).map((x) => `<div class="dos-row ach-row"><span class="dos-star">★</span><span>${esc(x)}</span></div>`).join('');
  const skills = Object.entries(SKILLS).map(([k, label]) => {
    const v = Number(d.skills[k]) || 0;
    return `<div class="dos-skill"><span>${label}</span><span class="dos-dots" dir="ltr">${dots(v)}</span></div>`;
  }).join('');
  app.innerHTML = `
  <div class="dossier">
    <div class="dos-top"><span>ARGOS // STRATEGIC DOSSIER</span><span class="dos-class">CLASSIFIED // EYES ONLY</span></div>
    <div class="dos-file" dir="ltr">FILE: ${esc(user.username.toUpperCase())}.CV</div>
    <div class="dos-id">
      <div class="dos-photo">
        ${d.avatar ? `<img src="${esc(d.avatar)}" alt="">` : `<div class="dos-photo-flag">${c.flag}</div>`}
        <i class="cnr tl"></i><i class="cnr tr"></i><i class="cnr bl"></i><i class="cnr br"></i>
      </div>
      <div class="dos-idinfo">
        <div class="dos-line"><span class="k" dir="ltr">OPERATIVE:</span> <b>${esc(user.username)}</b></div>
        ${d.alias ? `<div class="dos-line"><span class="k" dir="ltr">ALIAS:</span> ${esc(d.alias)}</div>` : ''}
        <div class="dos-line"><span class="k" dir="ltr">STATUS:</span> <span class="status-badge ${esc(d.status)}">${STATUS_AR[d.status] || d.status}</span></div>
        <div class="dos-line"><span class="k" dir="ltr">CLEARANCE:</span> <b dir="ltr">${esc(d.clearance)}</b> <span class="hint">(${CLEARANCE_DESC[d.clearance] || ''})</span></div>
        <div class="dos-line"><span class="k" dir="ltr">NATION:</span> ${c.flag} ${esc(c.name)}</div>
        <div class="ribbon">OPERATIVE PROFILE</div>
        <p class="dos-profile">${d.profile ? esc(d.profile) : '<span class="hint">لا يوجد ملف تعريفي بعد.</span>'}</p>
        ${isMine ? `<button class="btn ghost" style="margin-top:8px" onclick="location.hash='#/dash'">تعديل ملفي ←</button>` : ''}
      </div>
    </div>
    <div class="dos-cols">
      <div>
        <div class="ribbon">THEATERS OF OPERATIONS</div>
        ${theaters || '<p class="hint">لم تُسجَّل مسارح عمليات بعد.</p>'}
        <div class="ribbon gold-r">ACHIEVEMENTS · الإنجازات</div>
        ${ach || '<p class="hint">لا توجد إنجازات مسجلة بعد.</p>'}
      </div>
      <div>
        <div class="ribbon">ROLES &amp; SERVICES</div>
        ${roles || '<p class="hint">لم تُسجَّل مناصب بعد.</p>'}
        <div class="ribbon">SKILL MATRIX</div>
        <div class="dos-skills">${skills}</div>
      </div>
    </div>
    <div class="dos-foot">
      <span class="hint">ARGOS HEADQUARTERS — INTELLIGENCE DIVISION</span>
      <span class="stamp">APPROVED</span>
    </div>
  </div>`;
}
async function vDashDossier(body) {
  let r;
  try { r = await api('GET', '/dossier/' + encodeURIComponent(me.username)); }
  catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const d = r.dossier;
  const th = new Set(d.theaters || []);
  body.innerHTML = `<div class="form" style="max-width:760px"><h2>ملفي الاستخباراتي</h2><div id="msg"></div>
    <div class="field"><label>الصورة الشخصية للملف</label>
      <div style="display:flex;gap:12px;align-items:center">
        <img id="favatarprev" src="${esc(d.avatar || '')}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;${d.avatar ? '' : 'display:none'}">
        <input id="favatar" type="file" accept="image/*">
      </div><input id="favatarurl" type="hidden" value="${esc(d.avatar || '')}"></div>
    <div class="field"><label>الاسم المستعار (Alias)</label><input id="falias" value="${esc(d.alias)}" placeholder="مثال: الثعلب" dir="ltr"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="field"><label>الحالة (Status)</label><select id="fstatus">
        ${Object.entries(STATUS_AR).map(([k, v]) => `<option value="${k}"${d.status === k ? ' selected' : ''}>${v} (${k})</option>`).join('')}</select></div>
      <div class="field"><label>مستوى التصريح (Clearance)</label><select id="fclearance">
        ${Object.keys(CLEARANCE_DESC).map((k) => `<option${d.clearance === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>الملف التعريفي (Operative Profile)</label>
      <textarea id="fprofile" placeholder="نبذة عن العميل: خبراته، أسلوبه، تخصصاته…">${esc(d.profile)}</textarea></div>
    <div class="field"><label>مسارح العمليات (Theaters)</label>
      <div class="check-grid">${COUNTRIES.map((x) => `<label><input type="checkbox" class="fth" value="${x.code}"${th.has(x.code) ? ' checked' : ''}> ${x.flag} ${esc(x.name)}</label>`).join('')}</div></div>
    <div class="field"><label>المناصب والخدمات (سطر لكل منصب)</label>
      <textarea id="froles" placeholder="مثال: رئيس وزراء بريطانيا&#10;عميل في جهاز الأمن الفيدرالي">${esc((d.roles || []).join('\n'))}</textarea></div>
    <div class="field"><label>🏆 الإنجازات (سطر لكل إنجاز)</label>
      <textarea id="fach" placeholder="مثال: قاد حملة البلقان بنجاح سنة 1901&#10;أبرم تحالفًا مع ثلاث دول">${esc((d.achievements || []).join('\n'))}</textarea></div>
    <div class="field"><label>مصفوفة المهارات (Skill Matrix)</label>
      <div class="dos-skills-edit">${Object.entries(SKILLS).map(([k, label]) => `
        <div class="dos-skill"><span>${label}</span>
          <select id="fsk_${k}" dir="ltr">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${Number(d.skills[k]) === n ? ' selected' : ''}>${'●'.repeat(n) || '○'}</option>`).join('')}</select>
        </div>`).join('')}</div></div>
    <button class="btn" onclick="saveDossier()">حفظ الملف</button>
    <button class="btn ghost" onclick="location.hash='#/dossier/${esc(me.username)}'" style="margin-inline-start:8px">معاينة الملف</button>
  </div>`;
  document.getElementById('favatar').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { msg('جارٍ رفع الصورة…', true); const url = await uploadImage(f);
      document.getElementById('favatarurl').value = url;
      const p = document.getElementById('favatarprev'); p.src = url; p.style.display = '';
      msg('تم رفع الصورة ✓', true);
    } catch (err) { msg(err.message, false); }
  };
}
async function saveDossier() {
  try {
    const skills = {};
    for (const k of Object.keys(SKILLS)) skills[k] = Number(document.getElementById('fsk_' + k).value);
    await api('POST', '/dossier', {
      alias: val('falias'), status: val('fstatus'), clearance: val('fclearance'),
      profile: val('fprofile'), avatar: document.getElementById('favatarurl').value,
      theaters: [...document.querySelectorAll('.fth:checked')].map((x) => x.value),
      roles: val('froles').split('\n'), achievements: val('fach').split('\n'), skills,
    });
    msg('تم حفظ ملفك الاستخباراتي ✓', true);
  } catch (e) { msg(e.message, false); }
}

// ---------- بدء ----------
(async function boot() {
  COUNTRIES = await api('GET', '/countries');
  CMAP = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
  me = (await api('GET', '/me')).user;
  renderTop();
  window.addEventListener('hashchange', route);
  await route();
})();
