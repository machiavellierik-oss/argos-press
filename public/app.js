// أرجوس — واجهة بأسلوب X
const CATS = { official: 'بيانات رسمية', war: 'سيناريوهات الحروب', events: 'أحداث اللعبة' };
const SKILLS = {
  intel: 'الاستخبارات والتجسس', diplomacy: 'التفاوض والتحالفات',
  econwar: 'الحرب الاقتصادية والدبلوماسية', analysis: 'التحليل الجيوسياسي',
  planning: 'التخطيط طويل المدى وإدارة الأزمات', resources: 'إدارة الموارد وتحليل البيانات',
};
const CLEARANCE_DESC = {
  'LEVEL 1': 'FIELD OPERATIVE', 'LEVEL 2': 'TACTICAL CLEARANCE', 'LEVEL 3': 'OPERATIONAL COMMAND',
  'LEVEL 4': 'STRATEGIC CLEARANCE', 'LEVEL 5': 'STRATEGIC COMMAND',
};
const STATUS_AR = { ACTIVE: 'نشط', INACTIVE: 'غير نشط', MIA: 'مفقود', KIA: 'قتيل' };
let COUNTRIES = [], CMAP = {}, me = null;
const app = document.getElementById('app');

// ---------- أيقونات SVG ----------
const I = (p, fill) => `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  home: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>'),
  chat: I('<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>'),
  mega: I('<path d="M3 11v3l4 .5V10.5L3 11z"/><path d="M7 10.5 18 5v13l-11-3.5"/><path d="M18 8.5a3 3 0 0 1 0 6"/>'),
  zap: I('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'),
  feather: I('<path d="M20 4c-6 0-12 4-14 12l-2 4 4-2c8-2 12-8 12-14z"/><path d="M6 18 16 8"/>'),
  heart: (f) => `<svg viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C7 16.5 3 13 3 8.8 3 6 5.2 4 7.8 4c1.7 0 3.2.9 4.2 2.3C13 5 14.5 4 16.2 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 12.2z"/></svg>`,
  repost: I('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  reply: I('<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>'),
  share: I('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/>'),
  views: I('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  trash: I('<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>'),
  img: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 3 3 4-4 4 4"/>'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  dots: I('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  check: `<svg class="vbadge" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.4-.5.9 3.3 3 1.7-1.4 3.1 1.4 3.1-3 1.7-.9 3.3-3.4-.5L12 22l-2.4-2.4-3.4.5-.9-3.3-3-1.7L3.7 12 2.3 8.9l3-1.7.9-3.3 3.4.5L12 2z"/><path d="M10.6 14.6l-2.1-2.1-1.4 1.4 3.5 3.5 7-7-1.4-1.4z" fill="#000"/></svg>`,
  checkGold: `<svg class="vbadge gold" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.4-.5.9 3.3 3 1.7-1.4 3.1 1.4 3.1-3 1.7-.9 3.3-3.4-.5L12 22l-2.4-2.4-3.4.5-.9-3.3-3-1.7L3.7 12 2.3 8.9l3-1.7.9-3.3 3.4.5L12 2z"/><path d="M10.6 14.6l-2.1-2.1-1.4 1.4 3.5 3.5 7-7-1.4-1.4z" fill="#000"/></svg>`,
};

// ---------- أدوات ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60); if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60); if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24); if (d < 30) return `منذ ${d} يوم`;
  return new Date(ts).toLocaleDateString('ar');
}
function countryOf(code) {
  if (code === 'HQ') return { flag: '🏛️', name: 'مقر أرجوس' };
  return CMAP[code] || { flag: '🏳️', name: code };
}
async function api(method, url, body) {
  const r = await fetch('/api' + url, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {},
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
const val = (id) => document.getElementById(id).value.trim();
function msg(t, ok) {
  const el = document.getElementById('msg');
  if (el) el.innerHTML = `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>`;
}
// عدّاد المشاهدات التقريبي (تجميلي فقط)
const baseCount = (id, salt) => { let x = (id * 2654435761 + salt * 40503) % 997; return x < 0 ? -x : x; };
const fmtN = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n);

// جلب عدّادات الإعجابات/التعليقات الحقيقية دفعة واحدة وتحديث الواجهة
async function hydrateEngagement(type) {
  const kind = type === 'dispatch' ? 'd' : 'a';
  const els = [...app.querySelectorAll(`[data-kind="${kind}"]`)];
  const ids = els.map((el) => Number(el.dataset.id)).filter(Boolean);
  if (!ids.length) return;
  try {
    const { counts, liked } = await api('GET', `/engagement?type=${type}&ids=${ids.join(',')}`);
    const likedSet = new Set(liked || []);
    for (const el of els) {
      const id = Number(el.dataset.id);
      const c = (counts && counts[id]) || { likes: 0, comments: 0 };
      const lb = el.querySelector('[data-like]');
      if (lb) {
        lb.querySelector('[data-n]').textContent = fmtN(c.likes);
        const on = likedSet.has(id);
        lb.classList.toggle('on', on);
        lb.querySelector('.a-ic').innerHTML = ICONS.heart(on);
      }
      const cc = el.querySelector('[data-ccount]');
      if (cc) cc.textContent = fmtN(c.comments);
    }
  } catch (e) { /* تجاهل */ }
}

// ---------- القائمة الجانبية والودجت ----------
const NAV = [
  ['#/', 'الرئيسية', 'home'],
  ['#/dispatches', 'البرقيات', 'chat'],
  ['#/cat/official', 'بيانات رسمية', 'mega'],
  ['#/cat/war', 'سيناريوهات الحروب', 'zap'],
  ['#/cat/events', 'أحداث اللعبة', 'cal'],
  ['#/dossiers', 'ملفات العملاء', 'folder'],
];
function renderNav(active) {
  const nav = document.getElementById('mainnav');
  const dashLink = me ? ['#/dash', 'حسابي', 'user'] : ['#/login', 'دخول', 'user'];
  nav.innerHTML = [...NAV, dashLink].map(([h, t, ic]) =>
    `<a class="nav-link${h === active ? ' active' : ''}" href="${h}">${ICONS[ic]}<span>${t}</span></a>`).join('');
  const bn = document.getElementById('bottomnav');
  bn.innerHTML = [...NAV.slice(0, 2), ['#/dossiers', '', 'folder'], dashLink].map(([h, , ic]) =>
    `<a class="${h === active ? 'active' : ''}" href="${h}">${ICONS[ic]}</a>`).join('');
  document.querySelector('.cb-ic').innerHTML = ICONS.feather;
  document.getElementById('composeBtn').onclick = () => {
    location.hash = me ? '#/dash' : '#/login';
    if (me) setTimeout(() => dashTab('new-d'), 350);
  };
  const nu = document.getElementById('navuser');
  if (me) {
    const c = countryOf(me.country_code);
    nu.innerHTML = `<button class="nav-user" id="nuBtn">
      <span class="av">${c.flag}</span>
      <span class="nu-tx"><span class="nu-name">${esc(me.username)}</span><br><span class="nu-handle">@${esc(me.username)}</span></span>
      <span class="nu-go">···</span></button>`;
    document.getElementById('nuBtn').onclick = () => { location.hash = '#/u/' + encodeURIComponent(me.username); };
  } else {
    nu.innerHTML = '';
  }
}
function renderWidgets() {
  document.getElementById('wsearch').innerHTML = `<div class="s-box">${ICONS.search}
    <input id="winput" placeholder="بحث في أرجوس"></div>`;
  document.getElementById('winput').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    document.querySelectorAll('.tweet .tw-body, .acard h3, .acard p').forEach(() => {});
    document.querySelectorAll('.tweet, .acard').forEach((el) => {
      el.style.display = !q || el.textContent.includes(q) ? '' : 'none';
    });
  });
  document.getElementById('wtrends').innerHTML = `<h3>الأكثر تداولًا في أرجوس</h3>` +
    Object.entries(CATS).map(([k, v]) => `<a class="w-trend" href="#/cat/${k}">
      <div class="t-cat">قسم المحاكاة</div><div class="t-name">${v}</div>
      <div class="t-n">آخر التطورات لحظة بلحظة</div></a>`).join('') +
    `<a class="w-more" href="#/dispatches">عرض برقيات الدول</a>`;
  api('GET', '/dossiers').then((list) => {
    const el = document.getElementById('wusers');
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<h3>ملفات مقترحة</h3>` + list.slice(0, 3).map((d) => {
      const c = countryOf(d.country_code);
      return `<div class="w-user" onclick="location.hash='#/dossier/${esc(d.username)}'">
        <span class="av">${d.avatar ? `<img src="${esc(d.avatar)}">` : c.flag}</span>
        <span class="wu-tx"><span class="wu-n">${esc(d.username)}</span><br><span class="wu-h">@${esc(d.username)}</span></span>
      </div>`;
    }).join('') + `<a class="w-more" href="#/dossiers">عرض الكل</a>`;
  }).catch(() => {});
}

// ---------- مكوّن التغريدة ----------
function tweetHTML(d) {
  const c = countryOf(d.author.country_code);
  const canDel = me && (me.id === d.author.id || me.role === 'admin');
  const views = fmtN(baseCount(d.id, 13) + 40);
  const isHQ = d.author.country_code === 'HQ';
  return `<article class="tweet" data-kind="d" data-id="${d.id}">
    <span class="av" data-user="${esc(d.author.username)}" style="cursor:pointer">${c.flag}</span>
    <div class="tw-main">
      <div class="tw-head">
        <span class="tw-name" data-user="${esc(d.author.username)}" style="cursor:pointer">${esc(c.name)}</span>${isHQ ? ICONS.checkGold : ICONS.check}
        <span class="tw-handle">@${esc(d.author.username)} · ${timeAgo(d.created_at)}</span>
        ${canDel ? `<button class="tw-del" data-del-d="${d.id}" title="حذف">${ICONS.trash}</button>` : ''}
      </div>
      <div class="tw-body">${esc(d.body)}</div>
      ${d.image ? `<img class="tw-img" src="${esc(d.image)}" loading="lazy" alt="">` : ''}
      <div class="tw-actions">
        <button class="tw-act reply" data-go="#/d/${d.id}">${'<span class="a-ic">' + ICONS.reply + '</span>'}<span data-ccount>0</span></button>
        <button class="tw-act repost" data-repost="${d.id}">${'<span class="a-ic">' + ICONS.repost + '</span>'}<span>${fmtN(baseCount(d.id, 5))}</span></button>
        <button class="tw-act like" data-like="dispatch:${d.id}">${'<span class="a-ic">' + ICONS.heart(false) + '</span>'}<span data-n>0</span></button>
        <button class="tw-act views">${'<span class="a-ic">' + ICONS.views + '</span>'}<span>${views}</span></button>
        <button class="tw-act share" data-share-d="${d.id}">${'<span class="a-ic">' + ICONS.share + '</span>'}</button>
      </div>
    </div>
  </article>`;
}
function articleCardHTML(a) {
  const c = countryOf(a.author.country_code);
  const gold = a.category === 'official';
  return `<article class="acard" data-kind="a" data-id="${a.id}">
    <span class="tw-cat${gold ? ' gold' : ''}">${gold ? '📜 ' : ''}${esc(a.category_label)}</span>
    ${a.image ? `<img class="ac-img" src="${esc(a.image)}" loading="lazy" alt="">` : ''}
    <h3>${esc(a.title)}</h3>
    <p>${esc(excerpt(a.body, 160))}</p>
    <div class="tw-head"><span class="av" style="width:30px;height:30px;font-size:1rem" data-user="${esc(a.author.username)}">${c.flag}</span>
      <span class="tw-name" style="font-size:.85rem" data-user="${esc(a.author.username)}">${esc(c.name)}</span>
      <span class="tw-handle">@${esc(a.author.username)} · ${timeAgo(a.created_at)}</span></div>
    <div class="tw-actions">
      <button class="tw-act like" data-like="article:${a.id}">${'<span class="a-ic">' + ICONS.heart(false) + '</span>'}<span data-n>0</span></button>
      <button class="tw-act reply" data-go="#/article/${a.id}">${'<span class="a-ic">' + ICONS.reply + '</span>'}<span data-ccount>0</span></button>
    </div>
  </article>`;
}
// تفويض النقرات داخل التايم لاين
function bindFeed() {
  app.querySelectorAll('[data-like]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (!me) { location.hash = '#/login'; return; }
    const [type, id] = b.dataset.like.split(':');
    try {
      const r = await api('POST', '/likes', { type, id: Number(id) });
      b.classList.toggle('on', r.liked);
      b.querySelector('.a-ic').innerHTML = ICONS.heart(r.liked);
      b.querySelector('[data-n]').textContent = fmtN(r.likes);
    } catch (err) { alert(err.message); }
  });
  app.querySelectorAll('[data-del-d]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm('حذف هذه البرقية؟')) return;
    await api('DELETE', '/dispatches/' + b.dataset.delD); route();
  });
  app.querySelectorAll('[data-share-d]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const t = b.closest('.tweet');
    const url = location.origin + location.pathname + '#/d/' + (t ? t.dataset.id : '0');
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => alert('تم نسخ رابط البرقية ✓'), () => prompt('انسخ الرابط:', url));
  });
  app.querySelectorAll('[data-repost]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    if (!me) { location.hash = '#/login'; return; }
    location.hash = '#/dash'; setTimeout(() => dashTab('new-d'), 350);
  });
  app.querySelectorAll('[data-go]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); location.hash = b.dataset.go; });
  app.querySelectorAll('[data-user]').forEach((el) => el.onclick = (e) => {
    e.stopPropagation(); location.hash = '#/u/' + encodeURIComponent(el.dataset.user);
  });
  app.querySelectorAll('.tweet').forEach((t) => t.onclick = (e) => {
    if (e.target.closest('button') || e.target.closest('img') || e.target.closest('[data-user]')) return;
    location.hash = '#/d/' + t.dataset.id;
  });
  app.querySelectorAll('.tweet .tw-img').forEach((img) => img.onclick = (e) => {
    e.stopPropagation(); window.open(img.src, '_blank');
  });
  app.querySelectorAll('.acard').forEach((c) => c.onclick = (e) => {
    if (e.target.closest('button') || e.target.closest('[data-user]')) return;
    location.hash = '#/article/' + c.dataset.id;
  });
}
const thead = (title, tabs) => `<div class="thead"><div class="thead-title">${title}</div>
  ${tabs ? `<div class="ttabs">${tabs}</div>` : ''}</div>`;

// ---------- المؤلف ----------
function composerHTML() {
  if (!me) return '';
  const c = countryOf(me.country_code);
  return `<div class="composer">
    <span class="av">${c.flag}</span>
    <div class="c-main">
      <div id="msg"></div>
      <textarea id="cbody" maxlength="500" placeholder="بماذا تودّ أن تُصرّح يا ${esc(c.name)}؟"></textarea>
      <div class="c-prev" id="cprev" style="display:none"><img id="cprevimg"><button id="cpremx">✕</button></div>
      <div class="c-tools">
        <button class="c-ic" id="cimgbtn" title="إرفاق صورة">${ICONS.img}</button>
        <input type="file" id="cimg" accept="image/*" style="display:none">
        <span class="c-count" id="ccount">0 / 500</span>
        <button class="c-post" id="cpost">نشر</button>
      </div>
    </div>
  </div>`;
}
function bindComposer(after) {
  if (!me) return;
  const ta = document.getElementById('cbody'), cnt = document.getElementById('ccount');
  const fi = document.getElementById('cimg'), prev = document.getElementById('cprev'), pimg = document.getElementById('cprevimg');
  let imgUrl = null;
  ta.addEventListener('input', () => { cnt.textContent = `${ta.value.length} / 500`; });
  document.getElementById('cimgbtn').onclick = () => fi.click();
  fi.onchange = async () => {
    const f = fi.files[0]; if (!f) return;
    try { msg('جارٍ رفع الصورة…', true); imgUrl = await uploadImage(f);
      pimg.src = imgUrl; prev.style.display = ''; msg('');
    } catch (e) { msg(e.message, false); }
  };
  document.getElementById('cpremx').onclick = () => { prev.style.display = 'none'; imgUrl = null; fi.value = ''; };
  document.getElementById('cpost').onclick = async () => {
    const body = ta.value.trim();
    if (!body) { msg('اكتب نص البرقية أولًا', false); return; }
    try { await api('POST', '/dispatches', { body, image: imgUrl }); after && after(); }
    catch (e) { msg(e.message, false); }
  };
}

// ---------- الرئيسية ----------
async function vHome() {
  app.innerHTML = thead('الرئيسية',
    `<button class="ttab active" data-ht="d">البرقيات</button><button class="ttab" data-ht="a">المقالات</button>`) +
    `<div id="sbar"></div>` + composerHTML() + `<div id="feed"><div class="spin"></div></div>`;
  bindComposer(() => route());
  document.getElementById('sbar').innerHTML = await storyBarHTML();
  bindStories();
  const tabs = app.querySelectorAll('[data-ht]');
  const load = async (kind) => {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.ht === kind));
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div class="spin"></div>';
    try {
      if (kind === 'd') {
        const items = await api('GET', '/dispatches?limit=30');
        feed.innerHTML = items.length ? items.map(tweetHTML).join('')
          : `<div class="empty"><span class="e-ic">📜</span>لا توجد برقيات بعد — كن أول من يصرّح باسم دولته.</div>`;
      } else {
        const items = await api('GET', '/articles?limit=20');
        feed.innerHTML = items.length ? items.map(articleCardHTML).join('')
          : '<div class="empty"><span class="e-ic">📰</span>لا توجد مقالات بعد.</div>';
      }
      bindFeed(); hydrateEngagement(kind === 'd' ? 'dispatch' : 'article');
    } catch (e) { feed.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  tabs.forEach((t) => t.onclick = () => load(t.dataset.ht));
  await load('d');
}

// ---------- البرقيات ----------
async function vDispatches() {
  app.innerHTML = thead('برقيات الدول') + composerHTML() + `<div id="feed"><div class="spin"></div></div>`;
  bindComposer(() => route());
  try {
    const items = await api('GET', '/dispatches?limit=40');
    document.getElementById('feed').innerHTML = items.length ? items.map(tweetHTML).join('')
      : '<div class="empty"><span class="e-ic">📜</span>لا توجد برقيات بعد.</div>';
    bindFeed(); hydrateEngagement('dispatch');
  } catch (e) { document.getElementById('feed').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- تصنيف ----------
async function vCat(cat) {
  app.innerHTML = thead(CATS[cat] || '') + `<div id="feed"><div class="spin"></div></div>`;
  try {
    const items = await api('GET', `/articles?category=${cat}&limit=30`);
    document.getElementById('feed').innerHTML = items.length ? items.map(articleCardHTML).join('')
      : '<div class="empty"><span class="e-ic">📰</span>لا توجد مواد في هذا القسم بعد.</div>';
    bindFeed(); hydrateEngagement('article');
  } catch (e) { document.getElementById('feed').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- مقال ----------
async function vArticle(id) {
  app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">مقال</div></div><div class="spin"></div>`;
  try {
    const a = await api('GET', `/articles/${id}`);
    const c = countryOf(a.author.country_code);
    const canDel = me && (me.id === a.author.id || me.role === 'admin');
    const gold = a.category === 'official';
    app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
      <div class="thead-title" style="padding:0">مقال</div></div>
      <div class="detail" data-kind="a" data-id="${a.id}"><div class="d-pad">
        <span class="tw-cat${gold ? ' gold' : ''}">${esc(a.category_label)}</span>
        <h1>${esc(a.title)}</h1>
        <div class="tw-head"><span class="av" style="width:38px;height:38px;font-size:1.3rem" data-user="${esc(a.author.username)}">${c.flag}</span>
          <span class="tw-name" data-user="${esc(a.author.username)}" style="cursor:pointer">${esc(c.name)}</span>${a.author.country_code === 'HQ' ? ICONS.checkGold : ICONS.check}
          <span class="tw-handle">@${esc(a.author.username)} · ${timeAgo(a.created_at)}</span>
          ${canDel ? `<button class="btn danger" style="margin-inline-start:auto" onclick="delArticle(${a.id})">حذف المقال</button>` : ''}
        </div>
        <div class="tw-actions" style="border:none;padding:8px 0 0">
          <button class="tw-act like" data-like="article:${a.id}">${'<span class="a-ic">' + ICONS.heart(false) + '</span>'}<span data-n>0</span></button>
          <button class="tw-act reply">${'<span class="a-ic">' + ICONS.reply + '</span>'}<span data-ccount>0</span></button>
        </div></div>
        ${a.image ? `<div class="d-pad"><img class="lead-img" src="${esc(a.image)}" alt=""></div>` : ''}
        <div class="body">${esc(a.body)}</div>
        ${commentsHTML()}
      </div>`;
    bindFeed(); hydrateEngagement('article'); loadComments('article', a.id);
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function delArticle(id) {
  if (!confirm('حذف هذا المقال؟')) return;
  await api('DELETE', `/articles/${id}`); location.hash = '#/';
}

// ---------- ملفات العملاء ----------
const dots = (n) => '●'.repeat(n) + `<span class="dots-off">${'●'.repeat(5 - n)}</span>`;
async function vDossiers() {
  app.innerHTML = thead('ملفات العملاء') + `<div class="dos-list"><div class="spin"></div></div>`;
  try {
    const list = await api('GET', '/dossiers');
    document.querySelector('.dos-list').innerHTML = list.length ? list.map((d) => {
      const c = countryOf(d.country_code);
      return `<div class="dos-card" onclick="location.hash='#/dossier/${esc(d.username)}'">
        <span class="av">${d.avatar ? `<img src="${esc(d.avatar)}">` : c.flag}</span>
        <span class="dc-tx"><span class="dc-n">${esc(d.username)}</span>
          <span class="status-badge ${esc(d.status)}" style="margin-inline-start:8px">${STATUS_AR[d.status] || d.status}</span><br>
          <span class="dc-s">${d.alias ? `«${esc(d.alias)}» · ` : ''}${c.flag} ${esc(c.name)} · <span dir="ltr">${esc(d.clearance)}</span></span></span>
        <span class="hint">←</span></div>`;
    }).join('') : '<div class="empty"><span class="e-ic">🗂️</span>لا توجد ملفات بعد — سيظهر ملف كل لاعب هنا فور تسجيله.</div>';
  } catch (e) { document.querySelector('.dos-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function vDossier(username) {
  app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">الملف الاستخباراتي</div></div><div class="spin"></div>`;
  let r;
  try { r = await api('GET', '/dossier/' + encodeURIComponent(username)); }
  catch (e) { app.innerHTML = '<div class="empty">الملف غير موجود.</div>'; return; }
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
  <div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">الملف الاستخباراتي</div></div>
  <div class="dossier">
    <div class="dos-top"><span>ARGOS // STRATEGIC DOSSIER</span><span>CLASSIFIED // EYES ONLY</span></div>
    <div class="dos-file" dir="ltr">FILE: ${esc(user.username.toUpperCase())}.CV</div>
    <div class="dos-id">
      <div class="dos-photo">
        ${d.avatar ? `<img src="${esc(d.avatar)}">` : `<div class="dos-photo-flag">${c.flag}</div>`}
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

// ---------- الدخول / التسجيل ----------
function vLogin() {
  app.innerHTML = `<div class="auth">
    <div class="a-logo"><img src="/logo.jpg" alt="أرجوس"></div>
    <h2>تسجيل الدخول إلى أرجوس</h2><p class="a-sub">تابع برقيات الدول لحظة بلحظة</p><div id="msg"></div>
    <div class="field"><input id="email" type="email" dir="ltr" placeholder="البريد الإلكتروني"></div>
    <div class="field"><input id="password" type="password" placeholder="كلمة المرور"></div>
    <button class="btn" onclick="doLogin()">دخول</button>
    <p class="swap">ليس لديك حساب؟ <a href="#/register">أنشئ حسابًا واختر دولتك</a></p></div>`;
}
async function doLogin() {
  try {
    await api('POST', '/login', { email: val('email'), password: val('password') });
    me = (await api('GET', '/me')).user; boot(false); location.hash = '#/';
  } catch (e) { msg(e.message, false); }
}
async function vRegister() {
  let taken = [];
  try { taken = await api('GET', '/taken-countries'); } catch (e) {}
  app.innerHTML = `<div class="auth">
    <div class="a-logo"><img src="/logo.jpg" alt="أرجوس"></div>
    <h2>انضم إلى أرجوس</h2><p class="a-sub">أنشئ حساب لاعب واحجز دولتك — كل دولة للاعب واحد فقط</p><div id="msg"></div>
    <div class="field"><input id="username" dir="ltr" placeholder="اسم المستخدم (إنجليزي، 3-20)"></div>
    <div class="field"><input id="email" type="email" dir="ltr" placeholder="البريد الإلكتروني"></div>
    <div class="field"><input id="password" type="password" placeholder="كلمة المرور (6 أحرف على الأقل)"></div>
    <div class="field"><label>الدولة التي ستلعب بها</label><select id="country">
      ${COUNTRIES.map((c) => `<option value="${c.code}"${taken.includes(c.code) ? ' disabled' : ''}>${c.flag} ${c.name}${taken.includes(c.code) ? ' — محجوزة' : ''}</option>`).join('')}</select></div>
    <button class="btn" onclick="doRegister()">إنشاء الحساب</button>
    <p class="swap">لديك حساب؟ <a href="#/login">سجّل الدخول</a></p></div>`;
}
async function doRegister() {
  try {
    const r = await api('POST', '/register', {
      username: val('username'), email: val('email'), password: val('password'), country_code: val('country'),
    });
    me = (await api('GET', '/me')).user; boot(false); location.hash = '#/dash';
    if (r.role === 'admin') setTimeout(() => alert('أنت أول المسجّلين — مُنحت صلاحيات إدارة المقر (البيانات الرسمية).'), 400);
  } catch (e) { msg(e.message, false); }
}

// ---------- لوحة التحكم (بروفايل) ----------
async function vDash() {
  if (!me) { location.hash = '#/login'; return; }
  const c = countryOf(me.country_code);
  const [arts, disps] = await Promise.all([
    api('GET', '/articles?limit=100').catch(() => []), api('GET', '/dispatches?limit=100').catch(() => []),
  ]);
  const mine_a = arts.filter((a) => a.author.username === me.username).length;
  const mine_d = disps.filter((d) => d.author.username === me.username).length;
  app.innerHTML = `
    <div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
      <div><div class="thead-title" style="padding:0">${esc(me.username)}</div>
      <div class="hint">${mine_d} برقية · ${mine_a} مقال</div></div></div>
    <div class="cover"></div>
    <div class="prow">
      <div class="p-av">${c.flag}</div>
      <div class="p-head"><div class="p-id">
        <div class="p-name">${esc(c.name)} ${me.role === 'admin' ? ICONS.checkGold : ICONS.check}</div>
        <div class="p-handle">@${esc(me.username)}</div></div>
        <span style="display:flex;gap:8px">
          <a class="btn ghost" href="#/u/${esc(me.username)}" style="width:auto;padding:8px 16px">بروفايلي</a>
          <button class="btn ghost" id="logoutBtn" style="width:auto;padding:8px 16px">خروج</button>
        </span>
      </div>
      <p class="p-bio">${me.bio ? esc(me.bio) : `${c.flag} الحساب الرسمي لدولة ${esc(c.name)} في محاكاة أرجوس للتاريخ — 1900.`}</p>
      <div class="p-meta"><span>📍 ${esc(c.name)}</span><span>🗓️ انضم ${timeAgo(me.created_at || Date.now())}</span>
        ${me.role === 'admin' ? '<span>⭐ إدارة المقر</span>' : ''}</div>
      <div class="p-meta"><span><b>${mine_d}</b> برقية</span><span><b>${mine_a}</b> مقال</span></div>
    </div>
    <div class="ptabs">
      <button class="ptab active" data-pt="feed">منشوراتي</button>
      <button class="ptab" data-pt="new-d">برقية جديدة</button>
      <button class="ptab" data-pt="new-a">مقال جديد</button>
      <button class="ptab" data-pt="edit">تعديل البروفايل</button>
      <button class="ptab" data-pt="dossier">ملفي الاستخباراتي</button>
    </div>
    <div id="pbody"></div>`;
  const tabs = app.querySelectorAll('[data-pt]');
  tabs.forEach((t) => t.onclick = () => {
    tabs.forEach((x) => x.classList.remove('active')); t.classList.add('active'); dashTab(t.dataset.pt);
  });
  document.getElementById('logoutBtn').onclick = async () => {
    if (confirm('تسجيل الخروج؟')) { await api('POST', '/logout'); me = null; location.hash = '#/'; boot(false); }
  };
  dashTab('feed');
}
async function dashTab(t) {
  const body = document.getElementById('pbody');
  if (!body) return;
  if (t === 'feed') {
    body.innerHTML = '<div class="spin"></div>';
    const [arts, disps] = await Promise.all([
      api('GET', '/articles?limit=100'), api('GET', '/dispatches?limit=100'),
    ]);
    const mine_a = arts.filter((a) => a.author.username === me.username);
    const mine_d = disps.filter((d) => d.author.username === me.username);
    body.innerHTML = `<div class="sec-h">مقالاتي (${mine_a.length})</div>` +
      (mine_a.map((a) => rowItem(`📰 ${esc(a.title)} · ${timeAgo(a.created_at)}`, `delArticle(${a.id})`)).join('') || '<p class="hint" style="padding:0 18px">لا توجد مقالات.</p>') +
      `<div class="sec-h">برقياتي (${mine_d.length})</div>` +
      (mine_d.map((d) => rowItem(`📜 ${esc(excerpt(d.body, 70))}`, `delDispatch(${d.id})`)).join('') || '<p class="hint" style="padding:0 18px">لا توجد برقيات.</p>');
  } else if (t === 'new-d') {
    const c = countryOf(me.country_code);
    body.innerHTML = `<div class="form-dark"><h2>برقية جديدة باسم ${c.flag} ${esc(c.name)}</h2><div id="msg"></div>
      <div class="field"><textarea id="dbody" maxlength="500" placeholder="بماذا تودّ أن تُصرّح؟ (500 حرف كحد أقصى)"></textarea></div>
      <div class="field"><label class="filebtn">${ICONS.img} إرفاق صورة (اختياري)<input id="dimg" type="file" accept="image/*" style="display:none"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendDispatch()">نشر البرقية</button></div>`;
  } else if (t === 'new-a') {
    const cats = Object.entries(CATS).filter(([k]) => k !== 'official' || me.role === 'admin');
    body.innerHTML = `<div class="form-dark"><h2>مقال جديد</h2><div id="msg"></div>
      <div class="field"><label>القسم</label><select id="acat">${cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>العنوان</label><input id="atitle"></div>
      <div class="field"><label>نص المقال</label><textarea id="abody" style="min-height:220px" placeholder="اكتب سيناريو المعركة أو الحدث بالتفصيل…"></textarea></div>
      <div class="field"><label class="filebtn">${ICONS.img} صورة المقال (اختياري)<input id="aimg" type="file" accept="image/*" style="display:none"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendArticle()">نشر المقال</button></div>`;
  } else if (t === 'edit') {
    body.innerHTML = `<div class="form-dark"><h2>تعديل البروفايل</h2><div id="msg"></div>
      <div class="field"><label>النبذة التعريفية (البايو) — 160 حرفًا كحد أقصى</label>
        <textarea id="pbio" maxlength="160" placeholder="عرّف بنفسك وبمشروع دولتك…">${esc(me.bio || '')}</textarea></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="saveBio()">حفظ البايو</button>
      <a class="btn ghost" href="#/u/${esc(me.username)}" style="margin-inline-start:8px">معاينة بروفايلي</a></div>`;
  } else {
    body.innerHTML = '<div class="spin"></div>';
    await vDashDossier(body);
  }
}
const rowItem = (t, fn) => `<div class="row-item"><span class="grow">${t}</span><button class="btn danger" onclick="${fn}">حذف</button></div>`;
async function sendDispatch() {
  try {
    let image = null;
    const f = document.getElementById('dimg').files[0];
    if (f) { msg('جارٍ رفع الصورة…', true); image = await uploadImage(f); }
    await api('POST', '/dispatches', { body: val('dbody'), image });
    dashTab('feed');
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
  await api('DELETE', `/dispatches/${id}`); dashTab('feed');
}
async function saveBio() {
  try {
    const r = await api('POST', '/profile', { bio: val('pbio') });
    me.bio = r.bio;
    msg('تم حفظ البايو ✓', true);
  } catch (e) { msg(e.message, false); }
}
async function vDashDossier(body) {
  let r;
  try { r = await api('GET', '/dossier/' + encodeURIComponent(me.username)); }
  catch (e) { body.innerHTML = `<div class="form-dark"><p class="err">${esc(e.message)}</p></div>`; return; }
  const d = r.dossier;
  const th = new Set(d.theaters || []);
  body.innerHTML = `<div class="form-dark"><h2>ملفي الاستخباراتي</h2><div id="msg"></div>
    <div class="field"><label>الصورة الشخصية للملف</label>
      <div style="display:flex;gap:12px;align-items:center">
        <img id="favatarprev" class="avprev" src="${esc(d.avatar || '')}" style="${d.avatar ? '' : 'display:none'}">
        <label class="filebtn">${ICONS.img} اختر صورة<input id="favatar" type="file" accept="image/*" style="display:none"></label>
      </div><input id="favatarurl" type="hidden" value="${esc(d.avatar || '')}"></div>
    <div class="field"><label>الاسم المستعار (Alias)</label><input id="falias" value="${esc(d.alias)}" placeholder="مثال: الثعلب" dir="ltr"></div>
    <div class="frow">
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
      <textarea id="froles" placeholder="مثال: رئيس وزراء بريطانيا">${esc((d.roles || []).join('\n'))}</textarea></div>
    <div class="field"><label>🏆 الإنجازات (سطر لكل إنجاز)</label>
      <textarea id="fach" placeholder="مثال: قاد حملة البلقان بنجاح سنة 1901">${esc((d.achievements || []).join('\n'))}</textarea></div>
    <div class="field"><label>مصفوفة المهارات (Skill Matrix)</label>
      <div class="dos-skills-edit">${Object.entries(SKILLS).map(([k, label]) => `
        <div class="dos-skill"><span>${label}</span>
          <select id="fsk_${k}" dir="ltr">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${Number(d.skills[k]) === n ? ' selected' : ''}>${'●'.repeat(n) || '○'}</option>`).join('')}</select>
        </div>`).join('')}</div></div>
    <button class="btn" style="width:auto;padding:12px 44px" onclick="saveDossier()">حفظ الملف</button>
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

// ---------- التعليقات ----------
function commentsHTML() {
  const c = me ? countryOf(me.country_code) : null;
  return `<div class="comments"><div class="sec-h">التعليقات</div>
    <div id="clist"><div class="spin"></div></div>
    ${me ? `<div class="cform"><span class="av" style="width:38px;height:38px;font-size:1.2rem">${c.flag}</span>
      <input id="cinput" maxlength="500" placeholder="اكتب تعليقك…">
      <button class="c-post" id="csend">نشر</button></div>`
    : `<p class="hint" style="padding:0 18px 16px"><a href="#/login" style="color:var(--accent)">سجّل الدخول</a> للمشاركة في التعليقات</p>`}
  </div>`;
}
async function loadComments(type, id) {
  const box = document.getElementById('clist');
  if (!box) return;
  try {
    const list = await api('GET', `/comments/${type}/${id}`);
    box.innerHTML = list.length ? list.map((cm) => {
      const cc = countryOf(cm.author.country_code);
      const canDel = me && (me.username === cm.author.username || me.role === 'admin');
      return `<div class="comment"><span class="av" style="width:38px;height:38px;font-size:1.25rem">${cc.flag}</span>
        <div class="cm-main"><div class="cm-head">
          <span class="tw-name" data-user="${esc(cm.author.username)}" style="cursor:pointer">${esc(cc.name)}</span>
          <span class="tw-handle">@${esc(cm.author.username)} · ${timeAgo(cm.created_at)}</span>
          ${canDel ? `<button class="tw-del" data-cdel="${cm.id}">${ICONS.trash}</button>` : ''}</div>
          <div class="cm-body">${esc(cm.body)}</div></div></div>`;
    }).join('') : '<p class="hint" style="padding:4px 18px 14px">لا توجد تعليقات بعد — كن أول المعلقين.</p>';
    box.querySelectorAll('[data-user]').forEach((el) => el.onclick = (e) => { e.stopPropagation(); location.hash = '#/u/' + encodeURIComponent(el.dataset.user); });
    box.querySelectorAll('[data-cdel]').forEach((b) => b.onclick = async () => {
      if (!confirm('حذف التعليق؟')) return;
      await api('DELETE', '/comments/' + b.dataset.cdel);
      loadComments(type, id); hydrateEngagement(type);
    });
  } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  const send = document.getElementById('csend');
  if (send) send.onclick = async () => {
    const inp = document.getElementById('cinput');
    const v = inp.value.trim(); if (!v) return;
    send.disabled = true;
    try { await api('POST', '/comments', { type, id, body: v }); inp.value = ''; loadComments(type, id); hydrateEngagement(type); }
    catch (e) { alert(e.message); }
    send.disabled = false;
  };
}

// ---------- الستوريات ----------
let STORY_GROUPS = [];
async function storyBarHTML() {
  try { STORY_GROUPS = await api('GET', '/stories'); } catch (e) { STORY_GROUPS = []; }
  let items = '';
  if (me) {
    items += `<div class="story" id="sadd"><span class="s-ring sadd">＋</span><span class="s-name">قصتك</span></div>`;
    const mine = STORY_GROUPS.find((g) => g.user.username === me.username);
    if (mine) {
      const c = countryOf(mine.user.country_code);
      items += `<div class="story" data-suser="${esc(mine.user.username)}"><span class="s-ring seen">${c.flag}</span><span class="s-name">${esc(mine.user.username)}</span></div>`;
    }
  }
  for (const g of STORY_GROUPS) {
    if (me && g.user.username === me.username) continue;
    const c = countryOf(g.user.country_code);
    items += `<div class="story" data-suser="${esc(g.user.username)}"><span class="s-ring">${c.flag}</span><span class="s-name">${esc(g.user.username)}</span></div>`;
  }
  return `<div class="stories">${items || '<span class="hint">لا توجد ستوريات بعد</span>'}</div>`;
}
function bindStories() {
  const add = document.getElementById('sadd');
  if (add) add.onclick = openStoryAdd;
  app.querySelectorAll('[data-suser]').forEach((el) => el.onclick = () => openStory(el.dataset.suser));
}
function openStoryAdd() {
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal-card">
    <div class="m-head"><b>ستوري جديد</b><button class="m-x" id="saddx">✕</button></div>
    <div class="m-msg"></div>
    <textarea id="sbody" maxlength="300" placeholder="اكتب شيئًا… (اختياري)" rows="3"></textarea>
    <div class="c-prev" id="sprev" style="display:none"><img id="sprevimg"><button id="spremx">✕</button></div>
    <div class="c-tools">
      <button class="c-ic" id="simgbtn" title="إرفاق صورة">${ICONS.img}</button>
      <input type="file" id="simg" accept="image/*" style="display:none">
      <button class="c-post" id="spost" style="margin-inline-start:auto">نشر الستوري</button>
    </div>
    <p class="hint">الستوري يختفي تلقائيًا بعد 24 ساعة ⏳</p>
  </div>`;
  document.body.appendChild(ov);
  const m = (t, ok) => { ov.querySelector('.m-msg').innerHTML = t ? `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>` : ''; };
  let imgUrl = null;
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById('saddx').onclick = close;
  document.getElementById('simgbtn').onclick = () => document.getElementById('simg').click();
  document.getElementById('simg').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { m('جارٍ رفع الصورة…', true); imgUrl = await uploadImage(f);
      document.getElementById('sprevimg').src = imgUrl; document.getElementById('sprev').style.display = ''; m('');
    } catch (err) { m(err.message, false); }
  };
  document.getElementById('spremx').onclick = () => { document.getElementById('sprev').style.display = 'none'; imgUrl = null; };
  document.getElementById('spost').onclick = async () => {
    const body = document.getElementById('sbody').value.trim();
    if (!body && !imgUrl) { m('أضف نصًا أو صورة', false); return; }
    try { await api('POST', '/stories', { body, image: imgUrl }); close(); route(); }
    catch (err) { m(err.message, false); }
  };
}
function openStory(username) {
  const g = STORY_GROUPS.find((x) => x.user.username === username);
  if (!g) return;
  const c = countryOf(g.user.country_code);
  const ov = document.createElement('div');
  ov.className = 'sview-ov';
  document.body.appendChild(ov);
  let i = 0, timer = null;
  const close = () => { clearTimeout(timer); ov.remove(); };
  const render = () => {
    clearTimeout(timer);
    const s = g.stories[i];
    const canDel = me && g.user.username === me.username;
    ov.innerHTML = `<div class="sview">
      <div class="sv-prog">${g.stories.map((_, k) => `<span><i class="${k < i ? 'done' : k === i ? 'run' : ''}"></i></span>`).join('')}</div>
      <div class="sv-head"><span class="av">${c.flag}</span>
        <span class="tw-name" style="color:#fff">${esc(g.user.username)}</span>
        <span class="tw-handle">· ${timeAgo(s.created_at)}</span>
        <span style="margin-inline-start:auto;display:flex;gap:4px">
          ${canDel ? `<button class="sv-x" id="svdel" title="حذف">${ICONS.trash}</button>` : ''}
          <button class="sv-x" id="svx">✕</button></span></div>
      ${s.image ? `<img class="sv-img" src="${esc(s.image)}">` : `<div class="sv-body only">${esc(s.body) || ''}</div>`}
      ${s.image && s.body ? `<div class="sv-cap">${esc(s.body)}</div>` : ''}
      <div class="sv-zone prev" id="svprev"></div><div class="sv-zone next" id="svnext"></div>
    </div>`;
    document.getElementById('svx').onclick = (e) => { e.stopPropagation(); close(); };
    const del = document.getElementById('svdel');
    if (del) del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('حذف هذا الستوري؟')) return;
      await api('DELETE', '/stories/' + s.id);
      g.stories.splice(i, 1);
      if (!g.stories.length) { STORY_GROUPS = STORY_GROUPS.filter((x) => x.user.username !== username); close(); route(); return; }
      i = Math.min(i, g.stories.length - 1); render();
    };
    document.getElementById('svprev').onclick = (e) => { e.stopPropagation(); i = (i - 1 + g.stories.length) % g.stories.length; render(); };
    document.getElementById('svnext').onclick = (e) => { e.stopPropagation(); i = (i + 1) % g.stories.length; render(); };
    timer = setTimeout(() => { i++; if (i >= g.stories.length) close(); else render(); }, 5000);
  };
  render();
}

// ---------- برقية: تفاصيل + تعليقات ----------
async function vDispatch(id) {
  app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">برقية</div></div><div class="spin"></div>`;
  try {
    const d = await api('GET', `/dispatches/${id}`);
    app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
      <div class="thead-title" style="padding:0">برقية</div></div>
      ${tweetHTML(d)}
      ${commentsHTML()}`;
    bindFeed();
    await hydrateEngagement('dispatch');
    loadComments('dispatch', d.id);
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- بروفايل عام ----------
async function vUser(username) {
  app.innerHTML = `<div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">البروفايل</div></div><div class="spin"></div>`;
  try {
    const { user, stats } = await api('GET', '/user/' + encodeURIComponent(username));
    const c = countryOf(user.country_code);
    const isMine = me && me.username === user.username;
    app.innerHTML = `
      <div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
        <div><div class="thead-title" style="padding:0">${esc(user.username)}</div>
        <div class="hint">${stats.dispatches} برقية · ${stats.articles} مقال</div></div></div>
      <div class="cover"></div>
      <div class="prow">
        <div class="p-av">${c.flag}</div>
        <div class="p-head"><div class="p-id">
          <div class="p-name">${esc(c.name)} ${user.role === 'admin' ? ICONS.checkGold : ICONS.check}</div>
          <div class="p-handle">@${esc(user.username)}</div></div>
          ${isMine ? `<a class="btn ghost" href="#/dash" style="width:auto;padding:8px 18px">تعديل</a>`
            : `<a class="btn ghost" href="#/dossier/${esc(user.username)}" style="width:auto;padding:8px 18px">🗂️ الملف الاستخباراتي</a>`}
        </div>
        ${user.bio ? `<p class="p-bio">${esc(user.bio)}</p>`
          : isMine ? `<p class="p-bio" style="opacity:.5">أضف نبذة تعريفية (بايو) من حسابك…</p>` : ''}
        <div class="p-meta"><span>📍 ${esc(c.name)}</span><span>🗓️ انضم ${timeAgo(user.created_at)}</span>
          ${user.role === 'admin' ? '<span>⭐ إدارة المقر</span>' : ''}</div>
        <div class="p-meta"><span><b>${stats.dispatches}</b> برقية</span><span><b>${stats.articles}</b> مقال</span></div>
      </div>
      <div class="ptabs">
        <button class="ptab active" data-pt="d">البرقيات</button>
        <button class="ptab" data-pt="a">المقالات</button>
      </div>
      <div id="pfeed"><div class="spin"></div></div>`;
    const tabs = app.querySelectorAll('[data-pt]');
    const load = async (kind) => {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.pt === kind));
      const feed = document.getElementById('pfeed');
      feed.innerHTML = '<div class="spin"></div>';
      try {
        if (kind === 'd') {
          const items = (await api('GET', '/dispatches?limit=100')).filter((d) => d.author.username === username);
          feed.innerHTML = items.length ? items.map(tweetHTML).join('') : '<div class="empty">لا توجد برقيات.</div>';
          bindFeed(); hydrateEngagement('dispatch');
        } else {
          const items = (await api('GET', '/articles?limit=100')).filter((a) => a.author.username === username);
          feed.innerHTML = items.length ? items.map(articleCardHTML).join('') : '<div class="empty">لا توجد مقالات.</div>';
          bindFeed(); hydrateEngagement('article');
        }
      } catch (e) { feed.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    };
    tabs.forEach((t) => t.onclick = () => load(t.dataset.pt));
    await load('d');
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- التوجيه ----------
function navKey(h) {
  if (h === '#/' || h === '') return '#/';
  if (h.startsWith('#/cat/')) return '#/cat/' + h.split('/')[2];
  if (h === '#/dispatches' || h === '#/dossiers' || h === '#/dash' || h === '#/login') return h;
  if (h.startsWith('#/d/')) return '#/dispatches';
  return null;
}
async function route() {
  const h = location.hash || '#/';
  renderNav(navKey(h));
  try {
    if (h === '#/' || h === '') await vHome();
    else if (h.startsWith('#/cat/')) await vCat(h.split('/')[2]);
    else if (h.startsWith('#/article/')) await vArticle(h.split('/')[2]);
    else if (h.startsWith('#/d/')) await vDispatch(h.split('/')[2]);
    else if (h.startsWith('#/u/')) await vUser(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/dispatches') await vDispatches();
    else if (h === '#/dossiers') await vDossiers();
    else if (h.startsWith('#/dossier/')) await vDossier(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/login') vLogin();
    else if (h === '#/register') await vRegister();
    else if (h === '#/dash') await vDash();
    else await vHome();
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}

// ---------- بدء ----------
async function boot(first = true) {
  try {
    COUNTRIES = await api('GET', '/countries');
    CMAP = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
    me = (await api('GET', '/me')).user;
    renderNav(navKey(location.hash || '#/'));
    renderWidgets();
    if (first) {
      window.addEventListener('hashchange', route);
      await route();
    } else { await route(); }
  } catch (e) {
    app.innerHTML = `<div class="empty"><span class="e-ic">⚠️</span>تعذّر الاتصال بالخادم.<br>${esc(e.message)}</div>`;
  }
}
boot();
