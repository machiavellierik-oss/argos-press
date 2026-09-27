// ============================================================
// جريدة أرجوس | Argos Press — الخادم الخلفي
// حسابات لاعبين + مقالات + برقيات الدول + ملفات العملاء
// قاعدة البيانات: PostgreSQL (Supabase) — دائمة لا تُمسح مع النشر
// الصور: Supabase Storage — دائمة
// ============================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { COUNTRIES } = require('./countries');
const { LATLON } = require('./geo');

const PORT = process.env.PORT || 3000;

const CATEGORIES = {
  official: 'بيانات رسمية',
  war: 'سيناريوهات الحروب',
  events: 'أحداث اللعبة',
};

// ---------- ساعة اللعبة ----------
// كل 24 ساعة واقعية = سنة كاملة داخل اللعبة (كل ساعتين حقيقيتين = شهر)
// بداية اللعبة: الأحد 27 سبتمبر 2026 — 18:00 بتوقيت غرينتش = يناير 1900
const GAME_EPOCH_REAL = Date.UTC(2026, 8, 27, 18, 0, 0);
const GAME_MONTH_MS = 2 * 3600 * 1000;
function gameDateOf(startedAt, nowMs) {
  const elapsed = Math.max(0, nowMs - startedAt);
  const m = Math.floor(elapsed / GAME_MONTH_MS);
  const day = Math.floor((elapsed % GAME_MONTH_MS) / GAME_MONTH_MS * 30) + 1; // 1..30
  return { year: 1900 + Math.floor(m / 12), month: (m % 12) + 1, day };
}

// مهارات العملاء (مصفوفة المهارات في الملف الاستخباراتي)
const SKILLS = {
  intel: 'الاستخبارات والتجسس',
  diplomacy: 'التفاوض والتحالفات',
  econwar: 'الحرب الاقتصادية والدبلوماسية',
  analysis: 'التحليل الجيوسياسي',
  planning: 'التخطيط طويل المدى وإدارة الأزمات',
  resources: 'إدارة الموارد وتحليل البيانات',
};
const DOSSIER_STATUSES = ['ACTIVE', 'INACTIVE', 'MIA', 'KIA'];
const DOSSIER_CLEARANCES = ['LEVEL 1', 'LEVEL 2', 'LEVEL 3', 'LEVEL 4', 'LEVEL 5'];

// ---------------- قاعدة البيانات (PostgreSQL) ----------------
if (!process.env.DATABASE_URL && !global.__pool) {
  console.error('❌ DATABASE_URL غير مضبوط.');
  console.error('أنشئ مشروعًا مجانيًا على https://supabase.com ثم أضف متغيرات البيئة:');
  console.error('DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}
function getPool() {
  if (global.__pool) return global.__pool; // حقن للاختبارات فقط
  if (!getPool._p) {
    getPool._p = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return getPool._p;
}
const q = (text, params) => getPool().query(text, params || []);
const one = async (text, params) => (await q(text, params)).rows[0] || null;
const all = async (text, params) => (await q(text, params)).rows;

async function initDb() {
  await q(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    country_code TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image TEXT,
    category TEXT NOT NULL DEFAULT 'events',
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS dispatches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    image TEXT,
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS dossiers (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    alias TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    clearance TEXT DEFAULT 'LEVEL 1',
    profile TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    theaters TEXT DEFAULT '[]',
    roles TEXT DEFAULT '[]',
    achievements TEXT DEFAULT '[]',
    skills TEXT DEFAULT '{}',
    updated_at BIGINT
  )`);
  await q('CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category, created_at)');
  await q('CREATE INDEX IF NOT EXISTS idx_dispatches_time ON dispatches(created_at)');
  // الإعجابات
  await q(`CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, target_type, target_id)
  )`);
  // التعليقات
  await q(`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`);
  // الستوريات (تنتهي بعد 24 ساعة)
  await q(`CREATE TABLE IF NOT EXISTS stories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    body TEXT DEFAULT '',
    image TEXT,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`);
  // البايو في البروفايل
  try { await q("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch (e) { /* موجود مسبقًا */ }
  // الصورة الشخصية
  try { await q("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"); } catch (e) { /* موجود مسبقًا */ }
  // الحظر
  try { await q("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0"); } catch (e) { /* موجود مسبقًا */ }
  // الرسائل الخاصة
  await q(`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    image TEXT,
    created_at BIGINT NOT NULL,
    read_at BIGINT
  )`);
  await q('CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id, created_at)');
  await q('CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id)');
  await q('CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id)');
  await q('CREATE INDEX IF NOT EXISTS idx_stories_exp ON stories(expires_at)');

  // مستخدم النظام (مقر أرجوس) + مقال ترحيبي
  let sys = await one("SELECT id FROM users WHERE username='argos_hq'");
  if (!sys) {
    sys = await one(
      'INSERT INTO users (username,email,password_hash,country_code,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      ['argos_hq', 'hq@argos.internal', '!', 'HQ', 'system', Date.now()]
    );
  }
  // حساب المطورين الكامل (ARGOS HQ) — المسؤول الوحيد عنه هو اللاعب الأمريكي
  let dev = await one("SELECT id FROM users WHERE username='argos_dev'");
  if (!dev) {
    dev = await one(
      'INSERT INTO users (username,email,password_hash,country_code,role,bio,avatar,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      ['argos_dev', 'dev@argos.internal', '!', 'HQ', 'developer',
        '🛠️ الحساب الرسمي لمطوري منصة أرجوس — تشغيل ساعة اللعبة وإدارة المنصة.',
        '/logo.jpg', Date.now()]
    );
  }
  // جدول ساعة اللعبة (صف واحد)
  await q(`CREATE TABLE IF NOT EXISTS game_clock (
    id INTEGER PRIMARY KEY, started_at BIGINT, running INTEGER DEFAULT 0, updated_by INTEGER
  )`);
  const gc = await one('SELECT id FROM game_clock WHERE id=1');
  if (!gc) await q('INSERT INTO game_clock (id,started_at,running) VALUES (1,NULL,0)');
  // تعديلات المطورين على خريطة غرفة الحرب: لون/حالة/حدود مخصصة لكل دولة
  await q(`CREATE TABLE IF NOT EXISTS map_states (
    country_code TEXT PRIMARY KEY, color TEXT, status TEXT,
    label TEXT, borders_geojson TEXT, updated_by INTEGER, updated_at BIGINT
  )`);
  // حروب يناير 1900 الحقيقية — تُزرع مرة واحدة فقط،
  // ويمكن للمطورين تعديلها/حذفها لاحقًا من محرر الخريطة
  const WAR_SEED = [
    { cc: 'US', label: 'الحرب الأمريكية – الإسبانية' },
    { cc: 'ES', label: 'الحرب الأمريكية – الإسبانية' },
    { cc: 'GB', label: 'حرب البوير الثانية' },
    { cc: 'TV', label: 'حرب البوير الثانية' },
    { cc: 'OF', label: 'حرب البوير الثانية' },
    { cc: 'CN', label: 'ثورة الملاكمين' },
  ];
  for (const w of WAR_SEED) {
    const ex = await one('SELECT country_code FROM map_states WHERE country_code=$1', [w.cc]);
    if (!ex) await q(
      `INSERT INTO map_states (country_code,color,status,label,updated_by,updated_at)
       VALUES ($1,'#f4212e','war',$2,NULL,$3)`,
      [w.cc, w.label, Date.now()]);
  }
  await seedArmies();
  await seedEconomy();
  const n = await one('SELECT COUNT(*) AS c FROM articles');
  if (Number(n.c) === 0) {
    await q(
      'INSERT INTO articles (user_id,title,body,category,created_at) VALUES ($1,$2,$3,$4,$5)',
      [sys.id,
        'انطلاق جريدة أرجوس — الصحيفة الرسمية للمحاكاة',
        `يُعلن مقر أرجوس عن انطلاق الجريدة الرسمية للمحاكاة، المنصة التي توثّق سيناريوهات الحروب وأحداث اللعبة لحظة بلحظة، اعتبارًا من الأول من يناير سنة 1900.

على كل لاعب إنشاء حسابه واختيار الدولة التي سيلعب بها، ثم التغريد والتصريح باسم دولته عبر «برقيات الدول»، ونشر سيناريوهات المعارك والتطورات عبر المقالات.

القاعدة الذهبية للمحاكاة: الواقعية الصارمة — كل قرار يُقيَّم بمنطق حقيقي، وكل حدث يُسجَّل في الأرشيف فور حدوثه.

العالم ينتظر قادةً... فهل أنت جاهز لترك بصمتك في التاريخ الجديد؟`,
        'official',
        Date.now()]
    );
  }
}

// ---------------- تخزين الصور (Supabase Storage) ----------------
function getSupa() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  if (!getSupa._c) getSupa._c = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return getSupa._c;
}
async function uploadToStorage(buffer, mimetype, ext) {
  if (global.__storageMock) return global.__storageMock(buffer, mimetype, ext); // للاختبارات
  const supa = getSupa();
  if (!supa) throw new Error('التخزين السحابي غير مهيأ — أضف SUPABASE_URL و SUPABASE_SERVICE_KEY');
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(8).toString('hex') + ext;
  const { error } = await supa.storage.from('uploads').upload(name, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error('فشل رفع الصورة');
  return supa.storage.from('uploads').getPublicUrl(name).data.publicUrl;
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('يُسمح برفع الصور فقط'));
  },
});

// ---------------- التطبيق ----------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// تغليف الدوال غير المتزامنة لـ Express 4
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- الجلسات ----------
function getToken(req) {
  const h = req.headers.cookie || '';
  const m = h.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
async function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 30 * 24 * 3600 * 1000;
  await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)', [token, userId, expires]);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`);
}
async function clearSession(req, res) {
  const t = getToken(req);
  if (t) await q('DELETE FROM sessions WHERE token=$1', [t]);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}
async function auth(req, res, next) {
  const t = getToken(req);
  if (!t) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  const row = await one(
    'SELECT u.id,u.username,u.email,u.country_code,u.role,u.bio,u.avatar,u.banned FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2',
    [t, Date.now()]
  );
  if (!row) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجددًا' });
  if (row.banned) return res.status(403).json({ error: 'تم حظر هذا الحساب من المنصة' });
  req.user = row;
  next();
}
// طاقم المقر: الأدمن + حساب argos HQ
const isStaff = (u) => u && (u.role === 'admin' || u.role === 'system');
const isDeveloper = (u) => u && u.role === 'developer';
// التبديل بين الحسابات حصرًا: اللاعب الأمريكي (أدمن بدولة US) وحساب المطورين — لا أحد غيرهما
const canSwitch = (u) => u && (isDeveloper(u) || (u.role === 'admin' && u.country_code === 'US'));
const requireDeveloper = (req, res, next) =>
  isDeveloper(req.user) ? next() : res.status(403).json({ error: 'تشغيل الساعة حصرًا عبر حساب المطورين' });
const requireStaff = (req, res, next) =>
  isStaff(req.user) ? next() : res.status(403).json({ error: 'هذه الخاصية لإدارة المقر فقط' });
const validCountry = (c) => COUNTRIES.some((x) => x.code === c);
const cleanImage = (v) =>
  (typeof v === 'string' && v.startsWith('https://') && v.length < 600 ? v : null);

// ---------- الدول ----------
app.get('/api/countries', (req, res) => res.json(COUNTRIES));

// ---------- غرفة الحرب: شدة الصراع والموجز اليومي (نافذة 30 يومًا) ----------
app.get('/api/conflict', ah(async (req, res) => {
  const now = Date.now(), D = 864e5, W = 30 * D;
  const arts = await all(
    `SELECT a.category,a.title,a.created_at,u.country_code,u.username FROM articles a
     JOIN users u ON u.id=a.user_id WHERE a.created_at>=$1`, [now - W]);
  const dsps = await all(
    `SELECT d.body,d.created_at,u.country_code,u.username FROM dispatches d
     JOIN users u ON u.id=d.user_id WHERE d.created_at>=$1`, [now - W]);
  const prevA = await all(
    `SELECT u.country_code,COUNT(*)::int c FROM articles a JOIN users u ON u.id=a.user_id
     WHERE a.created_at>=$1 AND a.created_at<$2 GROUP BY u.country_code`, [now - 2 * W, now - W]);
  const prevD = await all(
    `SELECT u.country_code,COUNT(*)::int c FROM dispatches d JOIN users u ON u.id=d.user_id
     WHERE d.created_at>=$1 AND d.created_at<$2 GROUP BY u.country_code`, [now - 2 * W, now - W]);
  const map = {};
  const bump = (cc, kind, head, ts, username) => {
    if (!cc) return;
    const e = map[cc] || (map[cc] = { war: 0, official: 0, events: 0, dispatches: 0, heads: [], user: null, uts: 0 });
    if (kind === 'war' || kind === 'official' || kind === 'events') e[kind]++; else e.dispatches++;
    if (head) e.heads.push({ t: head, ts });
    if (username && ts > e.uts) { e.user = username; e.uts = ts; }
  };
  arts.forEach((a) => bump(a.country_code, a.category, a.title, a.created_at, a.username));
  dsps.forEach((d) => bump(d.country_code, 'dispatches', d.body.slice(0, 90), d.created_at, d.username));
  const ptot = {};
  prevA.forEach((r) => { ptot[r.country_code] = (ptot[r.country_code] || 0) + r.c; });
  prevD.forEach((r) => { ptot[r.country_code] = (ptot[r.country_code] || 0) + r.c; });
  const rows = Object.entries(map).map(([cc, e]) => {
    const c = COUNTRIES.find((x) => x.code === cc) || { name: cc, flag: '🏳️' };
    const total = e.war + e.official + e.events + e.dispatches;
    const severity = (e.war >= 2 || total >= 10) ? 'RED' : (e.war >= 1 || total >= 5) ? 'ORANGE' : 'YELLOW';
    const p = ptot[cc] || 0;
    const trend = total > p * 1.2 ? 'up' : total < p * 0.8 ? 'down' : 'steady';
    e.heads.sort((a, b) => b.ts - a.ts);
    const ll = LATLON[cc] || [];
    return {
      code: cc, name: c.name, flag: c.flag, user: e.user,
      lat: ll[0] ?? null, lon: ll[1] ?? null,
      war: e.war, mentions: total, severity, trend,
      brief: e.heads.slice(0, 3).map((h) => h.t),
    };
  }).filter((r) => r.lat !== null);
  const rank = { RED: 0, ORANGE: 1, YELLOW: 2 };
  rows.sort((a, b) => rank[a.severity] - rank[b.severity] || b.mentions - a.mentions);
  res.json({ updated: now, window_days: 30, rows });
}));

// الدول المحجوزة من طرف لاعبين (لمنع تكرار اختيار نفس الدولة)
app.get('/api/taken-countries', ah(async (req, res) => {
  const rows = await all("SELECT DISTINCT country_code FROM users WHERE role NOT IN ('system','developer')");
  res.json(rows.map((r) => r.country_code));
}));

// ---------- الملفات الاستخباراتية (إنجازات اللاعبين) ----------
const parseJson = (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };

// قائمة الملفات (نبذة)
app.get('/api/dossiers', ah(async (req, res) => {
  const rows = await all(`
    SELECT u.id AS user_id, COALESCE(d.alias,'') AS alias, COALESCE(d.status,'ACTIVE') AS status,
           COALESCE(d.clearance,'LEVEL 1') AS clearance, COALESCE(d.avatar,'') AS avatar,
           u.username, u.country_code
    FROM users u LEFT JOIN dossiers d ON d.user_id = u.id
    WHERE u.role NOT IN ('system','developer')
    ORDER BY u.id ASC`);
  res.json(rows);
}));

// ملف كامل لعميل
app.get('/api/dossier/:username', ah(async (req, res) => {
  const u = await one("SELECT id, username, country_code, role FROM users WHERE username=$1 AND role NOT IN ('system','developer')", [req.params.username]);
  if (!u) return res.status(404).json({ error: 'الملف غير موجود' });
  let d = await one('SELECT * FROM dossiers WHERE user_id=$1', [u.id]);
  if (!d) {
    await q('INSERT INTO dossiers (user_id, updated_at) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u.id, Date.now()]);
    d = await one('SELECT * FROM dossiers WHERE user_id=$1', [u.id]);
  }
  res.json({
    user: { username: u.username, country_code: u.country_code, role: u.role },
    dossier: {
      alias: d.alias || '', status: d.status || 'ACTIVE', clearance: d.clearance || 'LEVEL 1',
      profile: d.profile || '', avatar: d.avatar || '',
      theaters: parseJson(d.theaters, []), roles: parseJson(d.roles, []),
      achievements: parseJson(d.achievements, []), skills: parseJson(d.skills, {}),
      updated_at: d.updated_at,
    },
  });
}));

// إنشاء/تحديث الملف (صاحبه أو المدير)
app.post('/api/dossier', ah(auth), ah(async (req, res) => {
  const me = req.user;
  let targetId = me.id;
  if (req.body && req.body.user_id && me.role === 'admin') targetId = Number(req.body.user_id);
  if (targetId !== me.id && me.role !== 'admin')
    return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الملف' });
  const target = await one("SELECT id FROM users WHERE id=$1 AND role NOT IN ('system','developer')", [targetId]);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const b = req.body || {};
  const str = (v, max) => String(v ?? '').slice(0, max);
  const arr = (v, max, smax) => (Array.isArray(v) ? v.map((x) => str(x, smax)).filter(Boolean).slice(0, max) : []);
  const status = DOSSIER_STATUSES.includes(b.status) ? b.status : 'ACTIVE';
  const clearance = DOSSIER_CLEARANCES.includes(b.clearance) ? b.clearance : 'LEVEL 1';
  const skills = {};
  for (const k of Object.keys(SKILLS)) {
    const v = Number(b.skills && b.skills[k]);
    skills[k] = Number.isFinite(v) ? Math.max(0, Math.min(5, Math.round(v))) : 0;
  }
  await q(`INSERT INTO dossiers (user_id, alias, status, clearance, profile, avatar, theaters, roles, achievements, skills, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT(user_id) DO UPDATE SET alias=excluded.alias, status=excluded.status, clearance=excluded.clearance,
      profile=excluded.profile, avatar=excluded.avatar, theaters=excluded.theaters, roles=excluded.roles,
      achievements=excluded.achievements, skills=excluded.skills, updated_at=excluded.updated_at`,
    [targetId, str(b.alias, 60), status, clearance, str(b.profile, 2000), str(b.avatar, 600),
      JSON.stringify(arr(b.theaters, 43, 5)), JSON.stringify(arr(b.roles, 20, 200)),
      JSON.stringify(arr(b.achievements, 30, 200)), JSON.stringify(skills), Date.now()]);
  res.json({ ok: true });
}));

// ---------- الحسابات ----------
app.post('/api/register', ah(async (req, res) => {
  const { username, email, password, country_code } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'اسم المستخدم 3-20 حرفًا (أحرف وأرقام و _ فقط)' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  if (!validCountry(country_code))
    return res.status(400).json({ error: 'اختر الدولة التي ستلعب بها' });
  const dup = await one('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
  if (dup) return res.status(409).json({ error: 'اسم المستخدم أو البريد مسجّل مسبقًا' });
  const taken = await one("SELECT username FROM users WHERE country_code=$1 AND role NOT IN ('system','developer')", [country_code]);
  if (taken) return res.status(409).json({ error: 'هذه الدولة محجوزة مسبقًا من طرف لاعب آخر — اختر دولة أخرى' });

  const hash = bcrypt.hashSync(password, 10);
  const cnt = await one("SELECT COUNT(*) AS c FROM users WHERE role NOT IN ('system','developer')");
  const role = Number(cnt.c) === 0 ? 'admin' : 'player'; // أول لاعب يسجّل = إدارة المقر
  const r = await one(
    'INSERT INTO users (username,email,password_hash,country_code,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [username, email.toLowerCase(), hash, country_code, role, Date.now()]
  );
  const uid = r.id;
  await q('INSERT INTO dossiers (user_id, updated_at) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, Date.now()]);
  await setSession(res, uid);
  res.json({ ok: true, role });
}));

app.post('/api/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await one('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  if (u.role === 'system' && u.username !== 'argos_hq')
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  if (u.banned) return res.status(403).json({ error: 'هذا الحساب محظور من المنصة' });
  await setSession(res, u.id);
  res.json({ ok: true, role: u.role });
}));

app.post('/api/logout', ah(async (req, res) => { await clearSession(req, res); res.json({ ok: true }); }));

app.get('/api/me', ah(async (req, res) => {
  const t = getToken(req);
  if (!t) return res.json({ user: null });
  const row = await one(
    'SELECT u.id,u.username,u.email,u.country_code,u.role,u.bio,u.avatar FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2',
    [t, Date.now()]
  );
  res.json({ user: row || null });
}));

// ---------- إدارة المقر (حظر/طرد/كلمة سر HQ) ----------
// توكن إضافي لتبديل الحسابات (يُحفظ في المتصفح)
app.post('/api/account-token', ah(auth), ah(async (req, res) => {
  if (!canSwitch(req.user)) return res.status(403).json({ error: 'تبديل الحسابات متاح للاعب الأمريكي وحساب المطورين فقط' });
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
    [token, req.user.id, Date.now() + 30 * 24 * 3600 * 1000]);
  res.json({ token, username: req.user.username });
}));
// دخول اللاعب الأمريكي إلى حساب المطورين بضغطة واحدة (هو من يعيّن كلمة سره أصلًا)
app.post('/api/admin/dev-token', ah(auth), ah(async (req, res) => {
  if (!(req.user.role === 'admin' && req.user.country_code === 'US'))
    return res.status(403).json({ error: 'هذه الخاصية للاعب الأمريكي فقط' });
  const dev = await one("SELECT id,username FROM users WHERE email='dev@argos.internal'");
  if (!dev) return res.status(404).json({ error: 'حساب المطورين غير موجود' });
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
    [token, dev.id, Date.now() + 30 * 24 * 3600 * 1000]);
  res.json({ token, username: dev.username });
}));

// قائمة المستخدمين للإدارة
app.get('/api/admin/users', ah(auth), requireStaff, ah(async (req, res) => {
  const rows = await all(
    "SELECT id,username,country_code,role,banned,created_at FROM users WHERE role!='system' ORDER BY created_at ASC"
  );
  res.json(rows.map((r) => ({
    id: r.id, username: r.username, country_code: r.country_code,
    role: r.role, banned: !!r.banned, created_at: Number(r.created_at),
  })));
}));

// حظر مستخدم (يطرد جلساته فورًا)
app.post('/api/admin/ban', ah(auth), requireStaff, ah(async (req, res) => {
  const { user_id } = req.body || {};
  const t = await one('SELECT id,username,role FROM users WHERE id=$1', [user_id]);
  if (!t || t.role === 'system' || t.role === 'developer') return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حظر نفسك' });
  await q('UPDATE users SET banned=1 WHERE id=$1', [t.id]);
  await q('DELETE FROM sessions WHERE user_id=$1', [t.id]);
  res.json({ ok: true });
}));

// إلغاء الحظر
app.post('/api/admin/unban', ah(auth), requireStaff, ah(async (req, res) => {
  const { user_id } = req.body || {};
  await q('UPDATE users SET banned=0 WHERE id=$1', [user_id]);
  res.json({ ok: true });
}));

// طرد نهائي: حذف الحساب وكل محتواه
app.delete('/api/admin/users/:id', ah(auth), requireStaff, ah(async (req, res) => {
  const t = await one('SELECT id,username,role FROM users WHERE id=$1', [req.params.id]);
  if (!t || t.role === 'system' || t.role === 'developer') return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (t.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك طرد نفسك' });
  const uid = t.id;
  const artIds = (await all('SELECT id FROM articles WHERE user_id=$1', [uid])).map((r) => r.id);
  const dspIds = (await all('SELECT id FROM dispatches WHERE user_id=$1', [uid])).map((r) => r.id);
  for (const aid of artIds) {
    await q("DELETE FROM likes WHERE target_type='article' AND target_id=$1", [aid]);
    await q("DELETE FROM comments WHERE target_type='article' AND target_id=$1", [aid]);
  }
  for (const did of dspIds) {
    await q("DELETE FROM likes WHERE target_type='dispatch' AND target_id=$1", [did]);
    await q("DELETE FROM comments WHERE target_type='dispatch' AND target_id=$1", [did]);
  }
  await q('DELETE FROM articles WHERE user_id=$1', [uid]);
  await q('DELETE FROM dispatches WHERE user_id=$1', [uid]);
  await q('DELETE FROM comments WHERE user_id=$1', [uid]);
  await q('DELETE FROM likes WHERE user_id=$1', [uid]);
  await q('DELETE FROM stories WHERE user_id=$1', [uid]);
  await q('DELETE FROM messages WHERE sender_id=$1 OR receiver_id=$1', [uid]);
  await q('DELETE FROM dossiers WHERE user_id=$1', [uid]);
  await q('DELETE FROM sessions WHERE user_id=$1', [uid]);
  await q('DELETE FROM users WHERE id=$1', [uid]);
  res.json({ ok: true });
}));

// تعيين كلمة سر حساب argos HQ
app.post('/api/admin/hq-password', ah(auth), requireStaff, ah(async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  const hash = bcrypt.hashSync(password, 10);
  await q("UPDATE users SET password_hash=$1 WHERE username='argos_hq'", [hash]);
  res.json({ ok: true });
}));

// تعيين كلمة سر حساب المطورين ARGOS HQ
app.post('/api/admin/dev-password', ah(auth), requireStaff, ah(async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  const hash = bcrypt.hashSync(password, 10);
  await q("UPDATE users SET password_hash=$1 WHERE username='argos_dev'", [hash]);
  res.json({ ok: true });
}));

// ---------- ساعة اللعبة (التحكم حصرًا لحساب المطورين) ----------
app.get('/api/clock', ah(async (req, res) => {
  const row = await one('SELECT started_at,running FROM game_clock WHERE id=1');
  const started = row && row.started_at ? Number(row.started_at) : null;
  const running = !!(row && row.running);
  res.json({
    running, started_at: started, now: Date.now(), epoch_real: GAME_EPOCH_REAL,
    game: running && started ? gameDateOf(started, Date.now()) : null,
  });
}));
app.post('/api/clock/start', ah(auth), requireDeveloper, ah(async (req, res) => {
  const now = Date.now();
  await q('UPDATE game_clock SET started_at=$1, running=1, updated_by=$2 WHERE id=1', [now, req.user.id]);
  await q('UPDATE companies SET last_collect=NULL');
  await q('UPDATE country_economy SET last_tax_collect=NULL');
  res.json({ ok: true, running: true, started_at: now, game: gameDateOf(now, now) });
}));
app.post('/api/clock/stop', ah(auth), requireDeveloper, ah(async (req, res) => {
  await q('UPDATE game_clock SET running=0, updated_by=$1 WHERE id=1', [req.user.id]);
  res.json({ ok: true, running: false });
}));
// إعادة التعيين: يعود زمن اللعبة إلى الصفر (يناير 1900) ويعمل من جديد
// يقبل start_at (ISO) اختياريًا لتثبيت بداية اللعبة على لحظة محددة — حتى لو كانت في المستقبل
app.post('/api/clock/reset', ah(auth), requireDeveloper, ah(async (req, res) => {
  let startAt = Date.now();
  if (req.body && req.body.start_at) {
    const t = Date.parse(req.body.start_at);
    if (!Number.isFinite(t)) return res.status(400).json({ error: 'تاريخ البداية غير صالح' });
    startAt = t;
  }
  await q('UPDATE game_clock SET started_at=$1, running=1, updated_by=$2 WHERE id=1', [startAt, req.user.id]);
  await q('UPDATE companies SET last_collect=NULL');
  await q('UPDATE country_economy SET last_tax_collect=NULL');
  res.json({ ok: true, running: true, started_at: startAt, game: gameDateOf(startAt, Date.now()) });
}));
// تصفير جميع الشركات — المطورون فقط (قرار إداري لا رجعة فيه)
app.post('/api/admin/wipe-companies', ah(auth), requireDeveloper, ah(async (req, res) => {
  const r = await q('DELETE FROM companies');
  res.json({ ok: true, deleted: r.rowCount });
}));

// ---------- خريطة غرفة الحرب: تعديلات المطورين (لون/حالة/حدود) ----------
// عام للقراءة — يغذي ألوان الكرة وإعلانات الحرب/الطوارئ
app.get('/api/map-states', ah(async (req, res) => {
  const rows = await all('SELECT country_code,color,status,label,borders_geojson,updated_at FROM map_states');
  res.json({
    states: rows.map((s) => ({
      country_code: s.country_code, color: s.color, status: s.status,
      label: s.label, borders_geojson: s.borders_geojson,
      updated_at: Number(s.updated_at),
      lat: (LATLON[s.country_code] || [])[0] ?? null,
      lon: (LATLON[s.country_code] || [])[1] ?? null,
    })),
  });
}));
const MAP_STATUS = ['war', 'emergency', 'peace'];
function cleanMapState(b) {
  const out = {};
  if (typeof b.country_code !== 'string' || !validCountry(b.country_code)) throw new Error('كود دولة غير صالح');
  out.country_code = b.country_code;
  out.color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : null;
  out.status = MAP_STATUS.includes(b.status) ? b.status : null;
  out.label = typeof b.label === 'string' && b.label.trim() ? b.label.trim().slice(0, 120) : null;
  out.borders_geojson = null;
  if (typeof b.borders_geojson === 'string' && b.borders_geojson.trim()) {
    const g = JSON.parse(b.borders_geojson);
    const okType = g && (g.type === 'Polygon' || g.type === 'MultiPolygon');
    const coords = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    const okCoords = Array.isArray(g.coordinates) && coords.every((ring) =>
      Array.isArray(ring) && ring.length >= 3 && ring.every((p) =>
        Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every((n) => typeof n === 'number' && isFinite(n))));
    if (!okType || !okCoords) throw new Error('GeoJSON غير صالح (Polygon/MultiPolygon بإحداثيات رقمية)');
    const s = JSON.stringify(g);
    if (s.length > 300000) throw new Error('حجم الحدود كبير جدًا');
    out.borders_geojson = s;
  }
  return out;
}
app.post('/api/map-states', ah(auth), requireDeveloper, ah(async (req, res) => {
  let s;
  try { s = cleanMapState(req.body || {}); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const now = Date.now();
  await q(`INSERT INTO map_states (country_code,color,status,label,borders_geojson,updated_by,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (country_code) DO UPDATE SET color=EXCLUDED.color,status=EXCLUDED.status,
             label=EXCLUDED.label,borders_geojson=EXCLUDED.borders_geojson,
             updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`,
    [s.country_code, s.color, s.status, s.label, s.borders_geojson, req.user.id, now]);
  res.json({ ok: true });
}));
app.delete('/api/map-states/:code', ah(auth), requireDeveloper, ah(async (req, res) => {
  await q('DELETE FROM map_states WHERE country_code=$1', [req.params.code]);
  res.json({ ok: true });
}));

// ---------- جيوش الدول وتسليح 1900 ----------
// armies: تعداد الجنود لكل دولة | weapons: ترسانة كل دولة (صنف/نوع/طراز/اسم/عدد/صورة)
async function seedArmies() {
  await q(`CREATE TABLE IF NOT EXISTS armies (
    country_code TEXT PRIMARY KEY, soldiers INTEGER DEFAULT 0, note TEXT,
    updated_by INTEGER, updated_at BIGINT
  )`);
  await q(`CREATE TABLE IF NOT EXISTS weapons (
    id SERIAL PRIMARY KEY, country_code TEXT, name TEXT, class TEXT,
    wtype TEXT, model TEXT, quantity INTEGER, image_url TEXT,
    created_by INTEGER, created_at BIGINT,
    source_url TEXT, confidence TEXT DEFAULT 'unknown', note TEXT
  )`);
  // أعمدة جديدة لقواعد البيانات التي أُنشئت قبل إضافتها
  for (const colDef of ['source_url TEXT', "confidence TEXT DEFAULT 'unknown'", 'note TEXT']) {
    try { await q(`ALTER TABLE weapons ADD COLUMN ${colDef}`); } catch (e) { /* العمود موجود */ }
  }
  await q(`CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)`);

  // تعداد الجيوش من البحث التاريخي — يُحدَّث فقط ما لم يعدّله المطور يدويًا
  let SOLDIERS = [];
  try { SOLDIERS = require('./server/data/soldiers-1900.json'); } catch (e) { /* بلا بيانات */ }
  const noteFor = (s) => s.confidence === 'documented' ? 'تعداد موثق تاريخيًا — قابل للتعديل'
    : s.confidence === 'estimate' ? 'تقدير تاريخي — قابل للتعديل' : 'غير موثق بدقة — قابل للتعديل';
  for (const s of SOLDIERS) {
    if (!s || s.soldiers == null) continue;
    const ex = await one('SELECT country_code, updated_by FROM armies WHERE country_code=$1', [s.country_code]);
    if (!ex) {
      await q('INSERT INTO armies (country_code,soldiers,note,updated_at) VALUES ($1,$2,$3,$4)',
        [s.country_code, s.soldiers, noteFor(s), Date.now()]);
    } else if (!ex.updated_by) {
      await q('UPDATE armies SET soldiers=$1, note=$2, updated_at=$3 WHERE country_code=$4',
        [s.soldiers, noteFor(s), Date.now(), s.country_code]);
    }
  }

  // احتياطي للدول التي لا يوجد لها تعداد موثق في البحث
  const FALLBACK = { CH: 25000, SN: 69800, LU: 500, TH: 12000, LR: 2000, BO: 5000, CL: 15000, PY: 4000 };
  for (const [cc, n] of Object.entries(FALLBACK)) {
    const ex = await one('SELECT country_code FROM armies WHERE country_code=$1', [cc]);
    if (!ex) await q('INSERT INTO armies (country_code,soldiers,note,updated_at) VALUES ($1,$2,$3,$4)',
      [cc, n, 'تقدير تاريخي — قابل للتعديل', Date.now()]);
  }
  // وما يضيفه المطور يدويًا (created_by) لا يُمس
  const meta = await one("SELECT value FROM seed_meta WHERE key='weapons_v2'");
  if (!meta) {
    await q('DELETE FROM weapons WHERE created_by IS NULL');
    let WEAPONS = [];
    try { WEAPONS = require('./server/data/weapons-1900.json'); } catch (e) { /* بلا بيانات */ }
    for (const w of WEAPONS) {
      await q(`INSERT INTO weapons (country_code,name,class,wtype,model,quantity,image_url,
               source_url,confidence,note,created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [w.country_code, w.name_ar, w.class, w.wtype || null, w.model || null,
         w.quantity, w.image_url, w.source || null, w.confidence || 'unknown',
         w.note || null, Date.now()]);
    }
    await q("INSERT INTO seed_meta (key,value) VALUES ('weapons_v2','done')");
  }

  // الموجة الثانية: البحرية والطيران (516 سلاحًا) — إضافة فقط، دون مساس بالموجود
  const meta3 = await one("SELECT value FROM seed_meta WHERE key='weapons_v3'");
  if (!meta3) {
    let NAVAL = [];
    try { NAVAL = require('./server/data/weapons-naval-air.json'); } catch (e) { /* بلا بيانات */ }
    for (const w of NAVAL) {
      await q(`INSERT INTO weapons (country_code,name,class,wtype,model,quantity,image_url,
               source_url,confidence,note,created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [w.country_code, w.name_ar, w.class, w.wtype || null, w.model || null,
         w.quantity, w.image_url, w.source || null, w.confidence || 'unknown',
         w.note || null, Date.now()]);
    }
    await q("INSERT INTO seed_meta (key,value) VALUES ('weapons_v3','done')");
  }
}

// قائمة الجيوش — كل لاعب يرى جيش دولته فقط، والمطورون يرون الكل
app.get('/api/armies', ah(auth), ah(async (req, res) => {
  const dev = req.user.role === 'developer';
  const where = dev ? '' : 'WHERE a.country_code=$1';
  const params = dev ? [] : [req.user.country_code];
  const rows = await all(`SELECT a.country_code, a.soldiers, a.note,
    COUNT(w.id) AS weapons_count
    FROM armies a LEFT JOIN weapons w ON w.country_code=a.country_code
    ${where} GROUP BY a.country_code, a.soldiers, a.note ORDER BY a.soldiers DESC`, params);
  res.json({ armies: rows.map((r) => ({
    country_code: r.country_code, soldiers: Number(r.soldiers) || 0,
    note: r.note, weapons_count: Number(r.weapons_count) || 0,
  })) });
}));
// تفاصيل جيش دولة + ترسانتها — كل لاعب لدولته فقط، والمطورون لأي دولة
app.get('/api/armies/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = req.user.role === 'developer';
  if (!dev && cc !== req.user.country_code)
    return res.status(403).json({ error: 'كل لاعب يرى جيش دولته فقط' });
  const a = await one('SELECT country_code,soldiers,note,updated_at FROM armies WHERE country_code=$1', [cc]);
  const ws = await all(`SELECT id,country_code,name,class,wtype,model,quantity,image_url,source_url,confidence,note,created_at
                        FROM weapons WHERE country_code=$1 ORDER BY id`, [cc]);
  res.json({
    army: a ? { country_code: a.country_code, soldiers: Number(a.soldiers) || 0, note: a.note } : null,
    weapons: ws.map((w) => ({ ...w, quantity: w.quantity == null ? null : Number(w.quantity) })),
  });
}));
// تعديل تعداد جيش دولة — المطورون فقط
app.post('/api/armies/:code', ah(auth), requireDeveloper, ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const soldiers = Math.max(0, parseInt(req.body.soldiers, 10) || 0);
  const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 300) : null;
  await q(`INSERT INTO armies (country_code,soldiers,note,updated_by,updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (country_code) DO UPDATE SET soldiers=EXCLUDED.soldiers,
             note=EXCLUDED.note, updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at`,
    [cc, soldiers, note, req.user.id, Date.now()]);
  res.json({ ok: true });
}));
function cleanWeapon(b) {
  const out = {};
  const cc = String(b.country_code || '').toUpperCase();
  if (!validCountry(cc)) throw new Error('كود دولة غير صالح');
  out.country_code = cc;
  for (const k of ['name', 'class', 'wtype', 'model']) {
    if (typeof b[k] !== 'string' || !b[k].trim()) throw new Error('أكمل بيانات السلاح');
    out[k] = b[k].trim().slice(0, 160);
  }
  out.quantity = b.quantity == null || b.quantity === '' ? null : Math.max(0, parseInt(b.quantity, 10) || 0);
  out.image_url = typeof b.image_url === 'string' && b.image_url.trim() ? b.image_url.trim().slice(0, 500) : null;
  out.source_url = typeof b.source_url === 'string' && b.source_url.trim() ? b.source_url.trim().slice(0, 500) : null;
  out.confidence = ['documented', 'estimate', 'unknown'].includes(b.confidence) ? b.confidence : 'unknown';
  out.note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 500) : null;
  return out;
}
// إضافة سلاح — المطورون فقط
app.post('/api/weapons', ah(auth), requireDeveloper, ah(async (req, res) => {
  let w; try { w = cleanWeapon(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
  const r = await q(`INSERT INTO weapons (country_code,name,class,wtype,model,quantity,image_url,source_url,confidence,note,created_by,created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [w.country_code, w.name, w.class, w.wtype, w.model, w.quantity, w.image_url, w.source_url, w.confidence, w.note, req.user.id, Date.now()]);
  res.json({ ok: true, id: r.rows[0].id });
}));
// تعديل سلاح — المطورون فقط
app.put('/api/weapons/:id', ah(auth), requireDeveloper, ah(async (req, res) => {
  let w; try { w = cleanWeapon(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
  await q(`UPDATE weapons SET country_code=$1,name=$2,class=$3,wtype=$4,model=$5,quantity=$6,image_url=$7,
           source_url=$8,confidence=$9,note=$10 WHERE id=$11`,
    [w.country_code, w.name, w.class, w.wtype, w.model, w.quantity, w.image_url,
     w.source_url, w.confidence, w.note, req.params.id]);
  res.json({ ok: true });
}));
// حذف سلاح — المطورون فقط
app.delete('/api/weapons/:id', ah(auth), requireDeveloper, ah(async (req, res) => {
  await q('DELETE FROM weapons WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- السكان والاقتصاد 1900 + الشركات + سوق السلاح ----------
// country_economy: عملة كل دولة وقيمتها مقابل الدولار + السكان + الناتج المحلي + السيولة (بيانات 1900)
// companies: شركات وطنية (مقرها في مدن دولتها) ودولية (بموافقة الدولة المضيفة)
// notifications: إشعارات (طلبات الشركات/الموافقات/سوق السلاح)
// market_listings + market_orders: بيع وشراء الأسلحة بين الدول مع مدة تسليم بزمن اللعبة
const SECTORS = ['صناعية', 'عسكرية', 'تجارية', 'زراعية', 'مالية', 'نقل وشحن', 'تعدين', 'أخرى'];
let GEO_CITIES = {}, GEO_CONT = {};
try { GEO_CITIES = require('./server/data/cities-1900.json'); } catch (e) { /* بلا ملف مدن */ }
try { GEO_CONT = require('./server/data/continents.json'); } catch (e) { /* بلا ملف قارات */ }
// الموارد الطبيعية: احتياطيات تقديرية لأغراض اللعب + قواعد الإنتاج
const RES_AR = { oil: 'النفط', gas: 'الغاز الطبيعي', iron: 'الحديد', coal: 'الفحم', grain: 'الحبوب', cotton: 'القطن' };
const RES_UNIT = { oil: 'برميل', gas: 'م³', iron: 'طن', coal: 'طن', grain: 'طن', cotton: 'طن' };
// إنتاج العامل الواحد شهريًا (شهر لعبة) بوحدة المورد — قواعد اللعبة
const RES_RATE = { oil: 10, gas: 15, iron: 5, coal: 8, grain: 12, cotton: 6 };
const MAX_WORKERS = 20000;
let RESERVES = {};
try { RESERVES = require('./server/data/resources-1900.json'); } catch (e) { /* بلا ملف موارد */ }
const citiesOf = (cc) => (GEO_CITIES && GEO_CITIES[cc]) || [];
const continentOf = (cc) => (GEO_CONT && GEO_CONT[cc]) || null;
const cname = (cc) => { const c = COUNTRIES.find((x) => x.code === cc); return c ? c.name : cc; };
// كل لاعب يرى اقتصاد دولته فقط — الرؤية الشاملة للمطورين فقط
const canSeeAllEcon = (u) => isDeveloper(u);
const GAME_DAY_MS = 4 * 60 * 1000; // يوم اللعبة = 4 دقائق حقيقية (ساعتان حقيقيتان = شهر لعبة من 30 يومًا)
function deliveryGameDays(buyerCC, sellerCC) {
  const a = continentOf(buyerCC), b = continentOf(sellerCC);
  if (a && b && a === b) return 5 + Math.floor(Math.random() * 3); // نفس القارة: 5-7 أيام
  return 15; // قارتان مختلفتان: 15 يومًا
}
async function notify(userId, ntype, title, body, link) {
  if (!userId) return;
  await q(`INSERT INTO notifications (user_id,ntype,title,body,link,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, ntype, title, body, link || null, Date.now()]);
}
async function ownersOf(cc) {
  const rows = await all(`SELECT id FROM users WHERE country_code=$1 AND role NOT IN ('system','developer') AND COALESCE(banned,0)=0`, [cc]);
  return rows.map((r) => r.id);
}
async function devIds() {
  const rows = await all(`SELECT id FROM users WHERE role='developer'`);
  return rows.map((r) => r.id);
}
async function deductLiquidity(cc, amountUsd) {
  if (!(amountUsd > 0)) return true;
  const e = await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc]);
  const cur = e && e.liquidity_m_usd != null ? Number(e.liquidity_m_usd) : 0;
  if (cur < amountUsd) return false;
  await q('UPDATE country_economy SET liquidity_m_usd = liquidity_m_usd - $2 WHERE country_code=$1', [cc, amountUsd]);
  return true;
}
async function addLiquidity(cc, amountUsd) {
  if (!(amountUsd > 0)) return;
  await q('UPDATE country_economy SET liquidity_m_usd = COALESCE(liquidity_m_usd,0) + $2 WHERE country_code=$1', [cc, amountUsd]);
}
// سجل حركات السيولة: كل عملية شراء/بيع/جباية/تأسيس تُسجَّل هنا
async function logLiq(cc, amount, reason, actor) {
  try {
    await q('INSERT INTO liquidity_log (country_code,amount,reason,actor,created_at) VALUES ($1,$2,$3,$4,$5)',
      [cc, Math.round(Number(amount) * 100) / 100, reason, actor || null, Date.now()]);
  } catch (e) { /* غير حرج */ }
}
// مخزون الموارد المنتَجة
async function getStock(cc, res2) {
  const r = await one('SELECT stock FROM country_stocks WHERE country_code=$1 AND resource=$2', [cc, res2]);
  return r ? Number(r.stock) || 0 : 0;
}
async function addStock(cc, res2, delta) {
  const ex = await one('SELECT stock FROM country_stocks WHERE country_code=$1 AND resource=$2', [cc, res2]);
  if (ex) await q('UPDATE country_stocks SET stock = stock + $3 WHERE country_code=$1 AND resource=$2', [cc, res2, delta]);
  else await q('INSERT INTO country_stocks (country_code,resource,stock) VALUES ($1,$2,$3)', [cc, res2, delta]);
}
// الكمية المحجوزة من مورد (عروض نشطة + شحنات في الطريق)
async function reservedStock(cc, res2) {
  const l = await one(`SELECT COALESCE(SUM(qty),0) s FROM market_listings WHERE seller_country=$1 AND resource=$2 AND status='active'`, [cc, res2]);
  const o = await one(`SELECT COALESCE(SUM(qty),0) s FROM market_orders WHERE seller_country=$1 AND resource=$2 AND status='in_transit'`, [cc, res2]);
  return (Number(l.s) || 0) + (Number(o.s) || 0);
}
// زمن اللعبة = المنقضي منذ تشغيل الساعة؛ والشهر = 30 يوم لعبة (ساعتان حقيقيتان)
function gameMonthMs() { return GAME_MONTH_MS; }
function gameMonthIdx(ts) { return Math.floor(Number(ts || 0) / gameMonthMs()); }
async function gameNow() {
  const row = await one('SELECT started_at FROM game_clock WHERE id=1');
  const st = row && row.started_at ? Number(row.started_at) : null;
  return st ? Math.max(0, Date.now() - st) : 0;
}
// الجباية/الجمع متاح إذا لم يحدث من قبل أو دخلنا شهر لعبة جديدًا
function canCollectNow(nowG, lastTs) {
  if (lastTs == null) return true;
  return gameMonthIdx(nowG) > gameMonthIdx(lastTs);
}
async function seedEconomy() {
  await q(`CREATE TABLE IF NOT EXISTS country_economy (
    country_code TEXT PRIMARY KEY,
    currency_name TEXT, currency_code TEXT,
    units_per_usd DOUBLE PRECISION,
    currency_confidence TEXT DEFAULT 'unknown', currency_source TEXT, currency_note TEXT,
    population BIGINT,
    pop_confidence TEXT DEFAULT 'unknown', pop_source TEXT,
    gdp_m_intl DOUBLE PRECISION,
    gdp_confidence TEXT DEFAULT 'unknown', gdp_source TEXT, gdp_note TEXT,
    liquidity_m_usd DOUBLE PRECISION,
    liquidity_confidence TEXT DEFAULT 'unknown', liquidity_source TEXT, liquidity_note TEXT,
    updated_by INTEGER, updated_at BIGINT
  )`);
  await q(`CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY, country_code TEXT NOT NULL, owner_id INTEGER NOT NULL,
    name TEXT NOT NULL, sector TEXT NOT NULL, city TEXT,
    capital DOUBLE PRECISION, description TEXT,
    created_at BIGINT, updated_at BIGINT
  )`);
  await q(`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
    ntype TEXT, title TEXT, body TEXT, link TEXT,
    is_read BOOLEAN DEFAULT FALSE, created_at BIGINT
  )`);
  await q(`CREATE TABLE IF NOT EXISTS market_listings (
    id SERIAL PRIMARY KEY, seller_id INTEGER NOT NULL, seller_country TEXT NOT NULL,
    weapon_id INTEGER NOT NULL, qty INTEGER NOT NULL,
    price_unit_m_usd DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'active', created_at BIGINT
  )`);
  await q(`CREATE TABLE IF NOT EXISTS market_orders (
    id SERIAL PRIMARY KEY, listing_id INTEGER NOT NULL, weapon_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL, seller_country TEXT NOT NULL,
    buyer_id INTEGER NOT NULL, buyer_country TEXT NOT NULL,
    qty INTEGER NOT NULL, total_m_usd DOUBLE PRECISION NOT NULL,
    game_days INTEGER NOT NULL,
    status TEXT DEFAULT 'in_transit', deliver_at BIGINT, created_at BIGINT
  )`);
  // مخزون الموارد المنتَجة لكل دولة + سجل حركات السيولة
  await q(`CREATE TABLE IF NOT EXISTS country_stocks (
    country_code TEXT NOT NULL, resource TEXT NOT NULL, stock DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (country_code, resource)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS resource_extracted (
    country_code TEXT NOT NULL, resource TEXT NOT NULL, extracted DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (country_code, resource)
  )`);
  await q(`CREATE TABLE IF NOT EXISTS liquidity_log (
    id SERIAL PRIMARY KEY, country_code TEXT, amount DOUBLE PRECISION,
    reason TEXT, actor TEXT, created_at BIGINT
  )`);
  // ترقية قواعد البيانات القديمة
  for (const colDef of [
    'liquidity_m_usd DOUBLE PRECISION',
    "liquidity_confidence TEXT DEFAULT 'unknown'",
    'liquidity_source TEXT', 'liquidity_note TEXT',
  ]) { try { await q(`ALTER TABLE country_economy ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ } }
  for (const colDef of [
    "ctype TEXT DEFAULT 'national'", "status TEXT DEFAULT 'approved'",
    'host_country TEXT', 'capital_usd DOUBLE PRECISION',
  ]) { try { await q(`ALTER TABLE companies ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ } }
  for (const colDef of [
    'tax_rate DOUBLE PRECISION DEFAULT 10', 'last_tax_collect BIGINT',
    'revolt_active INTEGER DEFAULT 0',
  ]) { try { await q(`ALTER TABLE country_economy ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ } }
  for (const colDef of [
    'resource_kind TEXT', 'workers INTEGER DEFAULT 0', 'last_collect BIGINT',
  ]) { try { await q(`ALTER TABLE companies ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ } }
  for (const colDef of [
    "kind TEXT DEFAULT 'weapon'", 'title TEXT', 'unit TEXT', 'resource TEXT',
  ]) {
    try { await q(`ALTER TABLE market_listings ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ }
    try { await q(`ALTER TABLE market_orders ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ }
  }
  await q('UPDATE country_economy SET tax_rate=10 WHERE tax_rate IS NULL');
  // عروض الموارد لا تحمل weapon_id
  for (const t of ['market_listings', 'market_orders']) {
    try { await q(`ALTER TABLE ${t} ALTER COLUMN weapon_id DROP NOT NULL`); } catch (e) { /* مدعوم */ }
  }
  await q("UPDATE market_listings SET kind='weapon' WHERE kind IS NULL");
  await q("UPDATE market_orders SET kind='weapon' WHERE kind IS NULL");
  await q(`UPDATE companies SET host_country=country_code WHERE host_country IS NULL`);
  await q(`UPDATE companies SET capital_usd=capital WHERE capital_usd IS NULL`);
  await q(`CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)`);
  const meta = await one("SELECT value FROM seed_meta WHERE key='economy_v1'");
  let ECON = [];
  try { ECON = require('./server/data/economy-1900.json'); } catch (e) { /* بلا بيانات */ }
  if (!meta) {
    for (const r of ECON) {
      if (!r || !validCountry(r.country_code)) continue;
      const ex = await one('SELECT country_code, updated_by FROM country_economy WHERE country_code=$1', [r.country_code]);
      const vals = [
        r.country_code,
        r.currency_name_ar || null, r.currency_code || null,
        r.units_per_usd == null ? null : Number(r.units_per_usd),
        r.currency_confidence || 'unknown', r.currency_source || null, r.currency_note || null,
        r.population_1900 == null ? null : parseInt(r.population_1900, 10),
        r.pop_confidence || 'unknown', r.pop_source || null,
        r.gdp_1900_m_intl == null ? null : Number(r.gdp_1900_m_intl),
        r.gdp_confidence || 'unknown', r.gdp_source || null, r.gdp_note || null,
        r.liquidity_m_usd == null ? null : Number(r.liquidity_m_usd),
        r.liquidity_confidence || 'unknown', r.liquidity_source || null, r.liquidity_note || null,
        Date.now(),
      ];
      if (!ex) {
        await q(`INSERT INTO country_economy (country_code,currency_name,currency_code,units_per_usd,
          currency_confidence,currency_source,currency_note,population,pop_confidence,pop_source,
          gdp_m_intl,gdp_confidence,gdp_source,gdp_note,
          liquidity_m_usd,liquidity_confidence,liquidity_source,liquidity_note,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, vals);
      } else if (!ex.updated_by) {
        await q(`UPDATE country_economy SET currency_name=$2,currency_code=$3,units_per_usd=$4,
          currency_confidence=$5,currency_source=$6,currency_note=$7,population=$8,
          pop_confidence=$9,pop_source=$10,gdp_m_intl=$11,gdp_confidence=$12,gdp_source=$13,
          gdp_note=$14,liquidity_m_usd=$15,liquidity_confidence=$16,liquidity_source=$17,
          liquidity_note=$18,updated_at=$19 WHERE country_code=$1`, vals);
      }
    }
    await q("INSERT INTO seed_meta (key,value) VALUES ('economy_v1','done') ON CONFLICT (key) DO NOTHING");
  }
  // تعبئة السيولة للصفوف القديمة التي لم يمسسها المطور (لا تمس أي تعديل يدوي)
  for (const r of ECON) {
    if (!r || r.liquidity_m_usd == null) continue;
    await q(`UPDATE country_economy SET liquidity_m_usd=$2, liquidity_confidence=$3,
             liquidity_source=$4, liquidity_note=$5
             WHERE country_code=$1 AND liquidity_m_usd IS NULL`,
      [r.country_code, Number(r.liquidity_m_usd), r.liquidity_confidence || 'estimate',
       r.liquidity_source || null, r.liquidity_note || null]);
  }
}
function econRow(e) {
  const pop = e.population == null ? null : Number(e.population);
  const gdp = e.gdp_m_intl == null ? null : Number(e.gdp_m_intl);
  const liq = e.liquidity_m_usd == null ? null : Number(e.liquidity_m_usd);
  return {
    country_code: e.country_code,
    currency_name: e.currency_name, currency_code: e.currency_code,
    units_per_usd: e.units_per_usd == null ? null : Number(e.units_per_usd),
    currency_confidence: e.currency_confidence, currency_source: e.currency_source, currency_note: e.currency_note,
    population: pop, pop_confidence: e.pop_confidence, pop_source: e.pop_source,
    gdp_m_intl: gdp, gdp_confidence: e.gdp_confidence, gdp_source: e.gdp_source, gdp_note: e.gdp_note,
    gdp_per_capita: (pop && gdp) ? Math.round((gdp * 1e6) / pop) : null,
    liquidity_m_usd: liq, liquidity_confidence: e.liquidity_confidence,
    liquidity_source: e.liquidity_source, liquidity_note: e.liquidity_note,
  };
}
function companyRow(c) {
  return {
    id: c.id, country_code: c.country_code, host_country: c.host_country,
    owner_id: c.owner_id, owner_name: c.owner_name,
    ctype: c.ctype || 'national', status: c.status || 'approved',
    name: c.name, sector: c.sector, city: c.city,
    capital: c.capital == null ? null : Number(c.capital),
    capital_usd: c.capital_usd == null ? null : Number(c.capital_usd),
    description: c.description, created_at: Number(c.created_at),
    resource_kind: c.resource_kind || null,
    resource_name: c.resource_kind ? RES_AR[c.resource_kind] : null,
    resource_unit: c.resource_kind ? RES_UNIT[c.resource_kind] : null,
    workers: Number(c.workers) || 0,
    last_collect: c.last_collect == null ? null : Number(c.last_collect),
  };
}
// بيانات جغرافية للنماذج (مدن كل دولة + قارتها)
app.get('/api/meta/geo', ah(auth), ah(async (req, res) => {
  res.json({ cities: GEO_CITIES, continents: GEO_CONT });
}));
// نظرة عامة — كل لاعب يرى اقتصاد دولته فقط (المطورون فقط يرون الكل)
app.get('/api/economy', ah(auth), ah(async (req, res) => {
  const full = canSeeAllEcon(req.user);
  const rows = full
    ? await all('SELECT * FROM country_economy ORDER BY population DESC NULLS LAST')
    : await all('SELECT * FROM country_economy WHERE country_code=$1', [req.user.country_code]);
  const counts = await all(`SELECT host_country AS country_code, COUNT(*) AS n FROM companies
                            WHERE status='approved' GROUP BY host_country`);
  const cmap = {};
  for (const c of counts) cmap[c.country_code] = Number(c.n) || 0;
  res.json({
    economies: rows.map((r) => ({ ...econRow(r), companies_count: cmap[r.country_code] || 0 })),
    sectors: SECTORS, full,
  });
}));
// تفاصيل دولة — اقتصاد دولتك فقط (أو الكل للمطورين فقط)
app.get('/api/economy/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  if (!canSeeAllEcon(req.user) && cc !== req.user.country_code)
    return res.status(403).json({ error: 'يمكنك رؤية اقتصاد دولتك فقط' });
  const e = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  const cos = await all(`SELECT c.*, u.username AS owner_name FROM companies c
                         LEFT JOIN users u ON u.id=c.owner_id
                         WHERE c.host_country=$1 ORDER BY c.created_at DESC`, [cc]);
  const mine = await all(`SELECT c.*, u.username AS owner_name FROM companies c
                          LEFT JOIN users u ON u.id=c.owner_id
                          WHERE c.owner_id=$1 AND c.host_country!=$2 ORDER BY c.created_at DESC`,
    [req.user.id, cc]);
  // الضرائب: المبلغ القابل للجباية شهريًا = الناتج السنوي × النسبة ÷ 12
  const taxRate = e && e.tax_rate != null ? Number(e.tax_rate) : 10;
  const revolt = !!(e && e.revolt_active);
  const gdp = e && e.gdp_m_intl != null ? Number(e.gdp_m_intl) : null;
  const liq = e && e.liquidity_m_usd != null ? Number(e.liquidity_m_usd) : null;
  const taxBase = gdp || (liq != null ? liq / 0.04 : 0);
  const collectAmount = Math.round(taxBase * (taxRate / 100) / 12);
  const nowG = await gameNow();
  const canCollect = !revolt && canCollectNow(nowG, e ? e.last_tax_collect : null);
  // الموارد: الاحتياطيات التقديرية + المخزون المنتَج
  const resInfo = (RESERVES[cc] && typeof RESERVES[cc] === 'object') ? RESERVES[cc] : {};
  const resources = [];
  for (const k of Object.keys(RES_AR)) {
    resources.push({
      kind: k, name: RES_AR[k], unit: RES_UNIT[k],
      reserves: Number(resInfo[k]) || 0,
      stock: await getStock(cc, k),
    });
  }
  // البطالة: قوة العمل ≈ 35% من السكان، والموظفون = عمال الشركات المعتمدة
  const wsum = await one(`SELECT COALESCE(SUM(workers),0) s FROM companies WHERE host_country=$1 AND status='approved'`, [cc]);
  const gameWorkers = Number(wsum.s) || 0;
  const employed = gameWorkers * 100;
  const pop = e && e.population ? Number(e.population) : null;
  const laborForce = pop ? Math.round(pop * 0.35) : null;
  const unempRate = laborForce ? Math.max(0, Math.round((laborForce - employed) / laborForce * 1000) / 10) : null;
  const liqLog = await all('SELECT amount,reason,actor,created_at FROM liquidity_log WHERE country_code=$1 ORDER BY id DESC LIMIT 12', [cc]);
  res.json({
    economy: e ? econRow(e) : null,
    tax_rate: taxRate, revolt_active: revolt,
    collect_amount: collectAmount, can_collect: canCollect,
    last_tax_collect: e && e.last_tax_collect != null ? Number(e.last_tax_collect) : null,
    resources, unemployment: { labor_force: laborForce, employed, game_workers: gameWorkers, worker_scale: 100, rate: unempRate },
    liquidity_log: liqLog.map((x) => ({ amount: Number(x.amount), reason: x.reason, actor: x.actor, created_at: Number(x.created_at) })),
    companies: cos.map(companyRow),
    my_companies_abroad: mine.map(companyRow),
    sectors: SECTORS, cities: citiesOf(cc),
    resource_kinds: Object.keys(RES_AR).map((k) => ({ kind: k, name: RES_AR[k], unit: RES_UNIT[k], rate: RES_RATE[k] })),
    full: canSeeAllEcon(req.user),
  });
}));
function cleanCompany(b, founderCC) {
  const out = {};
  if (typeof b.name !== 'string' || !b.name.trim()) throw new Error('اسم الشركة مطلوب');
  out.name = b.name.trim().slice(0, 120);
  if (!SECTORS.includes(b.sector)) throw new Error('اختر قطاعًا صالحًا');
  out.sector = b.sector;
  const ctype = b.ctype === 'international' ? 'international' : 'national';
  out.ctype = ctype;
  let hostCC = founderCC;
  if (ctype === 'international') {
    hostCC = String(b.host_country || '').toUpperCase();
    if (!validCountry(hostCC)) throw new Error('اختر الدولة المضيفة');
    if (hostCC === founderCC) throw new Error('الشركة الدولية يجب أن تُبنى خارج دولتك — اختر «وطنية» لداخل دولتك');
  }
  out.host_country = hostCC;
  const city = typeof b.city === 'string' ? b.city.trim().slice(0, 120) : '';
  if (!city) throw new Error('اختر مدينة المقر');
  const list = citiesOf(hostCC);
  if (list.length && !list.includes(city)) throw new Error('المدينة يجب أن تكون من مدن ' + cname(hostCC));
  out.city = city;
  const rk = b.resource_kind || null;
  if (rk && !RES_AR[rk]) throw new Error('تخصص المورد غير صالح');
  out.resource_kind = rk;
  const wk = parseInt(b.workers, 10) || 0;
  if (wk < 0 || wk > MAX_WORKERS) throw new Error('عدد العمال يجب أن يكون بين 0 و ' + MAX_WORKERS.toLocaleString('en-US'));
  out.workers = wk;
  const capLocal = Number(b.capital);
  if (!(capLocal > 0)) throw new Error('رأس المال مطلوب (بملايين عملة الدولة المضيفة)');
  out.capital = capLocal;
  out.description = typeof b.description === 'string' && b.description.trim() ? b.description.trim().slice(0, 500) : null;
  return out;
}
// إنشاء شركة — وطنية: مقرها في مدن دولتك فقط وتُخصم فورًا | دولية: بموافقة الدولة المضيفة
app.post('/api/companies', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const b = req.body || {};
  let founderCC = req.user.country_code;
  if (dev && b.country_code) {
    const cc = String(b.country_code).toUpperCase();
    if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
    founderCC = cc;
  }
  if (!founderCC) return res.status(400).json({ error: 'لا توجد دولة مرتبطة بحسابك' });
  let c; try { c = cleanCompany(b, founderCC); } catch (e) { return res.status(400).json({ error: e.message }); }
  const erow = await one('SELECT units_per_usd, currency_code FROM country_economy WHERE country_code=$1', [c.host_country]);
  const rate = erow && erow.units_per_usd ? Number(erow.units_per_usd) : 1;
  const capUsd = c.capital / rate;
  const status = (c.ctype === 'international' && !dev) ? 'pending' : 'approved';
  if (status === 'approved') {
    const ok = await deductLiquidity(c.host_country, capUsd);
    if (!ok) return res.status(400).json({ error: 'سيولة ' + cname(c.host_country) + ' لا تكفي لرأس المال المطلوب' });
    await logLiq(c.host_country, -capUsd, `تأسيس شركة «${c.name}» (${c.city})`, req.user.username);
  }
  const r = await q(`INSERT INTO companies (country_code,host_country,owner_id,ctype,status,name,sector,city,
                     capital,capital_usd,description,resource_kind,workers,created_at,updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING id`,
    [founderCC, c.host_country, req.user.id, c.ctype, status, c.name, c.sector, c.city,
     c.capital, capUsd, c.description, c.resource_kind, c.workers, Date.now()]);
  const id = r.rows[0].id;
  if (status === 'pending') {
    const owners = await ownersOf(c.host_country);
    const targets = owners.length ? owners : await devIds();
    const curName = erow && erow.currency_code ? erow.currency_code : 'دولار';
    for (const uid of targets) {
      await notify(uid, 'company_request',
        `طلب شركة دولية في ${cname(c.host_country)}`,
        `${req.user.username} (${cname(founderCC)}) يطلب تأسيس شركة دولية «${c.name}» في ${c.city} برأس مال ${c.capital} مليون ${curName} (~${Math.round(capUsd)} مليون دولار). القرار لك: موافقة أم رفض.`,
        `#/economy/${c.host_country}`);
    }
  }
  res.json({ ok: true, id, status });
}));
// طلبات الشركات الدولية المعلقة — صاحب الدولة المضيفة أو المطورون
app.get('/api/companies/pending', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const rows = dev
    ? await all(`SELECT c.*, u.username AS owner_name FROM companies c LEFT JOIN users u ON u.id=c.owner_id
                 WHERE c.status='pending' ORDER BY c.created_at DESC`)
    : await all(`SELECT c.*, u.username AS owner_name FROM companies c LEFT JOIN users u ON u.id=c.owner_id
                 WHERE c.status='pending' AND c.host_country=$1 ORDER BY c.created_at DESC`, [req.user.country_code]);
  res.json({ pending: rows.map(companyRow) });
}));
// الموافقة على شركة دولية — صاحب الدولة المضيفة أو المطورون (يُخصم رأس المال من سيولة الدولة المضيفة)
app.post('/api/companies/:id/approve', ah(auth), ah(async (req, res) => {
  const row = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'الشركة غير موجودة' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلقًا' });
  const dev = isDeveloper(req.user);
  if (!dev && req.user.country_code !== row.host_country)
    return res.status(403).json({ error: 'الموافقة لصاحب الدولة المضيفة فقط' });
  const ok = await deductLiquidity(row.host_country, Number(row.capital_usd) || 0);
  if (!ok) return res.status(400).json({ error: 'سيولة ' + cname(row.host_country) + ' لا تكفي لرأس مال الشركة' });
  await q(`UPDATE companies SET status='approved', updated_at=$2 WHERE id=$1`, [req.params.id, Date.now()]);
  await notify(row.owner_id, 'company_decision',
    `تمت الموافقة على شركتك «${row.name}»`,
    `${cname(row.host_country)} وافقت على تأسيس شركتك الدولية في ${row.city}.`,
    `#/economy/${row.host_country}`);
  res.json({ ok: true });
}));
// رفض شركة دولية — صاحب الدولة المضيفة أو المطورون
app.post('/api/companies/:id/reject', ah(auth), ah(async (req, res) => {
  const row = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'الشركة غير موجودة' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلقًا' });
  const dev = isDeveloper(req.user);
  if (!dev && req.user.country_code !== row.host_country)
    return res.status(403).json({ error: 'الرفض لصاحب الدولة المضيفة فقط' });
  await q(`UPDATE companies SET status='rejected', updated_at=$2 WHERE id=$1`, [req.params.id, Date.now()]);
  await notify(row.owner_id, 'company_decision',
    `رُفض طلب شركتك «${row.name}»`,
    `${cname(row.host_country)} رفضت تأسيس شركتك الدولية في ${row.city}.`,
    `#/economy/${row.country_code}`);
  res.json({ ok: true });
}));
// تعديل شركة — مالكها أو المطورون (لا يغيّر الدولة/النوع بعد الإنشاء)
app.put('/api/companies/:id', ah(auth), ah(async (req, res) => {
  const row = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const dev = isDeveloper(req.user);
  if (!dev && row.owner_id !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
  const b = req.body || {};
  if (typeof b.name !== 'string' || !b.name.trim()) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  if (!SECTORS.includes(b.sector)) return res.status(400).json({ error: 'اختر قطاعًا صالحًا' });
  const city = typeof b.city === 'string' ? b.city.trim().slice(0, 120) : '';
  const list = citiesOf(row.host_country);
  if (list.length && !list.includes(city)) return res.status(400).json({ error: 'المدينة يجب أن تكون من مدن ' + cname(row.host_country) });
  const desc = typeof b.description === 'string' && b.description.trim() ? b.description.trim().slice(0, 500) : null;
  const rk = b.resource_kind || null;
  if (rk && !RES_AR[rk]) return res.status(400).json({ error: 'تخصص المورد غير صالح' });
  const wk = Math.max(0, Math.min(MAX_WORKERS, parseInt(b.workers, 10) || 0));
  await q(`UPDATE companies SET name=$1,sector=$2,city=$3,description=$4,resource_kind=$5,workers=$6,updated_at=$7 WHERE id=$8`,
    [b.name.trim().slice(0, 120), b.sector, city, desc, rk, wk, Date.now(), req.params.id]);
  res.json({ ok: true });
}));
// جمع إنتاج الشركة — شهريًا بزمن اللعبة: كل عامل ينتج كمية ثابتة حسب المورد
app.post('/api/companies/:id/collect', ah(auth), ah(async (req, res) => {
  const row = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'الشركة غير موجودة' });
  if (row.status !== 'approved') return res.status(400).json({ error: 'الشركة لم تُعتمد بعد' });
  const dev = isDeveloper(req.user);
  if (!dev && row.owner_id !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
  if (!row.resource_kind || !RES_AR[row.resource_kind])
    return res.status(400).json({ error: 'هذه الشركة غير متخصصة في استخراج مورد — حدد تخصصها أولًا' });
  const workers = Number(row.workers) || 0;
  if (workers <= 0) return res.status(400).json({ error: 'حدد عدد العمال أولًا' });
  const nowG = await gameNow();
  const monthStart = gameMonthIdx(nowG) * GAME_MONTH_MS; // بداية شهر اللعبة الحالي بالمللي
  // حجز ذري لشهر اللعبة: أول طلب فقط ينجح — يمنع غليتش الأموال عند الضغط المزدوج
  const claim = await q('UPDATE companies SET last_collect=$1 WHERE id=$2 AND (last_collect IS NULL OR last_collect < $3)',
    [nowG, row.id, monthStart]);
  if (!claim.rowCount)
    return res.status(400).json({ error: 'تم جمع إنتاج هذا الشهر — عُد الشهر القادم (شهر لعبة)' });
  const reserveTotal = Number((RESERVES[row.host_country] || {})[row.resource_kind]) || 0;
  const exRow = await one('SELECT extracted FROM resource_extracted WHERE country_code=$1 AND resource=$2', [row.host_country, row.resource_kind]);
  const extractedSoFar = exRow ? Number(exRow.extracted) || 0 : 0;
  const remaining = reserveTotal - extractedSoFar;
  if (remaining <= 0)
    return res.status(400).json({ error: 'نفد احتياطي ' + RES_AR[row.resource_kind] + ' في ' + cname(row.host_country) });
  let amount = Math.floor(Math.min(workers * RES_RATE[row.resource_kind], remaining));
  if (amount <= 0) return res.status(400).json({ error: 'لا يوجد إنتاج متاح هذا الشهر' });
  await addStock(row.host_country, row.resource_kind, amount);
  if (exRow) await q('UPDATE resource_extracted SET extracted = extracted + $3 WHERE country_code=$1 AND resource=$2',
    [row.host_country, row.resource_kind, amount]);
  else await q('INSERT INTO resource_extracted (country_code,resource,extracted) VALUES ($1,$2,$3)',
    [row.host_country, row.resource_kind, amount]);
  await logLiq(row.host_country, 0, `إنتاج ${RES_AR[row.resource_kind]}: ${amount.toLocaleString('en-US')} ${RES_UNIT[row.resource_kind]} من «${row.name}» (${workers.toLocaleString('en-US')} عامل)`, req.user.username);
  res.json({ ok: true, amount, unit: RES_UNIT[row.resource_kind], resource: RES_AR[row.resource_kind],
             stock: await getStock(row.host_country, row.resource_kind), reserve_remaining: remaining - amount });
}));
// حذف شركة — مالكها أو المطورون
app.delete('/api/companies/:id', ah(auth), ah(async (req, res) => {
  const row = await one('SELECT * FROM companies WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const dev = isDeveloper(req.user);
  if (!dev && row.owner_id !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
  await q('DELETE FROM companies WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));
// تعديل بيانات اقتصاد دولة — المطورون لكل الحقول، وصاحب الدولة لنسبة الضريبة فقط
app.put('/api/economy/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = isDeveloper(req.user);
  const isOwner = req.user.country_code === cc;
  if (!dev && !isOwner) return res.status(403).json({ error: 'غير مصرح' });
  const b = req.body || {};
  // نسبة الضريبة — يحددها صاحب الدولة (0-100)
  if (b.tax_rate !== undefined) {
    const nr = Math.max(0, Math.min(100, Number(b.tax_rate) || 0));
    let row = await one('SELECT tax_rate, revolt_active, liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc]);
    if (!row) {
      await q('INSERT INTO country_economy (country_code,tax_rate,updated_by,updated_at) VALUES ($1,$2,$3,$4)',
        [cc, nr, req.user.id, Date.now()]);
      row = { tax_rate: nr, revolt_active: 0, liquidity_m_usd: 0 };
    } else {
      await q('UPDATE country_economy SET tax_rate=$2, updated_by=$3, updated_at=$4 WHERE country_code=$1',
        [cc, nr, req.user.id, Date.now()]);
    }
    // تجاوز 30%: ثورة شعبية — عصيان مدني: خصم 15% من السيولة + إعلان على الخريطة
    if (nr > 30 && !row.revolt_active) {
      const liq = Number(row.liquidity_m_usd) || 0;
      const loss = Math.round(liq * 0.15);
      await q('UPDATE country_economy SET liquidity_m_usd = GREATEST(0, COALESCE(liquidity_m_usd,0) - $2), revolt_active=1 WHERE country_code=$1', [cc, loss]);
      await logLiq(cc, -loss, 'خسائر الثورة الشعبية — عصيان مدني بعد رفع الضرائب فوق 30%', req.user.username);
      const ms = await one('SELECT status FROM map_states WHERE country_code=$1', [cc]);
      if (!ms || !['war', 'emergency'].includes(ms.status)) {
        const ex = await one('SELECT country_code FROM map_states WHERE country_code=$1', [cc]);
        if (ex) await q(`UPDATE map_states SET color='#ff2222',status='revolt',label='ثورة شعبية — عصيان مدني ضد الضرائب المرتفعة',updated_by=$2,updated_at=$3 WHERE country_code=$1`, [cc, req.user.id, Date.now()]);
        else await q(`INSERT INTO map_states (country_code,color,status,label,updated_by,updated_at) VALUES ($1,'#ff2222','revolt','ثورة شعبية — عصيان مدني ضد الضرائب المرتفعة',$2,$3)`, [cc, req.user.id, Date.now()]);
      }
      const owners = await ownersOf(cc);
      const tg = owners.length ? owners : await devIds();
      for (const uid of tg) await notify(uid, 'revolt',
        'ثورة شعبية في ' + cname(cc) + '!',
        `الشعب أعلن العصيان المدني بعد رفع الضرائب فوق 30%. خسرت الدولة ${loss.toLocaleString('en-US')} مليون دولار من السيولة، وتوقفت جباية الضرائب حتى تهدأ الأوضاع. اخفض الضريبة لـ30% أو أقل لإنهاء الثورة.`,
        '#/economy/' + cc);
    } else if (nr <= 30 && row.revolt_active) {
      // انتهاء الثورة
      await q('UPDATE country_economy SET revolt_active=0 WHERE country_code=$1', [cc]);
      await q("DELETE FROM map_states WHERE country_code=$1 AND status='revolt'", [cc]);
      const owners = await ownersOf(cc);
      const tg = owners.length ? owners : await devIds();
      for (const uid of tg) await notify(uid, 'revolt_end',
        'انتهت الثورة في ' + cname(cc),
        'هدأت الأوضاع بعد خفض الضرائب. عادت جباية الضرائب للعمل.', '#/economy/' + cc);
    }
    if (!dev) return res.json({ ok: true, tax_rate: nr });
  }
  if (!dev) return res.status(403).json({ error: 'بقية الحقول للمطورين فقط' });
  const str = (k, n) => typeof b[k] === 'string' && b[k].trim() ? b[k].trim().slice(0, n) : null;
  const num = (k) => b[k] == null || b[k] === '' ? null : Number(b[k]);
  const conf = (k) => ['documented', 'estimate', 'unknown'].includes(b[k]) ? b[k] : null;
  const sets = [], vals = []; let i = 1;
  const put = (col, v) => { sets.push(`${col}=$${i++}`); vals.push(v); };
  if ('currency_name' in b) put('currency_name', str('currency_name', 80));
  if ('currency_code' in b) put('currency_code', str('currency_code', 12));
  if ('units_per_usd' in b) put('units_per_usd', num('units_per_usd'));
  if ('currency_confidence' in b) put('currency_confidence', conf('currency_confidence') || 'unknown');
  if ('currency_source' in b) put('currency_source', str('currency_source', 500));
  if ('currency_note' in b) put('currency_note', str('currency_note', 300));
  if ('population' in b) put('population', b.population == null || b.population === '' ? null : Math.max(0, parseInt(b.population, 10) || 0));
  if ('pop_confidence' in b) put('pop_confidence', conf('pop_confidence') || 'unknown');
  if ('pop_source' in b) put('pop_source', str('pop_source', 500));
  if ('gdp_m_intl' in b) put('gdp_m_intl', num('gdp_m_intl'));
  if ('gdp_confidence' in b) put('gdp_confidence', conf('gdp_confidence') || 'unknown');
  if ('gdp_source' in b) put('gdp_source', str('gdp_source', 500));
  if ('gdp_note' in b) put('gdp_note', str('gdp_note', 300));
  if ('liquidity_m_usd' in b) put('liquidity_m_usd', num('liquidity_m_usd'));
  if ('liquidity_confidence' in b) put('liquidity_confidence', conf('liquidity_confidence') || 'unknown');
  if ('liquidity_source' in b) put('liquidity_source', str('liquidity_source', 500));
  if ('liquidity_note' in b) put('liquidity_note', str('liquidity_note', 300));
  const ex = await one('SELECT country_code FROM country_economy WHERE country_code=$1', [cc]);
  if (!ex) {
    await q(`INSERT INTO country_economy (country_code,updated_by,updated_at) VALUES ($1,$2,$3)`, [cc, req.user.id, Date.now()]);
  }
  if (sets.length) {
    put('updated_by', req.user.id); put('updated_at', Date.now());
    vals.push(cc);
    await q(`UPDATE country_economy SET ${sets.join(', ')} WHERE country_code=$${i}`, vals);
  }
  res.json({ ok: true });
}));

// جباية الضرائب — مرة كل شهر لعبة: الناتج السنوي × النسبة ÷ 12 (ممنوعة أثناء الثورة)
app.post('/api/economy/:code/collect-taxes', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = isDeveloper(req.user);
  if (!dev && req.user.country_code !== cc) return res.status(403).json({ error: 'غير مصرح' });
  const e = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  if (!e) return res.status(400).json({ error: 'لا توجد بيانات اقتصادية' });
  if (e.revolt_active) return res.status(403).json({ error: 'لا يمكن جباية الضرائب أثناء الثورة الشعبية' });
  const nowG = await gameNow();
  const monthStart = gameMonthIdx(nowG) * GAME_MONTH_MS; // بداية شهر اللعبة الحالي بالمللي
  // حجز ذري لشهر اللعبة: أول طلب فقط ينجح — يمنع غليتش الأموال عند الضغط المزدوج
  const claim = await q('UPDATE country_economy SET last_tax_collect=$1 WHERE country_code=$2 AND (last_tax_collect IS NULL OR last_tax_collect < $3)',
    [nowG, cc, monthStart]);
  if (!claim.rowCount)
    return res.status(400).json({ error: 'تمت الجباية هذا الشهر — عُد الشهر القادم (شهر لعبة = ساعتان)' });
  const rate = e.tax_rate != null ? Number(e.tax_rate) : 10;
  const gdp = e.gdp_m_intl != null ? Number(e.gdp_m_intl) : null;
  const liq = e.liquidity_m_usd != null ? Number(e.liquidity_m_usd) : null;
  const base = gdp || (liq != null ? liq / 0.04 : 0);
  const amount = Math.round(base * (rate / 100) / 12);
  await q('UPDATE country_economy SET liquidity_m_usd = COALESCE(liquidity_m_usd,0) + $2 WHERE country_code=$1',
    [cc, amount]);
  await logLiq(cc, amount, `جباية الضرائب الشهرية بنسبة ${rate}%`, req.user.username);
  const ne = await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc]);
  res.json({ ok: true, amount, liquidity: Number(ne.liquidity_m_usd) || 0 });
}));

// ---------- الإشعارات ----------
app.get('/api/notifications', ah(auth), ah(async (req, res) => {
  const rows = await all(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ notifications: rows.map((n) => ({
    id: n.id, ntype: n.ntype, title: n.title, body: n.body, link: n.link,
    is_read: !!n.is_read, created_at: Number(n.created_at),
  })) });
}));
app.get('/api/notifications/unread-count', ah(auth), ah(async (req, res) => {
  const r = await one(`SELECT COUNT(*) c FROM notifications WHERE user_id=$1 AND is_read IS NOT TRUE`, [req.user.id]);
  res.json({ count: Number(r.c) || 0 });
}));
app.post('/api/notifications/read-all', ah(auth), ah(async (req, res) => {
  await q(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1`, [req.user.id]);
  res.json({ ok: true });
}));

// ---------- سوق السلاح ----------
async function processDeliveries() {
  const due = await all(`SELECT * FROM market_orders WHERE status='in_transit' AND deliver_at <= $1`, [Date.now()]);
  for (const o of due) {
    const isRes = o.kind === 'resource' && o.resource && RES_AR[o.resource];
    if (isRes) {
      await addStock(o.seller_country, o.resource, -o.qty);
      await addStock(o.buyer_country, o.resource, o.qty);
      await q(`UPDATE market_orders SET status='delivered' WHERE id=$1`, [o.id]);
      await notify(o.buyer_id, 'market_delivery', 'وصلت شحنة الموارد',
        `اكتمل تسليم ${o.qty.toLocaleString('en-US')} ${o.unit || ''} ${o.title || ''} إلى مخزون ${cname(o.buyer_country)}.`, `#/market`);
      continue;
    }
    const w = await one('SELECT * FROM weapons WHERE id=$1', [o.weapon_id]);
    if (w) {
      await q(`INSERT INTO weapons (country_code,name,class,wtype,model,quantity,image_url,
               created_by,created_at,source_url,confidence,note)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.buyer_country, w.name, w.class, w.wtype, w.model, o.qty, w.image_url,
         o.buyer_id, Date.now(), w.source_url, w.confidence,
         `شراء من ${cname(o.seller_country)} عبر سوق السلاح`]);
    }
    await q(`UPDATE market_orders SET status='delivered' WHERE id=$1`, [o.id]);
    await notify(o.buyer_id, 'market_delivery', 'وصلت شحنة السلاح',
      `اكتمل تسليم ${o.qty} × ${w ? w.name : 'سلاح'} إلى ترسانة ${cname(o.buyer_country)}.`, `#/market`);
  }
}
// السوق: العروض النشطة
app.get('/api/market', ah(auth), ah(async (req, res) => {
  await processDeliveries();
  const rows = await all(`SELECT l.*, w.name AS weapon_name, w.class AS weapon_class, w.wtype AS weapon_wtype,
                          w.model AS weapon_model, w.image_url AS weapon_image, w.quantity AS weapon_qty,
                          u.username AS seller_name
                          FROM market_listings l
                          LEFT JOIN weapons w ON w.id=l.weapon_id
                          LEFT JOIN users u ON u.id=l.seller_id
                          WHERE l.status='active' ORDER BY l.created_at DESC`);
  res.json({ listings: rows.map((l) => ({
    id: l.id, seller_name: l.seller_name, seller_country: l.seller_country,
    seller_continent: continentOf(l.seller_country),
    kind: l.kind || 'weapon', title: l.title || l.weapon_name, unit: l.unit || 'قطعة', resource: l.resource || null,
    weapon_id: l.weapon_id, weapon_name: l.weapon_name, weapon_class: l.weapon_class,
    weapon_wtype: l.weapon_wtype, weapon_model: l.weapon_model, weapon_image: l.weapon_image,
    qty: l.qty, price_unit_m_usd: Number(l.price_unit_m_usd),
    created_at: Number(l.created_at),
  })) });
}));
// عرض للبيع — سلاح من الترسانة أو مورد من المخزون، بالسعر الذي يريده البائع
app.post('/api/market/listings', ah(auth), ah(async (req, res) => {
  const b = req.body || {};
  const dev = isDeveloper(req.user);
  const kind = b.kind === 'resource' ? 'resource' : 'weapon';
  const sellerCC = dev && b.country_code && validCountry(String(b.country_code).toUpperCase())
    ? String(b.country_code).toUpperCase() : req.user.country_code;
  if (!sellerCC) return res.status(400).json({ error: 'تحتاج دولة للبيع' });
  const qty = Math.max(1, parseInt(b.qty, 10) || 0);
  const price = Number(b.price_unit_m_usd);
  if (!(price > 0)) return res.status(400).json({ error: 'حدد سعر البيع (بملايين الدولارات للوحدة)' });
  if (kind === 'resource') {
    const rk = b.resource;
    if (!rk || !RES_AR[rk]) return res.status(400).json({ error: 'اختر موردًا صالحًا' });
    if (!dev && sellerCC !== req.user.country_code)
      return res.status(403).json({ error: 'يمكنك بيع موارد دولتك فقط' });
    const stock = await getStock(sellerCC, rk);
    const avail = stock - await reservedStock(sellerCC, rk);
    if (qty > avail) return res.status(400).json({ error: `المخزون المتاح للبيع: ${Math.max(0, Math.floor(avail)).toLocaleString('en-US')} ${RES_UNIT[rk]}` });
    const r = await q(`INSERT INTO market_listings (seller_id,seller_country,weapon_id,qty,price_unit_m_usd,kind,title,unit,resource,created_at)
                       VALUES ($1,$2,NULL,$3,$4,'resource',$5,$6,$7,$8) RETURNING id`,
      [req.user.id, sellerCC, qty, price, RES_AR[rk], RES_UNIT[rk], rk, Date.now()]);
    await logLiq(sellerCC, 0, `عرض ${qty.toLocaleString('en-US')} ${RES_UNIT[rk]} ${RES_AR[rk]} للبيع في السوق`, req.user.username);
    return res.json({ ok: true, id: r.rows[0].id });
  }
  const w = await one('SELECT * FROM weapons WHERE id=$1', [b.weapon_id]);
  if (!w) return res.status(404).json({ error: 'السلاح غير موجود' });
  if (!dev && w.country_code !== req.user.country_code)
    return res.status(403).json({ error: 'يمكنك بيع أسلحة دولتك فقط' });
  if (!(price > 0)) return res.status(400).json({ error: 'حدد سعر البيع (بملايين الدولارات للقطعة)' });
  const cap = w.quantity == null ? 50 : Math.max(0, Number(w.quantity));
  const used = await one(`SELECT COALESCE(SUM(qty),0) s FROM market_listings
                          WHERE weapon_id=$1 AND status='active'`, [w.id]);
  const inT = await one(`SELECT COALESCE(SUM(o.qty),0) s FROM market_orders o
                         JOIN market_listings l ON l.id=o.listing_id
                         WHERE l.weapon_id=$1 AND o.status='in_transit'`, [w.id]);
  const avail = cap - (Number(used.s) || 0) - (Number(inT.s) || 0);
  if (qty > avail) return res.status(400).json({ error: `الكمية المتاحة للبيع: ${avail}` });
  const r = await q(`INSERT INTO market_listings (seller_id,seller_country,weapon_id,qty,price_unit_m_usd,kind,title,unit,created_at)
                     VALUES ($1,$2,$3,$4,$5,'weapon',$6,'قطعة',$7) RETURNING id`,
    [req.user.id, sellerCC, w.id, qty, price, w.name, Date.now()]);
  res.json({ ok: true, id: r.rows[0].id });
}));
// إلغاء عرض — البائع أو المطورون
app.delete('/api/market/listings/:id', ah(auth), ah(async (req, res) => {
  const l = await one('SELECT * FROM market_listings WHERE id=$1', [req.params.id]);
  if (!l) return res.status(404).json({ error: 'العرض غير موجود' });
  if (l.status !== 'active') return res.status(400).json({ error: 'العرض غير نشط' });
  if (!isDeveloper(req.user) && l.seller_id !== req.user.id)
    return res.status(403).json({ error: 'غير مصرح' });
  await q(`UPDATE market_listings SET status='cancelled' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
}));
// شراء سلاح — يُخصم من سيولة دولتك ويُضاف للبائع، والتسليم بزمن اللعبة
app.post('/api/market/buy/:id', ah(auth), ah(async (req, res) => {
  await processDeliveries();
  const l = await one('SELECT * FROM market_listings WHERE id=$1', [req.params.id]);
  if (!l || l.status !== 'active') return res.status(404).json({ error: 'العرض غير متاح' });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: 'لا يمكنك شراء عرضك الخاص' });
  if (!req.user.country_code) return res.status(400).json({ error: 'تحتاج دولة لاستلام الشحنة' });
  const qty = Math.max(1, parseInt((req.body || {}).qty, 10) || 0);
  if (qty > l.qty) return res.status(400).json({ error: `الكمية المتاحة في العرض: ${l.qty}` });
  const total = qty * Number(l.price_unit_m_usd);
  const ok = await deductLiquidity(req.user.country_code, total);
  if (!ok) return res.status(400).json({ error: 'سيولة دولتك لا تكفي لإتمام الشراء' });
  await addLiquidity(l.seller_country, total);
  await logLiq(req.user.country_code, -total, `شراء ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} من السوق`, req.user.username);
  await logLiq(l.seller_country, total, `بيع ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} في السوق`, req.user.username);
  const days = deliveryGameDays(req.user.country_code, l.seller_country);
  const isRes = l.kind === 'resource';
  const r = await q(`INSERT INTO market_orders (listing_id,weapon_id,seller_id,seller_country,
                     buyer_id,buyer_country,qty,total_m_usd,game_days,kind,title,unit,resource,status,deliver_at,created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'in_transit',$14,$15) RETURNING id`,
    [l.id, l.weapon_id, l.seller_id, l.seller_country, req.user.id, req.user.country_code,
     qty, total, days, l.kind || 'weapon', l.title, l.unit, l.resource, Date.now() + days * GAME_DAY_MS, Date.now()]);
  const left = l.qty - qty;
  if (left <= 0) await q(`UPDATE market_listings SET qty=0, status='sold' WHERE id=$1`, [l.id]);
  else await q(`UPDATE market_listings SET qty=$2 WHERE id=$1`, [l.id, left]);
  await notify(l.seller_id, 'market_sale', isRes ? 'بيع مورد جديد' : 'بيع سلاح جديد',
    `${req.user.username} (${cname(req.user.country_code)}) اشترى ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} مقابل ${total} مليون دولار. المبلغ أُضيف لسيولة ${cname(l.seller_country)}.`,
    `#/market`);
  res.json({ ok: true, order_id: r.rows[0].id, game_days: days });
}));
// طلباتي (مشترياتي ومبيعاتي)
app.get('/api/market/orders', ah(auth), ah(async (req, res) => {
  await processDeliveries();
  const rows = await all(`SELECT o.*, w.name AS weapon_name, w.image_url AS weapon_image,
                          u1.username AS seller_name, u2.username AS buyer_name
                          FROM market_orders o
                          LEFT JOIN weapons w ON w.id=o.weapon_id
                          LEFT JOIN users u1 ON u1.id=o.seller_id
                          LEFT JOIN users u2 ON u2.id=o.buyer_id
                          WHERE o.buyer_id=$1 OR o.seller_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ orders: rows.map((o) => ({
    id: o.id, kind: o.kind || 'weapon', title: o.title || o.weapon_name, unit: o.unit || 'قطعة', resource: o.resource || null,
    weapon_name: o.weapon_name, weapon_image: o.weapon_image,
    seller_name: o.seller_name, seller_country: o.seller_country,
    buyer_name: o.buyer_name, buyer_country: o.buyer_country,
    qty: o.qty, total_m_usd: Number(o.total_m_usd), game_days: o.game_days,
    status: o.status, deliver_at: Number(o.deliver_at), created_at: Number(o.created_at),
    mine_bought: o.buyer_id === req.user.id,
  })) });
}));

// ---------- رفع صورة ----------
app.post('/api/upload', ah(auth), (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || 'فشل الرفع' });
      if (!req.file) return res.status(400).json({ error: 'اختر صورة أولاً' });
      const ext = (path.extname(req.file.originalname || '').toLowerCase().match(/\.[a-z0-9]+/) || ['.jpg'])[0];
      const url = await uploadToStorage(req.file.buffer, req.file.mimetype, ext);
      res.json({ url });
    } catch (e) { next(e); }
  });
});

// ---------- المقالات ----------
function articleRow(a) {
  return {
    id: a.id, title: a.title, body: a.body, image: a.image,
    category: a.category, category_label: CATEGORIES[a.category] || a.category,
    created_at: Number(a.created_at),
    author: { username: a.username, country_code: a.country_code, role: a.role, avatar: a.avatar || '' },
  };
}
app.get('/api/articles', ah(async (req, res) => {
  const { category, limit } = req.query;
  const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  let rows;
  if (category && CATEGORIES[category]) {
    rows = await all(
      `SELECT a.*,u.username,u.country_code,u.role,u.avatar FROM articles a JOIN users u ON u.id=a.user_id
       WHERE a.category=$1 ORDER BY a.created_at DESC LIMIT $2`,
      [category, lim]
    );
  } else {
    rows = await all(
      `SELECT a.*,u.username,u.country_code,u.role,u.avatar FROM articles a JOIN users u ON u.id=a.user_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [lim]
    );
  }
  res.json(rows.map(articleRow));
}));
app.get('/api/articles/:id', ah(async (req, res) => {
  const a = await one(
    'SELECT a.*,u.username,u.country_code,u.role,u.avatar FROM articles a JOIN users u ON u.id=a.user_id WHERE a.id=$1',
    [req.params.id]
  );
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  res.json(articleRow(a));
}));
app.post('/api/articles', ah(auth), ah(async (req, res) => {
  if (!isStaff(req.user))
    return res.status(403).json({ error: 'نشر السيناريوهات والحروب والأحداث حصرًا عبر حساب argos HQ' });
  const { title, body, category, image } = req.body || {};
  if (!title || title.trim().length < 5) return res.status(400).json({ error: 'العنوان قصير جدًا' });
  if (!body || body.trim().length < 20) return res.status(400).json({ error: 'نص المقال قصير جدًا (20 حرفًا على الأقل)' });
  const cat = CATEGORIES[category] ? category : 'events';
  const r = await one(
    'INSERT INTO articles (user_id,title,body,image,category,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.user.id, title.trim(), body.trim(), cleanImage(image), cat, Date.now()]
  );
  res.json({ ok: true, id: r.id });
}));
app.delete('/api/articles/:id', ah(auth), ah(async (req, res) => {
  const a = await one('SELECT user_id FROM articles WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  if (a.user_id !== req.user.id && !isStaff(req.user))
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM articles WHERE id=$1', [req.params.id]);
  await q("DELETE FROM likes WHERE target_type='article' AND target_id=$1", [req.params.id]);
  await q("DELETE FROM comments WHERE target_type='article' AND target_id=$1", [req.params.id]);
  res.json({ ok: true });
}));

// ---------- برقيات الدول (تغريد باسم الدولة) ----------
function dispatchRow(d) {
  return {
    id: d.id, body: d.body, image: d.image, created_at: Number(d.created_at),
    author: { username: d.username, country_code: d.country_code, avatar: d.avatar || '' },
  };
}
app.get('/api/dispatches', ah(async (req, res) => {
  const lim = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const rows = await all(
    `SELECT d.*,u.username,u.country_code,u.avatar FROM dispatches d JOIN users u ON u.id=d.user_id
     ORDER BY d.created_at DESC LIMIT $1`,
    [lim]
  );
  res.json(rows.map(dispatchRow));
}));
app.post('/api/dispatches', ah(auth), ah(async (req, res) => {
  const { body, image } = req.body || {};
  if (!body || body.trim().length < 2) return res.status(400).json({ error: 'اكتب نص البرقية' });
  if (body.length > 500) return res.status(400).json({ error: 'البرقية 500 حرف كحد أقصى' });
  const r = await one(
    'INSERT INTO dispatches (user_id,body,image,created_at) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.user.id, body.trim(), cleanImage(image), Date.now()]
  );
  res.json({ ok: true, id: r.id });
}));
app.delete('/api/dispatches/:id', ah(auth), ah(async (req, res) => {
  const d = await one('SELECT user_id FROM dispatches WHERE id=$1', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'البرقية غير موجودة' });
  if (d.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM dispatches WHERE id=$1', [req.params.id]);
  await q("DELETE FROM likes WHERE target_type='dispatch' AND target_id=$1", [req.params.id]);
  await q("DELETE FROM comments WHERE target_type='dispatch' AND target_id=$1", [req.params.id]);
  res.json({ ok: true });
}));

// ---------- التفاعل: إعجابات + تعليقات ----------
const TGT = ['dispatch', 'article'];
function inPlaceholders(ids, from) { return ids.map((_, i) => '$' + (from + i)).join(','); }

// عدّادات الإعجابات/التعليقات دفعة واحدة + حالة إعجاب المستخدم الحالي
app.get('/api/engagement', ah(async (req, res) => {
  const type = TGT.includes(req.query.type) ? req.query.type : 'dispatch';
  const ids = String(req.query.ids || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0).slice(0, 60);
  const counts = {};
  if (ids.length) {
    const ph = inPlaceholders(ids, 2);
    const lc = await all(`SELECT target_id, COUNT(*) AS c FROM likes WHERE target_type=$1 AND target_id IN (${ph}) GROUP BY target_id`, [type, ...ids]);
    const cc = await all(`SELECT target_id, COUNT(*) AS c FROM comments WHERE target_type=$1 AND target_id IN (${ph}) GROUP BY target_id`, [type, ...ids]);
    for (const r of lc) counts[r.target_id] = { likes: Number(r.c), comments: 0 };
    for (const r of cc) {
      counts[r.target_id] = counts[r.target_id] || { likes: 0, comments: 0 };
      counts[r.target_id].comments = Number(r.c);
    }
  }
  let liked = [];
  const t = getToken(req);
  if (t && ids.length) {
    const mu = await one('SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2', [t, Date.now()]);
    if (mu) {
      const ph = inPlaceholders(ids, 3);
      liked = (await all(`SELECT target_id FROM likes WHERE user_id=$1 AND target_type=$2 AND target_id IN (${ph})`, [mu.id, type, ...ids])).map((r) => r.target_id);
    }
  }
  res.json({ counts, liked });
}));

// تبديل الإعجاب (like/unlike)
app.post('/api/likes', ah(auth), ah(async (req, res) => {
  const { type, id } = req.body || {};
  if (!TGT.includes(type) || !Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: 'طلب غير صالح' });
  const tbl = type === 'dispatch' ? 'dispatches' : 'articles';
  const ex = await one(`SELECT id FROM ${tbl} WHERE id=$1`, [id]);
  if (!ex) return res.status(404).json({ error: 'المنشور غير موجود' });
  const has = await one('SELECT 1 AS x FROM likes WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [req.user.id, type, id]);
  let liked;
  if (has) {
    await q('DELETE FROM likes WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [req.user.id, type, id]);
    liked = false;
  } else {
    await q('INSERT INTO likes (user_id,target_type,target_id,created_at) VALUES ($1,$2,$3,$4)', [req.user.id, type, id, Date.now()]);
    liked = true;
  }
  const c = await one('SELECT COUNT(*) AS c FROM likes WHERE target_type=$1 AND target_id=$2', [type, id]);
  res.json({ liked, likes: Number(c.c) });
}));

// ---------- التعليقات ----------
app.get('/api/comments/:type/:id', ah(async (req, res) => {
  const { type } = req.params;
  if (!TGT.includes(type)) return res.status(400).json({ error: 'نوع غير صالح' });
  const rows = await all(
    `SELECT c.*,u.username,u.country_code,u.avatar FROM comments c JOIN users u ON u.id=c.user_id
     WHERE c.target_type=$1 AND c.target_id=$2 ORDER BY c.created_at ASC LIMIT 200`,
    [type, parseInt(req.params.id, 10) || 0]
  );
  res.json(rows.map((c) => ({
    id: c.id, body: c.body, created_at: Number(c.created_at),
    author: { username: c.username, country_code: c.country_code, avatar: c.avatar || '' },
  })));
}));
app.post('/api/comments', ah(auth), ah(async (req, res) => {
  const { type, id, body } = req.body || {};
  if (!TGT.includes(type) || !Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: 'طلب غير صالح' });
  const b = String(body || '').trim();
  if (!b || b.length > 500) return res.status(400).json({ error: 'التعليق فارغ أو يتجاوز 500 حرف' });
  const tbl = type === 'dispatch' ? 'dispatches' : 'articles';
  const ex = await one(`SELECT id FROM ${tbl} WHERE id=$1`, [id]);
  if (!ex) return res.status(404).json({ error: 'المنشور غير موجود' });
  const r = await one(
    'INSERT INTO comments (user_id,target_type,target_id,body,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [req.user.id, type, id, b, Date.now()]
  );
  res.json({ ok: true, id: r.id });
}));
app.delete('/api/comments/:id', ah(auth), ah(async (req, res) => {
  const c = await one('SELECT user_id FROM comments WHERE id=$1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'التعليق غير موجود' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM comments WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- الستوريات ----------
app.get('/api/stories', ah(async (req, res) => {
  const now = Date.now();
  await q('DELETE FROM stories WHERE expires_at <= $1', [now]); // تنظيف المنتهية
  const rows = await all(
    `SELECT s.*,u.username,u.country_code,u.avatar FROM stories s JOIN users u ON u.id=s.user_id
     WHERE s.expires_at > $1 ORDER BY s.created_at DESC LIMIT 120`, [now]
  );
  const map = {};
  for (const r of rows) {
    (map[r.username] = map[r.username] || { user: { username: r.username, country_code: r.country_code, avatar: r.avatar || '' }, stories: [] })
      .stories.push({ id: r.id, body: r.body || '', image: r.image, created_at: Number(r.created_at) });
  }
  const groups = Object.values(map);
  groups.sort((a, b) => b.stories[0].created_at - a.stories[0].created_at);
  res.json(groups);
}));
app.post('/api/stories', ah(auth), ah(async (req, res) => {
  const { body, image } = req.body || {};
  const b = String(body || '').trim().slice(0, 300);
  const img = cleanImage(image);
  if (!b && !img) return res.status(400).json({ error: 'أضف نصًا أو صورة للستوري' });
  const now = Date.now();
  const r = await one(
    'INSERT INTO stories (user_id,body,image,created_at,expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [req.user.id, b, img, now, now + 24 * 3600 * 1000]
  );
  res.json({ ok: true, id: r.id });
}));
app.delete('/api/stories/:id', ah(auth), ah(async (req, res) => {
  const s = await one('SELECT user_id FROM stories WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'الستوري غير موجود' });
  if (s.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM stories WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- البروفايلات العامة + البايو ----------
app.get('/api/user/:username', ah(async (req, res) => {
  const u = await one('SELECT id,username,country_code,role,bio,avatar,created_at FROM users WHERE username=$1', [req.params.username]);
  if (!u || u.username === 'argos_hq') return res.status(404).json({ error: 'المستخدم غير موجود' });
  const dc = await one('SELECT COUNT(*) AS c FROM dispatches WHERE user_id=$1', [u.id]);
  const ac = await one('SELECT COUNT(*) AS c FROM articles WHERE user_id=$1', [u.id]);
  res.json({
    user: { username: u.username, country_code: u.country_code, role: u.role, bio: u.bio || '', avatar: u.avatar || '', created_at: Number(u.created_at) },
    stats: { dispatches: Number(dc.c), articles: Number(ac.c) },
  });
}));
app.post('/api/profile', ah(auth), ah(async (req, res) => {
  const bio = String((req.body || {}).bio || '').slice(0, 160);
  const avatar = cleanImage((req.body || {}).avatar) || '';
  await q('UPDATE users SET bio=$1, avatar=$2 WHERE id=$3', [bio, avatar, req.user.id]);
  res.json({ ok: true, bio, avatar });
}));

// برقية واحدة (صفحة التفاصيل)
app.get('/api/dispatches/:id', ah(async (req, res) => {
  const d = await one(
    'SELECT d.*,u.username,u.country_code,u.avatar FROM dispatches d JOIN users u ON u.id=d.user_id WHERE d.id=$1',
    [req.params.id]
  );
  if (!d) return res.status(404).json({ error: 'البرقية غير موجودة' });
  res.json(dispatchRow(d));
}));

// ---------- الرسائل الخاصة ----------
// قائمة المستخدمين (لبدء محادثة جديدة)
app.get('/api/users', ah(auth), ah(async (req, res) => {
  const rows = await all("SELECT username,country_code,avatar FROM users WHERE id!=$1 AND role NOT IN ('system','developer') ORDER BY username ASC LIMIT 200", [req.user.id]);
  res.json(rows.map((u) => ({ username: u.username, country_code: u.country_code, avatar: u.avatar || '' })));
}));
// قائمة المحادثات
app.get('/api/conversations', ah(auth), ah(async (req, res) => {
  const rows = await all(
    `SELECT m.*, a.username AS s_name, a.country_code AS s_cc, a.avatar AS s_av,
            b.username AS r_name, b.country_code AS r_cc, b.avatar AS r_av
     FROM messages m
     JOIN users a ON a.id=m.sender_id
     JOIN users b ON b.id=m.receiver_id
     WHERE m.sender_id=$1 OR m.receiver_id=$1
     ORDER BY m.created_at DESC LIMIT 500`, [req.user.id]);
  const map = {};
  for (const r of rows) {
    const mine = r.sender_id === req.user.id;
    const uname = mine ? r.r_name : r.s_name;
    if (!map[uname]) map[uname] = {
      user: { username: uname, country_code: mine ? r.r_cc : r.s_cc, avatar: (mine ? r.r_av : r.s_av) || '' },
      last: null, unread: 0,
    };
    const cv = map[uname];
    if (!cv.last) cv.last = { body: r.body || '', image: r.image, created_at: Number(r.created_at), mine };
    if (!mine && !r.read_at) cv.unread++;
  }
  const list = Object.values(map);
  list.sort((x, y) => y.last.created_at - x.last.created_at);
  res.json(list);
}));
// محادثة مع مستخدم (وتعليم المقروء)
app.get('/api/messages/:username', ah(auth), ah(async (req, res) => {
  const other = await one("SELECT id,username,country_code,avatar FROM users WHERE username=$1 AND role NOT IN ('system','developer')", [req.params.username]);
  if (!other) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (other.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك مراسلة نفسك' });
  await q('UPDATE messages SET read_at=$1 WHERE sender_id=$2 AND receiver_id=$3 AND read_at IS NULL', [Date.now(), other.id, req.user.id]);
  const rows = await all(
    `SELECT m.*,u.username AS sender FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE (m.sender_id=$1 AND m.receiver_id=$2) OR (m.sender_id=$2 AND m.receiver_id=$1)
     ORDER BY m.created_at DESC LIMIT 100`,
    [req.user.id, other.id]
  );
  rows.reverse();
  res.json({
    user: { username: other.username, country_code: other.country_code, avatar: other.avatar || '' },
    messages: rows.map((m) => ({
      id: m.id, sender: m.sender, body: m.body || '', image: m.image,
      created_at: Number(m.created_at),
    })),
  });
}));
// إرسال رسالة
app.post('/api/messages', ah(auth), ah(async (req, res) => {
  const { to, body, image } = req.body || {};
  const other = await one("SELECT id FROM users WHERE username=$1 AND role NOT IN ('system','developer')", [to]);
  if (!other) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (other.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك مراسلة نفسك' });
  const b = String(body || '').trim().slice(0, 1000);
  const img = cleanImage(image);
  if (!b && !img) return res.status(400).json({ error: 'الرسالة فارغة' });
  const r = await one(
    'INSERT INTO messages (sender_id,receiver_id,body,image,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',
    [req.user.id, other.id, b, img, Date.now()]
  );
  res.json({ ok: true, id: r.id, created_at: Number(r.created_at) });
}));
// حذف رسالة
app.delete('/api/messages/:id', ah(auth), ah(async (req, res) => {
  const m = await one('SELECT sender_id FROM messages WHERE id=$1', [req.params.id]);
  if (!m) return res.status(404).json({ error: 'الرسالة غير موجودة' });
  if (m.sender_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM messages WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- الصفحة الرئيسية (التطبيق) ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// معالج الأخطاء
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('خطأ:', err.message);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// ---------------- بدء التشغيل ----------------
(async () => {
  await initDb();
  app.listen(PORT, () => console.log(`📰 جريدة أرجوس تعمل على http://localhost:${PORT}`));
})();
