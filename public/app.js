// جريدة أرجوس — واجهة التطبيق
const CATS = { official: 'بيانات رسمية', war: 'سيناريوهات الحروب', events: 'أحداث اللعبة' };
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
    ['#/cat/events', 'أحداث اللعبة'], ['#/dispatches', 'برقيات الدول'],
    ...(me ? [['#/dash', 'لوحة التحكم']] : []),
  ];
  nav.innerHTML = links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
}

// ---------- الصفحة الرئيسية ----------
async function vHome() {
  app.innerHTML = '<p class="empty">جارٍ تحميل العدد…</p>';
  const [official, war, events, dispatches] = await Promise.all([
    api('GET', '/articles?category=official&limit=1'),
    api('GET', '/articles?category=war&limit=3'),
    api('GET', '/articles?category=events&limit=3'),
    api('GET', '/dispatches?limit=4'),
  ]);
  let h = '';
  if (official[0]) {
    const a = official[0], c = countryOf(a.author.country_code);
    h += `<div class="hero" onclick="location.hash='#/article/${a.id}'">
      ${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}
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
function vRegister() {
  app.innerHTML = `<div class="form"><h2>إنشاء حساب لاعب</h2><div id="msg"></div>
    <div class="field"><label>اسم المستخدم</label><input id="username" dir="ltr" placeholder="مثال: napoleon_1900">
      <div class="hint">أحرف إنجليزية وأرقام و _ فقط (3-20)</div></div>
    <div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" dir="ltr"></div>
    <div class="field"><label>كلمة المرور</label><input id="password" type="password"><div class="hint">6 أحرف على الأقل</div></div>
    <div class="field"><label>الدولة التي ستلعب بها</label><select id="country">
      ${COUNTRIES.map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select>
      <div class="hint">ستظهر كل منشوراتك وبرقياتك باسم هذه الدولة</div></div>
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
  } else {
    btns[2].classList.add('active');
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
    else if (h === '#/login') vLogin();
    else if (h === '#/register') vRegister();
    else if (h === '#/dash') await vDash();
    else await vHome();
  } catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
  window.scrollTo(0, 0);
}
function renderTopActive(h) {
  document.querySelectorAll('.mainnav a').forEach((a) =>
    a.classList.toggle('active', a.getAttribute('href') === h.split('?')[0]));
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
