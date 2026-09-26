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
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3.2 3.6 3.2 14.4 0 18"/><path d="M12 3c-3.2 3.6-3.2 14.4 0 18"/>'),
  dots: I('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  news: I('<path d="M4 6h12a1 1 0 0 1 1 1v11H6a2 2 0 0 1-2-2V6z"/><path d="M17 9h2a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6"/><path d="M7.5 10h7M7.5 13.5h7M7.5 17h4"/>'),
  pen: I('<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>'),
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2"/>'),
  shield: I('<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"/><path d="M9.3 12l2 2 3.6-4"/>'),
  refresh: I('<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/>'),
  doc: I('<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 12.5h6M9 16.5h6"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/>'),
  pin: I('<path d="M12 21.5s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10.5" r="2.5"/>'),
  medal: I('<circle cx="12" cy="15" r="5"/><path d="M8.6 10.8L5.5 3.5h3.6l2.9 5 2.9-5h3.6l-3.1 7.3"/>'),
  lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  ban: I('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
  logout: I('<path d="M14 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7"/><path d="M10 12h11M18 8.5L21.5 12 18 15.5"/>'),
  bell: I('<path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 5.8 1.8 5.8H4.2S6 14 6 9.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
  send: I('<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"/>'),
  camera: I('<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  alert: I('<path d="M12 3.5L21.5 20h-19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.5"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  play: I('<path d="M7 4.5l13 7.5-13 7.5v-15z"/>'),
  pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg>`,
  star: I('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5z"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6M17.3 14.9c2.2.8 3.7 2.4 3.7 5.1"/>'),
  grid: I('<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>'),
  list: I('<path d="M8.5 6H21M8.5 12H21M8.5 18H21"/><circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/>'),
  checkSm: I('<path d="M4.5 12.5l5 5L19.5 7"/>'),
  bookmark: I('<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4.2L6 21V4.5a1 1 0 0 1 1-1z"/>'),
  flame: I('<path d="M12 3.5s5.5 4.8 5.5 10a5.5 5.5 0 0 1-11 0c0-2.2 1.1-4.1 1.1-4.1s.5 1.6 2.1 1.6c-1.1-3.2 2.3-7.5 2.3-7.5z"/>'),
  info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  editPen: I('<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>'),
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
// الأفاتار: الصورة الشخصية إن وُجدت وإلا علم الدولة
function avHTML(author, sz) {
  const st = sz ? ` style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * 0.42)}px"` : '';
  if (author && author.avatar) return `<span class="av"${st}><img src="${esc(author.avatar)}" alt=""></span>`;
  const c = countryOf(author ? author.country_code : null);
  return `<span class="av"${st}>${c.flag}</span>`;
}

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
  ['#/messages', 'الرسائل', 'mail'],
  ['#/cat/official', 'بيانات رسمية', 'mega'],
  ['#/cat/war', 'سيناريوهات الحروب', 'zap'],
  ['#/cat/events', 'أحداث اللعبة', 'cal'],
  ['#/dossiers', 'ملفات العملاء', 'folder'],
  ['#/news', 'غرفة الحرب', 'globe'],
];
function renderNav(active) {
  const nav = document.getElementById('mainnav');
  const dashLink = me ? ['#/dash', 'حسابي', 'user'] : ['#/login', 'دخول', 'user'];
  nav.innerHTML = [...NAV, dashLink].map(([h, t, ic]) =>
    `<a class="nav-link${h === active ? ' active' : ''}" href="${h}">${ICONS[ic]}<span>${t}</span></a>`).join('');
  const bn = document.getElementById('bottomnav');
  const newsLink = NAV.find((n) => n[0] === '#/news');
  bn.innerHTML = [NAV[0], newsLink, NAV[1], NAV[2], dashLink].map(([h, , ic]) =>
    `<a class="${h === active ? 'active' : ''}" href="${h}">${ICONS[ic]}</a>`).join('');
  if (me) {
    api('GET', '/conversations').then((list) => {
      const n = (list || []).reduce((s, c) => s + (c.unread || 0), 0);
      if (n > 0) document.querySelectorAll('a[href="#/messages"]').forEach((a) => {
        if (!a.querySelector('.unread')) a.insertAdjacentHTML('beforeend', `<span class="unread">${n}</span>`);
      });
    }).catch(() => {});
  }
  document.querySelector('.cb-ic').innerHTML = ICONS.feather;
  document.getElementById('composeBtn').onclick = () => {
    location.hash = me ? '#/dash' : '#/login';
    if (me) setTimeout(() => dashTab('new-d'), 350);
  };
  const nu = document.getElementById('navuser');
  if (me) {
    const c = countryOf(me.country_code);
    nu.innerHTML = `<button class="nav-user" id="nuBtn">
      ${avHTML(me)}
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
    <span data-user="${esc(d.author.username)}" style="cursor:pointer;display:inline-flex">${avHTML(d.author)}</span>
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
    <span class="tw-cat${gold ? ' gold' : ''}">${gold ? ICONS.doc + ' ' : ''}${esc(a.category_label)}</span>
    ${a.image ? `<img class="ac-img" src="${esc(a.image)}" loading="lazy" alt="">` : ''}
    <h3>${esc(a.title)}</h3>
    <p>${esc(excerpt(a.body, 160))}</p>
    <div class="tw-head"><span data-user="${esc(a.author.username)}" style="cursor:pointer;display:inline-flex">${avHTML(a.author, 30)}</span>
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
    ${avHTML(me)}
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
    `<div id="sbar"></div>` + composerHTML()
    + `<a class="war-banner" href="#/news"><span class="wb-ic">${ICONS.flame}</span><span class="wb-tx"><b>غرفة الحرب</b><i>خريطة الصراع المباشرة وشدة النزاعات</i></span><span class="wb-go">←</span></a>`
    + `<div id="clockbox"></div>`
    + `<div id="feed"><div class="spin"></div></div>`;
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
          : `<div class="empty"><span class="e-ic">${ICONS.news}</span>لا توجد برقيات بعد — كن أول من يصرّح باسم دولته.</div>`;
      } else {
        const items = await api('GET', '/articles?limit=20');
        feed.innerHTML = items.length ? items.map(articleCardHTML).join('')
          : '<div class="empty"><span class="e-ic">' + ICONS.doc + '</span>لا توجد مقالات بعد.</div>';
      }
      bindFeed(); hydrateEngagement(kind === 'd' ? 'dispatch' : 'article');
    } catch (e) { feed.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  tabs.forEach((t) => t.onclick = () => load(t.dataset.ht));
  mountClock(document.getElementById('clockbox'));
  await load('d');
}

// ---------- البرقيات ----------
async function vDispatches() {
  app.innerHTML = thead('برقيات الدول') + composerHTML() + `<div id="feed"><div class="spin"></div></div>`;
  bindComposer(() => route());
  try {
    const items = await api('GET', '/dispatches?limit=40');
    document.getElementById('feed').innerHTML = items.length ? items.map(tweetHTML).join('')
      : '<div class="empty"><span class="e-ic">' + ICONS.news + '</span>لا توجد برقيات بعد.</div>';
    bindFeed(); hydrateEngagement('dispatch');
  } catch (e) { document.getElementById('feed').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- تصنيف ----------
async function vCat(cat) {
  app.innerHTML = thead(CATS[cat] || '') + `<div id="feed"><div class="spin"></div></div>`;
  try {
    const items = await api('GET', `/articles?category=${cat}&limit=30`);
    document.getElementById('feed').innerHTML = items.length ? items.map(articleCardHTML).join('')
      : '<div class="empty"><span class="e-ic">' + ICONS.doc + '</span>لا توجد مواد في هذا القسم بعد.</div>';
    bindFeed(); hydrateEngagement('article');
  } catch (e) { document.getElementById('feed').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- ساعة أرجوس الرسمية ----------
// كل 24 ساعة واقعية = سنة كاملة داخل اللعبة (كل ساعتين = شهر)
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const GAME_MONTH_MS = 2 * 3600 * 1000;
function gameDateOf(startedAt, nowMs) {
  const elapsed = Math.max(0, nowMs - startedAt);
  const m = Math.floor(elapsed / GAME_MONTH_MS);
  const day = Math.floor((elapsed % GAME_MONTH_MS) / GAME_MONTH_MS * 30) + 1; // 1..30
  return { year: 1900 + Math.floor(m / 12), month: (m % 12) + 1, day };
}
function fmtGMT(ts) {
  return new Intl.DateTimeFormat('ar', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ts)) + ' GMT';
}
let clockTimers = [], clockState = null;
function clearClock() { clockTimers.forEach(clearInterval); clockTimers = []; }
async function mountClock(el) {
  clearClock();
  if (!el) return;
  el.innerHTML = '<div class="spin"></div>';
  try { clockState = await api('GET', '/clock'); }
  catch (e) { el.innerHTML = '<div class="clock-box"><div class="err">تعذّر تحميل الساعة</div></div>'; return; }
  const tick = () => {
    if (!document.body.contains(el)) { clearClock(); return; }
    const now = Date.now();
    let game = '—', status = ICONS.pause + ' الساعة متوقفة — بانتظار تشغيل المطورين';
    if (clockState && clockState.running && clockState.started_at) {
      const g = gameDateOf(clockState.started_at, now);
      game = `${g.day} ${AR_MONTHS[g.month - 1]} ${g.year}`;
      status = '<span class="dot-live"></span> اللعبة جارية';
    }
    el.innerHTML = `<div class="clock-box">
      <div class="clock-head">${ICONS.clock} ساعة أرجوس الرسمية</div>
      <div class="clock-row"><span class="clock-lbl">العالم الواقعي (غرينتش)</span><b>${fmtGMT(now)}</b></div>
      <div class="clock-row"><span class="clock-lbl">زمن اللعبة</span><b class="clock-game">${game}</b></div>
      <div class="clock-foot">${status} · كل 24 ساعة واقعية = سنة كاملة داخل اللعبة</div>
      ${me && me.role === 'developer' ? `<div class="clock-ctl">
        <button class="btn" style="width:auto;padding:8px 22px" onclick="clockStart()">${ICONS.play} تشغيل الساعة</button>
        <button class="btn ghost" style="width:auto;padding:8px 22px" onclick="clockStop()">${ICONS.pause} إيقاف</button>
        <button class="btn danger" style="width:auto;padding:8px 22px" onclick="clockReset()">${ICONS.refresh} إعادة التعيين</button>
      </div>` : ''}
    </div>`;
  };
  tick();
  clockTimers.push(setInterval(tick, 1000));
  clockTimers.push(setInterval(async () => {
    try { const s = await api('GET', '/clock'); clockState = s; } catch (e) {}
  }, 60000));
}
async function clockStart() {
  try { clockState = await api('POST', '/clock/start'); alert('بدأت الساعة ✓ — انطلق زمن اللعبة من يناير 1900'); }
  catch (e) { alert(e.message); }
}
async function clockStop() {
  try { clockState = await api('POST', '/clock/stop'); }
  catch (e) { alert(e.message); }
}
async function clockReset() {
  if (!confirm('إعادة تعيين الساعة؟ سيعود زمن اللعبة إلى الصفر (1 يناير 1900) ويعمل من جديد.')) return;
  try { clockState = await api('POST', '/clock/reset'); alert('أُعيد التعيين ✓ — زمن اللعبة عاد إلى 1 يناير 1900'); }
  catch (e) { alert(e.message); }
}
// ---------- غرفة الحرب (خريطة الصراع) ----------
const SEV_AR = { RED: 'مرتفع', ORANGE: 'متوسط', YELLOW: 'منخفض' };
const TREND_AR = { up: 'متصاعد', down: 'متراجع', steady: 'مستقر' };
async function vNews() {
  app.innerHTML = thead('غرفة الحرب')
    + `<div class="war-hero">
        <canvas id="wglobe"></canvas>
        <div class="war-hero-tx">
          <div class="war-kicker">خريطة الصراع المباشرة</div>
          <h2>مسرح عمليات أرجوس</h2>
          <p>رصد حي لنشاط الدول — البرقيات والبيانات والتقارير الحربية خلال آخر 30 يومًا.</p>
          <div class="war-legend">
            <span><i class="dot" style="background:#f4212e"></i>مرتفع</span>
            <span><i class="dot" style="background:#ff9f0a"></i>متوسط</span>
            <span><i class="dot" style="background:#ffd400"></i>منخفض</span>
            <span class="hint">لون حدود كل دولة = حالتها</span>
          </div>
        </div>
      </div>
      <div id="clockbox"></div>
      <div class="war-sec"><div class="war-sec-t">إعلانات المطورين — حالات الحرب والطوارئ</div><div id="wdecl"><div class="spin"></div></div></div>
      <div id="mapeditor"></div>
      <div class="war-sec"><div class="war-sec-t">شدة الصراع — نافذة 30 يومًا</div><div id="wtable"><div class="spin"></div></div></div>
      <div class="war-sec"><div class="war-sec-t">الموجز اليومي</div><div id="wbriefs"><div class="spin"></div></div></div>`;
  let rows = [], mstates = [];
  try { const d = await api('GET', '/conflict'); rows = d.rows || []; }
  catch (e) { /* يبقى فارغًا */ }
  try { const m = await api('GET', '/api/map-states'); mstates = m.states || []; }
  catch (e) { /* يبقى فارغًا */ }
  initGlobe(rows, mstates);
  renderWarTable(rows, mstates);
  renderBriefs(rows);
  renderDeclarations(mstates);
  if (me && me.role === 'developer') renderMapEditor(mstates);
  mountClock(document.getElementById('clockbox'));
}
let THREE_PROMISE = null;
function loadThree(ok, fail) {
  if (window.THREE) return ok();
  if (!THREE_PROMISE) {
    THREE_PROMISE = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  THREE_PROMISE.then(ok).catch(fail);
}
function latLonToVec3(lat, lon, r) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
// أسماء الدول في ملف حدود 1900 مقابل رموز اللعبة
const GEO_NAME_OF = {
  GB: 'United Kingdom of Great Britain and Ireland', FR: 'France', DE: 'Germany',
  AT: 'Austria Hungary', RU: 'Russian Empire', OT: 'Ottoman Empire', IT: 'Italy',
  ES: 'Spain', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  SN: 'Sweden–Norway', DK: 'Denmark', GR: 'Greece', RS: 'Serbia', RO: 'Romania',
  BG: 'Bulgaria', ME: 'Montenegro', LU: 'Luxembourg', JP: 'Imperial Japan',
  CN: 'Manchu Empire', IR: 'Persia', TH: 'Rattanakosin Kingdom', AF: 'Afghanistan',
  KR: 'Korea', NP: 'Nepal', ET: 'Ethiopia', LR: 'Liberia', MA: 'Morocco',
  TV: 'Transvaal', OF: 'Orange Free State', US: 'United States of America',
  MX: 'Mexico', GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CR: 'Costa Rica', CO: 'Colombia', VE: 'Venezuela',
  EC: 'Ecuador', PE: 'Peru', BO: 'Bolivia', CL: 'Chile', AR: 'Argentina',
  UY: 'Uruguay', PY: 'Paraguay', BR: 'Kingdom of Brazil', HT: 'Haiti',
  DO: 'Dominican Republic', OM: 'Oman', HS: 'Jabal Shammar',
};
let BORDERS_PROMISE = null;
function loadBorders1900() {
  if (!BORDERS_PROMISE) BORDERS_PROMISE = fetch('/borders-1900.geojson').then((r) => { if (!r.ok) throw 0; return r.json(); });
  return BORDERS_PROMISE;
}
function buildBorderLines(data, pick, radius, color, opacity) {
  const names = new Set(Object.values(GEO_NAME_OF));
  const pos = [];
  const seg = (a, b) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z); };
  const ring = (pts) => {
    let prev = null;
    for (const [lon, lat] of pts) {
      const p = latLonToVec3(lat, lon, radius);
      if (prev) seg(prev, p);
      prev = p;
    }
  };
  for (const f of data.features) {
    const nm = f.properties && f.properties.NAME;
    if (!pick(nm, names.has(nm))) continue;
    const g = f.geometry; if (!g) continue;
    if (g.type === 'Polygon') g.coordinates.forEach(ring);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(ring));
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
// رسم حدود مخصصة من GeoJSON (Polygon/MultiPolygon) يزوّدها المطورون
function buildCustomLines(geom, radius, color, opacity) {
  const pos = [];
  const seg = (a, b) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z); };
  const ring = (pts) => {
    let prev = null;
    for (const [lon, lat] of pts) {
      const p = latLonToVec3(lat, lon, radius);
      if (prev) seg(prev, p);
      prev = p;
    }
    if (prev && pts.length > 1) seg(prev, latLonToVec3(pts[0][1], pts[0][0], radius));
  };
  if (geom) {
    if (geom.type === 'Polygon') geom.coordinates.forEach(ring);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly) => poly.forEach(ring));
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function initGlobe(rows, mstates) {
  const cv = document.getElementById('wglobe'); if (!cv) return;
  loadThree(() => { try { initGlobe3D(cv, rows, mstates); } catch (e) { initGlobeFallback(cv, rows); } },
            () => initGlobeFallback(cv, rows));
}
function initGlobe3D(cv, rows, mstates) {
  const holder = cv.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0, 3.05);
  const globe = new THREE.Group();
  scene.add(globe);
  // الأرض بخامة الأقمار الصناعية الليلية
  const earthTex = new THREE.TextureLoader().load('/textures/earth-night.jpg');
  globe.add(new THREE.Mesh(
    new THREE.SphereGeometry(1, 72, 72),
    new THREE.MeshBasicMaterial({ map: earthTex })
  ));
  // توهج الغلاف الجوي
  const atm = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 72, 72),
    new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x2a7fd4) } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; uniform vec3 c; void main(){ float i = pow(max(0.0, 0.66 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(c, 1.0) * i; }',
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
    })
  );
  globe.add(atm);
  // نجوم
  const sp = [];
  for (let i = 0; i < 500; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue; }
    v.normalize().multiplyScalar(25 + Math.random() * 40);
    sp.push(v.x, v.y, v.z);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8aa8c8, size: 0.09, transparent: true, opacity: 0.75 })));
  // حدود سنة 1900: كل كيان بخط خافت، وحدود كل دولة قابلة للعب ملوّنة حسب حالتها
  // (تعديلات المطورين: لون مخصص وحدود مرسومة تتفوق على التلقائي)
  const CODE_OF = {};
  Object.entries(GEO_NAME_OF).forEach(([c, n]) => { CODE_OF[n] = c; });
  const sevByCode = {};
  rows.forEach((r) => { sevByCode[r.code] = r.severity; });
  const ovByCode = {};
  (mstates || []).forEach((s) => { ovByCode[s.country_code] = s; });
  const SEV_HEX = { RED: '#f4212e', ORANGE: '#ff9f0a', YELLOW: '#ffd400' };
  const finalColor = (code) => {
    const ov = ovByCode[code];
    if (ov && ov.color) return ov.color;
    return SEV_HEX[sevByCode[code]] || null;
  };
  loadBorders1900().then((data) => {
    if (!document.body.contains(cv)) return;
    globe.add(buildBorderLines(data, (nm, isP) => !isP, 1.002, 0x5f7285, 0.45));
    const skipNames = new Set();
    (mstates || []).forEach((s) => {
      const nm = GEO_NAME_OF[s.country_code];
      if (nm && s.borders_geojson) skipNames.add(nm);
    });
    const byColor = {};
    Object.keys(GEO_NAME_OF).forEach((code) => {
      const col = finalColor(code); if (!col) return;
      (byColor[col] = byColor[col] || []).push(GEO_NAME_OF[code]);
    });
    Object.entries(byColor).forEach(([col, names]) => {
      const set = new Set(names);
      globe.add(buildBorderLines(data,
        (nm, isP) => isP && set.has(nm) && !skipNames.has(nm), 1.004, parseInt(col.slice(1), 16), 0.95));
    });
    globe.add(buildBorderLines(data,
      (nm, isP) => isP && !skipNames.has(nm) && !finalColor(CODE_OF[nm]), 1.004, 0x8a97a5, 0.55));
    // حدود مرسومة يدويًا من المطورين
    (mstates || []).forEach((s) => {
      if (!s.borders_geojson) return;
      try {
        const col = finalColor(s.country_code) || '#8a97a5';
        globe.add(buildCustomLines(JSON.parse(s.borders_geojson), 1.004, parseInt(col.slice(1), 16), 0.95));
      } catch (e) {}
    });
  }).catch(() => {});
  // علامات الدول المشتعلة
  const SEVC = { RED: 0xf4212e, ORANGE: 0xff9f0a, YELLOW: 0xffd400 };
  const glowTex = makeGlowTexture();
  const markers = [];
  rows.forEach((r) => {
    if (r.lat == null || r.lon == null) return;
    const col = SEVC[r.severity] || 0xffd400;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    halo.position.copy(latLonToVec3(r.lat, r.lon, 1.004));
    halo.scale.setScalar(0.22);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.position.copy(halo.position);
    core.scale.setScalar(0.07);
    globe.add(halo); globe.add(core);
    markers.push({ halo, phase: Math.random() * 6.28 });
  });
  // علامات إعلانات المطورين: حالة حرب / طوارئ (حتى للدول الهادئة)
  (mstates || []).forEach((s) => {
    if ((s.status === 'war' || s.status === 'emergency') && s.lat != null && s.lon != null) {
      const col = s.status === 'war' ? 0xf4212e : 0xff9f0a;
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }));
      ring.position.copy(latLonToVec3(s.lat, s.lon, 1.006));
      ring.scale.setScalar(0.42);
      globe.add(ring);
      markers.push({ halo: ring, phase: Math.random() * 6.28 });
    }
  });
  // مراجع لأدوات الرسم (وضع تحرير المطورين)
  cv._globe = { globe, camera, renderer, scene };
  // ابدأ موجهًا نحو الشرق الأوسط/أوروبا
  globe.rotation.y = -2.094; globe.rotation.x = 0.18;
  let dragging = false, px = 0, py = 0, autoV = 0.0016;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', (e) => { if (cv._drawing) return; dragging = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    globe.rotation.y += (e.clientX - px) * 0.006;
    globe.rotation.x = Math.max(-0.7, Math.min(0.7, globe.rotation.x + (e.clientY - py) * 0.003));
    px = e.clientX; py = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  const resize = () => {
    const w = Math.max(1, holder.clientWidth), h = Math.max(1, holder.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize', resize);
  const clock = new THREE.Clock();
  (function tick() {
    if (!document.body.contains(cv)) { renderer.dispose(); return; }
    const t = clock.getElapsedTime();
    if (!dragging) globe.rotation.y += autoV;
    markers.forEach((m) => {
      const p = (Math.sin(t * 2.4 + m.phase) + 1) / 2;
      m.halo.scale.setScalar(0.18 + p * 0.14);
      m.halo.material.opacity = 0.55 + p * 0.45;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}
// بديل بسيط لو تعذّر تحميل Three.js
function initGlobeFallback(cv, rows) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, R = 0;
  const fit = () => {
    const r = cv.getBoundingClientRect();
    W = cv.width = Math.max(1, r.width * dpr); H = cv.height = Math.max(1, r.height * dpr);
    R = Math.min(W, H) * 0.40;
  };
  fit(); window.addEventListener('resize', fit);
  // كرة منقطة (توزيع فيبوناتشي)
  const dots = []; const N = 650;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963;
    dots.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
  }
  let rot = 0.6, dragging = false, px = 0;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; });
  window.addEventListener('pointermove', (e) => { if (dragging) { rot += (e.clientX - px) * 0.008; px = e.clientX; } });
  window.addEventListener('pointerup', () => { dragging = false; });
  const proj = (x, y, z) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const x1 = x * cr + z * sr, z1 = -x * sr + z * cr;
    const tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
    const y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    return [W / 2 + x1 * R, H / 2 - y1 * R, z2];
  };
  const SEVC = { RED: '#f4212e', ORANGE: '#ff9f0a', YELLOW: '#ffd400' };
  let t = 0;
  (function draw() {
    if (!document.body.contains(cv)) return;
    t += 0.035; if (!dragging) rot += 0.0032;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, R * 0.1, W / 2, H / 2, R * 1.35);
    g.addColorStop(0, 'rgba(29,155,240,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const d of dots) {
      const p = proj(d[0], d[1], d[2]);
      if (p[2] < -0.12) continue;
      const a = 0.08 + 0.30 * Math.max(0, p[2]);
      ctx.fillStyle = 'rgba(140,170,200,' + a.toFixed(2) + ')';
      const s = Math.max(1, dpr * 0.85);
      ctx.fillRect(p[0], p[1], s, s);
    }
    for (const r of rows) {
      if (r.lat == null || r.lon == null) continue;
      const la = r.lat * Math.PI / 180, lo = r.lon * Math.PI / 180;
      const p = proj(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
      if (p[2] < 0.02) continue;
      const col = SEVC[r.severity] || '#ffd400';
      const pulse = (Math.sin(t * 2.2) + 1) / 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], (4 + pulse * 5) * dpr, 0, 7);
      ctx.fillStyle = col + '2e'; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * dpr, 0, 7);
      ctx.fillStyle = col; ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
}
function renderWarTable(rows, mstates) {
  const el = document.getElementById('wtable'); if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty"><span class="e-ic">' + ICONS.flame + '</span>لا توجد تقارير بعد — كن أول من يشعل مسرح العمليات.</div>';
    return;
  }
  const stByCode = {};
  (mstates || []).forEach((s) => { if (s.status) stByCode[s.country_code] = s.status; });
  const ST_AR = { war: 'حالة حرب', emergency: 'حالة طوارئ', peace: 'سلم' };
  el.innerHTML = `<div class="war-table">` + rows.map((r) => `
    <div class="war-row sev-${r.severity}">
      <span class="war-flag">${r.flag}</span>
      <span class="war-name">${esc(r.name)}${stByCode[r.code] ? ` <span class="st-badge st-${stByCode[r.code]}">${ST_AR[stByCode[r.code]]}</span>` : ''}</span>
      <span class="war-sev">${SEV_AR[r.severity]}</span>
      <span class="war-num"><b>${r.war}</b><i>تقارير حرب</i></span>
      <span class="war-num"><b>${r.mentions}</b><i>كل الإشارات</i></span>
      <span class="war-trend tr-${r.trend}">${TREND_AR[r.trend]}</span>
    </div>`).join('') + `</div>
    <div class="war-upd">آخر تحديث: ${new Date().toLocaleString('ar-EG')} · نافذة 30 يومًا</div>`;
}
function renderBriefs(rows) {
  const el = document.getElementById('wbriefs'); if (!el) return;
  const top = rows.filter((r) => r.brief && r.brief.length).slice(0, 6);
  if (!top.length) { el.innerHTML = '<div class="empty">لا توجد موجزات بعد.</div>'; return; }
  el.innerHTML = top.map((r) => `
    <article class="war-brief">
      <header>
        <span class="war-flag">${r.flag}</span>
        <div class="war-brief-tx"><b>${esc(r.name)}</b><time>${new Date().toLocaleDateString('ar-EG')}</time></div>
        <span class="war-sev">${SEV_AR[r.severity]}</span>
      </header>
      <ul>${r.brief.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      ${r.user ? `<a class="war-more" href="#/u/${encodeURIComponent(r.user)}">ملف الدولة ←</a>`
               : `<a class="war-more" href="#/cat/war">تقارير الحرب ←</a>`}
    </article>`).join('');
}

// ---------- إعلانات المطورين: حالات الحرب والطوارئ ----------
const MAP_ST_AR = { war: 'حالة حرب', emergency: 'حالة طوارئ', peace: 'سلم معلن' };
function renderDeclarations(mstates) {
  const el = document.getElementById('wdecl'); if (!el) return;
  const order = { war: 0, emergency: 1, peace: 2 };
  const list = (mstates || []).filter((s) => s.status).sort((a, b) => order[a.status] - order[b.status]);
  if (!list.length) { el.innerHTML = '<div class="empty">لا توجد إعلانات حالية.</div>'; return; }
  el.innerHTML = '<div class="wdecl-list">' + list.map((s) => {
    const c = countryOf(s.country_code);
    return `<div class="wdecl"><span class="war-flag">${c.flag}</span>
      <div class="wdecl-tx"><b>${esc(c.name)}</b>${s.label ? `<span> — ${esc(s.label)}</span>` : ''}
      <time>${s.updated_at ? new Date(s.updated_at).toLocaleDateString('ar-EG') : ''}</time></div>
      <span class="st-badge st-${s.status}">${MAP_ST_AR[s.status]}</span></div>`;
  }).join('') + '</div>';
}

// ---------- محرر الخريطة (حساب المطورين فقط) ----------
function renderMapEditor(mstates) {
  window._mstates = mstates || [];
  const el = document.getElementById('mapeditor'); if (!el) return;
  el.innerHTML = `<div class="war-sec dev-sec"><div class="war-sec-t">${ICONS.shield} تحرير الخريطة — المطورون فقط</div>
   <div class="map-ed">
    <div class="field"><label>الدولة</label><select id="me-country" onchange="mapLoadCountry()">
      ${COUNTRIES.map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select></div>
    <div class="field"><label>لون الحدود</label><div class="me-colorrow"><input type="color" id="me-color" value="#f4212e">
      <label class="chk"><input type="checkbox" id="me-usecolor"> تخصيص اللون</label></div>
      <p class="hint">بدون تخصيص: لون الحدود حسب شدة الصراع تلقائيًا.</p></div>
    <div class="field"><label>الحالة المعلنة</label><select id="me-status">
      <option value="">بدون إعلان</option><option value="war">حالة حرب</option>
      <option value="emergency">حالة طوارئ</option><option value="peace">سلم</option></select></div>
    <div class="field"><label>عنوان الإعلان (اختياري)</label><input id="me-label" placeholder="مثال: الحرب العظمى"></div>
    <div class="me-btns">
      <button class="btn" onclick="mapSave()">${ICONS.checkSm} حفظ التعديل</button>
      <button class="btn ghost" onclick="mapDraw()">${ICONS.pen} رسم الحدود على الكرة</button>
      <button class="btn ghost" onclick="mapEditGeo()">${ICONS.doc} تحرير الإحداثيات</button>
      <button class="btn danger" onclick="mapDelete()">${ICONS.trash} حذف التعديل</button>
    </div>
    <p class="hint" id="me-drawhint" style="display:none">وضع الرسم مفعّل: انقر على الكرة لإضافة نقاط الحدود، ثم اضغط «إنهاء الرسم».</p>
    <button class="btn" id="me-finishdraw" style="display:none;margin-top:8px" onclick="mapFinishDraw()">إنهاء الرسم</button>
    <div id="me-geo" style="display:none;margin-top:10px"><div class="field"><label>GeoJSON للحدود (Polygon / MultiPolygon)</label>
      <textarea id="me-geotext" rows="5" dir="ltr" placeholder='{"type":"Polygon","coordinates":[[[lon,lat],...]]}'></textarea></div>
      <p class="hint">الإحداثيات بصيغة [خط الطول، خط العرض]. اتركه فارغًا لاستخدام حدود 1900 الأصلية.</p></div>
   </div></div>`;
  mapLoadCountry();
}
function mapLoadCountry() {
  const code = val('me-country');
  const s = (window._mstates || []).find((x) => x.country_code === code);
  document.getElementById('me-usecolor').checked = !!(s && s.color);
  document.getElementById('me-color').value = (s && s.color) || '#f4212e';
  document.getElementById('me-status').value = (s && s.status) || '';
  document.getElementById('me-label').value = (s && s.label) || '';
  const gt = document.getElementById('me-geotext');
  gt.value = (s && s.borders_geojson) || '';
  document.getElementById('me-geo').style.display = gt.value ? 'block' : 'none';
}
async function mapSave() {
  const body = {
    country_code: val('me-country'),
    color: document.getElementById('me-usecolor').checked ? document.getElementById('me-color').value : null,
    status: val('me-status') || null,
    label: val('me-label') || null,
    borders_geojson: val('me-geotext') || null,
  };
  try { await api('POST', '/api/map-states', body); alert('حُفظ تعديل الخريطة ✓'); vNews(); }
  catch (e) { alert(e.message); }
}
async function mapDelete() {
  const code = val('me-country');
  if (!confirm('حذف كل تعديلات هذه الدولة من الخريطة؟')) return;
  try { await api('DELETE', '/api/map-states/' + code); vNews(); }
  catch (e) { alert(e.message); }
}
async function mapEditGeo() {
  const code = val('me-country');
  try {
    const data = await loadBorders1900();
    const nm = GEO_NAME_OF[code];
    const f = data.features.find((x) => x.properties && x.properties.NAME === nm);
    if (!f) { alert('لا توجد حدود مسجلة لهذه الدولة في ملف 1900'); return; }
    const rr = (o) => Array.isArray(o) ? o.map(rr) : (typeof o === 'number' ? Math.round(o * 1000) / 1000 : o);
    const g = JSON.parse(JSON.stringify(f.geometry));
    g.coordinates = rr(g.coordinates);
    document.getElementById('me-geotext').value = JSON.stringify(g);
    document.getElementById('me-geo').style.display = 'block';
  } catch (e) { alert('تعذّر تحميل الحدود'); }
}
// --- رسم الحدود بالنقر على الكرة ---
let drawPts = [], drawLine = null, drawMarks = [], drawG = null;
function mapClearDrawObjs() {
  if (drawLine && drawG) { drawG.globe.remove(drawLine); drawLine = null; }
  if (drawG) drawMarks.forEach((m) => drawG.globe.remove(m));
  drawMarks = [];
}
function mapStopDraw() {
  const cv = document.getElementById('wglobe');
  if (cv) {
    cv._drawing = false; cv.style.cursor = '';
    if (cv._drawHandler) cv.removeEventListener('pointerdown', cv._drawHandler);
    const h = document.getElementById('me-drawhint'); if (h) h.style.display = 'none';
    const fb = document.getElementById('me-finishdraw'); if (fb) fb.style.display = 'none';
  }
}
function mapDraw() {
  const cv = document.getElementById('wglobe');
  const G = cv && cv._globe;
  if (!G || !window.THREE) { alert('الكرة ثلاثية الأبعاد غير جاهزة — حدّث الصفحة وحاول مجددًا'); return; }
  mapClearDrawObjs();
  drawPts = []; drawG = G;
  cv._drawing = true; cv.style.cursor = 'crosshair';
  document.getElementById('me-drawhint').style.display = 'block';
  document.getElementById('me-finishdraw').style.display = 'block';
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  cv._drawHandler = (e) => {
    const r = cv.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, G.camera);
    const hits = ray.intersectObject(G.globe.children[0]);
    if (!hits.length) return;
    const v = G.globe.worldToLocal(hits[0].point.clone()).normalize();
    const lat = Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI;
    const lon = Math.atan2(-v.z, v.x) * 180 / Math.PI;
    drawPts.push([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
    mapClearDrawObjs();
    const pts = drawPts.map(([lo, la]) => latLonToVec3(la, lo, 1.006));
    if (pts.length > 1) {
      drawLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x2aff5e }));
      G.globe.add(drawLine);
    }
    const mkGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const mkMat = new THREE.MeshBasicMaterial({ color: 0x2aff5e });
    drawMarks = pts.map((p) => { const m = new THREE.Mesh(mkGeo, mkMat); m.position.copy(p); G.globe.add(m); return m; });
  };
  cv.addEventListener('pointerdown', cv._drawHandler);
}
function mapFinishDraw() {
  if (drawPts.length < 3) { alert('ارسم 3 نقاط على الأقل'); return; }
  const ring = drawPts.slice();
  ring.push(ring[0].slice());
  document.getElementById('me-geotext').value = JSON.stringify({ type: 'Polygon', coordinates: [ring] });
  document.getElementById('me-geo').style.display = 'block';
  mapClearDrawObjs();
  mapStopDraw();
  alert('اكتمل الرسم — راجع الإحداثيات ثم اضغط «حفظ التعديل»');
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
        <div class="tw-head"><span data-user="${esc(a.author.username)}" style="cursor:pointer;display:inline-flex">${avHTML(a.author, 38)}</span>
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
    }).join('') : '<div class="empty"><span class="e-ic">' + ICONS.folder + '</span>لا توجد ملفات بعد — سيظهر ملف كل لاعب هنا فور تسجيله.</div>';
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
  const ach = (d.achievements || []).map((x) => `<div class="dos-row ach-row"><span class="dos-star">${ICONS.medal}</span></span><span>${esc(x)}</span></div>`).join('');
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
  const staff = me.role === 'admin' || me.role === 'system';
  // التبديل حصرًا: اللاعب الأمريكي (أدمن بدولة US) وحساب المطورين — لا أحد غيرهما
  const canSwitch = me.role === 'developer' || (me.role === 'admin' && me.country_code === 'US');
  const hqAccess = staff || me.role === 'developer'; // إدارة المنصة
  const [arts, disps] = await Promise.all([
    api('GET', '/articles?limit=100').catch(() => []), api('GET', '/dispatches?limit=100').catch(() => []),
  ]);
  const mine_a = arts.filter((a) => a.author.username === me.username).length;
  const mine_d = disps.filter((d) => d.author.username === me.username).length;
  app.innerHTML = `
    <div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
      <div class="thead-title" style="padding:0;display:flex;align-items:center;gap:6px">${esc(me.username)} ${me.role === 'admin' ? ICONS.checkGold : ICONS.check}</div></div>
    <div class="ig">
      <div class="ig-top">
        <div class="ig-ava">${me.avatar ? `<img src="${esc(me.avatar)}">` : c.flag}</div>
        <div class="ig-stats">
          <div><b>${mine_d}</b><span>برقية</span></div>
          <div><b>${mine_a}</b><span>مقال</span></div>
          <div><b>${disps.filter((d) => d.author.username === me.username && d.image).length + arts.filter((a) => a.author.username === me.username && a.image).length}</b><span>صورة</span></div>
        </div>
      </div>
      <div class="ig-id">
        <div class="ig-name">${esc(c.name)}</div>
        <div class="ig-handle">@${esc(me.username)}</div>
        <p class="ig-bio">${me.bio ? esc(me.bio) : `${c.flag} الحساب الرسمي لدولة ${esc(c.name)} في محاكاة أرجوس للتاريخ — 1900.`}</p>
        <div class="ig-meta"><span>${ICONS.pin} ${esc(c.name)}</span><span>${ICONS.cal} انضم ${timeAgo(me.created_at || Date.now())}</span>
          ${staff ? `<span>${ICONS.star} إدارة المقر</span>` : ''}${me.role === 'developer' ? `<span>${ICONS.zap} المطورون</span>` : ''}</div>
      </div>
      <div class="ig-actions">
        <a class="btn ghost" href="#/u/${esc(me.username)}" style="flex:1">بروفايلي العام</a>
        <button class="btn ghost" id="logoutBtn" style="flex:1">${ICONS.logout} خروج</button>
      </div>
    </div>
    <div class="ptabs">
      <button class="ptab active" data-pt="feed" title="منشوراتي">${ICONS.news}</button>
      <button class="ptab" data-pt="new-d" title="برقية جديدة">${ICONS.pen}</button>
      ${staff ? `<button class="ptab" data-pt="new-a" title="مقال جديد">${ICONS.doc}</button>` : ''}
      <button class="ptab" data-pt="edit" title="تعديل البروفايل">${ICONS.gear}</button>
      <button class="ptab" data-pt="dossier" title="ملفي الاستخباراتي">${ICONS.folder}</button>
      ${canSwitch ? `<button class="ptab" data-pt="switch" title="تبديل الحسابات">${ICONS.refresh}</button>` : ''}
      ${hqAccess ? `<button class="ptab" data-pt="admin" title="إدارة المنصة">${ICONS.shield}</button>` : ''}
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
      (mine_a.map((a) => rowItem(`${ICONS.doc} ${esc(a.title)} · ${timeAgo(a.created_at)}`, `delArticle(${a.id})`)).join('') || '<p class="hint" style="padding:0 18px">لا توجد مقالات.</p>') +
      `<div class="sec-h">برقياتي (${mine_d.length})</div>` +
      (mine_d.map((d) => rowItem(`${ICONS.news} ${esc(excerpt(d.body, 70))}`, `delDispatch(${d.id})`)).join('') || '<p class="hint" style="padding:0 18px">لا توجد برقيات.</p>');
  } else if (t === 'new-d') {
    const c = countryOf(me.country_code);
    body.innerHTML = `<div class="form-dark"><h2>برقية جديدة باسم ${c.flag} ${esc(c.name)}</h2><div id="msg"></div>
      <div class="field"><textarea id="dbody" maxlength="500" placeholder="بماذا تودّ أن تُصرّح؟ (500 حرف كحد أقصى)"></textarea></div>
      <div class="field"><label class="filebtn">${ICONS.img} إرفاق صورة (اختياري)<input id="dimg" type="file" accept="image/*" style="display:none"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendDispatch()">نشر البرقية</button></div>`;
  } else if (t === 'new-a') {
    const staff = me.role === 'admin' || me.role === 'system';
    if (!staff) { body.innerHTML = '<div class="form-dark"><div class="err">نشر المقالات حصرًا عبر حساب argos HQ.</div></div>'; return; }
    const cats = Object.entries(CATS);
    body.innerHTML = `<div class="form-dark"><h2>مقال جديد</h2><div id="msg"></div>
      <div class="field"><label>القسم</label><select id="acat">${cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>العنوان</label><input id="atitle"></div>
      <div class="field"><label>نص المقال</label><textarea id="abody" style="min-height:220px" placeholder="اكتب سيناريو المعركة أو الحدث بالتفصيل…"></textarea></div>
      <div class="field"><label class="filebtn">${ICONS.img} صورة المقال (اختياري)<input id="aimg" type="file" accept="image/*" style="display:none"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendArticle()">نشر المقال</button></div>`;
  } else if (t === 'edit') {
    body.innerHTML = `<div class="form-dark"><h2>تعديل البروفايل</h2><div id="msg"></div>
      <div class="field"><label>الصورة الشخصية</label>
        <div class="pav-row">
          <span id="pavprev">${avHTML(me, 64)}</span>
          <label class="filebtn">${ICONS.img} اختر صورة<input id="pavatar" type="file" accept="image/*" style="display:none"></label>
          <button class="btn ghost" id="pavrm" style="width:auto;padding:8px 16px">إزالة</button>
        </div>
        <input id="pavatarurl" type="hidden" value="${esc(me.avatar || '')}"></div>
      <div class="field"><label>النبذة التعريفية (البايو) — 160 حرفًا كحد أقصى</label>
        <textarea id="pbio" maxlength="160" placeholder="عرّف بنفسك وبمشروع دولتك…">${esc(me.bio || '')}</textarea></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="saveProfile()">حفظ البروفايل</button>
      <a class="btn ghost" href="#/u/${esc(me.username)}" style="margin-inline-start:8px">معاينة بروفايلي</a></div>`;
    document.getElementById('pavatar').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const m2 = (tx, ok) => { const m = document.getElementById('msg'); if (m) m.innerHTML = tx ? `<div class="${ok ? 'ok' : 'err'}">${esc(tx)}</div>` : ''; };
      try {
        m2('جارٍ رفع الصورة…', true);
        const url = await uploadImage(f);
        document.getElementById('pavatarurl').value = url;
        document.getElementById('pavprev').innerHTML = avHTML({ avatar: url }, 64);
        m2('', true);
      } catch (err) { m2(err.message, false); }
    };
    document.getElementById('pavrm').onclick = () => {
      document.getElementById('pavatarurl').value = '';
      document.getElementById('pavprev').innerHTML = avHTML({ country_code: me.country_code }, 64);
    };
  } else if (t === 'switch') {
    renderSwitchTab(body);
  } else if (t === 'admin') {
    renderAdminTab(body);
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
// ---------- تبديل الحسابات (إدارة المقر) ----------
function getSavedAccounts() {
  try { return JSON.parse(localStorage.getItem('argos_switch') || '[]'); } catch { return []; }
}
function saveAccounts(list) { localStorage.setItem('argos_switch', JSON.stringify(list)); }
function renderSwitchTab(body) {
  const list = getSavedAccounts();
  body.innerHTML = `<div class="form-dark"><h2>${ICONS.refresh} تبديل الحسابات</h2>
    <p class="hint">احفظ حساباتك هنا وانتقل بينها بضغطة واحدة.</p>
    <div>` + (list.length ? list.map((a, i) => `
      <div class="row-item"><span class="grow">${ICONS.user} ${esc(a.username)}${a.username === me.username ? ' <b>(الحالي)</b>' : ''}</span>
      ${a.username === me.username ? '' : `<button class="btn" style="width:auto;padding:8px 18px" onclick="switchToAccount(${i})">دخول</button>`}
      <button class="btn ghost" style="width:auto;padding:8px 14px" onclick="removeAccount(${i})">✕</button></div>`).join('')
      : '<p class="hint">لا توجد حسابات محفوظة بعد.</p>') + `</div>
    <button class="btn" style="width:auto;padding:12px 32px;margin-top:12px" onclick="saveCurrentAccount()">${ICONS.bookmark} حفظ الحساب الحالي (@${esc(me.username)})</button>
  </div>`;
}
async function saveCurrentAccount() {
  try {
    const r = await api('POST', '/account-token');
    const list = getSavedAccounts().filter((a) => a.username !== r.username);
    list.push({ username: r.username, token: r.token });
    saveAccounts(list);
    dashTab('switch');
  } catch (e) { msg(e.message, false); }
}
function switchToAccount(i) {
  const a = getSavedAccounts()[i]; if (!a) return;
  document.cookie = `session=${encodeURIComponent(a.token)}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`;
  location.reload();
}
function removeAccount(i) {
  const list = getSavedAccounts(); list.splice(i, 1); saveAccounts(list); dashTab('switch');
}
// ---------- إدارة المنصة (حظر/طرد) ----------
async function renderAdminTab(body) {
  body.innerHTML = '<div class="spin"></div>';
  let users = [];
  try { users = await api('GET', '/admin/users'); }
  catch (e) { body.innerHTML = `<div class="form-dark"><div class="err">${esc(e.message)}</div></div>`; return; }
  body.innerHTML = `<div class="form-dark"><h2>${ICONS.shield} إدارة المنصة</h2>
    <div class="sec-h">حساب argos HQ</div>
    <p class="hint">البريد: <b dir="ltr">hq@argos.internal</b> — عيّن كلمة السر ثم سجّل الدخول به من صفحة الدخول، واحفظه في «تبديل الحسابات».</p>
    <div id="msg"></div>
    <div class="field"><label>كلمة سر جديدة لحساب argos HQ</label>
      <input id="hqpass" type="password" placeholder="6 أحرف على الأقل" autocomplete="new-password"></div>
    <button class="btn" style="width:auto;padding:10px 32px" onclick="setHqPassword()">تعيين كلمة السر</button>
    <div class="sec-h" style="margin-top:18px">حساب المطورين ARGOS HQ</div>
    <p class="hint">البريد: <b dir="ltr">dev@argos.internal</b> — الحساب الكامل للمطورين: تشغيل ساعة اللعبة وإدارة المنصة. المسؤول الوحيد عنه هو اللاعب الأمريكي.</p>
    <div class="field"><label>كلمة سر جديدة لحساب المطورين</label>
      <input id="devpass" type="password" placeholder="6 أحرف على الأقل" autocomplete="new-password"></div>
    <button class="btn" style="width:auto;padding:10px 32px" onclick="setDevPassword()">تعيين كلمة السر</button>
    <div class="sec-h" style="margin-top:18px">المستخدمون (${users.length})</div>
    <div>` + (users.map((u) => {
      const c = countryOf(u.country_code);
      const roleTag = u.role === 'admin' ? ` · ${ICONS.star} أدمن` : u.role === 'developer' ? ` · ${ICONS.zap} المطورون` : '';
      const actions = u.role === 'developer'
        ? `<span class="hint">${ICONS.zap} حساب المطورين — محمي من الحظر والطرد</span>`
        : (u.banned
          ? `<button class="btn" style="width:auto;padding:8px 14px" onclick="unbanUser(${u.id})">إلغاء الحظر</button>`
          : `<button class="btn danger" style="width:auto;padding:8px 14px" onclick="banUser(${u.id},'${esc(u.username)}')">${ICONS.ban} حظر</button>`)
          + `<button class="btn danger" style="width:auto;padding:8px 14px" onclick="kickUser(${u.id},'${esc(u.username)}')">${ICONS.trash} طرد</button>`;
      return `<div class="row-item"><span class="grow">${c.flag} <b>${esc(u.username)}</b> <span class="hint">${esc(c.name)}${roleTag}${u.banned ? ` · ${ICONS.ban} محظور` : ''}</span></span>${actions}</div>`;
    }).join('') || '<p class="hint">لا يوجد مستخدمون.</p>') + `</div></div>`;
}
async function setHqPassword() {
  const p = document.getElementById('hqpass').value;
  try {
    await api('POST', '/admin/hq-password', { password: p });
    msg('تم تعيين كلمة سر argos HQ ✓', true);
    document.getElementById('hqpass').value = '';
  } catch (e) { msg(e.message, false); }
}
async function setDevPassword() {
  const p = document.getElementById('devpass').value;
  try {
    await api('POST', '/admin/dev-password', { password: p });
    msg('تم تعيين كلمة سر حساب المطورين ✓', true);
    document.getElementById('devpass').value = '';
  } catch (e) { msg(e.message, false); }
}
async function banUser(id, name) {
  if (!confirm(`حظر ${name} من المنصة؟ سيُطرد من جلساته فورًا.`)) return;
  try { await api('POST', '/admin/ban', { user_id: id }); dashTab('admin'); }
  catch (e) { alert(e.message); }
}
async function unbanUser(id) {
  try { await api('POST', '/admin/unban', { user_id: id }); dashTab('admin'); }
  catch (e) { alert(e.message); }
}
async function kickUser(id, name) {
  if (!confirm(`طرد ${name} نهائيًا مع حذف كل محتواه؟ لا يمكن التراجع!`)) return;
  try { await api('DELETE', `/admin/users/${id}`); dashTab('admin'); }
  catch (e) { alert(e.message); }
}
async function saveProfile() {
  try {
    const r = await api('POST', '/profile', { bio: val('pbio'), avatar: document.getElementById('pavatarurl').value });
    me.bio = r.bio; me.avatar = r.avatar;
    msg('تم حفظ البروفايل ✓', true);
    renderNav(navKey(location.hash || '#/'));
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
    <div class="field"><label>${ICONS.medal} الإنجازات (سطر لكل إنجاز)</label>
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
    ${me ? `<div class="cform">${avHTML(me, 38)}
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
      return `<div class="comment">${avHTML(cm.author, 38)}
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
      items += `<div class="story" data-suser="${esc(mine.user.username)}"><span class="s-ring seen">${mine.user.avatar ? `<img class="ring-img" src="${esc(mine.user.avatar)}">` : c.flag}</span><span class="s-name">${esc(mine.user.username)}</span></div>`;
    }
  }
  for (const g of STORY_GROUPS) {
    if (me && g.user.username === me.username) continue;
    const c = countryOf(g.user.country_code);
    items += `<div class="story" data-suser="${esc(g.user.username)}"><span class="s-ring">${g.user.avatar ? `<img class="ring-img" src="${esc(g.user.avatar)}">` : c.flag}</span><span class="s-name">${esc(g.user.username)}</span></div>`;
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
    <p class="hint">الستوري يختفي تلقائيًا بعد 24 ساعة</p>
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
      <div class="sv-head">${avHTML(g.user)}
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
    const badge = user.role === 'admin' ? ICONS.checkGold : user.role !== 'player' ? ICONS.check : '';
    let ds = [], as = [];
    try {
      const [dAll, aAll] = await Promise.all([
        api('GET', '/dispatches?limit=100'), api('GET', '/articles?limit=100'),
      ]);
      ds = dAll.filter((d) => d.author.username === username);
      as = aAll.filter((a) => a.author.username === username);
    } catch (e) {}
    const pics = [
      ...ds.filter((d) => d.image).map((d) => ({ kind: 'd', id: d.id, image: d.image, ts: d.created_at })),
      ...as.filter((a) => a.image).map((a) => ({ kind: 'a', id: a.id, image: a.image, ts: a.created_at })),
    ].sort((x, y) => y.ts - x.ts);
    app.innerHTML = `
      <div class="backrow"><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
        <div class="thead-title" style="padding:0;display:flex;align-items:center;gap:6px">${esc(user.username)} ${badge}</div></div>
      <div class="ig">
        <div class="ig-top">
          <div class="ig-ava">${user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : c.flag}</div>
          <div class="ig-stats">
            <div><b>${stats.dispatches}</b><span>برقية</span></div>
            <div><b>${stats.articles}</b><span>مقال</span></div>
            <div><b>${pics.length}</b><span>صورة</span></div>
          </div>
        </div>
        <div class="ig-id">
          <div class="ig-name">${esc(c.name)}</div>
          <div class="ig-handle">@${esc(user.username)}</div>
          ${user.bio ? `<p class="ig-bio">${esc(user.bio)}</p>`
            : isMine ? `<p class="ig-bio" style="opacity:.5">أضف نبذة تعريفية (بايو) من حسابك…</p>` : ''}
          <div class="ig-meta"><span>${ICONS.pin} ${esc(c.name)}</span><span>${ICONS.cal} انضم ${timeAgo(user.created_at)}</span>
            ${user.role === 'admin' ? `<span>${ICONS.star} إدارة المقر</span>` : ''}${user.role === 'developer' ? `<span>${ICONS.zap} المطورون</span>` : ''}</div>
        </div>
        <div class="ig-actions">
          ${isMine ? `<a class="btn" href="#/dash" style="flex:1">تعديل البروفايل</a>`
            : `${me ? `<a class="btn" href="#/messages/${esc(user.username)}" style="flex:1">${ICONS.send} مراسلة</a>` : ''}
               <a class="btn ghost" href="#/dossier/${esc(user.username)}" style="flex:1">${ICONS.folder} الملف الاستخباراتي</a>`}
        </div>
        <div class="ig-tabs">
          <button class="ig-tab active" data-pt="grid" title="الصور">${ICONS.grid}</button>
          <button class="ig-tab" data-pt="list" title="المنشورات">${ICONS.list}</button>
        </div>
        <div id="pfeed"></div>
      </div>`;
    const tabs = app.querySelectorAll('[data-pt]');
    const load = async (kind) => {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.pt === kind));
      const feed = document.getElementById('pfeed');
      if (kind === 'grid') {
        feed.innerHTML = pics.length ? `<div class="ig-grid">${pics.map((p) =>
          `<a class="ig-tile" href="${p.kind === 'd' ? '#/d/' + p.id : '#/article/' + p.id}"><img src="${esc(p.image)}" loading="lazy" alt=""></a>`
        ).join('')}</div>` : '<div class="empty">لا توجد صور بعد.</div>';
        return;
      }
      feed.innerHTML = '<div class="spin"></div>';
      const mixed = [...ds.map((d) => ({ ts: d.created_at, h: tweetHTML(d) })), ...as.map((a) => ({ ts: a.created_at, h: articleCardHTML(a) }))]
        .sort((x, y) => y.ts - x.ts);
      feed.innerHTML = mixed.length ? mixed.map((x) => x.h).join('') : '<div class="empty">لا توجد منشورات.</div>';
      bindFeed(); hydrateEngagement('dispatch'); hydrateEngagement('article');
    };
    tabs.forEach((t) => t.onclick = () => load(t.dataset.pt));
    await load('grid');
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- التوجيه ----------
function navKey(h) {
  if (h === '#/' || h === '') return '#/';
  if (h.startsWith('#/cat/')) return '#/cat/' + h.split('/')[2];
  if (h === '#/dispatches' || h === '#/dossiers' || h === '#/news' || h === '#/dash' || h === '#/login' || h === '#/messages') return h;
  if (h.startsWith('#/messages/')) return '#/messages';
  if (h.startsWith('#/d/')) return '#/dispatches';
  return null;
}
async function route() {
  clearMsgTimer(); clearClock();
  const h = location.hash || '#/';
  renderNav(navKey(h));
  try {
    if (h === '#/' || h === '') await vHome();
    else if (h.startsWith('#/cat/')) await vCat(h.split('/')[2]);
    else if (h.startsWith('#/article/')) await vArticle(h.split('/')[2]);
    else if (h.startsWith('#/d/')) await vDispatch(h.split('/')[2]);
    else if (h.startsWith('#/u/')) await vUser(decodeURIComponent(h.split('/')[2] || ''));
    else if (h.startsWith('#/messages/')) await vThread(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/messages') await vMessages();
    else if (h === '#/dispatches') await vDispatches();
    else if (h === '#/dossiers') await vDossiers();
    else if (h === '#/news') await vNews();
    else if (h.startsWith('#/dossier/')) await vDossier(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/login') vLogin();
    else if (h === '#/register') await vRegister();
    else if (h === '#/dash') await vDash();
    else await vHome();
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}

// ---------- الرسائل الخاصة (ماسنجر) ----------
let MSG_TIMER = null;
function clearMsgTimer() { if (MSG_TIMER) { clearInterval(MSG_TIMER); MSG_TIMER = null; } }
// عارض صور مكبر
function openViewer(src) {
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="viewer-card"><img src="${esc(src)}"><button class="m-x" id="vx">✕</button></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  document.getElementById('vx').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
}

async function vMessages() {
  if (!me) { location.hash = '#/login'; return; }
  app.innerHTML = thead('الرسائل')
    + `<button class="btn" id="newmsg" style="width:auto;padding:10px 24px;margin:12px 18px">✉️ رسالة جديدة</button>
    <div id="convlist"><div class="spin"></div></div>`;
  document.getElementById('newmsg').onclick = openNewMsg;
  const load = async () => {
    try {
      const list = await api('GET', '/conversations');
      const box = document.getElementById('convlist');
      if (!box) return;
      box.innerHTML = list.length ? list.map((cv) => `
        <a class="conv" href="#/messages/${esc(cv.user.username)}">
          ${avHTML(cv.user, 52)}
          <span class="conv-tx"><span class="conv-top"><b class="conv-name">${esc(cv.user.username)}</b><span class="tw-handle">${timeAgo(cv.last.created_at)}</span></span>
          <span class="conv-last">${cv.last.mine ? 'أنت: ' : ''}${cv.last.image ? ICONS.camera + ' صورة' : esc(excerpt(cv.last.body, 55))}</span></span>
          ${cv.unread ? `<span class="unread">${cv.unread}</span>` : ''}
        </a>`).join('')
        : '<div class="empty"><span class="e-ic">✉️</span>لا توجد محادثات بعد.<br>ابدأ رسالة جديدة وتحدث مع اللاعبين.</div>';
    } catch (e) { /* صامت */ }
  };
  await load();
  clearMsgTimer();
  MSG_TIMER = setInterval(load, 5000);
}

async function openNewMsg() {
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal-card"><div class="m-head"><b>رسالة جديدة</b><button class="m-x" id="nmx">✕</button></div>
    <input id="nmq" class="m-input" placeholder="ابحث عن لاعب…">
    <div id="nmlist"><div class="spin"></div></div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  document.getElementById('nmx').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  let users = [];
  try { users = await api('GET', '/users'); } catch (e) { users = []; }
  const list = document.getElementById('nmlist');
  const draw = (q) => {
    const f = users.filter((u) => !q || u.username.includes(q));
    list.innerHTML = f.length ? f.map((u) => `
      <div class="conv" data-u="${esc(u.username)}" style="cursor:pointer">
        ${avHTML(u, 44)}
        <span class="conv-tx"><b class="conv-name">${esc(u.username)}</b>
        <span class="conv-last">${esc(countryOf(u.country_code).name)}</span></span>
      </div>`).join('')
      : '<div class="empty">لا يوجد لاعبون بعد.</div>';
    list.querySelectorAll('.conv').forEach((el) => {
      el.onclick = () => { close(); location.hash = '#/messages/' + encodeURIComponent(el.dataset.u); };
    });
  };
  draw('');
  document.getElementById('nmq').oninput = (e) => draw(e.target.value.trim());
}

async function vThread(username) {
  if (!me) { location.hash = '#/login'; return; }
  clearMsgTimer();
  app.innerHTML = `<div class="th-head">
      <button class="backbtn" onclick="location.hash='#/messages'">${ICONS.back}</button>
      <div id="thuser"><div class="spin" style="width:24px;height:24px"></div></div>
    </div>
    <div id="thread" class="thread"><div class="spin"></div></div>
    <div class="c-prev" id="tprev" style="display:none"><img id="tprevimg"><button id="tpremx">✕</button></div>
    <div class="cform tform">
      <button class="c-ic" id="timgbtn" title="صورة">${ICONS.img}</button>
      <input type="file" id="timg" accept="image/*" style="display:none">
      <input id="tinput" maxlength="1000" placeholder="اكتب رسالة…" autocomplete="off">
      <button class="c-post" id="tsend">إرسال</button>
    </div>`;
  const thread = document.getElementById('thread');
  const input = document.getElementById('tinput');
  let lastId = 0;
  const bHTML = (m) => {
    const mine = m.sender === me.username;
    return `<div class="msg ${mine ? 'mine' : 'theirs'}">
      ${m.image ? `<img class="msg-img" src="${esc(m.image)}" onclick="openViewer('${esc(m.image)}')">` : ''}
      ${m.body ? `<div class="bubble">${esc(m.body)}</div>` : ''}
      <span class="msg-t">${timeAgo(m.created_at)}</span>
    </div>`;
  };
  const scroll = () => { thread.scrollTop = thread.scrollHeight; };
  const load = async (first) => {
    try {
      const d = await api('GET', '/messages/' + encodeURIComponent(username));
      if (!document.getElementById('thread')) return;
      document.getElementById('thuser').innerHTML = `<a class="th-u" href="#/u/${esc(d.user.username)}">
        ${avHTML(d.user, 40)}<span class="th-un"><b>${esc(d.user.username)}</b><span class="tw-handle">${esc(countryOf(d.user.country_code).name)}</span></span></a>`;
      const msgs = d.messages || [];
      if (first || (msgs.length && msgs[msgs.length - 1].id !== lastId)) {
        thread.innerHTML = msgs.length ? msgs.map(bHTML).join('') : '<div class="empty">ابدأ المحادثة</div>';
        lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
        scroll();
      }
    } catch (e) { if (first) thread.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  const send = async () => {
    const body = input.value.trim();
    const pv = document.getElementById('tprev');
    const img = pv.style.display !== 'none' ? (document.getElementById('tprevimg').dataset.url || '') : '';
    if (!body && !img) return;
    input.value = '';
    pv.style.display = 'none';
    try {
      await api('POST', '/messages', { to: username, body, image: img });
      await load(true);
    } catch (e) { alert(e.message); }
  };
  document.getElementById('tsend').onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  document.getElementById('timgbtn').onclick = () => document.getElementById('timg').click();
  document.getElementById('timg').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const url = await uploadImage(f);
      const pi = document.getElementById('tprevimg');
      pi.src = url; pi.dataset.url = url;
      document.getElementById('tprev').style.display = 'block';
    } catch (err) { alert(err.message); }
  };
  document.getElementById('tpremx').onclick = () => { document.getElementById('tprev').style.display = 'none'; };
  await load(true);
  MSG_TIMER = setInterval(() => load(false), 4000);
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
    app.innerHTML = `<div class="empty"><span class="e-ic">${ICONS.alert}</span>تعذّر الاتصال بالخادم.<br>${esc(e.message)}</div>`;
  }
}
boot();
