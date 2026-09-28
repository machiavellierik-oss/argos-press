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
  coin: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.2 9.8c0-1.2 1.2-2 2.8-2s2.8.8 2.8 2-1 1.7-2.8 2.3-2.8 1.1-2.8 2.3 1.2 2.1 2.8 2.1 2.8-.9 2.8-2.1"/>'),
  swords: I('<path d="M6 20L18 8"/><path d="M18 20L6 8"/><path d="M15.5 5.5l3 3M8.5 5.5l-3 3"/>'),
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
// تنبيه عائم بسيط — كان مستخدمًا في عدة مواضع دون تعريف (يسبب ReferenceError)
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:#1c2333;color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;z-index:9999;opacity:0;transition:opacity .25s;max-width:90vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    document.body.appendChild(t);
  }
  t.textContent = String(msg ?? '');
  t.style.opacity = '1';
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}
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

// ---------- القائمة الجانبية (درج بأقسام) والودجت ----------
const NAV_SECTIONS = [
  { t: '', links: [['#/', 'الرئيسية', 'home']] },
  { t: 'الحرب', links: [['#/news', 'غرفة الحرب', 'globe'], ['#/wars', 'الحروب', 'swords'], ['#/workshop', 'مختبر الأسلحة', 'zap'], ['#/diplomacy', 'الدبلوماسية', 'doc'], ['#/intel', 'الاستخبارات', 'search']] },
  { t: 'المستشار', links: [['#/advisor', 'المستشار', 'shield'], ['#/cabinet', 'مجلس الوزراء', 'users']] },
  { t: 'الاقتصاد', links: [['#/economy', 'الاقتصاد والسكان', 'coin']] },
  { t: 'التجارة', links: [['#/market', 'السوق العام', 'swords']] },
  { t: 'الإعلام', links: [
    ['#/dispatches', 'البرقيات', 'chat'],
    ['#/cat/official', 'بيانات رسمية', 'mega'],
    ['#/cat/war', 'سيناريوهات الحروب', 'zap'],
    ['#/cat/events', 'أحداث اللعبة', 'cal'],
    ['#/dossiers', 'ملفات العملاء', 'folder'],
  ]},
  { t: 'التواصل', links: [
    ['#/messages', 'الرسائل', 'mail'],
    ['#/notifications', 'الإشعارات', 'bell'],
  ]},
];
function closeNav() { document.body.classList.remove('nav-open'); }
function renderNav(active) {
  const nav = document.getElementById('mainnav');
  const dashLink = me ? ['#/dash', 'حسابي', 'user'] : ['#/login', 'دخول', 'user'];
  const link = ([h, t, ic]) =>
    `<a class="nav-link${h === active ? ' active' : ''}" href="${h}" onclick="closeNav()">${ICONS[ic]}<span>${t}</span></a>`;
  nav.innerHTML = NAV_SECTIONS.map((s2) =>
    (s2.t ? `<div class="nav-sec-t">${s2.t}</div>` : '') + s2.links.map(link).join('')
  ).join('') + `<div class="nav-sec-t">الحساب</div>` + link(dashLink);
  const bn = document.getElementById('bottomnav');
  const L = (h) => NAV_SECTIONS.flatMap((s2) => s2.links).find((n) => n[0] === h);
  bn.innerHTML = [L('#/'), L('#/news'), L('#/market'), L('#/messages'), dashLink]
    .map(([h, , ic]) => `<a class="${h === active ? 'active' : ''}" href="${h}">${ICONS[ic]}</a>`).join('');
  refreshNotifBadge();
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
const MENU_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const thead = (title, tabs) => `<div class="thead"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><div class="thead-title">${title}</div>
  ${tabs ? `<div class="ttabs">${tabs}</div>` : ''}
  <a href="#/notifications" class="nbell" id="nbell" title="الإشعارات">${ICONS.bell}<span class="unread" id="nbell-n" style="display:none"></span></a></div>`;

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
        <input type="file" id="cimg" accept="image/*" class="a11y-hidden">
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
  try { clockState = await api('POST', '/clock/start'); alert('بدأت الساعة ✓'); }
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
          <p>الكرة تعرض الحروب النشطة والمستعمرات لحظة بلحظة — الأحمر دولة في حرب، والقرمزي مستعمَرة.</p>
          <div class="war-legend">
            <span><i class="dot" style="background:#f4212e"></i>في حرب</span>
            <span><i class="dot" style="background:#8e1e2f"></i>مستعمَرة</span>
            <span><i class="dot" style="background:transparent;border:1.5px dashed #f4212e"></i>أراضٍ محتلة</span>
            <span class="hint">لون حدود كل دولة = حالتها</span>
          </div>
        </div>
      </div>
      <div id="clockbox"></div>
      <div id="mapeditor"></div>
      <div class="war-sec"><div class="war-sec-t">${ICONS.swords} الحروب النشطة</div><div id="wactivewars"><div class="spin"></div></div>
        <p class="hint" style="margin-top:8px"><a href="#/wars">إدارة الحروب والمعارك ←</a></p></div>
      <div class="war-sec"><div class="war-sec-t" id="army-sec-t">جيش دولتك — تعداد 1900</div><p class="hint" id="army-sec-hint" style="margin:0 0 10px"></p><div id="warmies"><div class="spin"></div></div></div>
      <div id="armymgr"></div>`;
  let wars = [], mstates = [], colonies = [];
  try { const d = await api('GET', '/wars'); wars = (d.wars || []).filter((w) => w.status === 'active'); }
  catch (e) { /* يبقى فارغًا */ }
  try { const m = await api('GET', '/map-states'); mstates = m.states || []; }
  catch (e) { /* يبقى فارغًا */ }
  try { const c = await api('GET', '/colonies'); colonies = c.colonies || []; }
  catch (e) { /* يبقى فارغًا */ }
  initGlobe({ wars, colonies }, mstates);
  renderActiveWarsMini(wars);
  if (me && me.role === 'developer') renderMapEditor(mstates);
  await renderArmiesSection();
  if (me && me.role === 'developer') renderArmyManager();
  mountClock(document.getElementById('clockbox'));
}
function hpBar(hp, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((hp / max) * 100))) : 0;
  const col = pct > 60 ? '#3ddc84' : pct > 30 ? '#ffb020' : '#f4212e';
  return `<span class="hp-wrap" title="نقاط الصحة: ${hp}/${max}"><span class="hp-bar"><i style="width:${pct}%;background:${col}"></i></span><span class="hp-num" dir="ltr">${hp}/${max}</span></span>`;
}
function renderActiveWarsMini(wars) {
  const el = document.getElementById('wactivewars'); if (!el) return;
  if (!wars.length) { el.innerHTML = '<div class="empty">لا حروب نشطة — العالم يعيش سلامًا هشًا.</div>'; return; }
  el.innerHTML = '<div class="wpn-grid">' + wars.slice(0, 6).map((w) => {
    const a = countryOf(w.attacker_code), df = countryOf(w.defender_code);
    return `<div class="wpn-card"><div class="wpn-tx"><b>${a.flag} ${esc(w.attacker_name)} <span class="hint">ضد</span> ${df.flag} ${esc(w.defender_name)}</b>`
      + `<span class="hint">${a.flag} ${hpBar(w.attacker_hp.hp, w.attacker_hp.max_hp)}</span>`
      + `<span class="hint">${df.flag} ${hpBar(w.defender_hp.hp, w.defender_hp.max_hp)}</span>`
      + `</div></div>`;
  }).join('') + '</div>';
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
function initGlobe(warInfo, mstates) {
  const cv = document.getElementById('wglobe'); if (!cv) return;
  loadThree(() => { try { initGlobe3D(cv, warInfo, mstates); } catch (e) { initGlobeFallback(cv, warInfo); } },
            () => initGlobeFallback(cv, warInfo));
}
function initGlobe3D(cv, warInfo, mstates) {
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
  // توهج الغلاف الجوي — طبقتان: هالة داخلية ساطعة وهالة خارجية خافتة لعمق سينمائي
  const atmInner = new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 72, 72),
    new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x3d9fe0) } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; uniform vec3 c; void main(){ float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.5); gl_FragColor = vec4(c, 1.0) * i * 1.35; }',
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
    })
  );
  globe.add(atmInner);
  const atmOuter = new THREE.Mesh(
    new THREE.SphereGeometry(1.32, 72, 72),
    new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(0x1e5f9e) } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vN; uniform vec3 c; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.0, 0.0, 1.0))), 4.0); gl_FragColor = vec4(c, 1.0) * i * 0.5; }',
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
    })
  );
  globe.add(atmOuter);
  // نجوم — طبقتان بأحجام وألوان متباينة لعمق أكبر
  const mkStars = (n, color, size, op) => {
    const sp = [];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue; }
      v.normalize().multiplyScalar(25 + Math.random() * 40);
      sp.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: op })));
  };
  mkStars(420, 0x8aa8c8, 0.085, 0.7);
  mkStars(90, 0xd8c9a8, 0.13, 0.55);
  // حدود سنة 1900: تلوين حسب حالة الحرب — أحمر = في حرب، قرمزي = مستعمَرة
  // (تعديلات المطورين: لون مخصص وحدود مرسومة تتفوق على التلقائي)
  const CODE_OF = {};
  Object.entries(GEO_NAME_OF).forEach(([c, n]) => { CODE_OF[n] = c; });
  const wi = warInfo || {};
  const wars = wi.wars || [];
  const colonySet = new Set((wi.colonies || []).map((c) => c.colony_code));
  const warSet = new Set();
  wars.forEach((w) => { warSet.add(w.attacker_code); warSet.add(w.defender_code); });
  const ovByCode = {};
  (mstates || []).forEach((s) => { ovByCode[s.country_code] = s; });
  const finalColor = (code) => {
    const ov = ovByCode[code];
    if (ov && ov.color) return ov.color;
    if (colonySet.has(code)) return '#8e1e2f';
    if (warSet.has(code)) return '#f4212e';
    return null;
  };
  loadBorders1900().then((data) => {
    if (!document.body.contains(cv)) return;
    globe.add(buildBorderLines(data, (nm, isP) => !isP, 1.002, 0x6b7f93, 0.5));
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
      (nm, isP) => isP && !skipNames.has(nm) && !finalColor(CODE_OF[nm]), 1.004, 0xa3b4c4, 0.62));
    // حدود مرسومة يدويًا من المطورين
    (mstates || []).forEach((s) => {
      if (!s.borders_geojson) return;
      try {
        const col = finalColor(s.country_code) || '#8a97a5';
        globe.add(buildCustomLines(JSON.parse(s.borders_geojson), 1.004, parseInt(col.slice(1), 16), 0.95));
      } catch (e) {}
    });
    // الأراضي المحتلة: تُرسم بخط أحمر متقطع عندما يكون المحتل في حالة حرب/طوارئ
    const OCC = (typeof OCCUPIED_TERRITORIES !== 'undefined') ? OCCUPIED_TERRITORIES : [];
    const occByOccupier = {};
    OCC.forEach((t) => { (occByOccupier[t.occupier] = occByOccupier[t.occupier] || []).push(t); });
    (mstates || []).forEach((s) => {
      if (s.status !== 'war' && s.status !== 'emergency') return;
      const list = occByOccupier[s.country_code] || [];
      if (!list.length) return;
      const col = s.status === 'war' ? 0xf4212e : 0xff9f0a;
      list.forEach((t) => {
        try {
          let geom = t.geom;
          if (!geom && t.ref) {
            const f = data.features.find((x) => x.properties && x.properties.NAME === t.ref);
            if (f) geom = f.geometry;
          }
          if (!geom) return;
          const lines = buildCustomLines(geom, 1.005, col, 1);
          lines.material = new THREE.LineDashedMaterial({ color: col, dashSize: 0.02, gapSize: 0.012, transparent: true, opacity: 1 });
          lines.computeLineDistances();
          globe.add(lines);
        } catch (e) {}
      });
    });
  }).catch(() => {});
  // علامات الدول المتحاربة — نابضة مع حلقات صدمة
  const glowTex = makeGlowTexture();
  const markers = [];
  const shockRings = [];
  const addMarker = (lat, lon, col) => {
    if (lat == null || lon == null) return;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    halo.position.copy(latLonToVec3(lat, lon, 1.004));
    halo.scale.setScalar(0.22);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.position.copy(halo.position);
    core.scale.setScalar(0.07);
    globe.add(halo); globe.add(core);
    markers.push({ halo, phase: Math.random() * 6.28 });
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    ring.position.copy(halo.position);
    ring.scale.setScalar(0.25);
    globe.add(ring);
    shockRings.push({ ring, t: Math.random() });
  };
  wars.forEach((w) => {
    addMarker(w.attacker_lat, w.attacker_lon, 0xf4212e);
    addMarker(w.defender_lat, w.defender_lon, 0xf4212e);
  });
  // علامات إعلانات المطورين: حالة حرب / طوارئ (حتى للدول الهادئة)
  (mstates || []).forEach((s) => {
    if ((s.status === 'war' || s.status === 'emergency' || s.status === 'revolt') && s.lat != null && s.lon != null) {
      const col = s.status === 'emergency' ? 0xff9f0a : 0xf4212e;
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
    shockRings.forEach((rg) => {
      rg.t += 0.014; if (rg.t > 1) rg.t = 0;
      rg.ring.scale.setScalar(0.22 + rg.t * 0.55);
      rg.ring.material.opacity = 0.75 * (1 - rg.t);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}
// بديل بسيط لو تعذّر تحميل Three.js
function initGlobeFallback(cv, warInfo) {
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
  const SEVC = { war: '#f4212e' };
  const warPts = [];
  ((warInfo && warInfo.wars) || []).forEach((w) => {
    if (w.attacker_lat != null) warPts.push([w.attacker_lat, w.attacker_lon]);
    if (w.defender_lat != null) warPts.push([w.defender_lat, w.defender_lon]);
  });
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
    for (const pt of warPts) {
      const la = pt[0] * Math.PI / 180, lo = pt[1] * Math.PI / 180;
      const p = proj(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
      if (p[2] < 0.02) continue;
      const col = SEVC.war;
      const pulse = (Math.sin(t * 2.2) + 1) / 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], (4 + pulse * 5) * dpr, 0, 7);
      ctx.fillStyle = col + '2e'; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * dpr, 0, 7);
      ctx.fillStyle = col; ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
}

// ---------- جيوش الدول وتسليح 1900 ----------
const fmtArmy = (n) => Number(n || 0).toLocaleString('en-US');
const CONF_LBL = { documented: 'موثق', estimate: 'تقدير', unknown: 'غير موثق' };
const confBadge = (c) => `<span class="conf-badge conf-${c || 'unknown'}">${CONF_LBL[c] || 'غير موثق'}</span>`;
async function renderArmiesSection() {
  const el = document.getElementById('warmies'); if (!el) return;
  const t = document.getElementById('army-sec-t'), h = document.getElementById('army-sec-hint');
  const dev = me && me.role === 'developer';
  if (!me) {
    if (t) t.textContent = 'جيش دولتك';
    if (h) h.textContent = '';
    el.innerHTML = '<div class="empty">سجّل الدخول بحساب دولتك لرؤية جيشها.</div>';
    return;
  }
  let list = [];
  try { const d = await api('GET', '/armies'); list = d.armies || []; }
  catch (e) { el.innerHTML = '<div class="empty">تعذر تحميل بيانات الجيوش.</div>'; return; }
  if (!list.length) { el.innerHTML = '<div class="empty">لا توجد بيانات بعد.</div>'; return; }
  if (t) t.textContent = dev ? 'جيوش الدول — تعداد 1900' : 'جيش دولتك — تعداد 1900';
  if (h) h.textContent = dev
    ? 'التعدادات تقديرات تاريخية تقريبية — اضغط على أي دولة لعرض ترسانتها الكاملة.'
    : 'التعداد تقدير تاريخي تقريبي — اضغط لعرض الترسانة الكاملة لجيش دولتك.';
  el.innerHTML = '<div class="army-grid">' + list.map((a) => {
    const c = countryOf(a.country_code);
    return `<a class="army-card" href="#/army/${a.country_code}">
      <span class="war-flag">${c.flag}</span>
      <span class="army-card-tx"><b>${esc(c.name)}</b>
      <i>${fmtArmy(a.soldiers)} جندي${a.weapons_count ? ` · ${a.weapons_count} سلاح` : ''}</i></span>
    </a>`;
  }).join('') + '</div>';
}
// صفحة جيش دولة: التعداد + الترسانة الكاملة — كل لاعب لدولته فقط
async function vArmy(code) {
  code = String(code || '').toUpperCase();
  if (!me) { location.hash = '#/login'; return; }
  const dev = me.role === 'developer';
  if (!dev && code !== me.country_code) {
    app.innerHTML = thead('غير مصرح') + '<div class="empty">كل لاعب يرى جيش دولته فقط.</div><a class="btn ghost" href="#/news" style="margin-top:12px">← عودة لغرفة الحرب</a>';
    return;
  }
  const c = countryOf(code);
  app.innerHTML = thead('جيش ' + c.name) + '<div id="armybody"><div class="spin"></div></div>';
  let d;
  try { d = await api('GET', '/armies/' + code); }
  catch (e) { document.getElementById('armybody').innerHTML = '<div class="empty">تعذر التحميل.</div>'; return; }
  const a = d.army, ws = d.weapons || [];
  const byClass = {};
  ws.forEach((w) => { (byClass[w.class] = byClass[w.class] || []).push(w); });
  document.getElementById('armybody').innerHTML = `
    <div class="army-hero"><span class="war-flag big">${c.flag}</span>
      <div><h2>جيش ${esc(c.name)}</h2>
      <p class="army-count">${fmtArmy(a ? a.soldiers : 0)} جندي <span class="hint">(تعداد 1900 — تقدير تاريخي)</span></p>
      ${a && a.note ? `<p class="hint">${esc(a.note)}</p>` : ''}</div></div>
    ${Object.keys(byClass).length ? Object.entries(byClass).map(([cls, items]) => `
      <div class="war-sec"><div class="war-sec-t">${esc(cls)}</div><div class="wpn-grid">
      ${items.map((w) => `
        <div class="wpn-card">
          ${w.image_url ? `<img src="${esc(w.image_url)}" alt="" loading="lazy">` : `<div class="wpn-noimg">${ICONS.shield}</div>`}
          <div class="wpn-tx"><b>${esc(w.name)}</b>
            <span>النوع: ${esc(w.wtype || '—')}</span>
            <span>الطراز: ${esc(w.model || '—')}</span>
            <span class="wpn-qty">العدد: ${w.quantity == null ? "—" : fmtArmy(w.quantity)}</span>
            <span class="wpn-meta">${confBadge(w.confidence)}${w.source_url ? ` <a href="${esc(w.source_url)}" target="_blank" rel="noopener" class="wpn-src">المصدر</a>` : ''}</span></div>
        </div>`).join('')}
      </div></div>`).join('') : '<div class="empty">لا توجد أسلحة مسجلة لهذه الدولة بعد.</div>'}
    <a class="btn ghost" href="#/news" style="margin-top:12px">← عودة لغرفة الحرب</a>`;
}
// ---------- إدارة الجيوش (المطورون فقط) ----------
// ======== الاقتصاد والسكان 1900 ========
const fmtPop = (n) => n == null ? '—' : Number(n).toLocaleString('en-US');
const fmtBig = (n) => {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' مليار';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' مليون';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' ألف';
  return String(Math.round(n));
};
const fmtGdp = (n) => n == null ? '—' : (Number(n) >= 1000 ? (Number(n) / 1000).toFixed(1) + ' مليار' : Number(n).toFixed(0) + ' مليون');
const fmtRate = (n) => {
  if (n == null) return '—';
  const v = Number(n);
  if (v === 0) return '0';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toPrecision(3);
};
// ---------- الاقتصاد والسكان + الشركات ----------
// كل لاعب يرى اقتصاد دولته فقط — المطورون والإدارة يرون الكل
let GEO = null;
async function geoData() {
  if (!GEO) { try { GEO = await api('GET', '/meta/geo'); } catch (e) { GEO = { cities: {}, continents: {} }; } }
  return GEO;
}
const CONT_AR = { europe: 'أوروبا', asia: 'آسيا', africa: 'أفريقيا', north_america: 'أمريكا الشمالية', south_america: 'أمريكا الجنوبية' };
function deliveryLabel(buyerCC, sellerCC, cont) {
  if (!buyerCC || !cont) return '';
  const g = (GEO && GEO.continents) || {};
  const a = g[buyerCC], b = cont;
  const days = (a && b && a === b) ? '5-7' : '15';
  return `التسليم: ${days} أيام لعبة`;
}
async function vEconomy() {
  if (!me) { location.hash = '#/login'; return; }
  const dev = me.role === 'developer' || me.role === 'admin' || me.role === 'system';
  if (!dev && me.country_code) { location.hash = '#/economy/' + me.country_code; return; }
  app.innerHTML = thead('الاقتصاد والسكان — 1900') + '<div id="econbody"><div class="spin"></div></div>';
  let d;
  try { d = await api('GET', '/economy'); }
  catch (e) { document.getElementById('econbody').innerHTML = '<div class="empty">تعذر التحميل.</div>'; return; }
  const list = d.economies || [];
  if (!list.length) { document.getElementById('econbody').innerHTML = '<div class="empty">لا توجد بيانات اقتصادية بعد.</div>'; return; }
  document.getElementById('econbody').innerHTML = `
    <p class="hint" style="margin:0 0 12px">بيانات 1900 التاريخية: السكان والناتج المحلي (تقديرات ماديسون بالدولار الدولي 1990) وعملة كل دولة مقابل الدولار والسيولة المتوفرة — اضغط على أي دولة لعرض شركاتها.</p>
    <div class="army-grid">` + list.map((e) => {
      const c = countryOf(e.country_code);
      const rate = e.units_per_usd == null ? 'بلا عملة وطنية'
        : `1$ = ${fmtRate(e.units_per_usd)} ${esc(e.currency_code || '')}`;
      return `<a class="army-card" href="#/economy/${e.country_code}">
        <span class="war-flag">${c.flag}</span>
        <span class="army-card-tx"><b>${esc(c.name)}</b>
        <i>${fmtPop(e.population)} نسمة · ناتج ${fmtGdp(e.gdp_m_intl)}</i>
        <i>${esc(e.currency_name || '—')} · ${rate}</i>
        <i>السيولة: ${e.liquidity_m_usd == null ? '—' : fmtRate(e.liquidity_m_usd) + ' مليون $'}</i>
        <i>${e.companies_count ? `🏭 ${e.companies_count} شركات` : 'لا شركات بعد'}</i>
        ${e.ai_governed ? (e.ai_llm ? '<i>🧠 تُدار بذكاء اصطناعي حقيقي</i>' : '<i>🤖 تُدار بحاكم ذكي</i>') : ''}</span>
      </a>`;
    }).join('') + '</div>';
}
// تفاصيل دولة: العملة والسكان والناتج والسيولة + شركاتها + تأسيس شركة (وطنية/دولية)
async function vEconomyDetail(code) {
  code = String(code || '').toUpperCase();
  if (!me) { location.hash = '#/login'; return; }
  const c = countryOf(code);
  const dev = me.role === 'developer';
  const mine = dev || code === me.country_code;
  app.innerHTML = thead('اقتصاد ' + c.name) + '<div id="econbody"><div class="spin"></div></div>';
  let d;
  try { d = await api('GET', '/economy/' + code); }
  catch (e) { document.getElementById('econbody').innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; return; }
  const e = d.economy, cos = d.companies || [], sectors = d.sectors || [];
  const abroad = d.my_companies_abroad || [];
  const g = await geoData();
  let pend = [];
  if (mine) { try { pend = (await api('GET', '/companies/pending')).pending || []; } catch (x) {} }
  const rateBox = !e || e.units_per_usd == null
    ? '<div class="empty">لا توجد عملة وطنية موثقة لهذه الدولة سنة 1900.</div>'
    : `<div class="map-ed">
        <div class="field"><label>العملة</label><div class="stat-v">${esc(e.currency_name || '—')} ${e.currency_code ? '(' + esc(e.currency_code) + ')' : ''} ${confBadge(e.currency_confidence)}</div></div>
        <div class="field"><label>مقابل الدولار الأمريكي</label><div class="stat-v">1$ = ${fmtRate(e.units_per_usd)} ${esc(e.currency_code || '')}</div></div>
        <div class="field"><label>قيمة الوحدة بالدولار</label><div class="stat-v">${fmtRate(1 / e.units_per_usd)}$</div></div>
      </div>
      ${e.currency_note ? `<p class="hint">${esc(e.currency_note)}</p>` : ''}
      ${e.currency_source ? `<p class="hint"><a href="${esc(e.currency_source)}" target="_blank" rel="noopener" class="wpn-src">المصدر</a></p>` : ''}`;
  const liqBox = `<div class="map-ed">
      <div class="field"><label>السيولة المتوفرة</label><div class="stat-v" style="font-size:20px">${e && e.liquidity_m_usd != null ? fmtRate(e.liquidity_m_usd) + ' مليون دولار' : '—'} ${e ? confBadge(e.liquidity_confidence) : ''}</div></div>
      <div class="field"><label>ملاحظة</label><div class="hint" style="margin:0">تُخصم منها تلقائيًا تكاليف تأسيس الشركات والمشتريات العسكرية.</div></div>
    </div>
    ${e && e.liquidity_note ? `<p class="hint">${esc(e.liquidity_note)}</p>` : ''}`;
  // مقياس أفقي بسيط للمؤشرات السياسية (0-100 ما لم يُذكر خلافه)
  const meter = (lbl, v, suffix = '%', max = 100) => {
    const n = Math.max(0, Math.min(max, Number(v) || 0));
    const w = n / max, col = w >= 0.6 ? '#3fae5a' : w >= 0.4 ? '#d9a13b' : '#d64545';
    return `<div class="field"><label>${lbl}</label>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:8px;border-radius:6px;background:#22303e;overflow:hidden"><div style="height:100%;width:${(w * 100).toFixed(0)}%;background:${col}"></div></div>
        <b dir="ltr" style="min-width:52px;text-align:left">${Math.round(n * 10) / 10}${suffix}</b>
      </div></div>`;
  };
  const polBox = `<div class="map-ed">
      ${meter('الاستقرار السياسي', d.stability)}
      ${meter('الدعم الشعبي', d.public_support)}
      ${meter('التضخم السنوي', d.inflation, '%', 30)}
      ${meter('السمعة الدبلوماسية', d.reputation)}
    </div>
    <p class="hint">الثورة تندلع عند انهيار الاستقرار (0) وتنتهي بتجاوزه 40 — الضرائب المرتفعة والحروب تضغط عليه تدريجيًا كل شهر لعبة.</p>`;
  const coBadge = (o) => `<span class="co-badge ${o.ctype}">${o.ctype === 'international' ? 'دولية' : 'وطنية'}</span>`
    + (o.status === 'pending' ? ' <span class="co-badge pend">بانتظار الموافقة</span>'
      : o.status === 'rejected' ? ' <span class="co-badge rej">مرفوضة</span>' : '');
  window._cos = window._cos || {};
  cos.forEach((o) => { window._cos[o.id] = o; });
  abroad.forEach((o) => { window._cos[o.id] = o; });
  const rkOpts = (sel) => `<option value="">عامة (بدون استخراج)</option>` +
    (d.resource_kinds || []).map((r) => `<option value="${r.kind}"${sel === r.kind ? ' selected' : ''}>استخراج ${esc(r.name)} (${r.rate} ${esc(r.unit)}/عامل/شهر)</option>`).join('');
  const coCard = (o) => {
    const hc = o.host_country && o.host_country !== code ? ` · تستضيفها ${esc(countryOf(o.host_country).name)}` : '';
    const canEdit = dev || o.owner_id === me.id;
    const resLine = o.resource_kind
      ? `<span>التخصص: استخراج ${esc(o.resource_name)} · العمال: <b>${fmtN(o.workers)}</b></span>`
      : '<span class="hint">غير متخصصة في استخراج الموارد</span>';
    return `<div class="wpn-card"><div class="wpn-tx"><b>${esc(o.name)}</b> ${coBadge(o)}
      <span>القطاع: ${esc(o.sector)}${hc}</span>
      <span>المقر: ${esc(o.city || '—')}</span>
      ${resLine}
      <span>رأس المال: ${o.capital == null ? '—' : fmtRate(o.capital) + ' مليون ' + esc((e && o.host_country === code && e.currency_code) ? e.currency_code : 'عملة محلية')} ${o.capital_usd != null ? `(~${fmtRate(o.capital_usd)} مليون $)` : ''}</span>
      <span class="hint">المالك: ${esc(o.owner_name || '—')}</span>
      ${o.description ? `<span class="hint">${esc(o.description)}</span>` : ''}
      ${canEdit && o.status === 'approved' ? `<span class="me-btns co-edit">
        <select id="rk-${o.id}" title="تخصص الاستخراج">${rkOpts(o.resource_kind)}</select>
        <input id="wk-${o.id}" type="number" min="0" max="20000" value="${o.workers}" dir="ltr" title="عدد العمال" placeholder="العمال">
        <button class="btn ghost sm" onclick="coSpecSave(${o.id})">حفظ</button>
        ${o.resource_kind && o.workers > 0 ? `<button class="btn sm" onclick="coCollect(${o.id})">جمع الإنتاج</button>` : ''}
        <button class="btn ghost sm" onclick="coDel(${o.id})">حذف</button></span>` : ''}
    </div></div>`;
  };
  const hostCountries = COUNTRIES.filter((x) => x.code !== code && (g.cities[x.code] || []).length);
  document.getElementById('econbody').innerHTML = `
    <div class="army-hero"><span class="war-flag big">${c.flag}</span>
      <div><h2>اقتصاد ${esc(c.name)} — 1900</h2>
      <p class="army-count">${fmtPop(e ? e.population : null)} نسمة ${e ? confBadge(e.pop_confidence) : ''}</p>
      <p class="hint">الناتج المحلي: ${fmtGdp(e ? e.gdp_m_intl : null)} دولار دولي (1990) ${e && e.gdp_per_capita ? `· للفرد: ${fmtPop(e.gdp_per_capita)}` : ''} ${e ? confBadge(e.gdp_confidence) : ''}</p>
      ${d.unemployment && d.unemployment.rate != null ? `<p class="hint">نسبة البطالة: <b>${d.unemployment.rate}%</b> — قوة العمل التقديرية ${fmtPop(d.unemployment.labor_force)} · يعمل في الشركات ${fmtPop(d.unemployment.employed)} <span class="dim">(كل عامل لعبة = 100 عامل)</span></p>` : ''}
      ${e && e.pop_source ? `<p class="hint"><a href="${esc(e.pop_source)}" target="_blank" rel="noopener" class="wpn-src">مصدر السكان</a>${e.gdp_source ? ` · <a href="${esc(e.gdp_source)}" target="_blank" rel="noopener" class="wpn-src">مصدر الناتج</a>` : ''}</p>` : ''}</div></div>
    <div class="war-sec"><div class="war-sec-t">${ICONS.coin} العملة الوطنية</div>${rateBox}</div>
    <div class="war-sec"><div class="war-sec-t">${ICONS.coin} السيولة المتوفرة</div>${liqBox}</div>
    <div class="war-sec"><div class="war-sec-t">${ICONS.shield} الاستقرار السياسي</div>${polBox}</div>
    ${d.revolt_active ? `<div class="revolt-banner">ثورة شعبية — عصيان مدني! اخفض الضرائب وحسّن الأوضاع حتى يتجاوز الاستقرار 40 — الثورة الآن مرتبطة بانهيار الاستقرار لا بعتبة ضريبية.</div>` : ''}
    ${mine ? `<div class="war-sec"><div class="war-sec-t">الضرائب</div>
      <div class="map-ed">
        <div class="field"><label>نسبة الضريبة الحالية</label><div class="stat-v" id="tax-cur" style="font-size:20px">${d.tax_rate}%</div></div>
        <div class="field"><label>تحديد النسبة (0 – 100)</label><input id="tax-rate" type="number" min="0" max="100" step="any" value="${d.tax_rate}" dir="ltr"></div>
      </div>
      <div class="me-btns" style="margin-top:8px">
        <button class="btn sm" onclick="taxSave('${code}')">حفظ النسبة</button>
        <button class="btn sm" ${d.can_collect ? '' : 'disabled'} onclick="taxCollect('${code}')">جباية شهرية (+${fmtRate(d.collect_amount)} مليون $)</button>
      </div>
      <p class="hint" id="tax-pressure" style="margin-top:6px"></p>
      <p class="hint">الجباية مرة واحدة كل شهر لعبة (ساعتان حقيقيتان). المبلغ = الناتج السنوي × النسبة ÷ 12. أثناء الثورة تتوقف الجباية.</p>
    </div>` : `<div class="war-sec"><div class="war-sec-t">الضرائب</div><p class="hint">نسبة الضريبة الحالية: <b>${d.tax_rate}%</b></p></div>`}
    <div class="war-sec"><div class="war-sec-t">الموارد الطبيعية والاحتياطيات</div>
      <p class="hint">الاحتياطيات تقديرات لعب وليست أرقامًا موثقة. لا تستفيد الدولة من أي مورد إلا عبر شركة متخصصة في استخراجه مع عدد عمال — وكلما زاد العمال زاد الإنتاج الشهري.</p>
      <table class="res-table"><tr><th>المورد</th><th>الاحتياطي التقديري</th><th>المخزون المنتَج</th></tr>
      ${(d.resources || []).map((r) => `<tr><td>${esc(r.name)}</td><td>${r.reserves ? fmtBig(r.reserves) + ' ' + esc(r.unit) : '—'}</td><td><b>${fmtBig(r.stock)}</b> ${esc(r.unit)}</td></tr>`).join('')}
      </table></div>
    ${(d.liquidity_log || []).length ? `<div class="war-sec"><div class="war-sec-t">سجل السيولة</div>
      <div class="liq-log">${d.liquidity_log.map((x) => `
        <div class="liq-row"><span class="liq-amt ${x.amount >= 0 ? 'pos' : 'neg'}">${x.amount >= 0 ? '+' : ''}${fmtRate(x.amount)}</span>
        <span class="liq-rs">${esc(x.reason || '')}${x.actor ? ` <span class="hint">(${esc(x.actor)})</span>` : ''}</span>
        <time>${new Date(x.created_at).toLocaleDateString('ar-EG')}</time></div>`).join('')}</div></div>` : ''}
    ${pend.length ? `<div class="war-sec"><div class="war-sec-t">${ICONS.alert} طلبات شركات دولية بانتظار قرارك (${pend.length})</div>
      <div class="wpn-grid">` + pend.map((o) => `
        <div class="wpn-card"><div class="wpn-tx"><b>${esc(o.name)}</b> <span class="co-badge">دولية</span>
          <span>مقدم الطلب: ${esc(o.owner_name || '—')} (${esc(countryOf(o.country_code).name)})</span>
          <span>المقر المقترح: ${esc(o.city || '—')}</span>
          <span>رأس المال: ${o.capital == null ? '—' : fmtRate(o.capital) + ' مليون'} ${o.capital_usd != null ? `(~${fmtRate(o.capital_usd)} مليون $ يُخصم من سيولتك عند الموافقة)` : ''}</span>
          ${o.description ? `<span class="hint">${esc(o.description)}</span>` : ''}
          <span class="me-btns"><button class="btn sm" onclick="coApprove(${o.id})">موافقة</button>
          <button class="btn ghost sm" onclick="coReject(${o.id})">رفض</button></span>
        </div></div>`).join('') + '</div></div>' : ''}
    <div class="war-sec" id="co-list"><div class="war-sec-t">🏭 الشركات العاملة في ${esc(c.name)} (${cos.filter((o) => o.status === 'approved').length})</div>
      ${cos.length ? `<div class="wpn-grid">` + cos.map(coCard).join('') + '</div>'
        : '<div class="empty">لا توجد شركات مسجلة بعد — كن أول من يؤسس شركة هنا.</div>'}
    </div>
    ${abroad.length ? `<div class="war-sec"><div class="war-sec-t">🌍 شركاتي في الخارج (${abroad.length})</div>
      <div class="wpn-grid">` + abroad.map(coCard).join('') + '</div></div>' : ''}
    ${mine ? `<div class="war-sec"><div class="war-sec-t">${ICONS.coin} تأسيس شركة جديدة</div>
      <div class="map-ed">
        <div class="field"><label>اسم الشركة</label><input id="co-name" placeholder="مثال: شركة الحديد والصلب الوطنية"></div>
        <div class="field"><label>القطاع</label><select id="co-sector">${sectors.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>نوع الشركة</label><select id="co-type" onchange="coTypeChanged('${code}')">
          <option value="national">وطنية — مقرها في مدن دولتك فقط</option>
          <option value="international">دولية — تُبنى في دولة أخرى بموافقتها</option>
        </select></div>
        <div class="field" id="co-host-wrap" style="display:none"><label>الدولة المضيفة</label>
          <select id="co-host" onchange="coHostChanged()">${hostCountries.map((x) => `<option value="${x.code}">${x.flag} ${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field"><label>المدينة / المقر — ابحث واختر من القائمة</label>
          <input id="co-city" list="dl-city" placeholder="اكتب اسم المدينة للبحث..." autocomplete="off">
          <datalist id="dl-city"></datalist></div>
        <div class="field"><label>تخصص استخراج الموارد</label><select id="co-res">
          <option value="">عامة (بدون استخراج)</option>
          ${(d.resource_kinds || []).map((r) => `<option value="${r.kind}">استخراج ${esc(r.name)} — ${r.rate} ${esc(r.unit)}/عامل/شهر</option>`).join('')}
        </select></div>
        <div class="field"><label>عدد العمال (0 – 20000 · كل عامل = 100 عامل فعلي)</label><input id="co-workers" type="number" min="0" max="20000" value="0" dir="ltr"></div>
        <div class="field"><label id="co-cap-label">رأس المال (بملايين العملة المحلية)</label><input id="co-capital" type="number" min="0" dir="ltr"></div>
        <div class="field" style="grid-column:1/-1"><label>وصف النشاط</label><input id="co-desc" placeholder="ماذا تنتج الشركة؟"></div>
        <p class="hint" id="co-note" style="grid-column:1/-1"></p>
        <div class="me-btns"><button class="btn" onclick="coCreate('${code}')">${ICONS.checkSm} تأسيس الشركة</button></div>
      </div></div>` : ''}
    ${dev ? `<div class="war-sec dev-sec"><div class="war-sec-t">${ICONS.gear} تعديل بيانات الدولة — المطورون فقط</div>
      <div class="map-ed">
        <div class="field"><label>العملة (عربي)</label><input id="ec-cur" value="${esc(e && e.currency_name ? e.currency_name : '')}"></div>
        <div class="field"><label>رمز العملة</label><input id="ec-curcode" dir="ltr" value="${esc(e && e.currency_code ? e.currency_code : '')}"></div>
        <div class="field"><label>وحدات العملة = 1 دولار</label><input id="ec-rate" type="number" step="any" min="0" dir="ltr" value="${e && e.units_per_usd != null ? e.units_per_usd : ''}"></div>
        <div class="field"><label>السكان (1900)</label><input id="ec-pop" type="number" min="0" dir="ltr" value="${e && e.population != null ? e.population : ''}"></div>
        <div class="field"><label>الناتج (مليون دولار دولي)</label><input id="ec-gdp" type="number" step="any" min="0" dir="ltr" value="${e && e.gdp_m_intl != null ? e.gdp_m_intl : ''}"></div>
        <div class="field"><label>السيولة (مليون دولار)</label><input id="ec-liq" type="number" step="any" min="0" dir="ltr" value="${e && e.liquidity_m_usd != null ? e.liquidity_m_usd : ''}"></div>
        <div class="me-btns"><button class="btn" onclick="ecSave('${code}')">حفظ</button></div>
      </div></div>` : ''}
    <a class="btn ghost" href="#/economy" style="margin-top:12px">← عودة</a>`;
  coTypeChanged(code);
}
function coHostCC(fallback) {
  const t = document.getElementById('co-type');
  if (t && t.value === 'international') {
    const h = document.getElementById('co-host');
    return h ? h.value : fallback;
  }
  return fallback;
}
function coTypeChanged(code) {
  const t = document.getElementById('co-type'); if (!t) return;
  const hw = document.getElementById('co-host-wrap');
  hw.style.display = t.value === 'international' ? '' : 'none';
  coHostChanged(code);
}
function coHostChanged(code) {
  const t = document.getElementById('co-type'); if (!t) return;
  const hostCC = coHostCC(code || me.country_code);
  const g = (GEO && GEO.cities) || {};
  const list = g[hostCC] || [];
  const dl = document.getElementById('dl-city');
  if (dl) dl.innerHTML = list.map((x) => `<option value="${esc(x)}">`).join('');
  const inp = document.getElementById('co-city');
  if (inp) inp.placeholder = list.length ? `ابحث بين ${list.length} مدينة...` : 'اكتب اسم المدينة...';
  const isIntl = t.value === 'international';
  document.getElementById('co-cap-label').textContent =
    `رأس المال (بملايين عملة ${countryOf(hostCC).name})`;
  document.getElementById('co-note').textContent = isIntl
    ? `شركة دولية: سيُرسل طلبك إلى ${countryOf(hostCC).name} وهي من توافق أو ترفض. عند الموافقة يُخصم رأس المال من سيولة الدولة المضيفة.`
    : 'شركة وطنية: مقرها في مدن دولتك فقط، ويُخصم رأس المال من سيولة دولتك فور التأسيس.';
}
async function coCreate(code) {
  const t = document.getElementById('co-type');
  const ctype = t ? t.value : 'national';
  const body = {
    country_code: code,
    ctype,
    host_country: ctype === 'international' ? document.getElementById('co-host').value : undefined,
    name: document.getElementById('co-name').value.trim(),
    sector: document.getElementById('co-sector').value,
    city: document.getElementById('co-city').value.trim(),
    resource_kind: document.getElementById('co-res').value || null,
    workers: document.getElementById('co-workers').value || 0,
    capital: document.getElementById('co-capital').value,
    description: document.getElementById('co-desc').value.trim(),
  };
  if (!body.name) return toast('اكتب اسم الشركة أولاً');
  if (!body.city) return toast('اختر مدينة المقر من القائمة');
  try {
    const r = await api('POST', '/companies', body);
    toast(r.status === 'pending' ? 'تم إرسال الطلب للدولة المضيفة — بانتظار موافقتها' : 'تم تأسيس الشركة 🏭');
    await vEconomyDetail(code);
    const el = document.getElementById('co-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { toast(e.message || 'فشل التأسيس'); }
}
async function coSpecSave(id) {
  const o = (window._cos || {})[id];
  if (!o) return toast('تعذر التحميل');
  try {
    await api('PUT', '/companies/' + id, {
      name: o.name, sector: o.sector, city: o.city, description: o.description || '',
      resource_kind: document.getElementById('rk-' + id).value || null,
      workers: document.getElementById('wk-' + id).value || 0,
    });
    toast('تم حفظ التخصص والعمال'); route();
  } catch (e) { toast(e.message || 'فشل الحفظ'); }
}
async function coCollect(id) {
  try {
    const r = await api('POST', '/companies/' + id + '/collect');
    toast(`تم جمع الإنتاج: ${Number(r.amount).toLocaleString('en-US')} ${r.unit} ${r.resource}`);
    route();
  } catch (e) { toast(e.message || 'فشل الجمع'); }
}
async function taxSave(code) {
  const v = document.getElementById('tax-rate').value;
  const hintEl = () => document.getElementById('tax-pressure');
  try {
    const r = await api('PUT', '/economy/' + code, { tax_rate: v });
    if (r.tax_rate != null) {
      const cur = document.getElementById('tax-cur');
      if (cur) cur.textContent = r.tax_rate + '%';
      document.getElementById('tax-rate').value = r.tax_rate;
    }
    if (hintEl()) hintEl().innerHTML = `تم الحفظ — <b>الضغط الضريبي:</b> ${esc(r.pressure || '—')}`;
  } catch (e) { if (hintEl()) hintEl().textContent = e.message || 'فشل الحفظ'; }
}
async function taxCollect(code) {
  try {
    const r = await api('POST', '/economy/' + code + '/collect-taxes');
    toast(`تمت الجباية: +${fmtRate(r.amount)} مليون $ لسيولة الدولة`);
    vEconomyDetail(code);
  } catch (e) { toast(e.message || 'فشلت الجباية'); }
}
async function coApprove(id) {
  try { await api('POST', '/companies/' + id + '/approve'); toast('تمت الموافقة على الشركة'); route(); }
  catch (e) { toast(e.message || 'فشلت الموافقة'); }
}
async function coReject(id) {
  if (!confirm('رفض هذا الطلب؟')) return;
  try { await api('POST', '/companies/' + id + '/reject'); toast('تم الرفض'); route(); }
  catch (e) { toast(e.message || 'فشل الرفض'); }
}
async function coDel(id) {
  if (!confirm('حذف هذه الشركة نهائيًا؟')) return;
  try { await api('DELETE', '/companies/' + id); toast('تم الحذف'); route(); }
  catch (e) { toast(e.message || 'فشل الحذف'); }
}
async function ecSave(code) {
  const v = (id) => document.getElementById(id).value.trim();
  try {
    await api('PUT', '/economy/' + code, {
      currency_name: v('ec-cur'), currency_code: v('ec-curcode'), units_per_usd: v('ec-rate'),
      population: v('ec-pop'), gdp_m_intl: v('ec-gdp'), liquidity_m_usd: v('ec-liq'),
    });
    toast('تم الحفظ'); vEconomyDetail(code);
  } catch (e) { toast(e.message || 'فشل الحفظ'); }
}

// ---------- سوق السلاح ----------
let mktTab = 'market';
async function vMarket() {
  if (!me) { location.hash = '#/login'; return; }
  const g = await geoData();
  app.innerHTML = thead('السوق العام', [
    ['market', 'السوق'], ['sell', 'بِع شيئًا'], ['orders', 'طلباتي'],
  ].map(([k, t]) => `<button class="ttab${mktTab === k ? ' active' : ''}" onclick="mktTab='${k}';vMarket()">${t}</button>`).join(''))
    + '<div id="mktbody"><div class="spin"></div></div>';
  try {
    if (mktTab === 'market') await renderMktList(g);
    else if (mktTab === 'sell') await renderMktSell();
    else await renderMktOrders();
  } catch (e) { document.getElementById('mktbody').innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; }
}
async function renderMktList(g) {
  const d = await api('GET', '/market');
  const list = d.listings || [];
  const myCC = me.country_code;
  document.getElementById('mktbody').innerHTML = `
    <p class="hint" style="margin:0 0 12px">بِع أي شيء تملكه دولتك — أسلحة من الترسانة أو موارد منتَجة (نفط، غاز، حديد...) — بالسعر الذي تريده. مدة التسليم بزمن اللعبة: <b>5-7 أيام</b> داخل نفس القارة و<b>15 يومًا</b> بين قارتين مختلفتين.</p>
    ${list.length ? '<div class="wpn-grid">' + list.map((l) => {
      const sc = countryOf(l.seller_country);
      const own = l.seller_country === myCC;
      const isRes = l.kind === 'resource';
      const sub = isRes ? 'مورد طبيعي' : `${esc(l.weapon_class || '')} ${esc(l.weapon_wtype || '')} ${esc(l.weapon_model || '')}`;
      return `<div class="wpn-card"><div class="wpn-tx">
        ${!isRes && l.weapon_image ? `<img src="${esc(l.weapon_image)}" class="wpn-img" loading="lazy" alt="">` : ''}
        <b>${esc(l.title || 'سلعة')}</b> <span class="co-badge ${isRes ? 'res' : ''}">${isRes ? 'مورد' : 'سلاح'}</span>
        ${sub.trim() ? `<span>${sub}</span>` : ''}
        <span>البائع: ${esc(l.seller_name || '—')} ${sc.flag} ${esc(sc.name)}${own ? ' (عرضك)' : ''}</span>
        <span>الكمية: ${fmtBig(l.qty)} ${esc(l.unit || '')} · السعر: <b>${fmtRate(l.price_unit_m_usd)} مليون $</b> للوحدة</span>
        <span class="hint">${deliveryLabel(myCC, 0, l.seller_continent)}${l.seller_continent ? ` (${CONT_AR[l.seller_continent] || l.seller_continent})` : ''}</span>
        ${own ? `<span class="me-btns"><button class="btn ghost sm" onclick="mktCancel(${l.id})">إلغاء العرض</button></span>`
          : `<span class="me-btns"><input id="buy-qty-${l.id}" type="number" min="1" max="${l.qty}" value="1" style="width:70px" dir="ltr">
             <button class="btn sm" onclick="mktBuy(${l.id})">شراء</button></span>`}
      </div></div>`;
    }).join('') + '</div>' : '<div class="empty">لا توجد عروض نشطة حاليًا — كن أول من يعرض شيئًا للبيع.</div>'}`;
}
let mktSellKind = 'weapon';
async function renderMktSell() {
  let weapons = [], stocks = [];
  try {
    const d = await api('GET', '/armies/' + me.country_code);
    weapons = (d.weapons || []).filter((w) => w.id);
  } catch (e) {}
  try {
    const e2 = await api('GET', '/economy/' + me.country_code);
    stocks = (e2.resources || []).filter((r) => r.stock > 0);
  } catch (e) {}
  const kindBtns = ['weapon', 'resource'].map((k) =>
    `<button class="ttab${mktSellKind === k ? ' active' : ''}" onclick="mktSellKind='${k}';renderMktSell()">${k === 'weapon' ? 'سلاح' : 'مورد'}</button>`).join('');
  document.getElementById('mktbody').innerHTML = `
    <div class="war-sec"><div class="war-sec-t">${ICONS.swords} عرض للبيع</div>
      <div class="ttabs" style="margin-bottom:10px">${kindBtns}</div>
      ${mktSellKind === 'weapon'
        ? (weapons.length ? `<div class="map-ed">
            <div class="field" style="grid-column:1/-1"><label>السلاح (من ترسانة دولتك)</label>
              <select id="mkt-weapon">${weapons.map((w) => `<option value="${w.id}">${esc(w.name)}${w.quantity != null ? ` — الكمية: ${w.quantity}` : ''}</option>`).join('')}</select></div>
            <div class="field"><label>الكمية</label><input id="mkt-qty" type="number" min="1" value="1" dir="ltr"></div>
            <div class="field"><label>السعر للقطعة (مليون دولار)</label><input id="mkt-price" type="number" min="0" step="any" dir="ltr" placeholder="حدد السعر الذي تريده"></div>
          </div>` : '<div class="empty">لا توجد أسلحة في ترسانتك لعرضها.</div>')
        : (stocks.length ? `<div class="map-ed">
            <div class="field" style="grid-column:1/-1"><label>المورد (من مخزون دولتك المنتَج)</label>
              <select id="mkt-resource">${stocks.map((r) => `<option value="${r.kind}">${esc(r.name)} — المخزون: ${fmtBig(r.stock)} ${esc(r.unit)}</option>`).join('')}</select></div>
            <div class="field"><label>الكمية</label><input id="mkt-qty" type="number" min="1" value="1" dir="ltr"></div>
            <div class="field"><label>السعر للوحدة (مليون دولار)</label><input id="mkt-price" type="number" min="0" step="any" dir="ltr" placeholder="حدد السعر الذي تريده"></div>
          </div>` : '<div class="empty">لا يوجد مخزون موارد — أنتج عبر شركات متخصصة أولًا.</div>')}
      <p class="hint">السعر حر تمامًا. عند الشراء يُخصم المبلغ من سيولة دولة المشتري ويُضاف لسيولة دولتك، وتُسجَّل الحركة في سجل السيولة.</p>
      <div class="me-btns"><button class="btn" onclick="mktList()">نشر العرض</button></div>
    </div>
    <div class="war-sec"><div class="war-sec-t">عروضي النشطة</div><div id="mymkt"><div class="spin"></div></div></div>`;
  try {
    const d = await api('GET', '/market');
    const mine = (d.listings || []).filter((l) => l.seller_country === me.country_code);
    document.getElementById('mymkt').innerHTML = mine.length ? '<div class="wpn-grid">' + mine.map((l) => `
      <div class="wpn-card"><div class="wpn-tx"><b>${esc(l.title || 'سلعة')}</b> <span class="co-badge ${l.kind === 'resource' ? 'res' : ''}">${l.kind === 'resource' ? 'مورد' : 'سلاح'}</span>
        <span>الكمية: ${fmtBig(l.qty)} ${esc(l.unit || '')} · السعر: ${fmtRate(l.price_unit_m_usd)} مليون $ للوحدة</span>
        <span class="me-btns"><button class="btn ghost sm" onclick="mktCancel(${l.id})">إلغاء العرض</button></span>
      </div></div>`).join('') + '</div>' : '<div class="empty">لا عروض نشطة لك.</div>';
  } catch (e) { document.getElementById('mymkt').innerHTML = '<div class="empty">تعذر التحميل.</div>'; }
}
async function mktList() {
  const body = { qty: document.getElementById('mkt-qty').value, price_unit_m_usd: document.getElementById('mkt-price').value };
  if (mktSellKind === 'resource') {
    const rs = document.getElementById('mkt-resource');
    if (!rs) return toast('لا يوجد مخزون للبيع');
    body.kind = 'resource'; body.resource = rs.value;
  } else {
    const ws = document.getElementById('mkt-weapon');
    if (!ws) return toast('لا توجد أسلحة للبيع');
    body.kind = 'weapon'; body.weapon_id = ws.value;
  }
  try { await api('POST', '/market/listings', body); toast('تم نشر العرض'); vMarket(); }
  catch (e) { toast(e.message || 'فشل النشر'); }
}
async function mktCancel(id) {
  if (!confirm('إلغاء هذا العرض؟')) return;
  try { await api('DELETE', '/market/listings/' + id); toast('تم الإلغاء'); vMarket(); }
  catch (e) { toast(e.message || 'فشل الإلغاء'); }
}
async function mktBuy(id) {
  const q = document.getElementById('buy-qty-' + id);
  const qty = q ? q.value : 1;
  if (!confirm(`تأكيد الشراء؟ سيُخصم المبلغ من سيولة دولتك.`)) return;
  try {
    const r = await api('POST', '/market/buy/' + id, { qty });
    toast(`تم الشراء — التسليم خلال ${r.game_days} أيام لعبة`);
    mktTab = 'orders'; vMarket();
  } catch (e) { toast(e.message || 'فشل الشراء'); }
}
async function renderMktOrders() {
  const d = await api('GET', '/market/orders');
  const orders = d.orders || [];
  const fmtLeft = (ms) => {
    if (ms <= 0) return 'وصلت';
    const m = Math.ceil(ms / 60000);
    return m >= 60 ? `~${Math.round(m / 60)} ساعة` : `~${m} دقيقة`;
  };
  document.getElementById('mktbody').innerHTML = orders.length ? '<div class="wpn-grid">' + orders.map((o) => {
    const left = o.deliver_at - Date.now();
    const st = o.status === 'delivered' ? '<span class="co-badge">تم التسليم</span>'
      : `<span class="co-badge pend">في الطريق — ${o.game_days} أيام لعبة (${fmtLeft(left)} حقيقية)</span>`;
    const isRes = o.kind === 'resource';
    return `<div class="wpn-card"><div class="wpn-tx">
      ${!isRes && o.weapon_image ? `<img src="${esc(o.weapon_image)}" class="wpn-img" loading="lazy" alt="">` : ''}
      <b>${esc(o.title || o.weapon_name || 'سلعة')}</b> <span class="co-badge ${isRes ? 'res' : ''}">${isRes ? 'مورد' : 'سلاح'}</span> ${st}
      <span>${o.mine_bought ? 'اشتريت من' : 'بعت إلى'}: ${esc(o.mine_bought ? o.seller_name : o.buyer_name || '—')} ${countryOf(o.mine_bought ? o.seller_country : o.buyer_country).flag}</span>
      <span>الكمية: ${fmtBig(o.qty)} ${esc(o.unit || '')} · الإجمالي: ${fmtRate(o.total_m_usd)} مليون $</span>
    </div></div>`;
  }).join('') + '</div>' : '<div class="empty">لا توجد طلبات بعد.</div>';
}

// ---------- الإشعارات ----------
async function vNotifications() {
  if (!me) { location.hash = '#/login'; return; }
  app.innerHTML = thead('الإشعارات') + '<div id="notifbody"><div class="spin"></div></div>';
  let list = [];
  try { list = (await api('GET', '/notifications')).notifications || []; } catch (e) {}
  try { await api('POST', '/notifications/read-all'); } catch (e) {}
  refreshNotifBadge(true);
  document.getElementById('notifbody').innerHTML = list.length ? list.map((n) => `
    <a class="notif-card${n.is_read ? '' : ' fresh'}" ${n.link ? `href="${esc(n.link)}"` : ''}>
      <span class="notif-ic">${ICONS.bell}</span>
      <span class="notif-tx"><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span>
      <i class="hint">${new Date(n.created_at).toLocaleString('ar')}</i></span>
    </a>`).join('') : '<div class="empty">لا إشعارات — كل شيء هادئ.</div>';
}
async function refreshNotifBadge(clear) {
  const el = document.getElementById('nbell-n'); if (!el) return;
  let n = 0;
  if (!clear && me) { try { n = (await api('GET', '/notifications/unread-count')).count || 0; } catch (e) {} }
  el.style.display = n > 0 ? '' : 'none';
  el.textContent = n > 99 ? '99+' : n;
}
async function renderArmyManager() {
  const el = document.getElementById('armymgr'); if (!el) return;
  let list = [];
  try { const d = await api('GET', '/armies'); list = d.armies || []; } catch (e) {}
  const cmap = {}; list.forEach((a) => { cmap[a.country_code] = a; });
  el.innerHTML = `<div class="war-sec dev-sec"><div class="war-sec-t">${ICONS.shield} إدارة الجيوش — المطورون فقط</div>
    <div class="map-ed">
      <div class="field"><label>الدولة</label><select id="am-country" onchange="armyLoad()">
        ${COUNTRIES.map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select></div>
      <div class="field"><label>عدد الجنود</label><input id="am-soldiers" type="number" min="0" dir="ltr"></div>
      <div class="field"><label>ملاحظة</label><input id="am-note" placeholder="مثال: تقدير تاريخي"></div>
      <div class="me-btns"><button class="btn" onclick="armySave()">${ICONS.checkSm} حفظ التعداد</button></div>
    </div>
    <div class="war-sec-t" style="margin-top:14px">أسلحة الدولة</div>
    <div id="am-weapons"><div class="spin"></div></div>
    <div class="war-sec-t" style="margin-top:14px">إضافة / تعديل سلاح</div>
    <div class="map-ed">
      <input type="hidden" id="wpn-id">
      <div class="field"><label>الاسم الكامل</label><input id="wpn-name" placeholder="مثال: بندقية لي-إنفيلد"></div>
      <div class="field"><label>الصنف</label><input id="wpn-class" placeholder="بنادق / مدفعية / رشاشات / سفن..."></div>
      <div class="field"><label>النوع</label><input id="wpn-type" placeholder="بندقية مشاة تكرارية"></div>
      <div class="field"><label>الطراز</label><input id="wpn-model" placeholder="Mk I" dir="ltr"></div>
      <div class="field"><label>العدد</label><input id="wpn-qty" type="number" min="0" dir="ltr"></div>
      <div class="field"><label>صورة السلاح</label><input id="wpn-img" type="file" accept="image/*"><div id="wpn-preview" style="margin-top:6px"></div></div>
      <div class="field"><label>رابط المصدر</label><input id="wpn-src" placeholder="https://..." dir="ltr"></div>
      <div class="field"><label>الثقة</label><select id="wpn-conf">
        <option value="documented">موثق</option><option value="estimate">تقدير</option><option value="unknown" selected>غير موثق</option></select></div>
      <div class="field"><label>ملاحظة</label><input id="wpn-note" placeholder="مثال: رقم الإنتاج الكلي"></div>
      <div class="me-btns">
        <button class="btn" onclick="wpnSave()">${ICONS.checkSm} حفظ السلاح</button>
        <button class="btn ghost" onclick="wpnClear()">جديد</button>
      </div>
    </div></div>`;
  window._armies = cmap;
  armyLoad();
}
async function armyLoad() {
  const code = val('am-country');
  const a = (window._armies || {})[code];
  document.getElementById('am-soldiers').value = a ? a.soldiers : 0;
  document.getElementById('am-note').value = a && a.note ? a.note : '';
  const box = document.getElementById('am-weapons');
  box.innerHTML = '<div class="spin"></div>';
  try {
    const d = await api('GET', '/armies/' + code);
    const ws = d.weapons || [];
    box.innerHTML = ws.length ? '<div class="wpn-list">' + ws.map((w) => `
      <div class="wpn-row"><div class="wpn-row-tx"><b>${esc(w.name)}</b>
        <span class="hint">${esc(w.class || '')} · ${esc(w.wtype || '')} · ${esc(w.model || '')} · العدد: ${w.quantity == null ? "—" : fmtArmy(w.quantity)} · ${CONF_LBL[w.confidence] || 'غير موثق'}</span></div>
        <button class="btn ghost sm" onclick='wpnEdit(${JSON.stringify(w.id)})'>تعديل</button>
        <button class="btn danger sm" onclick='wpnDel(${JSON.stringify(w.id)})'>حذف</button></div>`).join('') + '</div>'
      : '<div class="empty">لا توجد أسلحة — أضف أول سلاح من النموذج بالأسفل.</div>';
    window._weapons = {}; ws.forEach((w) => { window._weapons[w.id] = w; });
  } catch (e) { box.innerHTML = '<div class="empty">تعذر التحميل.</div>'; }
}
async function armySave() {
  const code = val('am-country');
  try {
    await api('POST', '/armies/' + code, { soldiers: val('am-soldiers'), note: val('am-note') });
    alert('حُفظ تعداد الجيش ✓'); vNews();
  } catch (e) { alert(e.message); }
}
function wpnClear() {
  ['wpn-id', 'wpn-name', 'wpn-class', 'wpn-type', 'wpn-model', 'wpn-qty', 'wpn-src', 'wpn-note'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('wpn-conf').value = 'unknown';
  document.getElementById('wpn-img').value = '';
  document.getElementById('wpn-preview').innerHTML = '';
}
function wpnEdit(id) {
  const w = (window._weapons || {})[id]; if (!w) return;
  document.getElementById('wpn-id').value = w.id;
  document.getElementById('wpn-name').value = w.name || '';
  document.getElementById('wpn-class').value = w.class || '';
  document.getElementById('wpn-type').value = w.wtype || '';
  document.getElementById('wpn-model').value = w.model || '';
  document.getElementById('wpn-qty').value = w.quantity == null ? '' : w.quantity;
  document.getElementById('wpn-src').value = w.source_url || '';
  document.getElementById('wpn-conf').value = w.confidence || 'unknown';
  document.getElementById('wpn-note').value = w.note || '';
  document.getElementById('wpn-preview').innerHTML = w.image_url ? `<img src="${esc(w.image_url)}" style="max-width:120px;border-radius:8px">` : '';
  window.scrollTo(0, document.getElementById('wpn-name').offsetTop - 80);
}
async function wpnDel(id) {
  if (!confirm('حذف هذا السلاح نهائيًا؟')) return;
  try { await api('DELETE', '/weapons/' + id); armyLoad(); }
  catch (e) { alert(e.message); }
}
async function wpnSave() {
  const code = val('am-country');
  const id = document.getElementById('wpn-id').value;
  let image_url = null;
  const f = document.getElementById('wpn-img').files[0];
  const prev = document.querySelector('#wpn-preview img');
  if (f) { try { image_url = await uploadImage(f); } catch (e) { alert(e.message); return; } }
  else if (prev) image_url = prev.getAttribute('src');
  const body = {
    country_code: code,
    name: val('wpn-name'), class: val('wpn-class'), wtype: val('wpn-type'),
    model: val('wpn-model'), quantity: val('wpn-qty'), image_url,
    source_url: val('wpn-src'), confidence: val('wpn-conf'), note: val('wpn-note'),
  };
  try {
    if (id) await api('PUT', '/weapons/' + id, body);
    else await api('POST', '/weapons', body);
    alert('حُفظ السلاح ✓'); wpnClear(); armyLoad();
  } catch (e) { alert(e.message); }
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
  try { await api('POST', '/map-states', body); alert('حُفظ تعديل الخريطة ✓'); vNews(); }
  catch (e) { alert(e.message); }
}
async function mapDelete() {
  const code = val('me-country');
  if (!confirm('حذف كل تعديلات هذه الدولة من الخريطة؟')) return;
  try { await api('DELETE', '/map-states/' + code); vNews(); }
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
  app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">مقال</div></div><div class="spin"></div>`;
  try {
    const a = await api('GET', `/articles/${id}`);
    const c = countryOf(a.author.country_code);
    const canDel = me && (me.id === a.author.id || me.role === 'admin');
    const gold = a.category === 'official';
    app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
  app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
  <div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
    <div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
      <div class="field"><label class="filebtn">${ICONS.img} إرفاق صورة (اختياري)<input id="dimg" type="file" accept="image/*" class="a11y-hidden"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendDispatch()">نشر البرقية</button></div>`;
  } else if (t === 'new-a') {
    const staff = me.role === 'admin' || me.role === 'system';
    if (!staff) { body.innerHTML = '<div class="form-dark"><div class="err">نشر المقالات حصرًا عبر حساب argos HQ.</div></div>'; return; }
    const cats = Object.entries(CATS);
    body.innerHTML = `<div class="form-dark"><h2>مقال جديد</h2><div id="msg"></div>
      <div class="field"><label>القسم</label><select id="acat">${cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>العنوان</label><input id="atitle"></div>
      <div class="field"><label>نص المقال</label><textarea id="abody" style="min-height:220px" placeholder="اكتب سيناريو المعركة أو الحدث بالتفصيل…"></textarea></div>
      <div class="field"><label class="filebtn">${ICONS.img} صورة المقال (اختياري)<input id="aimg" type="file" accept="image/*" class="a11y-hidden"></label></div>
      <button class="btn" style="width:auto;padding:12px 44px" onclick="sendArticle()">نشر المقال</button></div>`;
  } else if (t === 'edit') {
    body.innerHTML = `<div class="form-dark"><h2>تعديل البروفايل</h2><div id="msg"></div>
      <div class="field"><label>الصورة الشخصية</label>
        <div class="pav-row">
          <span id="pavprev">${avHTML(me, 64)}</span>
          <label class="filebtn">${ICONS.img} اختر صورة<input id="pavatar" type="file" accept="image/*" class="a11y-hidden"></label>
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
    ${me.role === 'admin' && me.country_code === 'US' ? `
    <button class="btn" style="margin-bottom:12px" onclick="switchToDev()">${ICONS.zap} الانتقال إلى حساب المطورين</button>` : ''}
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
// اللاعب الأمريكي: دخول حساب المطورين بضغطة واحدة (يحفظ حسابه الحالي تلقائيًا)
async function switchToDev() {
  try {
    const cur = await api('POST', '/account-token');
    const list = getSavedAccounts().filter((a) => a.username !== cur.username);
    list.push({ username: cur.username, token: cur.token });
    const r = await api('POST', '/admin/dev-token');
    const list2 = list.filter((a) => a.username !== r.username);
    list2.push({ username: r.username, token: r.token });
    saveAccounts(list2);
    document.cookie = `session=${encodeURIComponent(r.token)}; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`;
    location.reload();
  } catch (e) { msg(e.message, false); }
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
    <div class="sec-h" style="margin-top:18px">🧠 الذكاء الاصطناعي الحقيقي (نموذج لغوي)</div>
    <p class="hint">نموذج لغوي حقيقي يحكم الدول الذكية كل شهر لعبة ويرد في السفارات — المحرك يتحقق من كل قرار قبل تنفيذه، وعند أي عطل يعود الحاكم القاعدي تلقائيًا. الخياران الأولان مجانيان تمامًا بلا حساب ولا مفتاح.</p>
    <div id="aimsg"></div>
    <div class="field"><label><input type="checkbox" id="llm_on" style="width:auto"> تفعيل الحاكم اللغوي</label></div>
    <div class="field"><label>المزوّد</label>
      <select id="llm_provider">
        <option value="pollinations">Pollinations — مجاني بلا مفتاح ✓</option>
        <option value="llm7">LLM7 — مجاني بلا حساب ✓</option>
        <option value="groq">Groq — طبقة مجانية (مفتاح مجاني)</option>
        <option value="gemini">Gemini — طبقة مجانية (مفتاح مجاني)</option>
        <option value="openrouter">OpenRouter — مدفوع</option>
      </select></div>
    <div class="field"><label>النموذج</label>
      <input id="llm_model" dir="ltr" placeholder="openai"></div>
    <div class="field"><label>مفتاح API (يُحفظ في السيرفر فقط — غير مطلوب للمجانيين)</label>
      <input id="llm_key" type="password" dir="ltr" placeholder="اتركه فارغًا للمزوّد المجاني" autocomplete="new-password"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" style="width:auto;padding:10px 24px" onclick="saveAiConfig()">حفظ الإعداد</button>
      <button class="btn" style="width:auto;padding:10px 24px" onclick="testAiConfig()">اختبار الاتصال</button>
    </div>
    <p class="hint" id="llm_status"></p>
    <div class="sec-h" style="margin-top:18px">صيانة المحاكاة</div>
    <p class="hint">أدوات خطيرة — للمطورين فقط. تصفير الشركات يحذف كل الشركات نهائيًا ولا رجعة فيه.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn danger" style="width:auto;padding:10px 20px" onclick="wipeCompanies()">${ICONS.trash} تصفير جميع الشركات</button>
      <button class="btn danger" style="width:auto;padding:10px 20px" onclick="endAllWars()">🕊️ إنهاء كل الحروب النشطة</button>
      <button class="btn" style="width:auto;padding:10px 20px" onclick="anchorClock()">↺ الساعة: 1900-01-01 منذ 6 مساء GMT اليوم</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
      <span class="hint">تاريخ اللعبة:</span>
      <input id="ckY" type="number" min="1900" max="2200" value="1900" style="width:76px" placeholder="السنة">
      <input id="ckM" type="number" min="1" max="12" value="1" style="width:60px" placeholder="الشهر">
      <input id="ckD" type="number" min="1" max="30" value="1" style="width:60px" placeholder="اليوم">
      <button class="btn" style="width:auto;padding:10px 20px" onclick="setGameDate()">ضبط التاريخ وتشغيل الساعة</button>
    </div>
    <p class="hint">بنفس القواعد: كل 24 ساعة واقعية = سنة لعبة — تستمر الساعة بالتقدم تلقائيًا من التاريخ المضبوط.</p>
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
  loadAiConfig();
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
async function loadAiConfig() {
  try {
    const c = await api('GET', '/admin/ai-config');
    document.getElementById('llm_on').checked = !!c.enabled;
    document.getElementById('llm_provider').value = c.provider || 'pollinations';
    document.getElementById('llm_model').value = c.model || '';
    document.getElementById('llm_model').placeholder = c.model || 'openai';
    const free = c.provider === 'pollinations' || c.provider === 'llm7';
    document.getElementById('llm_status').textContent = c.has_key
      ? `المفتاح محفوظ (ينتهي بـ ${c.key_tail}) — الحالة: ${c.enabled ? 'مفعّل 🧠' : 'متوقف'}`
      : free
        ? `المزوّد ${c.provider} مجاني بلا مفتاح — الحالة: ${c.enabled ? 'مفعّل 🧠' : 'متوقف'}`
        : 'هذا المزوّد يحتاج مفتاح API مجانيًا — أدخله واحفظ.';
  } catch (e) { /* صامت */ }
}
async function saveAiConfig() {
  const m = document.getElementById('aimsg');
  try {
    await api('POST', '/admin/ai-config', {
      enabled: document.getElementById('llm_on').checked,
      provider: document.getElementById('llm_provider').value,
      model: document.getElementById('llm_model').value.trim(),
      api_key: document.getElementById('llm_key').value.trim(),
    });
    document.getElementById('llm_key').value = '';
    m.innerHTML = '<p class="hint" style="color:var(--green,#4caf50)">تم الحفظ ✓</p>';
    loadAiConfig();
  } catch (e) { m.innerHTML = `<p class="hint" style="color:#e74c3c">${esc(e.message)}</p>`; }
}
async function testAiConfig() {
  const st = document.getElementById('llm_status');
  st.textContent = 'جارٍ الاختبار…';
  try {
    const r = await api('POST', '/admin/ai-test', {});
    st.textContent = `الاتصال ناجح ✓ — ${r.provider}: ${r.model} (${r.ms}ms)`;
  } catch (e) { st.textContent = 'فشل: ' + e.message; }
}
async function wipeCompanies() {
  if (!confirm('تحذير: سيتم حذف جميع الشركات نهائيًا. متأكد؟')) return;
  if (!confirm('تأكيد أخير — لا رجعة فيه!')) return;
  try {
    const r = await api('POST', '/admin/wipe-companies');
    msg('تم تصفير الشركات ✓ — حُذفت ' + r.deleted + ' شركة', true);
  } catch (e) { msg(e.message, false); }
}
async function endAllWars() {
  if (!confirm('إنهاء كل الحروب النشطة في العالم فورًا (وقف إطلاق نار شامل)؟')) return;
  if (!confirm('تأكيد أخير — كل الحروب ستتحول لمنتهية!')) return;
  try {
    const r = await api('POST', '/admin/end-all-wars');
    msg(`🕊️ تم إنهاء ${r.ended} حربًا — العالم في سلام`, true);
  } catch (e) { msg(e.message, false); }
}
async function anchorClock() {
  if (!confirm('ضبط بداية المحاكاة: 1 يناير 1900 منذ الساعة 6 مساء بتوقيت غرينتش اليوم (الأحد 27 سبتمبر)؟')) return;
  try {
    await api('POST', '/clock/reset', { start_at: '2026-09-27T18:00:00.000Z' });
    msg('تم ✓ — تبدأ المحاكاة من 6 مساء GMT اليوم وتنتقل تلقائيًا', true);
  } catch (e) { msg(e.message, false); }
}
async function setGameDate() {
  const y = +document.getElementById('ckY').value, m = +document.getElementById('ckM').value, d = +document.getElementById('ckD').value;
  if (!confirm(`ضبط زمن اللعبة على ${d}/${m}/${y} وتشغيل الساعة؟`)) return;
  try {
    const r = await api('POST', '/clock/set-date', { year: y, month: m, day: d });
    msg(`تم ✓ — زمن اللعبة الآن: ${r.game.day}/${r.game.month}/${r.game.year}`, true);
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
        <label class="filebtn">${ICONS.img} اختر صورة<input id="favatar" type="file" accept="image/*" class="a11y-hidden"></label>
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
      <input type="file" id="simg" accept="image/*" class="a11y-hidden">
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
  app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
    <div class="thead-title" style="padding:0">برقية</div></div><div class="spin"></div>`;
  try {
    const d = await api('GET', `/dispatches/${id}`);
    app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
  app.innerHTML = `<div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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
      <div class="backrow"><button class="menu-btn" onclick="document.body.classList.toggle('nav-open')" aria-label="القائمة">${MENU_SVG}</button><button class="backbtn" onclick="history.back()">${ICONS.back}</button>
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

// ---------- الحروب ----------
async function vWars() {
  app.innerHTML = thead('الحروب') + '<div id="warbody"><div class="spin"></div></div>';
  let d, col = null;
  try { d = await api('GET', '/wars'); } catch (e) { document.getElementById('warbody').innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; return; }
  try { col = await api('GET', '/colonies'); } catch (x) { col = { colonies: [] }; }
  const wars = d.wars || [];
  const myCC = me && me.country_code;
  const colonies = (col && col.colonies) || [];
  const mine = (w) => myCC && (w.attacker_code === myCC || w.defender_code === myCC);
  const card = (w) => {
    const a = countryOf(w.attacker_code), df = countryOf(w.defender_code);
    const active = w.status === 'active';
    const enemyCC = myCC === w.attacker_code ? w.defender_code : w.attacker_code;
    return `<div class="wpn-card"><div class="wpn-tx">
      <b>${a.flag} ${esc(w.attacker_name)} <span class="hint">ضد</span> ${df.flag} ${esc(w.defender_name)}</b>
      <span class="co-badge ${active ? 'rej' : ''}">${active ? 'نشطة' : 'منتهية'}</span>
      <span>نقاط الحرب: <b dir="ltr">${w.score_a} : ${w.score_b}</b></span>
      <span class="hint">${a.flag} ${hpBar(w.attacker_hp.hp, w.attacker_hp.max_hp)}</span>
      <span class="hint">${df.flag} ${hpBar(w.defender_hp.hp, w.defender_hp.max_hp)}</span>
      <span class="me-btns">
        <button class="btn ghost sm" onclick="warBattles(${w.id})">تفاصيل/معارك</button>
        ${active && mine(w) ? `<button class="btn sm" onclick="warBattle(${w.id},'${enemyCC}')">شن معركة</button>
        <button class="btn ghost sm" onclick="warPeace(${w.id})">سلام</button>` : ''}
      </span>
      <div id="wb-${w.id}"></div>
    </div></div>`;
  };
  const myColonies = myCC ? colonies.filter((c) => c.overlord_code === myCC) : [];
  const myOverlord = myCC ? colonies.find((c) => c.colony_code === myCC) : null;
  const colSec = `<div class="war-sec colony-theater"><div class="war-sec-t colony-title">👑 المستعمرات (${colonies.length})</div>
    ${myOverlord ? `<div class="wpn-card"><div class="wpn-tx"><b>أنت مستعمَرة لـ ${myOverlord.overlord_code ? countryOf(myOverlord.overlord_code).flag : ''} ${esc(myOverlord.overlord_name)}</b>
      <span class="hint">تدفع جزية شهرية ${myOverlord.tribute_pct}% من جبايتك — ولا تعلن الحرب إلا حرب استقلال ضده.</span></div></div>` : ''}
    ${myColonies.length ? '<div class="colony-routes">' + myColonies.map((c) => `<div class="colony-route">
      <span class="cr-over">${countryOf(myCC).flag} ${esc(countryOf(myCC).name)}</span>
      <span class="cr-line"></span>
      <span class="cr-col">${countryOf(c.colony_code).flag} ${esc(c.colony_name)}</span>
      <span class="hint">جزية ${c.tribute_pct}%</span>
      <span class="me-btns"><button class="btn ghost sm" onclick="colonyRelease('${c.colony_code}')">تحرير 🕊️</button></span>
    </div>`).join('') + '</div>' : (myOverlord ? '' : '<div class="empty">لا مستعمرات بعد — أَفنِ نقاط صحة عدوك في المعارك لتستعمره.</div>')}
    ${colonies.length && !myCC ? '<div class="colony-routes">' + colonies.map((c) => `<div class="colony-route">
      <span class="cr-over">${countryOf(c.overlord_code).flag} ${esc(c.overlord_name)}</span>
      <span class="cr-line"></span>
      <span class="cr-col">${countryOf(c.colony_code).flag} ${esc(c.colony_name)}</span>
    </div>`).join('') + '</div>' : ''}
  </div>`;
  const declareBox = myCC ? `<div class="war-sec"><div class="war-sec-t">${ICONS.swords} إعلان حرب</div>
      <div class="map-ed"><div class="field"><label>الدولة المستهدفة</label>
        <select id="war-target">${COUNTRIES.filter((c) => c.code !== myCC).map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select>
      </div></div>
      <p class="hint">${ICONS.alert} تحذير: إعلان الحرب يكسر تلقائيًا مواثيق عدم الاعتداء والتحالفات مع الهدف، ويخفض الاستقرار والدعم الشعبي لدولتك.</p>
      <div class="me-btns"><button class="btn sm" onclick="warDeclare()">إعلان الحرب</button></div>
    </div>` : '<p class="hint">إعلان الحروب وشن المعارك لأصحاب الدول فقط.</p>';
  document.getElementById('warbody').innerHTML = declareBox
    + colSec
    + `<div class="war-sec"><div class="war-sec-t">${ICONS.swords} الحروب (${wars.length})</div>
      ${wars.length ? '<div class="wpn-grid">' + wars.map(card).join('') + '</div>' : '<div class="empty">لا حروب مسجلة — العالم يعيش سلامًا هشًا.</div>'}
    </div>`;
}
async function warBattles(id) {
  const box = document.getElementById('wb-' + id);
  if (!box) return;
  if (box.dataset.open === '1') { box.innerHTML = ''; box.dataset.open = ''; return; }
  box.innerHTML = '<div class="spin"></div>';
  try {
    const d = await api('GET', '/wars/' + id);
    const bs = d.battles || [];
    box.dataset.open = '1';
    const wline = (list, label) => list.length
      ? `<br><span class="hint">${label}: ${list.map((x) => esc(x.weapon_name) + ' ×' + x.qty + (x.lost ? ` (فُقد ${x.lost})` : '')).join('، ')}</span>` : '';
    box.innerHTML = bs.length ? '<div class="liq-log">' + bs.map((b) => {
      const bw = b.weapons || [];
      const strat = (STRATEGIES[b.strategy] || {}).name;
      const cityLine = b.target_city ? `<br><span class="hint">🏙️ ${esc(b.target_city)}${b.direction ? ' — من ' + esc(b.direction) : ''} · دمار ${b.city_damage_pct || 0}% · قتلى مدنيون ${fmtPop(b.city_casualties || 0)}</span>` : (b.direction ? `<br><span class="hint">🧭 من ${esc(b.direction)}</span>` : '');
      return `<div class="liq-row"><span class="liq-rs"><b>${esc(b.winner_name || '')}</b>${strat ? ' · 🎯 ' + strat : ''}${b.region ? ' · ' + esc(b.region) : ''}
        <br><span class="hint">القوة <span dir="ltr">${fmtPop(b.att_units)}/${fmtPop(b.def_units)}</span> · الخسائر <span dir="ltr">${fmtPop(b.att_losses)}/${fmtPop(b.def_losses)}</span> · صحة الطرفين <span dir="ltr">${b.att_hp ?? '—'}/${b.def_hp ?? '—'}</span></span>${cityLine}`
        + wline(bw.filter((x) => x.side === 'attacker'), 'أسلحة الهجوم')
        + wline(bw.filter((x) => x.side === 'defender'), 'أسلحة الدفاع')
        + `</span></div>`;
    }).join('') + '</div>'
      : '<p class="hint">لا معارك مسجلة بعد في هذه الحرب.</p>';
  } catch (e) { box.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}
async function warDeclare() {
  const t = document.getElementById('war-target').value;
  const tn = countryOf(t).name;
  if (!confirm(`إعلان الحرب على ${tn}؟ هذا يكسر مواثيقك معها ويخفض استقرار دولتك.`)) return;
  try { await api('POST', '/war/declare', { target_code: t }); alert('أُعلنت الحرب'); vWars(); }
  catch (e) { alert(e.message); }
}
// قوة النيران لكل صنف سلاح (للعرض — القيم الفعلية تُحسب في السيرفر)
const WFP = { 'بنادق': 1, 'مسدسات': 0.3, 'رشاشات': 6, 'هاونات': 12, 'مدفعية ميدانية': 25, 'مدفعية جبلية': 18, 'مدفعية ثقيلة': 40, 'مدفعية حصار': 60, 'أسلحة أخرى': 4, 'سفن حربية': 50, 'طيران': 30 };
// استراتيجيات الهجوم (للعرض — القيم الفعلية تُحسب في السيرفر)
const STRATEGIES = {
  assault:   { name: 'هجوم مباشر', desc: 'اشتباك تقليدي متوازن' },
  blitz:     { name: 'هجوم خاطف', desc: 'سرعة وحسم — خسائر أعلى للطرفين' },
  siege:     { name: 'حصار', desc: 'خنق بطيء يدمر المدينة المحاصَرة' },
  artillery: { name: 'قصف مدفعي', desc: 'تدمير مركز للمدن والتحصينات' },
  naval:     { name: 'قصف بحري', desc: 'بوارج تدك الساحل — دمار مدني هائل' },
  guerrilla: { name: 'حرب عصابات', desc: 'كمائن واستنزاف بخسائر قليلة' },
};
const DIRECTIONS = ['الشمال', 'الجنوب', 'الشرق', 'الغرب', 'من البحر'];
async function warBattle(id, defenderCC) {
  const myCC = me && me.country_code;
  if (!myCC) return;
  let arsenal = [], defCities = [];
  try { arsenal = ((await api('GET', '/armies/' + myCC)).weapons || []).filter((w) => (WFP[w.class] || 0) > 0); }
  catch (e) { alert(e.message); return; }
  try { const g = await api('GET', '/meta/geo'); defCities = (g.cities && g.cities[defenderCC]) || []; }
  catch (e) { /* بلا مدن */ }
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal-card">
    <div class="m-head"><b>شن معركة — الخطة والجنود والأسلحة</b><button class="m-x" id="wbx">✕</button></div>
    <div class="m-msg"></div>
    <div class="field"><label>🎯 استراتيجية الهجوم</label>
      <select id="wbstrat">${Object.entries(STRATEGIES).map(([k, v]) => `<option value="${k}">${v.name} — ${v.desc}</option>`).join('')}</select></div>
    <div class="field"><label>🧭 اتجاه الهجوم (من أين تهجم؟)</label>
      <select id="wbdir"><option value="">— غير محدد —</option>${DIRECTIONS.map((d) => `<option>${d}</option>`).join('')}</select></div>
    <div class="field"><label>🏙️ المدينة المستهدفة (اختياري — قصفها يدمرها ويخفض إنتاج مصانعها ويقتل مدنيين)</label>
      <select id="wbcity"><option value="">— معركة ميدانية بلا استهداف مدينة —</option>${defCities.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="field"><label>عدد جنود الهجوم (1000 على الأقل)</label>
      <input id="wbunits" type="number" min="1000" value="5000" dir="ltr"></div>
    <div class="field"><label>أسلحة الدعم من ترسانتك (اختياري — حتى 6 أصناف)</label>
      <div id="wbweapons" class="liq-log" style="max-height:260px;overflow:auto">${
        arsenal.length ? arsenal.map((w) => {
          const cap = w.quantity == null ? 30 : Math.max(0, w.quantity);
          return `<div class="liq-row"><span class="liq-rs"><b>${esc(w.name)}</b><br>`
            + `<span class="hint">${esc(w.class || '')} · قوة النيران ${WFP[w.class]} · المخزون: ${w.quantity == null ? 'غير موثق (30 كحد أقصى)' : w.quantity}</span></span>`
            + `<input type="number" min="0" max="${cap}" value="0" data-wid="${w.id}" data-wfp="${WFP[w.class]}" data-wcap="${cap}" dir="ltr" style="width:76px" class="wb-qty" title="العدد المُرسل للمعركة"></div>`;
        }).join('') : '<p class="hint">لا أسلحة في ترسانتك — ستقاتل بالجنود فقط.</p>'
      }</div></div>
    <p class="hint" id="wbpower"></p>
    <div class="me-btns"><button class="btn sm" id="wbfire">شن المعركة</button></div>
    <p class="hint">الأسلحة المُرسلة تُفقد جزئيًا في المعركة (5-10% للمنتصر، 20-30% للمنهزم) وتُخصم من مخزونك. المدافع يدعم تلقائيًا من ترسانته. المعارك تُنقص نقاط صحة الدولتين — ومن تصل صحته لصفر يُستعمَر.</p>
  </div>`;
  document.body.appendChild(ov);
  const m = (t, ok) => { ov.querySelector('.m-msg').innerHTML = t ? `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>` : ''; };
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById('wbx').onclick = close;
  const upd = () => {
    let p = 0;
    ov.querySelectorAll('.wb-qty').forEach((inp) => {
      let v = parseInt(inp.value, 10) || 0;
      const cap = parseInt(inp.dataset.wcap, 10);
      if (v > cap) { v = cap; inp.value = cap; }
      if (v < 0) { v = 0; inp.value = 0; }
      p += v * parseFloat(inp.dataset.wfp);
    });
    document.getElementById('wbpower').textContent = p > 0 ? `قوة نيران الأسلحة المختارة: ${Math.round(p).toLocaleString('en-US')}` : '';
  };
  ov.querySelectorAll('.wb-qty').forEach((inp) => { inp.oninput = upd; });
  document.getElementById('wbfire').onclick = async () => {
    const units = parseInt(document.getElementById('wbunits').value, 10);
    if (!(units >= 1000)) { m('أقل قوة هجوم لمعركة: 1000 جندي'); return; }
    const weapons = [];
    ov.querySelectorAll('.wb-qty').forEach((inp) => {
      const qv = parseInt(inp.value, 10) || 0;
      if (qv > 0) weapons.push({ id: parseInt(inp.dataset.wid, 10), qty: qv });
    });
    if (weapons.length > 6) { m('أقصى 6 أصناف أسلحة في المعركة الواحدة'); return; }
    m('جارٍ شن المعركة…', true);
    try {
      const r = await api('POST', '/war/battle', { war_id: id, units, weapons, strategy: document.getElementById('wbstrat').value, direction: document.getElementById('wbdir').value || null, target_city: document.getElementById('wbcity').value || null });
      const wu = (r.weapons_used || []).map((x) => `${x.name} ×${x.qty}`).join('، ');
      const stratName = (STRATEGIES[r.strategy] || {}).name || '';
      let msg = `انتهت المعركة — المنتصر: ${r.winner_name}${stratName ? ' (' + stratName + ')' : ''}\nخسائر المهاجم ${fmtPop(r.att_losses)} · خسائر المدافع ${fmtPop(r.def_losses)}`;
      if (r.att_hp != null) msg += `\nنقاط الصحة: ${r.att_hp}/${r.att_max_hp} ضد ${r.def_hp}/${r.def_max_hp}`;
      if (r.city_damage_pct) msg += `\n🏙️ دمار ${esc(r.target_city || '')}: ${r.city_damage_pct}% · قتلى مدنيون ${fmtPop(r.city_casualties)}`;
      if (wu) msg += '\nالأسلحة المستخدمة: ' + wu;
      if (r.colonized) msg += `\n👑 استُعمِرت ${r.colonized.colony_name}!`;
      msg += `\nالنقاط: ${r.score_a} : ${r.score_b}`;
      alert(msg);
      close(); vWars();
    } catch (e) { m(e.message, false); }
  };
}
async function warPeace(id) {
  if (!confirm('طلب السلام في هذه الحرب؟ (تفاوضي بموافقة الطرفين، أو مفروض مع تعويضات عند تفوق ساحق)')) return;
  try {
    const r = await api('POST', '/war/peace', { war_id: id });
    if (r.enforced) alert(`سلام مفروض! المنتصر: ${r.winner_name} — تعويضات ${fmtRate(r.reparations)} مليون $`);
    else if (r.negotiated) alert('تم السلام التفاوضي');
    else alert('أُرسل عرض السلام للطرف الآخر — بانتظار قبوله');
    vWars();
  } catch (e) { alert(e.message); }
}
async function colonyRelease(code) {
  if (!confirm('تحرير هذه المستعمَرة ومنحها الاستقلال؟')) return;
  try { await api('POST', '/colonies/' + code + '/release'); alert('تم التحرير 🕊️'); vWars(); }
  catch (e) { alert(e.message); }
}

// ---------- مختبر الأسلحة ----------
const WORKSHOP_CLASSES = ['بنادق', 'رشاشات', 'مدفعية ميدانية', 'مدفعية ثقيلة', 'مدفعية حصار', 'هاونات', 'سفن حربية', 'طيران'];
async function vWorkshop() {
  if (!me) { location.hash = '#/login'; return; }
  const myCC = me.country_code;
  if (!myCC) { app.innerHTML = thead('مختبر الأسلحة') + '<div class="empty">اختراع الأسلحة لأصحاب الدول فقط.</div>'; return; }
  let mine = [];
  try {
    const d = await api('GET', '/armies/' + myCC);
    mine = (d.weapons || []).filter((w) => w.confidence === 'custom');
  } catch (e) { /* فارغ */ }
  app.innerHTML = thead('مختبر الأسلحة')
    + `<div class="war-sec workshop-hero"><div class="war-sec-t">${ICONS.zap} ابتكر سلاحًا جديدًا</div>
      <p class="hint">سمِّ سلاحك، اختر صنفه وكميته — يُضاف فورًا لترسانة ${esc(countryOf(myCC).name)} ويظهر في خيارات المعارك. القوة النارية حسب الصنف.</p>
      <div class="field"><label>اسم السلاح</label><input id="wsc-name" maxlength="80" placeholder="مثال: مدفع الرعد 75 ملم"></div>
      <div class="field"><label>الصنف (يحدد قوة النيران)</label>
        <select id="wsc-class">${WORKSHOP_CLASSES.map((c) => `<option value="${c}">${c} — قوة ${WFP[c] ?? '؟'}</option>`).join('')}</select></div>
      <div class="field"><label>الكمية (1–10000)</label><input id="wsc-qty" type="number" min="1" max="10000" value="100" dir="ltr"></div>
      <div class="field"><label>ملاحظة (اختياري)</label><input id="wsc-note" maxlength="300" placeholder="وصف مختصر للسلاح"></div>
      <div class="me-btns"><button class="btn sm" onclick="workshopInvent()">🧪 ابتكار وإضافة للترسانة</button></div>
      <div id="wsc-msg" style="margin-top:8px"></div>
    </div>
    <div class="war-sec"><div class="war-sec-t">أسلحتك المبتكرة (${mine.length})</div>
      ${mine.length ? '<div class="wpn-grid">' + mine.map((w) => `<div class="wpn-card"><div class="wpn-tx">
        <b>🧪 ${esc(w.name)}</b><span class="conf-badge conf-custom">ابتكارك</span>
        <span class="hint">${esc(w.class || '')} · قوة النيران ${WFP[w.class] ?? '؟'} · الكمية ${w.quantity ?? '—'}</span>
        ${w.note ? `<span class="hint">${esc(w.note)}</span>` : ''}
        <span class="me-btns"><button class="btn ghost sm" onclick="workshopDelete(${w.id})">حذف</button></span>
      </div></div>`).join('') + '</div>' : '<div class="empty">لم تبتكر أسلحة بعد — مختبرك بانتظار أول اختراع.</div>'}
    </div>`;
}
async function workshopInvent() {
  const msg = (t, ok) => { const el = document.getElementById('wsc-msg'); if (el) el.innerHTML = t ? `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>` : ''; };
  const name = document.getElementById('wsc-name').value.trim();
  const cls = document.getElementById('wsc-class').value;
  const qty = parseInt(document.getElementById('wsc-qty').value, 10);
  const note = document.getElementById('wsc-note').value.trim();
  if (!name) { msg('اكتب اسم السلاح أولًا', false); return; }
  if (!(qty >= 1 && qty <= 10000)) { msg('الكمية يجب أن تكون بين 1 و10000', false); return; }
  msg('جارٍ الابتكار…', true);
  try {
    const r = await api('POST', '/weapons/custom', { name, class: cls, qty, note });
    msg(`تم! "${name}" انضم لترسانتك بقوة نيران ${r.firepower} للقطعة.`, true);
    setTimeout(vWorkshop, 900);
  } catch (e) { msg(e.message, false); }
}
async function workshopDelete(id) {
  if (!confirm('حذف هذا السلاح المبتكر نهائيًا من ترسانتك؟')) return;
  try { await api('DELETE', '/weapons/custom/' + id); vWorkshop(); }
  catch (e) { alert(e.message); }
}

// ---------- الدبلوماسية ----------
const TREATY_OPTS = [
  ['non_aggression', 'ميثاق عدم اعتداء'], ['alliance', 'تحالف عسكري'], ['defensive', 'تحالف دفاعي'],
  ['trade', 'اتفاقية تجارية'], ['military_access', 'حق العبور العسكري'], ['embargo', 'حظر تجاري'], ['peace', 'معاهدة سلام'],
];
async function vDiplomacy() {
  if (!me) { location.hash = '#/login'; return; }
  const myCC = me.country_code;
  app.innerHTML = thead('الدبلوماسية') + '<div id="dipbody"><div class="spin"></div></div>';
  let d, rep = null, pol = {};
  try {
    d = await api('GET', '/treaties');
    if (myCC) {
      try { rep = (await api('GET', '/treaties/' + myCC)).reputation; } catch (x) {}
      try { pol = (await api('GET', '/autopolicy')).policies || {}; } catch (x) {}
    }
  } catch (e) { document.getElementById('dipbody').innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; return; }
  const POL_OPTS = [['manual', 'يدوي — أقرر بنفسي'], ['accept', 'قبول تلقائي'], ['reject', 'رفض تلقائي']];
  const POL_ROWS = [...TREATY_OPTS.map(([v, l]) => [v, l]), ['peace_offer', 'عروض السلام']];
  const polRow = ([v, l]) => `<div class="field"><label>${esc(l)}</label>
    <select data-pol="${v}" onchange="autopolicySet('${v}', this.value)">
      ${POL_OPTS.map(([pv, pl]) => `<option value="${pv}"${(pol[v] || 'manual') === pv ? ' selected' : ''}>${pl}</option>`).join('')}
    </select></div>`;
  const polSec = myCC ? `<div class="war-sec"><div class="war-sec-t">${ICONS.gear} القبول والرفض التلقائي</div>
    <div class="map-ed">${POL_ROWS.map(polRow).join('')}</div>
    <p class="hint">أي عرض يصلك يُقرَّر تلقائيًا حسب سياستك — حتى وأنت غائب. القبول التلقائي لا يشمل دولة في حرب معك.</p></div>` : '';
  const ts = d.treaties || [];
  const tCard = (t, btns) => `<div class="wpn-card"><div class="wpn-tx">
      <b>${esc(t.type_label || t.type)}</b> ${t.secret ? `<span class="co-badge">${ICONS.lock} سرية</span>` : ''}
      <span>${esc(t.from_name || '')} ${countryOf(t.from_code).flag} ←→ ${countryOf(t.to_code).flag} ${esc(t.to_name || '')}</span>
      <span class="hint">الحالة: ${t.status === 'active' ? 'نشطة' : t.status === 'proposed' ? 'مقترحة' : esc(t.status)}</span>
      ${btns ? `<span class="me-btns">${btns}</span>` : ''}
    </div></div>`;
  const incoming = myCC ? ts.filter((t) => t.status === 'proposed' && t.to_code === myCC) : [];
  const outgoing = myCC ? ts.filter((t) => t.status === 'proposed' && t.from_code === myCC) : [];
  const active = myCC ? ts.filter((t) => t.status === 'active' && (t.from_code === myCC || t.to_code === myCC)) : [];
  document.getElementById('dipbody').innerHTML = `
    ${myCC && rep != null ? `<div class="war-sec"><div class="war-sec-t">${ICONS.doc} سمعتك الدبلوماسية</div>
      <div class="map-ed"><div class="field"><label>السمعة (من 100)</label><div class="stat-v" style="font-size:20px">${rep}</div></div></div>
      <p class="hint">كسر المعاهدات يخصم 20 نقطة. الانكشاف في عمليات تجسس يخصم 5.</p></div>` : ''}
    ${polSec}
    ${incoming.length ? `<div class="war-sec"><div class="war-sec-t">${ICONS.bell} مقترحات واردة (${incoming.length})</div>
      <div class="wpn-grid">${incoming.map((t) => tCard(t,
        `<button class="btn sm" onclick="treatyAccept(${t.id})">قبول</button><button class="btn ghost sm" onclick="treatyReject(${t.id})">رفض</button>`)).join('')}</div></div>` : ''}
    ${active.length ? `<div class="war-sec"><div class="war-sec-t">${ICONS.shield} معاهداتي النشطة (${active.length})</div>
      <div class="wpn-grid">${active.map((t) => tCard(t,
        `<button class="btn ghost sm" onclick="treatyBreak(${t.id})">كسر المعاهدة</button>`)).join('')}</div></div>` : ''}
    ${outgoing.length ? `<div class="war-sec"><div class="war-sec-t">${ICONS.send} مقترحاتي المعلقة (${outgoing.length})</div>
      <div class="wpn-grid">${outgoing.map((t) => tCard(t, '')).join('')}</div></div>` : ''}
    ${!incoming.length && !active.length && !outgoing.length ? '<div class="empty">لا معاهدات بعد — اقترح أول معاهدة لك.</div>' : ''}
    ${myCC ? `<div class="war-sec"><div class="war-sec-t">${ICONS.doc} اقتراح معاهدة جديدة</div>
      <div class="map-ed">
        <div class="field"><label>الدولة</label><select id="tr-to">${COUNTRIES.filter((c) => c.code !== myCC).map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>النوع</label><select id="tr-type">${TREATY_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="field"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="tr-secret"> معاهدة سرية (لا يراها إلا الطرفان)</label></div>
      </div>
      <div class="me-btns"><button class="btn sm" onclick="treatyPropose()">إرسال الاقتراح</button></div>
    </div>` : '<p class="hint">اقتراح المعاهدات لأصحاب الدول فقط.</p>'}`;
}
async function treatyPropose() {
  try {
    await api('POST', '/treaties/propose', {
      to_code: val('tr-to'), type: document.getElementById('tr-type').value,
      secret: document.getElementById('tr-secret').checked,
    });
    alert('أُرسل الاقتراح للدولة الأخرى'); vDiplomacy();
  } catch (e) { alert(e.message); }
}
async function treatyAccept(id) {
  try { await api('POST', '/treaties/' + id + '/accept'); alert('تم قبول المعاهدة'); vDiplomacy(); }
  catch (e) { alert(e.message); }
}
async function treatyReject(id) {
  if (!confirm('رفض هذه المعاهدة؟')) return;
  try { await api('POST', '/treaties/' + id + '/reject'); vDiplomacy(); }
  catch (e) { alert(e.message); }
}
async function treatyBreak(id) {
  if (!confirm('كسر هذه المعاهدة؟ تحذير: ستخسر 20 نقطة من سمعتك الدبلوماسية.')) return;
  try { await api('POST', '/treaties/' + id + '/break'); alert('كُسرت المعاهدة — خسرت 20 نقطة سمعة'); vDiplomacy(); }
  catch (e) { alert(e.message); }
}
async function autopolicySet(type, policy) {
  try { await api('PUT', '/autopolicy', { type, policy }); toast('حُفظت السياسة ✓'); }
  catch (e) { alert(e.message); vDiplomacy(); }
}

// ---------- الاستخبارات ----------
const INTEL_OPTS = [
  ['military', 'عسكري — 60 مليون $'], ['economy', 'اقتصادي — 40 مليون $'], ['stability', 'سياسي — 30 مليون $'],
];
const _rangeLine = (lbl, v) => {
  if (v == null) return '';
  if (typeof v === 'object') return `<span>${lbl}: <b dir="ltr">${fmtPop(v.low)} – ${fmtPop(v.estimate)} – ${fmtPop(v.high)}</b></span>`;
  return `<span>${lbl}: <b>${esc(String(v))}</b></span>`;
};
const _repCard = (r) => {
  const tc = countryOf(r.target_code);
  const dt = r.data || {};
  return `<div class="wpn-card"><div class="wpn-tx">
    <b>${tc.flag} ${esc(r.target_name || tc.name)}</b> <span class="co-badge">${esc(r.kind_label || r.kind || '')}</span>
    <span class="hint">الثقة: ${esc(r.confidence || '—')}</span>
    ${_rangeLine('الجنود', dt.soldiers)}${_rangeLine('الجاهزية', dt.readiness)}${_rangeLine('المعنويات', dt.morale)}
    ${_rangeLine('السيولة (مليون $)', dt.liquidity_m_usd)}${_rangeLine('الضريبة %', dt.tax_rate)}
    ${_rangeLine('الاستقرار', dt.stability)}${_rangeLine('الدعم الشعبي', dt.public_support)}${_rangeLine('خطر الثورة', dt.revolt_risk)}
    <span class="hint">تنتهي صلاحية التقرير بعد 3 أشهر لعبة.</span>
  </div></div>`;
};
async function vIntel() {
  if (!me) { location.hash = '#/login'; return; }
  const myCC = me.country_code;
  if (!myCC) { app.innerHTML = thead('الاستخبارات') + '<div class="empty">الاستخبارات لأصحاب الدول فقط.</div>'; return; }
  app.innerHTML = thead('الاستخبارات') + '<div id="intelbody"><div class="spin"></div></div>';
  let st, reps;
  try {
    [st, reps] = await Promise.all([api('GET', '/intel/status'), api('GET', '/intel/reports')]);
  } catch (e) { document.getElementById('intelbody').innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; return; }
  const attempts = st.attempts || [];
  const reports = reps.reports || [];
  document.getElementById('intelbody').innerHTML = `
    <div class="war-sec"><div class="war-sec-t">${ICONS.shield} الأمن المضاد</div>
      <div class="map-ed"><div class="field"><label>مستواك الأمني الحالي: <b>${st.level}/100</b></label>
        <input id="sec-level" type="number" min="0" max="100" value="${st.level}" dir="ltr"></div></div>
      <p class="hint">التكلفة: 1 مليون $ لكل نقطة فوق مستواك الحالي. الأمن الأعلى يكشف جواسيس العدو — والانكشاف فضيحة تخصم 5 نقاط سمعة.</p>
      <div class="me-btns"><button class="btn sm" onclick="intelSecurity()">رفع المستوى</button></div>
    </div>
    ${attempts.length ? `<div class="war-sec"><div class="war-sec-t">${ICONS.alert} محاولات مكتشفة ضدك (${attempts.length})</div>
      <div class="liq-log">${attempts.map((a) => `<div class="liq-row"><span class="liq-rs"><b>${esc(a.spy_name || a.spy_code)}</b> · ${esc(a.kind_label || '')}</span></div>`).join('')}</div></div>` : ''}
    <div class="war-sec"><div class="war-sec-t">${ICONS.search} عملية تجسس جديدة</div>
      <div class="map-ed">
        <div class="field"><label>الدولة المستهدفة</label><select id="spy-target">${COUNTRIES.filter((c) => c.code !== myCC).map((c) => `<option value="${c.code}">${c.flag} ${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>نوع العملية</label><select id="spy-kind">${INTEL_OPTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      </div>
      <p class="hint">عملية واحدة لكل هدف شهريًا (زمن اللعبة). النجاح غير مضمون — والفوضى تساعد الجواسيس.</p>
      <div class="me-btns"><button class="btn sm" onclick="intelSpy()">تنفيذ العملية</button></div>
      <div id="spy-result"></div>
    </div>
    <div class="war-sec"><div class="war-sec-t">${ICONS.folder} تقاريري الاستخبارية (${reports.length})</div>
      ${reports.length ? '<div class="wpn-grid">' + reports.map(_repCard).join('') + '</div>' : '<div class="empty">لا تقارير بعد — نفّذ عمليتك الأولى.</div>'}
    </div>`;
}
async function intelSpy() {
  const box = document.getElementById('spy-result');
  if (!box) return;
  box.innerHTML = '<div class="spin"></div>';
  try {
    const r = await api('POST', '/intel/spy', { target_code: val('spy-target'), kind: document.getElementById('spy-kind').value });
    let h = `<div class="wpn-card" style="margin-top:10px"><div class="wpn-tx">
      <b>${r.success ? 'نجحت العملية' : 'فشلت العملية'}</b>
      <span class="co-badge ${r.success ? '' : 'rej'}">${r.success ? 'نجاح' : 'فشل'}</span>
      ${r.detected ? `<span class="co-badge rej">${ICONS.alert} انكشفنا! -5 سمعة</span>` : ''}
      <span>التكلفة: ${fmtRate(r.cost)} مليون $</span>`;
    if (r.success && r.report) {
      h += `<span class="hint">الثقة: ${esc(r.report.confidence || '—')} — الأرقام تقديرات بنطاق ثقة وليست دقيقة</span>`;
      const dt = r.report.data || {};
      h += _rangeLine('الجنود', dt.soldiers) + _rangeLine('الجاهزية', dt.readiness) + _rangeLine('المعنويات', dt.morale)
        + _rangeLine('السيولة (مليون $)', dt.liquidity_m_usd) + _rangeLine('الضريبة %', dt.tax_rate)
        + _rangeLine('الاستقرار', dt.stability) + _rangeLine('الدعم الشعبي', dt.public_support) + _rangeLine('خطر الثورة', dt.revolt_risk);
    } else {
      h += `<span class="hint">${esc(r.note || '')}</span>`;
    }
    box.innerHTML = h + '</div></div>';
  } catch (e) { box.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
}
async function intelSecurity() {
  const lvl = parseInt(document.getElementById('sec-level').value, 10);
  if (!(lvl >= 0 && lvl <= 100)) { alert('المستوى بين 0 و 100'); return; }
  try {
    const r = await api('POST', '/intel/security', { level: lvl });
    alert(r.cost ? `رُفع الأمن إلى ${r.level} — التكلفة ${fmtRate(r.cost)} مليون $` : 'المستوى الحالي مساوٍ أو أعلى — لا تكلفة');
    vIntel();
  } catch (e) { alert(e.message); }
}

// ---------- سجل التدقيق (مطورون) ----------
async function vAudit() {
  if (!me || me.role !== 'developer') { location.hash = '#/'; return; }
  app.innerHTML = thead('سجل التدقيق') + '<div id="auditbody"><div class="spin"></div></div>';
  try {
    const d = await api('GET', '/admin/audit?limit=100');
    const rows = d.audit || [];
    document.getElementById('auditbody').innerHTML = rows.length
      ? '<div class="liq-log">' + rows.map((a) =>
        `<div class="liq-row"><span class="liq-amt">${esc(String(a.id))}</span>
          <span class="liq-rs"><b>${esc(a.action || '')}</b> · ${esc(a.actor || '—')}
          ${a.details ? `<br><span class="hint">${esc(a.details)}</span>` : ''}
          <br><time>${new Date(a.created_at).toLocaleString('ar-EG')}</time></span>
        </div>`).join('') + '</div>'
      : '<div class="empty">لا سجلات تدقيق بعد.</div>';
  } catch (e) { document.getElementById('auditbody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ---------- التوجيه ----------

// ---------- المستشار (ARGOS AI Advisor) ----------
let ADV = { state: null, tasks: [], hist: [], modeSel: 1 };
const ADV_DOMAINS = [['economy', 'الاقتصاد'], ['media', 'الإعلام'], ['companies', 'الشركات'], ['military', 'الجيش'], ['diplomacy', 'الدبلوماسية'], ['intel', 'الاستخبارات']];
const ADV_RISK_L = { low: 'منخفضة', medium: 'متوسطة', high: 'مرتفعة' };
const _advL = (t, arr) => (arr && arr.length) ? `<h4>${t}</h4><ul>${arr.map((x) => `<li>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '';

function _advBriefCard(b) {
  if (!b) return '<div class="empty">لا يوجد تقرير.</div>';
  let body = '';
  if (b.kind === 'economic') {
    body = _advL('المشاكل الرئيسية', b.problems) + _advL('الفرص', b.opportunities) + _advL('المخاطر', b.risks)
      + (b.options && b.options.length ? `<h4>الخيارات الاستراتيجية</h4><ul>${b.options.map((o) => `<li><b>${esc(o.label)}</b> — ${esc(o.desc)}</li>`).join('')}</ul>` : '');
  } else if (b.kind === 'military') {
    body = (b.status ? `<p><b>الوضع:</b> ${esc(b.status)}</p>` : '')
      + _advL('نقاط القوة', b.strengths) + _advL('نقاط الضعف', b.weaknesses) + _advL('المخاطر', b.risks) + _advL('الاحتياجات', b.needs)
      + (b.options && b.options.length ? `<h4>الخيارات الممكنة</h4><ul>${b.options.map((o) => `<li><b>${esc(o.label)}</b> — ${esc(o.desc)}</li>`).join('')}</ul>` : '')
      + (b.warn ? `<div class="adv-warn">⚠️ ${esc(b.warn)}</div>` : '');
  } else if (b.kind === 'intel') {
    body = (b.about ? `<p><b>الموضوع:</b> ${esc(b.about)}</p>` : '')
      + (b.confirmed && b.confirmed.length ? `<h4>معلومات مؤكدة</h4><ul>${b.confirmed.map((x) => `<li><b>${esc(x.level)}</b> — ${esc(x.text)}</li>`).join('')}</ul>` : '')
      + (b.assessments && b.assessments.length ? `<h4>التقديرات الاستخبارية</h4><ul>${b.assessments.map((x) => `<li><b>${esc(x.target)}</b> [${esc(x.confidence)}]</li>`).join('')}</ul>` : '');
  } else if (b.kind === 'diplomacy') {
    body = `<p><b>السمعة الدبلوماسية:</b> ${esc(String(b.reputation))}/100</p>`
      + (b.active_treaties && b.active_treaties.length ? `<h4>معاهدات نشطة</h4><ul>${b.active_treaties.map((t) => `<li>${esc(t.label || t.type)} — مع ${esc(countryOf(t.with).name)}${t.secret ? ' (سرية)' : ''}</li>`).join('')}</ul>` : '')
      + _advL('توصياتي', b.suggestions);
  } else if (b.kind === 'cabinet') {
    body = b.ministers.map((x) => `<div class="adv-min"><div class="r">${esc(x.icon || '')} ${esc(x.role)}</div><div class="s">«${esc(x.say)}»</div></div>`).join('')
      + `<div class="adv-chief"><div class="r">🧠 المستشار العام</div><div class="s">«${esc(b.chief || '')}»</div></div>`
      + `<div class="adv-warn">«قرار القائد» — القرار الأخير لك وحدك.</div>`;
  } else if (b.kind === 'daily') {
    body = `<p>${esc(b.summary || '')}</p>` + Object.entries(b.sections || {})
      .filter(([, v]) => v && v.length)
      .map(([k, v]) => `<h4>${esc(k)}</h4><ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('');
  }
  return `<div class="adv-dossier"><div class="adv-dos-h">${esc(b.title || 'تقرير')}${b.date ? `<span>${esc(b.date)}</span>` : ''}</div>
    <div class="adv-dos-b">${body || '<div class="empty">لا بنود.</div>'}</div>
    ${b.note ? `<div class="adv-dos-note">${esc(b.note)}</div>` : ''}</div>`;
}

function advMsgHTML(m) {
  const t = esc(m.text).replace(/\n/g, '<br>');
  if (m.role === 'user') return `<div class="adv-m u"><div class="adv-m-b">${t}</div></div>`;
  const nm = ADV.state && ADV.state.advisor ? ADV.state.advisor.name : 'المستشار';
  return `<div class="adv-m a"><div class="adv-m-h">${esc(nm)} · المستشار العام</div><div class="adv-m-b">${t}</div></div>`;
}

function advRenderModes() {
  const el = document.getElementById('adv-modes');
  if (!el) return;
  const modes = [[1, 'مستشار', 'يقترح فقط — لا ينفذ'], [2, 'مساعد تنفيذي', 'ينفذ بإذنك دائمًا'], [3, 'مدير مفوض', 'تحكم آلي كامل كل شهر لعبة في المجالات المفوَّضة']];
  el.innerHTML = modes.map(([v, t, d]) =>
    `<button class="adv-mode${ADV.modeSel === v ? ' sel' : ''}" onclick="advMode(${v})">${t}<p>${d}</p></button>`).join('');
  const dm = document.getElementById('adv-domains');
  if (dm) {
    const cur = (ADV.state && ADV.state.advisor.domains) || {};
    dm.innerHTML = ADV_DOMAINS.map(([k, l]) =>
      `<label><input type="checkbox" value="${k}"${cur[k] ? ' checked' : ''}${ADV.modeSel === 3 ? '' : ' disabled'}> ${l}</label>`).join('');
  }
}
function advMode(v) { ADV.modeSel = v; advRenderModes(); }

async function advSaveSettings() {
  const msg = document.getElementById('adv-set-msg');
  const domains = {};
  document.querySelectorAll('#adv-domains input[type=checkbox]').forEach((c) => { domains[c.value] = c.checked; });
  if (msg) msg.textContent = 'جارٍ الحفظ...';
  try {
    const r = await api('POST', '/advisor/settings', { mode: ADV.modeSel, domains });
    ADV.state.advisor.mode = r.settings.mode;
    ADV.state.advisor.domains = r.settings.domains;
    ADV.state.advisor.autonomy = r.settings.mode === 1 ? 'مستشار' : r.settings.mode === 2 ? 'مساعد تنفيذي' : 'مدير مفوض';
    if (msg) msg.textContent = 'حُفظت الإعدادات بنجاح.';
    advRenderModes();
  } catch (e) { if (msg) msg.textContent = e.message || 'تعذر الحفظ'; }
}

async function advBrief(kind) {
  const out = document.getElementById('adv-brief-out');
  if (!out) return;
  out.innerHTML = '<div class="spin"></div>';
  try {
    const r = await api('GET', '/advisor/brief/' + kind);
    out.innerHTML = _advBriefCard(r.brief);
  } catch (e) { out.innerHTML = `<div class="empty">${esc(e.message || 'تعذر التحميل')}</div>`; }
}

function advTaskHTML(t) {
  return `<div class="adv-task">
    <div class="adv-task-h"><span>⚠️ قرار يحتاج موافقتك</span><span class="adv-risk ${esc(t.risk || 'low')}">مخاطرة ${esc(ADV_RISK_L[t.risk] || t.risk || 'منخفضة')}</span></div>
    <div class="adv-task-t">${esc(t.title)}</div>
    ${t.detail ? `<div class="adv-task-d">${esc(t.detail)}</div>` : ''}
    <div class="adv-task-date">${esc(t.date || '')}</div>
    <div class="adv-task-btns"><button class="btn sm" onclick="advDecide(${t.id},1)">موافقة</button>
    <button class="btn ghost sm" onclick="advDecide(${t.id},0)">رفض</button></div></div>`;
}
async function advLoadTasks() {
  try {
    const r = await api('GET', '/advisor/tasks');
    ADV.tasks = r.tasks || [];
    const box = document.getElementById('adv-tasks');
    if (box) box.innerHTML = ADV.tasks.length ? ADV.tasks.map(advTaskHTML).join('') : '<div class="empty">لا قرارات معلقة — المستشار بانتظار توجيهاتك.</div>';
    const n = document.getElementById('adv-task-n');
    if (n) n.textContent = ADV.tasks.length;
  } catch (e) { /* تجاهل */ }
}
async function advDecide(id, okv) {
  try {
    await api('POST', `/api/advisor/tasks/${id}/${okv ? 'approve' : 'reject'}`);
    advLoadTasks();
    try {
      const st = await api('GET', '/advisor/state');
      ADV.state = st;
      const p = document.getElementById('adv-pend');
      if (p) p.textContent = st.pending_approvals;
    } catch (e) { /* تجاهل */ }
  } catch (e) { alert(e.message || 'تعذر تنفيذ القرار'); }
}

async function advSend(preset) {
  const inp = document.getElementById('adv-text');
  const text = String(preset || (inp && inp.value) || '').trim();
  if (!text) return;
  if (inp) inp.value = '';
  const box = document.getElementById('adv-chat');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', advMsgHTML({ role: 'user', text }));
  box.scrollTop = box.scrollHeight;
  const tp = document.createElement('div');
  tp.className = 'adv-m a';
  tp.innerHTML = '<div class="adv-m-b"><div class="spin"></div></div>';
  box.appendChild(tp);
  box.scrollTop = box.scrollHeight;
  try {
    const r = await api('POST', '/advisor/chat', { text });
    tp.remove();
    box.insertAdjacentHTML('beforeend', advMsgHTML({ role: 'advisor', text: r.reply }));
    if (r.brief) {
      const out = document.getElementById('adv-brief-out');
      if (out) out.innerHTML = _advBriefCard(r.brief);
    }
    if (r.tasks && r.tasks.length) advLoadTasks();
  } catch (e) {
    tp.remove();
    box.insertAdjacentHTML('beforeend', advMsgHTML({ role: 'advisor', text: 'المستشار غير متاح مؤقتًا — اللعبة تعمل طبيعيًا. حاول مجددًا.' }));
  }
  box.scrollTop = box.scrollHeight;
}

async function vAdvisor() {
  if (!me) { location.hash = '#/login'; return; }
  if (!me.country_code) { app.innerHTML = thead('المستشار') + '<div class="empty">اختر دولة أولًا ليكون لك مستشار.</div>'; return; }
  app.innerHTML = thead('المستشار') + '<div class="adv" id="advbody"><div class="spin"></div></div>';
  let st;
  try {
    const [s, tk, hs] = await Promise.all([
      api('GET', '/advisor/state'),
      api('GET', '/advisor/tasks'),
      api('GET', '/advisor/history'),
    ]);
    st = s; ADV.state = s; ADV.tasks = tk.tasks || []; ADV.hist = hs.messages || []; ADV.modeSel = s.advisor.mode || 1;
  } catch (e) {
    document.getElementById('advbody').innerHTML = `<div class="empty">${esc(e.message || 'المستشار غير متاح مؤقتًا')}</div>`;
    return;
  }
  const a = st.advisor, c = countryOf(st.country.code), cards = st.cards || {};
  const cardDef = [['الخزينة', cards.treasury], ['الاقتصاد', cards.economy], ['الجيش', cards.military], ['الاستقرار', cards.stability], ['الحرب', cards.war], ['الدبلوماسية', cards.diplomacy], ['الاستخبارات', cards.intel]];
  document.getElementById('advbody').innerHTML = `
    <div class="adv-head">
      <div class="adv-head-top"><span class="adv-logo">ARGOS AI</span><span class="adv-online"><i></i> ${esc(a.status || 'متصل')}</span></div>
      <div class="adv-head-title">المستشار العام</div>
      <div class="adv-head-country">${esc(c.flag)} ${esc(st.country.name)} — ${esc(a.name)}</div>
      <div class="adv-head-meta">النموذج: ${esc(a.model || 'ARGOS ADVISOR')} · الدور: ${esc(a.role || 'Chief State Advisor')}</div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">موجز الدولة — ${esc(st.country.date || '')}</div>
      <div class="adv-cards">${cardDef.map(([k, v]) => `<div class="adv-card"><div class="k">${k}</div><div class="v">${esc(v || 'غير متاح')}</div></div>`).join('')}</div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">لوحة الحالة</div>
      <div class="adv-status">
        <span class="k">AI STATUS</span><span class="v adv-online"><i></i> ONLINE</span>
        <span class="k">MODEL</span><span class="v">${esc(a.model || 'ARGOS ADVISOR')}</span>
        <span class="k">ROLE</span><span class="v">${esc(a.role || 'Chief State Advisor')}</span>
        <span class="k">AUTONOMY</span><span class="v">${esc(a.autonomy || '')}</span>
        <span class="k">ACTIVE TASKS</span><span class="v">${st.active_tasks}</span>
        <span class="k">PENDING APPROVALS</span><span class="v" id="adv-pend">${st.pending_approvals}</span>
        <span class="k">LAST UPDATE</span><span class="v">${esc(st.last_update || '')}</span>
      </div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">مستوى الاستقلالية</div>
      <div class="adv-modes" id="adv-modes"></div>
      <div class="adv-domains" id="adv-domains"></div>
      <p class="hint">مجالات التفويض تُفعَّل في وضع «مدير مفوض» فقط — والقرارات الحساسة تبقى بموافقتك دائمًا.</p>
      <div class="me-btns"><button class="btn sm" onclick="advSaveSettings()">حفظ الإعدادات</button></div>
      <div id="adv-set-msg" class="hint"></div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">تقارير المستشار</div>
      <div class="adv-brief-btns">
        <button onclick="advBrief('economic')">تحليل الاقتصاد</button>
        <button onclick="advBrief('military')">تحليل الجيش</button>
        <button onclick="advBrief('diplomacy')">الموجز الدبلوماسي</button>
        <button onclick="advBrief('intel')">تقرير استخباري</button>
        <button onclick="advBrief('daily')">الموجز اليومي</button>
      </div>
      <div id="adv-brief-out"><p class="hint">اختر تقريرًا ليعرضه المستشار من واقع سجلات دولتك.</p></div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">الإجراءات المعلقة (<span id="adv-task-n">${ADV.tasks.length}</span>)</div>
      <div id="adv-tasks">${ADV.tasks.length ? ADV.tasks.map(advTaskHTML).join('') : '<div class="empty">لا قرارات معلقة — المستشار بانتظار توجيهاتك.</div>'}</div>
    </div>
    <div class="adv-sec"><div class="adv-sec-t">مكتب المستشار — المحادثة</div>
      <div class="adv-quick">
        <button onclick="advSend('ما هي حالة دولتي؟')">تحليل الدولة</button>
        <button onclick="advSend('حلل الاقتصاد')">تحليل الاقتصاد</button>
        <button onclick="advSend('حلل وضعي العسكري')">تحليل الجيش</button>
        <button onclick="advBrief('daily')">آخر الأخبار</button>
        <button onclick="advSend('أريد تقريرًا استخباريًا')">تقرير استخباراتي</button>
        <button onclick="advSend('اجتماع مجلس الوزراء')">اجتماع مجلس الوزراء</button>
        <button onclick="document.getElementById('adv-tasks').scrollIntoView({behavior:'smooth'})">القرارات المعلقة</button>
      </div>
      <div class="adv-chat" id="adv-chat">${ADV.hist.map(advMsgHTML).join('') || '<div class="empty">ابدأ الحديث مع مستشارك — سيدي.</div>'}</div>
      <div class="adv-input">
        <input id="adv-text" placeholder="اكتب للمستشار... (مثال: حلل الاقتصاد)" onkeydown="if(event.key==='Enter')advSend()">
        <button class="btn" onclick="advSend()">${ICONS.send}</button>
      </div>
    </div>`;
  advRenderModes();
  const ch = document.getElementById('adv-chat');
  if (ch) ch.scrollTop = ch.scrollHeight;
}

// ---------- مجلس الوزراء ----------
async function vCabinet() {
  if (!me) { location.hash = '#/login'; return; }
  if (!me.country_code) { app.innerHTML = thead('مجلس الوزراء') + '<div class="empty">اختر دولة أولًا.</div>'; return; }
  app.innerHTML = thead('مجلس الوزراء') + `<div class="adv">
    <div class="adv-head"><div class="adv-head-top"><span class="adv-logo">ARGOS AI</span><span class="adv-online"><i></i> متصل</span></div>
      <div class="adv-head-title">🏛️ مجلس الوزراء</div>
      <div class="adv-head-country">${esc(countryOf(me.country_code).flag)} ${esc(countryOf(me.country_code).name)}</div></div>
    <div class="adv-sec"><div class="adv-sec-t">جلسة وزارية</div>
      <p class="hint">اجمع وزراءك لسماع مداخلاتهم حول وضع الدولة — كل وزير يقرأ من السجلات الحقيقية. القرار الأخير لك وحدك.</p>
      <div class="me-btns"><button class="btn sm" onclick="advMeet()">عقد اجتماع</button></div>
      <div id="cab-out" style="margin-top:10px"></div>
    </div></div>`;
}
async function advMeet() {
  const out = document.getElementById('cab-out');
  if (!out) return;
  out.innerHTML = '<div class="spin"></div>';
  try {
    const r = await api('GET', '/advisor/brief/cabinet');
    out.innerHTML = _advBriefCard(r.brief);
  } catch (e) { out.innerHTML = `<div class="empty">${esc(e.message || 'تعذر عقد الاجتماع')}</div>`; }
}

function navKey(h) {
  if (h === '#/' || h === '') return '#/';
  if (h.startsWith('#/cat/')) return '#/cat/' + h.split('/')[2];
  if (h === '#/dispatches' || h === '#/dossiers' || h === '#/news' || h === '#/wars' || h === '#/workshop' || h === '#/diplomacy' || h === '#/intel' || h === '#/audit' || h === '#/economy' || h === '#/market' || h === '#/notifications' || h === '#/dash' || h === '#/login' || h === '#/messages' || h === '#/advisor' || h === '#/cabinet') return h;
  if (h.startsWith('#/economy/')) return '#/economy';
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
    else if (h === '#/wars') await vWars();
    else if (h === '#/workshop') await vWorkshop();
    else if (h === '#/diplomacy') await vDiplomacy();
    else if (h === '#/intel') await vIntel();
    else if (h === '#/advisor') await vAdvisor();
    else if (h === '#/cabinet') await vCabinet();
    else if (h === '#/audit') await vAudit();
    else if (h === '#/economy') await vEconomy();
    else if (h.startsWith('#/economy/')) await vEconomyDetail(h.split('/')[2]);
    else if (h === '#/market') await vMarket();
    else if (h === '#/notifications') await vNotifications();
    else if (h.startsWith('#/army/')) await vArmy(h.split('/')[2]);
    else if (h.startsWith('#/dossier/')) await vDossier(decodeURIComponent(h.split('/')[2] || ''));
    else if (h === '#/login') vLogin();
    else if (h === '#/register') await vRegister();
    else if (h === '#/dash') await vDash();
    else await vHome();
  } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
  refreshNotifBadge();
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
  // سفارات الدول الذكية — تحدث مباشرة مع الحكام
  try {
    const embs = await api('GET', '/ai/embassies');
    if (embs.length) {
      const sec = document.createElement('div');
      sec.innerHTML = `<div class="emb-head">🏛️ سفارات الدول الذكية — تحدث مع الحكام مباشرة</div>` +
        embs.map((e) => `
        <a class="conv" href="#/messages/${encodeURIComponent(e.username)}">
          <span class="emb-av">🤖</span>
          <span class="conv-tx"><span class="conv-top"><b class="conv-name">${esc(e.username)}</b></span>
          <span class="conv-last">${esc(e.name)} — ${e.strategy === 'expansionist' ? 'توسعية' : e.strategy === 'conservative' ? 'محافظة' : 'متوازنة'}</span></span>
        </a>`).join('');
      document.getElementById('convlist').before(sec);
    }
  } catch (e) { /* صامت */ }
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
      <input type="file" id="timg" accept="image/*" class="a11y-hidden">
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
      const isEmb = d.user.username.startsWith('🤖');
      document.getElementById('thuser').innerHTML = isEmb
        ? `<span class="th-u"><span class="emb-av">🤖</span><span class="th-un"><b>${esc(d.user.username)}</b><span class="tw-handle">${esc(countryOf(d.user.country_code).name)} — حاكم ذكي</span></span></span>`
        : `<a class="th-u" href="#/u/${esc(d.user.username)}">
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
