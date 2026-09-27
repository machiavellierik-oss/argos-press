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
  try { await q('ALTER TABLE game_clock ADD COLUMN frozen_elapsed BIGINT'); } catch (e) { /* موجود */ }
  try { await q('ALTER TABLE game_clock ADD COLUMN last_tick_game_ms BIGINT'); } catch (e) { /* موجود */ }
  const gc = await one('SELECT id FROM game_clock WHERE id=1');
  if (!gc) await q('INSERT INTO game_clock (id,started_at,running) VALUES (1,NULL,0)');
  // ---------- محرك العالم: الأحداث + سجل التدقيق + منع التكرار (المرحلة 1: الأساس) ----------
  await q(`CREATE TABLE IF NOT EXISTS game_events (
    id SERIAL PRIMARY KEY, type TEXT NOT NULL,
    actor_code TEXT, target_code TEXT, title TEXT NOT NULL,
    data TEXT DEFAULT '{}', game_time BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY, action TEXT NOT NULL, actor TEXT NOT NULL,
    details TEXT DEFAULT '', ip TEXT DEFAULT '', created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at BIGINT NOT NULL
  )`);
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
  await seedWar();
  await seedDiplomacy();
  await seedIntel();
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
  const taken = await one("SELECT username FROM users WHERE country_code=$1 AND role NOT IN ('system','developer','ai_embassy')", [country_code]);
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
// ---------- إعداد الذكاء الاصطناعي الحقيقي (LLM) — للطاقم فقط ----------
// المفتاح لا يُعاد للواجهة أبدًا (has_key فقط)
app.get('/api/admin/ai-config', ah(auth), requireStaff, ah(async (req, res) => {
  const c = await getAiConfig();
  res.json({ enabled: c.enabled, provider: c.provider, model: c.model,
    has_key: !!c.api_key, key_tail: c.api_key ? '…' + c.api_key.slice(-4) : '' });
}));
app.post('/api/admin/ai-config', ah(auth), requireStaff, ah(async (req, res) => {
  const { enabled, provider, model, api_key } = req.body || {};
  await setSetting('llm_enabled', enabled ? '1' : '0');
  if (typeof provider === 'string' && LLM_PROVIDERS[provider])
    await setSetting('llm_provider', provider);
  if (typeof model === 'string' && model.trim().slice(0, 120))
    await setSetting('llm_model', model.trim().slice(0, 120));
  if (typeof api_key === 'string' && api_key.trim())
    await setSetting('llm_api_key', api_key.trim());
  await audit('ai_config', req.user.username, `تحديث إعداد LLM (مفعّل: ${enabled ? 'نعم' : 'لا'})`);
  res.json({ ok: true });
}));
app.post('/api/admin/ai-test', ah(auth), requireStaff, ah(async (req, res) => {
  const t0 = Date.now();
  try {
    const out = await llmChat(
      [{ role: 'user', content: 'أجب JSON فقط: {"ok": true}' }],
      { maxTokens: 50 });
    const d = llmParseJSON(out);
    const cfg = await getAiConfig();
    res.json({ ok: !!d.ok, ms: Date.now() - t0, provider: cfg.provider, model: cfg.model });
  } catch (e) {
    res.status(502).json({ error: 'فشل الاتصال بالنموذج: ' + String(e.message).slice(0, 160) });
  }
}));
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
  await runMonthlyTick(); // العالم يعيش: كل شهر لعبة تُعالَج آثاره هنا
  const gs = await gameState();
  const now = Date.now();
  res.json({
    running: gs.running, started_at: gs.started_at, now, epoch_real: GAME_EPOCH_REAL,
    game: (gs.elapsed > 0 || (gs.running && gs.started_at)) ? gameDateOf(now - gs.elapsed, now) : null,
  });
}));
app.post('/api/clock/start', ah(auth), requireDeveloper, ah(async (req, res) => {
  const now = Date.now();
  const prev = await one('SELECT started_at, frozen_elapsed FROM game_clock WHERE id=1');
  let started;
  if (prev && prev.frozen_elapsed != null) {
    // استئناف من حيث توقفت الساعة بالضبط (يحافظ على التثبيتات المستقبلية أيضًا)
    started = now - Number(prev.frozen_elapsed);
  } else {
    // يحافظ على نقطة البداية المضبوطة (مثل 6 مساء GMT) — لا يمسحها إلا لو لم توجد
    started = (prev && prev.started_at) ? prev.started_at : now;
  }
  await q('UPDATE game_clock SET started_at=$1, running=1, frozen_elapsed=NULL, updated_by=$2 WHERE id=1', [started, req.user.id]);
  await q('UPDATE companies SET last_collect=NULL');
  await q('UPDATE country_economy SET last_tax_collect=NULL');
  await audit('clock_start', req.user.username, 'تشغيل ساعة اللعبة', req);
  res.json({ ok: true, running: true, started_at: started, game: gameDateOf(started, now) });
}));
app.post('/api/clock/stop', ah(auth), requireDeveloper, ah(async (req, res) => {
  const now = Date.now();
  const prev = await one('SELECT started_at FROM game_clock WHERE id=1');
  const st = prev && prev.started_at ? Number(prev.started_at) : null;
  // تجميد الزمن: يُحفظ المنقضي كما هو (قد يكون سالبًا لتثبيت مستقبلي — يُحفظ بدقة)
  const frozen = st != null ? now - st : null;
  await q('UPDATE game_clock SET running=0, frozen_elapsed=$1, updated_by=$2 WHERE id=1', [frozen, req.user.id]);
  await audit('clock_stop', req.user.username, 'إيقاف ساعة اللعبة (تجميد الزمن)', req);
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
  await q('UPDATE game_clock SET started_at=$1, running=1, frozen_elapsed=NULL, updated_by=$2 WHERE id=1', [startAt, req.user.id]);
  await q('UPDATE companies SET last_collect=NULL');
  await q('UPDATE country_economy SET last_tax_collect=NULL');
  await audit('clock_reset', req.user.username, 'إعادة تعيين الساعة start_at=' + new Date(startAt).toISOString(), req);
  res.json({ ok: true, running: true, started_at: startAt, game: gameDateOf(startAt, Date.now()) });
}));
// ضبط تاريخ اللعبة يدويًا — المطورون فقط (بنفس القواعد: كل 24 ساعة واقعية = سنة لعبة)
app.post('/api/clock/set-date', ah(auth), requireDeveloper, ah(async (req, res) => {
  const y = parseInt(req.body && req.body.year, 10);
  const mo = parseInt(req.body && req.body.month, 10);
  const d = parseInt(req.body && req.body.day, 10);
  if (![y, mo, d].every(Number.isFinite) || y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 30)
    return res.status(400).json({ error: 'تاريخ غير صالح (السنة 1900-2200، الشهر 1-12، اليوم 1-30)' });
  const now = Date.now();
  const totalMonths = (y - 1900) * 12 + (mo - 1);
  const startedAt = now - Math.round(totalMonths * GAME_MONTH_MS + ((d - 1) / 30) * GAME_MONTH_MS);
  await q('UPDATE game_clock SET started_at=$1, running=1, frozen_elapsed=NULL, updated_by=$2 WHERE id=1', [startedAt, req.user.id]);
  await q('UPDATE companies SET last_collect=NULL');
  await q('UPDATE country_economy SET last_tax_collect=NULL');
  await audit('clock_set_date', req.user.username, `ضبط تاريخ اللعبة يدويًا: ${d}/${mo}/${y}`, req);
  res.json({ ok: true, running: true, started_at: startedAt, game: gameDateOf(startedAt, now) });
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

// ---------- نظام الحرب (المرحلة 2) ----------
// الحرب = إعلان → معارك بقوة محسوبة (ليست عدد البنادق فقط) → نقاط حرب → سلام/تعويضات
async function seedWar() {
  for (const colDef of ['readiness INTEGER DEFAULT 70', 'morale INTEGER DEFAULT 70', 'training INTEGER DEFAULT 60']) {
    try { await q(`ALTER TABLE armies ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ }
  }
  await q('UPDATE armies SET readiness=70 WHERE readiness IS NULL');
  await q('UPDATE armies SET morale=70 WHERE morale IS NULL');
  await q('UPDATE armies SET training=60 WHERE training IS NULL');
  await q(`CREATE TABLE IF NOT EXISTS wars (
    id SERIAL PRIMARY KEY, attacker_code TEXT NOT NULL, defender_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    score_a DOUBLE PRECISION NOT NULL DEFAULT 0, score_b DOUBLE PRECISION NOT NULL DEFAULT 0,
    proposed_by TEXT, started_game_time BIGINT NOT NULL, ended_game_time BIGINT,
    created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS battles (
    id SERIAL PRIMARY KEY, war_id INTEGER NOT NULL,
    attacker_code TEXT NOT NULL, defender_code TEXT NOT NULL,
    att_units INTEGER NOT NULL, def_units INTEGER NOT NULL,
    att_power DOUBLE PRECISION NOT NULL, def_power DOUBLE PRECISION NOT NULL,
    att_losses INTEGER NOT NULL, def_losses INTEGER NOT NULL,
    winner TEXT NOT NULL, region TEXT DEFAULT '',
    game_time BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS battle_weapons (
    id SERIAL PRIMARY KEY, battle_id INTEGER NOT NULL,
    weapon_id INTEGER, weapon_name TEXT, class TEXT,
    side TEXT NOT NULL DEFAULT 'attacker',
    qty INTEGER NOT NULL, lost INTEGER NOT NULL DEFAULT 0
  )`);
}
// قوة النيران لكل صنف سلاح — تُضاف لقوة المعركة فوق قوة الجنود
const WEAPON_FP = {
  'بنادق': 1, 'مسدسات': 0.3, 'رشاشات': 6, 'هاونات': 12,
  'مدفعية ميدانية': 25, 'مدفعية جبلية': 18, 'مدفعية ثقيلة': 40, 'مدفعية حصار': 60,
  'أسلحة أخرى': 4, 'سفن حربية': 50, 'طيران': 30,
};
function weaponFP(cls) { return WEAPON_FP[String(cls || '')] || 0; }
// أسلحة المدافع التلقائية: أقوى أصناف الترسانة (للمعارك التي يشنها الذكاء)
// تُرجع [{id, qty}] — qty محدود بسقف perCap، والمخزون غير الموثق (null) يُعامل كـ 40
async function aiPickWeapons(cc, maxTypes = 3, perCap = 300) {
  const ws = await all('SELECT id, class, quantity FROM weapons WHERE country_code=$1', [cc]);
  return ws
    .map((w) => ({ id: w.id, fp: weaponFP(w.class), avail: w.quantity == null ? 40 : Number(w.quantity) || 0 }))
    .filter((w) => w.fp > 0 && w.avail > 0)
    .sort((a, b) => (b.fp * b.avail) - (a.fp * a.avail))
    .slice(0, maxTypes)
    .map((w) => ({ id: w.id, qty: Math.min(w.avail, perCap) }));
}
// تحقق من أسلحة هجوم اللاعب: ملكية الدولة + سقف المخزون (غير الموثق: 30 للقطعة في المعركة)
// تُرجع [{id, name, class, qty, fp}] أو ترمي بخطأ عربي
async function validateBattleWeapons(attackerCC, picks) {
  const arr = Array.isArray(picks) ? picks : [];
  if (!arr.length) return [];
  const ids = [...new Set(arr.map((p) => parseInt(p && p.id, 10)).filter((n) => n > 0))];
  if (!ids.length) return [];
  const rows = await all(`SELECT id, country_code, name, class, quantity FROM weapons WHERE id IN (${ids.join(',')})`);
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const out = [];
  for (const p of arr) {
    const id = parseInt(p && p.id, 10);
    const qty = parseInt(p && p.qty, 10);
    if (!(id > 0) || !(qty >= 1)) continue;
    const w = byId.get(id);
    if (!w) throw { status: 400, message: 'سلاح غير موجود (#' + id + ')' };
    if (w.country_code !== attackerCC) throw { status: 403, message: 'السلاح "' + (w.name || id) + '" ليس من ترسانة دولتك' };
    const fp = weaponFP(w.class);
    if (!(fp > 0)) continue;
    const cap = w.quantity == null ? 30 : Math.max(0, Number(w.quantity) || 0);
    if (qty > cap) throw { status: 400, message: `الكمية المطلوبة من "${w.name}" تتجاوز المخزون (${cap})` };
    const dup = out.find((o) => o.id === id);
    if (dup) {
      if (dup.qty + qty > cap) throw { status: 400, message: `الكمية المطلوبة من "${w.name}" تتجاوز المخزون (${cap})` };
      dup.qty += qty;
    } else out.push({ id, name: w.name, class: w.class, qty, fp, stockNull: w.quantity == null });
  }
  if (out.length > 6) throw { status: 400, message: 'أقصى 6 أصناف أسلحة في المعركة الواحدة' };
  return out;
}
// ---------- منطقية حروب الذكاء الاصطناعي ----------
// تمنع حروبًا عبثية (سويسرا ضد الهندوراس...): مسافة + قارة + بحرية + حياد سويسرا
const AI_NEUTRAL = new Set(['CH']); // دول لا يهاجمها الذكاء ولا تهاجم أبدًا
function capitalDistKm(a, b) {
  const A = LATLON[a], B = LATLON[b];
  if (!A || !B) return Infinity;
  const R = 6371, toR = Math.PI / 180;
  const dLa = (B[0] - A[0]) * toR, dLo = (B[1] - A[1]) * toR;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(A[0] * toR) * Math.cos(B[0] * toR) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function hasNavy(cc) {
  const r = await one(`SELECT 1 FROM weapons WHERE country_code=$1 AND class='سفن حربية'
                       AND (quantity IS NULL OR quantity > 0) LIMIT 1`, [cc]);
  return !!r;
}
// هل حرب الذكاء بين att وdef منطقية جغرافيًا؟ (اللاعبون أحرار — القيد للذكاء فقط)
async function aiWarPlausible(att, def) {
  if (!att || !def || att === def) return false;
  if (AI_NEUTRAL.has(att) || AI_NEUTRAL.has(def)) return false; // سويسرا محايدة دائمًا
  const sameCont = GEO_CONT[att] && GEO_CONT[att] === GEO_CONT[def];
  const d = capitalDistKm(att, def);
  if (sameCont && d <= 2500) return true; // جيران إقليميون
  const mil = await getArmy(att);
  const soldiers = Number(mil.soldiers) || 0;
  if (d <= 5000 && soldiers >= 80000) return true; // قوة عظمى إقليمية
  if (soldiers >= 100000 && await hasNavy(att)) return true; // قوة بحرية عظمى تعبر البحار
  return false;
}
// حقن للاختبارات فقط (بنفس نمط global.__pool) — تُفعّل بـ ARGOS_TEST=1
if (process.env.ARGOS_TEST) {
  global.__argosTest = { aiWarPlausible, capitalDistKm, hasNavy, weaponFP, aiPickWeapons, validateBattleWeapons };
}
const numOr = (v, d) => (v == null ? d : Number(v));
async function getArmy(cc) {
  let a = await one('SELECT * FROM armies WHERE country_code=$1', [cc]);
  if (!a) {
    await q('INSERT INTO armies (country_code,soldiers,readiness,morale,training,updated_at) VALUES ($1,0,70,70,60,$2)',
      [cc, Date.now()]);
    a = await one('SELECT * FROM armies WHERE country_code=$1', [cc]);
  }
  return {
    country_code: cc,
    soldiers: numOr(a.soldiers, 0),
    readiness: Math.max(0, Math.min(100, numOr(a.readiness, 70))),
    morale: Math.max(0, Math.min(100, numOr(a.morale, 70))),
    training: Math.max(0, Math.min(100, numOr(a.training, 60))),
  };
}
// قوة المعركة: الجاهزية والتدريب والروح المعنوية — وليست عدد البنادق وحده
// العوامل مُقعّرة (0.4/0.5 حد أدنى) حتى لا يُصفّر عامل واحد الجيش كله
function battlePower(units, mil) {
  const r = mil.readiness / 100, t = mil.training / 100, m = mil.morale / 100;
  const rand = 0.90 + Math.random() * 0.20; // حظ محدود 0.90–1.10
  return units * (0.4 + 0.6 * r) * (0.5 + 0.5 * t) * (0.5 + 0.5 * m) * rand;
}
async function setArmyStat(cc, patch) {
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!['soldiers', 'readiness', 'morale', 'training'].includes(k)) continue;
    vals.push(v); sets.push(`${k}=$${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(cc);
  await q(`UPDATE armies SET ${sets.join(', ')}, updated_at=${'$' + (vals.length + 1)} WHERE country_code=$${vals.length}`, [...vals, Date.now()]);
}
async function activeWarBetween(a, b) {
  return one(`SELECT * FROM wars WHERE status='active' AND
    ((attacker_code=$1 AND defender_code=$2) OR (attacker_code=$2 AND defender_code=$1))`, [a, b]);
}
async function setMapWarStatus(cc, on, label, userId) {
  if (on) {
    const ex = await one('SELECT country_code FROM map_states WHERE country_code=$1', [cc]);
    if (ex) await q(`UPDATE map_states SET color='#f4212e',status='war',label=$2,updated_by=$3,updated_at=$4 WHERE country_code=$1`,
      [cc, label || 'حالة حرب', userId || null, Date.now()]);
    else await q(`INSERT INTO map_states (country_code,color,status,label,updated_by,updated_at) VALUES ($1,'#f4212e','war',$2,$3,$4)`,
      [cc, label || 'حالة حرب', userId || null, Date.now()]);
  } else {
    await q(`DELETE FROM map_states WHERE country_code=$1 AND status='war'`, [cc]);
  }
}
async function hqArticle(title, body, category) {
  try {
    const hq = await one("SELECT id FROM users WHERE username='argos_hq'");
    if (!hq) return;
    await q('INSERT INTO articles (user_id,title,body,category,created_at) VALUES ($1,$2,$3,$4,$5)',
      [hq.id, title, body, category || 'wars', Date.now()]);
  } catch (e) { /* غير حرج */ }
}
async function notifyCountry(cc, ntype, title, body, link) {
  const owners = await ownersOf(cc);
  const tg = owners.length ? owners : await devIds();
  for (const uid of tg) await notify(uid, ntype, title, body, link);
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
// ---------- الحرب: إعلان / معارك / سلام ----------
// ---------- الدبلوماسية (المرحلة 3) ----------
// معاهدات رسمية: عدم اعتداء/تحالف/دفاعي/تجاري/عبور/حظر/سلام — قابلة للكسر بثمن (السمعة)
const TREATY_TYPES = {
  non_aggression: 'ميثاق عدم اعتداء', alliance: 'تحالف عسكري', defensive: 'تحالف دفاعي',
  trade: 'اتفاقية تجارية', military_access: 'حق العبور العسكري', embargo: 'حظر تجاري', peace: 'معاهدة سلام',
};
async function seedDiplomacy() {
  await q(`CREATE TABLE IF NOT EXISTS treaties (
    id SERIAL PRIMARY KEY, type TEXT NOT NULL, from_code TEXT NOT NULL, to_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed', secret INTEGER NOT NULL DEFAULT 0,
    created_game_time BIGINT NOT NULL, decided_game_time BIGINT, created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS country_diplo (
    country_code TEXT PRIMARY KEY, reputation INTEGER NOT NULL DEFAULT 70, updated_at BIGINT
  )`);
}
async function getReputation(cc) {
  const r = await one('SELECT reputation FROM country_diplo WHERE country_code=$1', [cc]);
  if (!r) {
    await q('INSERT INTO country_diplo (country_code,reputation,updated_at) VALUES ($1,70,$2)', [cc, Date.now()]);
    return 70;
  }
  return Math.max(0, Math.min(100, Number(r.reputation)));
}
async function addReputation(cc, delta) {
  const cur = await getReputation(cc);
  const nv = Math.max(0, Math.min(100, cur + delta));
  await q('UPDATE country_diplo SET reputation=$1, updated_at=$2 WHERE country_code=$3', [nv, Date.now(), cc]);
  return nv;
}
async function activeTreaty(a, b, type) {
  return one(`SELECT * FROM treaties WHERE status='active' AND type=$3 AND
    ((from_code=$1 AND to_code=$2) OR (from_code=$2 AND to_code=$1))`, [a, b, type]);
}
// كسر معاهدة: ثمنه السمعة الدبلوماسية
async function breakTreaty(t, byCC, reason, req) {
  await q(`UPDATE treaties SET status='broken', decided_game_time=$1 WHERE id=$2`, [await gameNow(), t.id]);
  const nv = await addReputation(byCC, -20);
  const other = byCC === t.from_code ? t.to_code : t.from_code;
  await emitEvent('treaty_broken', t.from_code, t.to_code,
    `${cname(byCC)} تكسر ${TREATY_TYPES[t.type] || t.type} مع ${cname(other)} — ${reason}`,
    { treaty_id: t.id });
  await audit('treaty_break', req ? req.user.username : '?', `كسر معاهدة #${t.id} (${t.type}) — السمعة أصبحت ${nv}`, req);
  await notifyCountry(other, 'treaty', `كُسرت المعاهدة!`,
    `${cname(byCC)} كسرت ${TREATY_TYPES[t.type] || 'المعاهدة'} معك. سمعتها الدبلوماسية الآن ${nv}/100.`, '#/news');
  return nv;
}
// قائمة الحروب (عامة)
app.get('/api/wars', ah(async (req, res) => {
  const rows = await all(`SELECT * FROM wars ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, id DESC LIMIT 30`);
  res.json({ wars: rows.map((w) => ({
    id: w.id, attacker_code: w.attacker_code, defender_code: w.defender_code,
    attacker_name: cname(w.attacker_code), defender_name: cname(w.defender_code),
    status: w.status, score_a: Math.round(Number(w.score_a) * 10) / 10, score_b: Math.round(Number(w.score_b) * 10) / 10,
    proposed_by: w.proposed_by, started_game_time: Number(w.started_game_time),
    ended_game_time: w.ended_game_time != null ? Number(w.ended_game_time) : null,
  })) });
}));
app.get('/api/wars/:id', ah(async (req, res) => {
  const w = await one('SELECT * FROM wars WHERE id=$1', [req.params.id]);
  if (!w) return res.status(404).json({ error: 'الحرب غير موجودة' });
  const battles = await all('SELECT * FROM battles WHERE war_id=$1 ORDER BY id DESC LIMIT 20', [w.id]);
  let bwByBattle = {};
  if (battles.length) {
    const bw = await all(`SELECT * FROM battle_weapons WHERE battle_id IN (${battles.map((b) => parseInt(b.id, 10)).join(',')})`);
    for (const r of bw) {
      (bwByBattle[r.battle_id] = bwByBattle[r.battle_id] || []).push({
        weapon_name: r.weapon_name, class: r.class, side: r.side, qty: r.qty, lost: r.lost,
      });
    }
  }
  res.json({
    war: {
      id: w.id, attacker_code: w.attacker_code, defender_code: w.defender_code,
      attacker_name: cname(w.attacker_code), defender_name: cname(w.defender_code),
      status: w.status, score_a: Math.round(Number(w.score_a) * 10) / 10, score_b: Math.round(Number(w.score_b) * 10) / 10,
      proposed_by: w.proposed_by,
    },
    battles: battles.map((b) => ({
      id: b.id, att_units: b.att_units, def_units: b.def_units,
      att_losses: b.att_losses, def_losses: b.def_losses, winner: b.winner,
      winner_name: cname(b.winner === 'attacker' ? b.attacker_code : b.defender_code),
      region: b.region, game_time: Number(b.game_time),
      weapons: bwByBattle[b.id] || [],
    })),
  });
}));
// الوضع العسكري لدولة — المالك والمطورون يرون الأرقام الدقيقة، والبقية نطاقات (ضباب الحرب)
app.get('/api/military/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const a = await getArmy(cc);
  const mine = isDeveloper(req.user) || req.user.country_code === cc;
  if (mine) return res.json(Object.assign({ country_code: cc, exact: true }, a));
  // الاستخبارات تُحسّن ضباب الحرب: تقرير عسكري حديث = نطاقات أدق من التقديرات العامة
  const g = await gameNow();
  const rep = await one(`SELECT data, confidence FROM intel_reports
                         WHERE spy_code=$1 AND target_code=$2 AND kind='military' AND expires_game_time > $3
                         ORDER BY id DESC LIMIT 1`, [req.user.country_code, cc, g]);
  if (rep) {
    const d = JSON.parse(rep.data || '{}');
    return res.json({ country_code: cc, exact: false, source: 'intel', confidence: rep.confidence,
      soldiers: d.soldiers || null, readiness: d.readiness || null, morale: d.morale || null });
  }
  const band = (v) => v >= 80 ? 'ممتازة' : v >= 60 ? 'جيدة' : v >= 40 ? 'متوسطة' : v >= 20 ? 'ضعيفة' : 'منهارة';
  res.json({
    country_code: cc, exact: false,
    soldiers_approx: Math.round(a.soldiers / 5000) * 5000,
    readiness: band(a.readiness), morale: band(a.morale), training: band(a.training),
  });
}));
// ============================================================================
// محرك الحرب الداخلي — اللاعبون والدول الذكية يستخدمون نفس القواعد والقيم
// ============================================================================
// إعلان حرب — يرمي {status,message} عند الفشل
async function declareWarInternal(attacker, target, actorUsername) {
  if (!validCountry(target) || !validCountry(attacker)) throw { status: 400, message: 'كود دولة غير صالح' };
  if (!attacker) throw { status: 400, message: 'تحتاج دولة لإعلان الحرب' };
  if (attacker === target) throw { status: 400, message: 'لا يمكن إعلان الحرب على نفسك' };
  const ex = await activeWarBetween(attacker, target);
  if (ex) throw { status: 400, message: 'حرب نشطة موجودة أصلًا بين الدولتين' };
  for (const tt of ['non_aggression', 'alliance', 'defensive']) {
    const t = await activeTreaty(attacker, target, tt);
    if (t) await breakTreaty(t, attacker, 'إعلان الحرب', { user: { username: actorUsername } });
  }
  const mil = await getArmy(attacker);
  if (mil.soldiers < 1000) throw { status: 400, message: 'جيشك أصغر من أن يشن حربًا (أقل من 1000 جندي)' };
  const g = await gameNow();
  const r = await q(`INSERT INTO wars (attacker_code,defender_code,status,started_game_time,created_at)
                     VALUES ($1,$2,'active',$3,$4) RETURNING id`, [attacker, target, g, Date.now()]);
  const warId = r.rows[0].id;
  await setArmyStat(attacker, { readiness: Math.max(0, mil.readiness - 5), morale: Math.max(0, mil.morale - 3) });
  await setEconStat(attacker, 'stability', Math.max(0, await getEconStat(attacker, 'stability', 70) - 3));
  await setEconStat(attacker, 'public_support', Math.max(0, await getEconStat(attacker, 'public_support', 60) - 5));
  await setMapWarStatus(attacker, true, `حرب: ${cname(attacker)} ضد ${cname(target)}`, null);
  await setMapWarStatus(target, true, `حرب: ${cname(attacker)} ضد ${cname(target)}`, null);
  await emitEvent('war_declared', attacker, target, `${cname(attacker)} تعلن الحرب على ${cname(target)}`, { war_id: warId });
  await audit('war_declare', actorUsername, `${attacker} تعلن الحرب على ${target}`);
  await notifyCountry(attacker, 'war', `أعلنت الحرب على ${cname(target)}!`,
    `بدأت الحرب ضد ${cname(target)}. كل معركة تستهلك الجاهزية والروح المعنوية — أدر جيشك بحكمة.`, '#/news');
  await notifyCountry(target, 'war', `${cname(attacker)} أعلنت الحرب عليك!`,
    `${cname(attacker)} أعلنت الحرب على دولتك. استعد للدفاع!`, '#/news');
  const allies = await all(`SELECT * FROM treaties WHERE status='active' AND type='defensive' AND (from_code=$1 OR to_code=$1)`, [target]);
  for (const al of allies) {
    const allyCC = al.from_code === target ? al.to_code : al.from_code;
    if (allyCC === attacker) continue;
    await notifyCountry(allyCC, 'war', `حليفك ${cname(target)} تعرض للهجوم!`,
      `${cname(attacker)} أعلنت الحرب على حليفك الدفاعي ${cname(target)}. بموجب التحالف الدفاعي يمكنك إعلان الحرب على المعتدي.`, '#/news');
  }
  await hqArticle(`عاجل: ${cname(attacker)} تعلن الحرب على ${cname(target)}`,
    `في تطور خطير، أعلنت ${cname(attacker)} الحرب رسميًا على ${cname(target)}. ترقبوا تغطية المعارك أولًا بأول في غرفة الحرب.`, 'wars');
  return warId;
}
// معركة — attackerCC يجب أن يكون الطرف المهاجم في الحرب
// weaponPick: [{id, qty}] أسلحة المهاجم من ترسانته (اختياري) — المدافع يدعم تلقائيًا من ترسانته
async function battleInternal(warId, attackerCC, units, region, actorUsername, weaponPick) {
  const w = await one('SELECT * FROM wars WHERE id=$1', [parseInt(warId, 10) || 0]);
  if (!w || w.status !== 'active') throw { status: 404, message: 'لا توجد حرب نشطة بهذا الرقم' };
  if (w.attacker_code !== attackerCC) throw { status: 403, message: 'غير مصرح — المبادرة بالمعارك للطرف المهاجم' };
  const attMil = await getArmy(w.attacker_code);
  const defMil = await getArmy(w.defender_code);
  units = parseInt(units, 10) || 0;
  const maxUnits = Math.floor(attMil.soldiers * 0.5);
  if (!(units >= 1000)) throw { status: 400, message: 'أقل قوة هجوم لمعركة: 1000 جندي' };
  if (units > maxUnits) throw { status: 400, message: `أقصى قوة لمعركة واحدة: ${maxUnits.toLocaleString('en-US')} جندي (50% من الجيش)` };
  region = String(region || '').slice(0, 60);
  // أسلحة المهاجم (يختارها اللاعب أو الذكاء) — تُضاف قوة نيرانها فوق قوة الجنود
  const attW = await validateBattleWeapons(w.attacker_code, weaponPick);
  const attWPower = attW.reduce((s, x) => s + x.fp * x.qty, 0);
  // دعم المدافع التلقائي: أقوى 5 أصناف في ترسانته (بنصف الفعالية — أسلحة دفاعية مرتجلة)
  const defWRows = await all('SELECT id, name, class, quantity FROM weapons WHERE country_code=$1', [w.defender_code]);
  const defW = defWRows
    .map((r) => ({ id: Number(r.id), name: r.name, class: r.class, fp: weaponFP(r.class), avail: r.quantity == null ? 40 : Number(r.quantity) || 0, stockNull: r.quantity == null }))
    .filter((x) => x.fp > 0 && x.avail > 0)
    .sort((a, b) => (b.fp * b.avail) - (a.fp * a.avail))
    .slice(0, 5)
    .map((x) => ({ ...x, qty: Math.min(x.avail, 150) }));
  const defWPower = defW.reduce((s, x) => s + x.fp * x.qty * 0.5, 0);
  const defUnits = Math.max(500, Math.round(Math.min(defMil.soldiers * 0.6, units * (0.9 + Math.random() * 0.3))));
  const attP = battlePower(units, attMil) + attWPower;
  const defP = battlePower(defUnits, defMil) * 1.1 + defWPower;
  const attWins = attP >= defP;
  const winner = attWins ? 'attacker' : 'defender';
  const attLoss = Math.round(units * (attWins ? 0.05 + Math.random() * 0.05 : 0.15 + Math.random() * 0.10));
  const defLoss = Math.round(defUnits * (attWins ? 0.15 + Math.random() * 0.10 : 0.05 + Math.random() * 0.05));
  await setArmyStat(w.attacker_code, {
    soldiers: Math.max(0, attMil.soldiers - attLoss),
    readiness: Math.max(0, attMil.readiness - 8),
    morale: Math.max(0, Math.min(100, attMil.morale + (attWins ? 2 : -5))),
  });
  await setArmyStat(w.defender_code, {
    soldiers: Math.max(0, defMil.soldiers - defLoss),
    readiness: Math.max(0, defMil.readiness - 8),
    morale: Math.max(0, Math.min(100, defMil.morale + (attWins ? -5 : 2))),
  });
  const margin = Math.min(20, (Math.abs(attP - defP) / Math.max(attP, defP)) * 30);
  const pts = Math.round((10 + margin) * 10) / 10;
  const nScoreA = Math.round((Number(w.score_a) + (attWins ? pts : 0)) * 10) / 10;
  const nScoreB = Math.round((Number(w.score_b) + (attWins ? 0 : pts)) * 10) / 10;
  await q('UPDATE wars SET score_a=$1, score_b=$2 WHERE id=$3', [nScoreA, nScoreB, w.id]);
  const g = await gameNow();
  const br = await q(`INSERT INTO battles (war_id,attacker_code,defender_code,att_units,def_units,
                      att_power,def_power,att_losses,def_losses,winner,region,game_time,created_at)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [w.id, w.attacker_code, w.defender_code, units, defUnits, Math.round(attP), Math.round(defP),
     attLoss, defLoss, winner, region, g, Date.now()]);
  const battleId = br.rows[0].id;
  // خسائر الأسلحة: المنتصر يفقد 5-10%، المنهزم 20-30% — وتُخصم من المخزون الموثق
  const wLossRate = (win) => win ? 0.05 + Math.random() * 0.05 : 0.20 + Math.random() * 0.10;
  const recordWeapons = async (list, side, won) => {
    for (const x of list) {
      const lost = Math.min(x.qty, Math.round(x.qty * wLossRate(won)));
      if (lost > 0 && !x.stockNull) await q('UPDATE weapons SET quantity = GREATEST(0, quantity - $1) WHERE id=$2', [lost, x.id]);
      await q(`INSERT INTO battle_weapons (battle_id, weapon_id, weapon_name, class, side, qty, lost)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`, [battleId, x.id, x.name, x.class, side, x.qty, lost]);
    }
  };
  await recordWeapons(attW, 'attacker', attWins);
  await recordWeapons(defW, 'defender', !attWins);
  const wname = attWins ? cname(w.attacker_code) : cname(w.defender_code);
  const wTxt = attW.length ? ` — بالأسلحة: ${attW.map((x) => x.name + ' ×' + x.qty).join('، ')}` : '';
  await emitEvent('battle', w.attacker_code, w.defender_code,
    `معركة: ${wname} تنتصر${region ? ' في ' + region : ''} (خسائر المهاجم ${attLoss.toLocaleString('en-US')} / المدافع ${defLoss.toLocaleString('en-US')})${wTxt}`,
    { war_id: w.id, battle_id: battleId });
  await audit('war_battle', actorUsername, `معركة في حرب #${w.id}: ${units} ضد ${defUnits} — الفائز: ${wname}`);
  await notifyCountry(w.attacker_code, 'battle', attWins ? 'انتصار في المعركة!' : 'هزيمة في المعركة',
    `معركة ${region ? 'في ' + region : ''}: خسائرك ${attLoss.toLocaleString('en-US')} — خسائر العدو ${defLoss.toLocaleString('en-US')}. النقاط: ${nScoreA} مقابل ${nScoreB}.`, '#/news');
  await notifyCountry(w.defender_code, 'battle', attWins ? 'هزيمة في المعركة' : 'انتصار في المعركة!',
    `معركة ${region ? 'في ' + region : ''}: خسائرك ${defLoss.toLocaleString('en-US')} — خسائر العدو ${attLoss.toLocaleString('en-US')}. النقاط: ${nScoreB} مقابل ${nScoreA}.`, '#/news');
  return {
    battle_id: battleId, winner, winner_name: wname,
    att_losses: attLoss, def_losses: defLoss, score_a: nScoreA, score_b: nScoreB,
    weapons_used: attW.map((x) => ({ id: x.id, name: x.name, class: x.class, qty: x.qty })),
  };
}
// سلام — يُرجع {enforced,winner,reparations} أو {negotiated} أو {proposed} — يرمي عند الفشل
async function peaceInternal(warId, meCC, actorUsername, force) {
  const w = await one('SELECT * FROM wars WHERE id=$1', [parseInt(warId, 10) || 0]);
  if (!w || w.status !== 'active') throw { status: 404, message: 'لا توجد حرب نشطة بهذا الرقم' };
  if (meCC !== w.attacker_code && meCC !== w.defender_code) throw { status: 403, message: 'غير مصرح' };
  const meSide = meCC === w.attacker_code ? w.attacker_code : w.defender_code;
  const otherSide = meSide === w.attacker_code ? w.defender_code : w.attacker_code;
  const g = await gameNow();
  const diff = Number(w.score_a) - Number(w.score_b);
  const finishWar = async (reparations, winnerCC) => {
    await q(`UPDATE wars SET status='ended', ended_game_time=$1, proposed_by=NULL WHERE id=$2`, [g, w.id]);
    await setMapWarStatus(w.attacker_code, false);
    await setMapWarStatus(w.defender_code, false);
    await emitEvent('war_ended', w.attacker_code, w.defender_code,
      `انتهت الحرب بين ${cname(w.attacker_code)} و${cname(w.defender_code)}${reparations ? ` — تعويضات ${reparations} مليون دولار` : ''}`,
      { war_id: w.id, reparations: reparations || 0 });
    await audit('war_peace', actorUsername, `سلام في حرب #${w.id} (تعويضات: ${reparations || 0})`);
    await notifyCountry(w.attacker_code, 'peace', 'انتهت الحرب!',
      `انتهت الحرب ضد ${cname(w.defender_code)}.${reparations && winnerCC === w.attacker_code ? ` حصلت على تعويضات ${reparations} مليون دولار.` : ''}`, '#/news');
    await notifyCountry(w.defender_code, 'peace', 'انتهت الحرب!',
      `انتهت الحرب ضد ${cname(w.attacker_code)}.${reparations && winnerCC === w.defender_code ? ` حصلت على تعويضات ${reparations} مليون دولار.` : ''}`, '#/news');
    await hqArticle(`سلام: انتهاء الحرب بين ${cname(w.attacker_code)} و${cname(w.defender_code)}`,
      `وُقّع السلام رسميًا بين ${cname(w.attacker_code)} و${cname(w.defender_code)}${reparations ? ` مع تعويضات حرب قدرها ${reparations} مليون دولار` : ''}.`, 'wars');
  };
  if (Math.abs(diff) >= 50 || force) {
    const winnerCC = diff >= 0 ? w.attacker_code : w.defender_code;
    const loserCC = diff >= 0 ? w.defender_code : w.attacker_code;
    const want = Math.round(Math.abs(diff) * 5);
    const le = await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [loserCC]);
    const paid = Math.max(0, Math.min(Math.floor(Number(le && le.liquidity_m_usd) || 0), want));
    if (paid > 0) {
      await deductLiquidity(loserCC, paid);
      await addLiquidity(winnerCC, paid);
      await logLiq(loserCC, -paid, `تعويضات حرب لصالح ${cname(winnerCC)}`, actorUsername);
      await logLiq(winnerCC, paid, `تعويضات حرب من ${cname(loserCC)}`, actorUsername);
    }
    await finishWar(paid, winnerCC);
    return { enforced: true, winner: winnerCC, winner_name: cname(winnerCC), reparations: paid };
  }
  if (w.proposed_by && w.proposed_by !== meSide) {
    await finishWar(0, null);
    return { negotiated: true };
  }
  if (w.proposed_by === meSide) throw { status: 400, message: 'عرضك للسلام قائم بانتظار الطرف الآخر' };
  await q('UPDATE wars SET proposed_by=$1 WHERE id=$2', [meSide, w.id]);
  await emitEvent('peace_proposed', meSide, otherSide, `${cname(meSide)} تعرض السلام على ${cname(otherSide)}`, { war_id: w.id });
  await notifyCountry(otherSide, 'peace_offer', `${cname(meSide)} تعرض السلام`,
    `${cname(meSide)} عرضت إنهاء الحرب سلميًا. اقبل من صفحة الحرب.`, '#/news');
  return { proposed: true };
}

// إعلان حرب — صاحب الدولة المهاجمة أو المطورون
// إعلان حرب — صاحب الدولة المهاجمة أو المطورون
app.post('/api/war/declare', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const b = req.body || {};
  const target = String(b.target_code || '').toUpperCase();
  const attacker = dev && b.attacker_code ? String(b.attacker_code).toUpperCase() : req.user.country_code;
  if (!dev && req.user.country_code !== attacker) return res.status(403).json({ error: 'غير مصرح' });
  const warId = await declareWarInternal(attacker, target, req.user.username);
  res.json({ ok: true, war_id: warId });
}));
// معركة — المبادرة للمهاجم (أو المطورون)، والمدافع يدافع تلقائيًا بأفضلية التضاريس
// معركة — المبادرة للمهاجم (أو المطورون)، والمدافع يدافع تلقائيًا بأفضلية التضاريس
app.post('/api/war/battle', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const b = req.body || {};
  const w = await one('SELECT * FROM wars WHERE id=$1', [parseInt(b.war_id, 10) || 0]);
  if (!w || w.status !== 'active') return res.status(404).json({ error: 'لا توجد حرب نشطة بهذا الرقم' });
  if (!dev && req.user.country_code !== w.attacker_code)
    return res.status(403).json({ error: 'غير مصرح — المبادرة بالمعارك للطرف المهاجم' });
  const out = await battleInternal(w.id, w.attacker_code, b.units, b.region, req.user.username, b.weapons);
  res.json(Object.assign({ ok: true }, out));
}));
// السلام — تفاوضي بموافقة الطرفين، أو مفروض عند تفوق ساحق (فرق 50+ نقطة) مع تعويضات
// السلام — تفاوضي بموافقة الطرفين، أو مفروض عند تفوق ساحق (فرق 50+ نقطة) مع تعويضات
app.post('/api/war/peace', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const b = req.body || {};
  const out = await peaceInternal(b.war_id, req.user.country_code, req.user.username, dev && b.force);
  res.json(Object.assign({ ok: true }, out));
}));
// ---------- المعاهدات ----------
// قائمة المعاهدات — العامة فقط (السرية لا تظهر إلا لأطرافها والمطورين)
app.get('/api/treaties', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const myCC = req.user.country_code;
  const rows = await all(`SELECT * FROM treaties WHERE status IN ('proposed','active') ORDER BY id DESC LIMIT 100`);
  res.json({ treaties: rows
    .filter((t) => !t.secret || dev || t.from_code === myCC || t.to_code === myCC)
    .map((t) => ({
      id: t.id, type: t.type, type_label: TREATY_TYPES[t.type] || t.type,
      from_code: t.from_code, to_code: t.to_code,
      from_name: cname(t.from_code), to_name: cname(t.to_code),
      status: t.status, secret: !!t.secret, mine: t.from_code === myCC || t.to_code === myCC,
    })) });
}));
app.get('/api/treaties/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = isDeveloper(req.user);
  const myCC = req.user.country_code;
  const rows = await all(`SELECT * FROM treaties WHERE status='active' AND (from_code=$1 OR to_code=$1) ORDER BY id DESC`, [cc]);
  res.json({
    reputation: await getReputation(cc),
    treaties: rows
      .filter((t) => !t.secret || dev || t.from_code === myCC || t.to_code === myCC)
      .map((t) => ({
        id: t.id, type: t.type, type_label: TREATY_TYPES[t.type] || t.type,
        partner: t.from_code === cc ? t.to_code : t.from_code,
        partner_name: cname(t.from_code === cc ? t.to_code : t.from_code),
        secret: !!t.secret,
      })),
  });
}));
// اقتراح معاهدة — صاحب الدولة أو المطورون
// داخلي: اقتراح معاهدة — نفس التحقق للـendpoint والمستشار (المستشار يمر عبر الموافقات)
async function proposeTreaty(from, to, type, secret, actorUsername) {
  if (!TREATY_TYPES[type]) throw new Error('نوع معاهدة غير صالح');
  if (!validCountry(to) || !validCountry(from)) throw new Error('كود دولة غير صالح');
  if (!from) throw new Error('تحتاج دولة لاقتراح معاهدة');
  if (from === to) throw new Error('لا يمكن التعاهد مع نفسك');
  const dup = await one(`SELECT id FROM treaties WHERE type=$1 AND status IN ('proposed','active') AND
    ((from_code=$2 AND to_code=$3) OR (from_code=$3 AND to_code=$2))`, [type, from, to]);
  if (dup) throw new Error('معاهدة مماثلة قائمة أصلًا بين الدولتين');
  const g = await gameNow();
  const r = await q(`INSERT INTO treaties (type,from_code,to_code,status,secret,created_game_time,created_at)
                     VALUES ($1,$2,$3,'proposed',$4,$5,$6) RETURNING id`,
    [type, from, to, secret ? 1 : 0, g, Date.now()]);
  await emitEvent('treaty_proposed', from, to, `${cname(from)} تقترح ${TREATY_TYPES[type]} على ${cname(to)}`, { treaty_id: r.rows[0].id, secret: !!secret });
  await audit('treaty_propose', actorUsername, `اقتراح ${type} من ${from} إلى ${to}${secret ? ' (سرية)' : ''}`);
  await notifyCountry(to, 'treaty', `عرض معاهدة من ${cname(from)}`,
    `${cname(from)} تقترح عليك: ${TREATY_TYPES[type]}${secret ? ' (سرية)' : ''}. اقبل أو ارفض من قسم الدبلوماسية.`, '#/news');
  return r.rows[0].id;
}
app.post('/api/treaties/propose', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const b = req.body || {};
  const to = String(b.to_code || '').toUpperCase();
  const type = String(b.type || '');
  const from = dev && b.from_code ? String(b.from_code).toUpperCase() : req.user.country_code;
  if (!dev && req.user.country_code !== from) return res.status(403).json({ error: 'غير مصرح' });
  try {
    const id = await proposeTreaty(from, to, type, b.secret ? 1 : 0, req.user.username);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));
// قبول / رفض — الطرف المُقترَح عليه فقط
app.post('/api/treaties/:id/accept', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const t = await one('SELECT * FROM treaties WHERE id=$1', [parseInt(req.params.id, 10) || 0]);
  if (!t || t.status !== 'proposed') return res.status(404).json({ error: 'لا يوجد عرض معاهدة بهذا الرقم' });
  if (!dev && req.user.country_code !== t.to_code) return res.status(403).json({ error: 'غير مصرح' });
  const g = await gameNow();
  await q(`UPDATE treaties SET status='active', decided_game_time=$1 WHERE id=$2`, [g, t.id]);
  await emitEvent('treaty_signed', t.from_code, t.to_code,
    `توقيع ${TREATY_TYPES[t.type]} بين ${cname(t.from_code)} و${cname(t.to_code)}`, { treaty_id: t.id });
  await audit('treaty_accept', req.user.username, `قبول معاهدة #${t.id} (${t.type})`, req);
  await notifyCountry(t.from_code, 'treaty', `قُبِلت معاهدتك!`,
    `${cname(t.to_code)} قبلت: ${TREATY_TYPES[t.type]}.`, '#/news');
  res.json({ ok: true });
}));
app.post('/api/treaties/:id/reject', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const t = await one('SELECT * FROM treaties WHERE id=$1', [parseInt(req.params.id, 10) || 0]);
  if (!t || t.status !== 'proposed') return res.status(404).json({ error: 'لا يوجد عرض معاهدة بهذا الرقم' });
  if (!dev && req.user.country_code !== t.to_code) return res.status(403).json({ error: 'غير مصرح' });
  await q(`UPDATE treaties SET status='rejected', decided_game_time=$1 WHERE id=$2`, [await gameNow(), t.id]);
  await notifyCountry(t.from_code, 'treaty', `رُفِضت معاهدتك`,
    `${cname(t.to_code)} رفضت: ${TREATY_TYPES[t.type]}.`, '#/news');
  res.json({ ok: true });
}));
// كسر معاهدة نافذة — الثمن: -20 سمعة دبلوماسية
app.post('/api/treaties/:id/break', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const t = await one('SELECT * FROM treaties WHERE id=$1', [parseInt(req.params.id, 10) || 0]);
  if (!t || t.status !== 'active') return res.status(404).json({ error: 'لا توجد معاهدة نافذة بهذا الرقم' });
  const myCC = dev && req.body && req.body.as_code ? String(req.body.as_code).toUpperCase() : req.user.country_code;
  if (!dev && myCC !== t.from_code && myCC !== t.to_code) return res.status(403).json({ error: 'غير مصرح' });
  if (myCC !== t.from_code && myCC !== t.to_code) return res.status(400).json({ error: 'حدد الدولة الكاسرة' });
  const nv = await breakTreaty(t, myCC, 'كسر أحادي', req);
  res.json({ ok: true, reputation: nv });
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

// ═══════════════ الاستخبارات ═══════════════
// تجسس بنطاقات ثقة (لا أرقام دقيقة للعدو) + كشف مضاد + مستوى أمني لكل دولة
const INTEL_KINDS = {
  military: { label: 'عسكري', cost: 60 },
  economy: { label: 'اقتصادي', cost: 40 },
  stability: { label: 'سياسي', cost: 30 },
};
async function seedIntel() {
  await q(`CREATE TABLE IF NOT EXISTS intel_reports (
    id SERIAL PRIMARY KEY, spy_code TEXT NOT NULL, target_code TEXT NOT NULL,
    kind TEXT NOT NULL, data TEXT NOT NULL, confidence TEXT NOT NULL DEFAULT 'متوسطة',
    game_time BIGINT NOT NULL, expires_game_time BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS intel_ops (
    id SERIAL PRIMARY KEY, spy_code TEXT NOT NULL, target_code TEXT NOT NULL,
    kind TEXT NOT NULL, success BOOLEAN NOT NULL DEFAULT false, detected BOOLEAN NOT NULL DEFAULT false,
    cost DOUBLE PRECISION NOT NULL DEFAULT 0, game_time BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`);
  await q(`CREATE TABLE IF NOT EXISTS intel_security (
    country_code TEXT PRIMARY KEY, level INTEGER NOT NULL DEFAULT 50, updated_at BIGINT NOT NULL
  )`);
  for (const c of COUNTRIES) {
    await q(`INSERT INTO intel_security (country_code,level,updated_at) VALUES ($1,50,$2)
             ON CONFLICT (country_code) DO NOTHING`, [c.code, Date.now()]);
  }
}
async function getSecurity(cc) {
  const r = await one('SELECT level FROM intel_security WHERE country_code=$1', [cc]);
  return r ? Number(r.level) : 50;
}
// نطاق ثقة ±25%: القيمة الحقيقية مضروبة بعامل عشوائي — الجاسوس لا يرى الدقة أبدًا
function intelRange(trueVal, spread = 0.25) {
  const f = 1 + (Math.random() * 2 - 1) * spread;
  const est = Math.max(0, Math.round(trueVal * f));
  const lo = Math.max(0, Math.round(trueVal * (1 - spread)));
  const hi = Math.round(trueVal * (1 + spread));
  return { estimate: est, low: lo, high: hi };
}
// عملية تجسس — صاحب الدولة (أو المطور) ضد دولة أخرى، مرة واحدة لكل هدف كل شهر لعبة
// داخلي: عملية استخبارية — نفس التحقق للـendpoint والمستشار (المستشار يمر عبر الموافقات)
// يرمي Error عند فشل التحقق (status=429 للتبريد)
async function runSpyOp(spyCC, target, kind, actorUsername) {
  if (!spyCC) throw new Error('تحتاج دولة لتنفيذ عمليات استخبارية');
  if (!validCountry(target) || !INTEL_KINDS[kind]) throw new Error('هدف أو نوع غير صالح');
  if (target === spyCC) throw new Error('لا تتجسس على نفسك');
  const g = await gameNow();
  const month = Math.floor(g / GAME_MONTH_MS);
  const recent = await one(`SELECT game_time FROM intel_ops WHERE spy_code=$1 AND target_code=$2 AND kind=$3
                            ORDER BY id DESC LIMIT 1`, [spyCC, target, kind]);
  if (recent && Math.floor(Number(recent.game_time) / GAME_MONTH_MS) === month)
    throw Object.assign(new Error('عملية واحدة لكل هدف شهريًا — انتظر شهر اللعبة التالي'), { status: 429 });
  const cost = INTEL_KINDS[kind].cost;
  const paid = await deductLiquidity(spyCC, cost);
  if (!paid) throw new Error('السيولة لا تكفي للعملية');
  await logLiq(spyCC, -cost, `عملية استخبارية (${INTEL_KINDS[kind].label}) ضد ${cname(target)}`, actorUsername);
  // النجاح: قاعدة 65% — الفوضى تساعد، والاستقرار العالي والأمن المشدود يعيقان
  const tStab = await getEconStat(target, 'stability', 70);
  const tSec = await getSecurity(target);
  const atWar = await one(`SELECT id FROM wars WHERE status='active' AND (attacker_code=$1 OR defender_code=$1)`, [target]);
  let pSuccess = 0.65 + (atWar ? 0.10 : 0) - Math.max(0, tStab - 70) * 0.005 - Math.max(0, tSec - 50) * 0.004;
  pSuccess = Math.max(0.2, Math.min(0.95, pSuccess));
  const success = Math.random() < pSuccess;
  // الكشف المضاد: الأمن الأعلى = كشف أعلى — والكشف فضيحة دبلوماسية
  const pDetect = 0.15 + Math.max(0, tSec - 50) * 0.008 + (success ? 0 : 0.10);
  const detected = Math.random() < Math.min(0.7, pDetect);
  await q(`INSERT INTO intel_ops (spy_code,target_code,kind,success,detected,cost,game_time,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [spyCC, target, kind, success, detected, cost, g, Date.now()]);
  await audit('intel_spy', actorUsername, `${cname(spyCC)} → ${cname(target)} [${kind}] ${success ? 'نجاح' : 'فشل'}${detected ? ' — انكشف!' : ''}`);
  let report = null;
  if (success) {
    const data = {};
    if (kind === 'military') {
      const a = await getArmy(target);
      data.soldiers = intelRange(a.soldiers);
      data.readiness = intelRange(a.readiness, 0.2);
      data.morale = intelRange(a.morale, 0.2);
    } else if (kind === 'economy') {
      const e = await one('SELECT liquidity_m_usd, tax_rate FROM country_economy WHERE country_code=$1', [target]);
      data.liquidity_m_usd = intelRange(Number((e && e.liquidity_m_usd) || 0));
      data.tax_rate = intelRange(Number((e && e.tax_rate) != null ? e.tax_rate : 10), 0.2);
    } else {
      const st = await getEconStat(target, 'stability', 70);
      const ps = await getEconStat(target, 'public_support', 60);
      data.stability = intelRange(st, 0.2);
      data.public_support = intelRange(ps, 0.2);
      data.revolt_risk = st <= 20 ? 'مرتفع جدًا' : st <= 40 ? 'مرتفع' : st <= 60 ? 'متوسط' : 'منخفض';
    }
    const conf = pSuccess >= 0.7 ? 'عالية' : pSuccess >= 0.5 ? 'متوسطة' : 'منخفضة';
    const exp = (month + 3) * GAME_MONTH_MS;
    const rr = await q(`INSERT INTO intel_reports (spy_code,target_code,kind,data,confidence,game_time,expires_game_time,created_at)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [spyCC, target, kind, JSON.stringify(data), conf, g, exp, Date.now()]);
    report = { id: rr.rows[0].id, kind, kind_label: INTEL_KINDS[kind].label, confidence: conf, data, expires_in_months: 3 };
  }
  if (detected) {
    const nv = await addReputation(spyCC, -5);
    await emitEvent('spy_caught', spyCC, target, `انكشاف جاسوس ${cname(spyCC)} في ${cname(target)}!`,
      { kind, spy: spyCC, target });
    await notifyCountry(target, 'spy_caught', `أمسكنا بجاسوس من ${cname(spyCC)}!`,
      `أجهزة الأمن ضبطت عميلًا استخباريًا من ${cname(spyCC)} كان يجمع معلومات ${INTEL_KINDS[kind].label}. سمعتهم الدبلوماسية تضررت (${nv}/100).`, '#/intel');
    await notifyCountry(spyCC, 'spy_burned', 'انكشف عميلنا!',
      `أجهزة ${cname(target)} الأمنية كشفت عمليتنا الاستخبارية (${INTEL_KINDS[kind].label}). خسرنا 5 نقاط سمعة دبلوماسية.`, '#/intel');
  }
  return { ok: true, success, detected, cost, report,
    note: success ? 'وصل التقرير — تذكر: الأرقام تقديرات بنطاق ثقة وليست دقيقة'
      : 'فشلت العملية — لا معلومات هذه المرة' };
}
app.post('/api/intel/spy', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const spyCC = dev && req.body && req.body.as_code ? String(req.body.as_code).toUpperCase() : req.user.country_code;
  const target = String((req.body && req.body.target_code) || '').toUpperCase();
  const kind = String((req.body && req.body.kind) || '');
  try {
    res.json(await runSpyOp(spyCC, target, kind, req.user.username));
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
}));
// تقاريري الاستخبارية — غير المنتهية فقط (3 أشهر لعبة)
app.get('/api/intel/reports', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const myCC = dev && req.query.as_code ? String(req.query.as_code).toUpperCase() : req.user.country_code;
  if (!myCC) return res.json({ reports: [] });
  const g = await gameNow();
  const rows = await all(`SELECT * FROM intel_reports WHERE spy_code=$1 AND expires_game_time > $2 ORDER BY id DESC LIMIT 50`, [myCC, g]);
  res.json({ reports: rows.map((r) => ({
    id: r.id, target_code: r.target_code, target_name: cname(r.target_code),
    kind: r.kind, kind_label: INTEL_KINDS[r.kind] ? INTEL_KINDS[r.kind].label : r.kind,
    confidence: r.confidence, data: JSON.parse(r.data || '{}'),
    game_time: Number(r.game_time), expires_game_time: Number(r.expires_game_time),
  })) });
}));
// تشديد الأمن المضاد — يرفع احتمال كشف جواسيس العدو (تكلفة لمرة واحدة)
app.post('/api/intel/security', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const myCC = dev && req.body && req.body.as_code ? String(req.body.as_code).toUpperCase() : req.user.country_code;
  if (!myCC) return res.status(400).json({ error: 'تحتاج دولة' });
  const level = Math.max(0, Math.min(100, parseInt(req.body && req.body.level, 10) || 0));
  const cur = await getSecurity(myCC);
  if (level <= cur) return res.json({ ok: true, level: cur, note: 'المستوى الحالي مساوٍ أو أعلى — لا تكلفة' });
  const cost = (level - cur) * 1; // مليون دولار لكل نقطة
  const paid = await deductLiquidity(myCC, cost);
  if (!paid) return res.status(400).json({ error: 'السيولة لا تكفي' });
  await q(`UPDATE intel_security SET level=$2, updated_at=$3 WHERE country_code=$1`, [myCC, level, Date.now()]);
  await logLiq(myCC, -cost, `تشديد الأمن المضاد إلى ${level}`, req.user.username);
  await audit('intel_security', req.user.username, `${cname(myCC)} رفع الأمن إلى ${level}`, req);
  res.json({ ok: true, level, cost });
}));
// وضعي الأمني + محاولات مكتشفة ضدي مؤخرًا
app.get('/api/intel/status', ah(auth), ah(async (req, res) => {
  const dev = isDeveloper(req.user);
  const myCC = dev && req.query.as_code ? String(req.query.as_code).toUpperCase() : req.user.country_code;
  if (!myCC) return res.json({ level: 50, attempts: [] });
  const g = await gameNow();
  const rows = await all(`SELECT spy_code, kind, game_time FROM intel_ops
                          WHERE target_code=$1 AND detected AND game_time > $2 ORDER BY id DESC LIMIT 10`,
    [myCC, g - 6 * GAME_MONTH_MS]);
  res.json({
    level: await getSecurity(myCC),
    attempts: rows.map((r) => ({ spy_code: r.spy_code, spy_name: cname(r.spy_code),
      kind_label: INTEL_KINDS[r.kind] ? INTEL_KINDS[r.kind].label : r.kind, game_time: Number(r.game_time) })),
  });
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
// ---------- محرك العالم: حدث → تحقق → تغيّر حالة → سجل → إشعارات → صحيفة ----------
// كل حدث في اللعبة يمر من هنا فيُسجَّل في game_events بزمن اللعبة
async function emitEvent(type, actorCode, targetCode, title, data) {
  try {
    const g = await gameNow();
    await q(`INSERT INTO game_events (type,actor_code,target_code,title,data,game_time,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [type, actorCode || null, targetCode || null, title, JSON.stringify(data || {}), g, Date.now()]);
  } catch (e) { /* غير حرج */ }
}
// سجل التدقيق: كل فعل إداري/مالي مهم — لا يُعدَّل ولا يُحذف (قراءة للمطورين فقط)
async function audit(action, actor, details, req) {
  try {
    const ip = req ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').slice(0, 64) : '';
    await q(`INSERT INTO audit_log (action,actor,details,ip,created_at) VALUES ($1,$2,$3,$4,$5)`,
      [action, actor || '?', details || '', ip, Date.now()]);
  } catch (e) { /* غير حرج */ }
}
// منع التكرار: نفس المفتاح = نفس الرد المحفوظ (يحمي من الضغط المزدوج وإعادة الإرسال)
async function withIdempotency(key, fn) {
  if (!key) return { duplicate: false, response: await fn() };
  const ex = await one('SELECT response FROM idempotency_keys WHERE key=$1', [key]);
  if (ex) return { duplicate: true, response: JSON.parse(ex.response) };
  const response = await fn();
  try {
    await q('INSERT INTO idempotency_keys (key,response,created_at) VALUES ($1,$2,$3)',
      [String(key).slice(0, 128), JSON.stringify(response), Date.now()]);
  } catch (e) { /* سباق على المفتاح: تجاهل */ }
  return { duplicate: false, response };
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
  // خصم ذري: الشرط والخصم في جملة واحدة — يمنع السباق على الرصيد
  const r = await q(`UPDATE country_economy SET liquidity_m_usd = liquidity_m_usd - $2
                     WHERE country_code=$1 AND COALESCE(liquidity_m_usd,0) >= $2`, [cc, amountUsd]);
  return r.rowCount > 0;
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
// حالة الساعة: المنقضي من زمن اللعبة — يحترم الإيقاف (يتجمد عند التوقف)
// GAME_TIME واحد فقط: كل أحداث اللعبة تُحسب من هنا، ولا يُستخدم Date.now() لأحداث اللعبة
async function gameState() {
  const row = await one('SELECT started_at, running, frozen_elapsed FROM game_clock WHERE id=1');
  if (!row) return { running: false, elapsed: 0, started_at: null };
  const running = !!row.running;
  const st = row.started_at ? Number(row.started_at) : null;
  const elapsed = running
    ? (st ? Math.max(0, Date.now() - st) : 0)
    : (row.frozen_elapsed != null ? Math.max(0, Number(row.frozen_elapsed)) : 0);
  return { running, elapsed, started_at: st };
}
async function gameNow() { return (await gameState()).elapsed; }
const ECON_STAT_COLS = ['stability', 'public_support', 'inflation'];
async function getEconStat(cc, col, def) {
  if (!ECON_STAT_COLS.includes(col)) return def;
  const r = await one(`SELECT ${col} FROM country_economy WHERE country_code=$1`, [cc]);
  return r && r[col] != null ? Number(r[col]) : def;
}
async function setEconStat(cc, col, val) {
  if (!ECON_STAT_COLS.includes(col)) return;
  await q(`UPDATE country_economy SET ${col}=$2 WHERE country_code=$1`, [cc, val]);
}
// ---------- محرك التك الشهري (المرحلة 4): العالم يعيش كل شهر لعبة ----------
// يُستدعى بتكاسل من نقاط الدخول الرئيسية — يعالج كل شهور اللعبة المنقضية دفعة واحدة
async function runMonthlyTick() {
  try {
    const g = await gameNow();
    const row = await one('SELECT last_tick_game_ms FROM game_clock WHERE id=1');
    const last = row && row.last_tick_game_ms != null ? Number(row.last_tick_game_ms) : 0;
    const months = Math.floor(g / GAME_MONTH_MS) - Math.floor(last / GAME_MONTH_MS);
    if (months <= 0) return;
    const n = Math.min(months, 24); // سقف أمان ضد الانفجار
    const startMonth = Math.floor(last / GAME_MONTH_MS);
    for (let i = 0; i < n; i++) await monthlyTickOnce();
    for (let i = 1; i <= n; i++) { try { await aiNationsTick(startMonth + i); } catch (e) { /* غير حرج */ } }
    for (let i = 1; i <= n; i++) { try { await advisorAutoTick(startMonth + i); } catch (e) { /* غير حرج */ } }
    await q('UPDATE game_clock SET last_tick_game_ms=$1 WHERE id=1', [Math.floor(g / GAME_MONTH_MS) * GAME_MONTH_MS]);
  } catch (e) { /* غير حرج */ }
}
async function monthlyTickOnce() {
  const countries = await all('SELECT country_code, tax_rate, revolt_active FROM country_economy');
  const wars = await all(`SELECT attacker_code, defender_code FROM wars WHERE status='active'`);
  const atWar = new Set();
  for (const w of wars) { atWar.add(w.attacker_code); atWar.add(w.defender_code); }
  for (const c of countries) {
    const cc = c.country_code;
    const rate = c.tax_rate != null ? Number(c.tax_rate) : 10;
    let stab = await getEconStat(cc, 'stability', 70);
    let ps = await getEconStat(cc, 'public_support', 60);
    let infl = await getEconStat(cc, 'inflation', 2);
    const warring = atWar.has(cc);
    // الضغط الضريبي التدريجي — بدل عتبة الـ30% الصلبة التي يستغلها اللاعبون
    if (rate > 25) stab -= (rate - 25) * 0.6 * (1 + infl / 50);
    else if (rate <= 15) stab += 3;
    if (warring) { stab -= 2; ps -= 3; } // إرهاق الحرب
    // التضخم: ضغط الحرب + الضرائب المرتفعة
    const inflTarget = 2 + (warring ? 2 : 0) + Math.max(0, rate - 30) * 0.15;
    infl = Math.max(0, Math.min(30, infl + (inflTarget - infl) * 0.3));
    // تكلفة القوة: صيانة الجيش الشهرية — ضد التضخم الثلجي (كلما كبرت دفعت أكثر)
    const mil = await getArmy(cc);
    const maint = Math.round(mil.soldiers * 0.0002 * 100) / 100;
    if (maint >= 1) {
      const paid = await deductLiquidity(cc, maint);
      if (paid) await logLiq(cc, -maint, 'صيانة الجيش الشهرية', 'النظام');
      else {
        await setArmyStat(cc, { readiness: Math.max(0, mil.readiness - 10) });
        stab -= 3; // جيش بلا رواتب = غضب
      }
    }
    if (!warring) {
      await setArmyStat(cc, {
        readiness: Math.min(100, mil.readiness + 5),
        morale: Math.min(100, mil.morale + 2),
      });
    }
    ps = Math.max(0, Math.min(100, ps + (60 - ps) * 0.1));
    stab = Math.max(0, Math.min(100, stab));
    await setEconStat(cc, 'stability', Math.round(stab * 10) / 10);
    await setEconStat(cc, 'public_support', Math.round(ps * 10) / 10);
    await setEconStat(cc, 'inflation', Math.round(infl * 10) / 10);
    // الثورة: انهيار الاستقرار = انفجار — والتعافي ينهيها
    const revolt = !!c.revolt_active;
    if (stab <= 0 && !revolt) await triggerRevolution(cc, 'انهيار الاستقرار الداخلي');
    else if (revolt && stab >= 40) await endRevolution(cc);
  }
}
// الثورة الشعبية — عصيان مدني: خصم 15% من السيولة + إعلان على الخريطة + توقف الجباية
async function triggerRevolution(cc, reason) {
  const e = await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc]);
  const liq = Number(e && e.liquidity_m_usd) || 0;
  const loss = Math.round(liq * 0.15);
  await q('UPDATE country_economy SET liquidity_m_usd = GREATEST(0, COALESCE(liquidity_m_usd,0) - $2), revolt_active=1 WHERE country_code=$1', [cc, loss]);
  await logLiq(cc, -loss, `خسائر الثورة الشعبية — ${reason}`, 'النظام');
  const ms = await one('SELECT status FROM map_states WHERE country_code=$1', [cc]);
  if (!ms || !['war', 'emergency'].includes(ms.status)) {
    const ex = await one('SELECT country_code FROM map_states WHERE country_code=$1', [cc]);
    if (ex) await q(`UPDATE map_states SET color='#ff2222',status='revolt',label=$2,updated_by=NULL,updated_at=$3 WHERE country_code=$1`,
      [cc, 'ثورة شعبية — ' + reason, Date.now()]);
    else await q(`INSERT INTO map_states (country_code,color,status,label,updated_by,updated_at) VALUES ($1,'#ff2222','revolt',$2,NULL,$3)`,
      [cc, 'ثورة شعبية — ' + reason, Date.now()]);
  }
  await emitEvent('revolution', cc, null, `ثورة شعبية في ${cname(cc)}!`, { reason });
  const owners = await ownersOf(cc);
  const tg = owners.length ? owners : await devIds();
  for (const uid of tg) await notify(uid, 'revolt',
    'ثورة شعبية في ' + cname(cc) + '!',
    `الشعب أعلن العصيان المدني: ${reason}. خسرت الدولة ${loss.toLocaleString('en-US')} مليون دولار من السيولة، وتوقفت جباية الضرائب حتى يستعيد الاستقرار عافيته (40+).`, '#/economy/' + cc);
}
async function endRevolution(cc) {
  await q('UPDATE country_economy SET revolt_active=0 WHERE country_code=$1', [cc]);
  await q("DELETE FROM map_states WHERE country_code=$1 AND status='revolt'", [cc]);
  await emitEvent('revolution_end', cc, null, `انتهت الثورة في ${cname(cc)}`, {});
  const owners = await ownersOf(cc);
  const tg = owners.length ? owners : await devIds();
  for (const uid of tg) await notify(uid, 'revolt_end',
    'انتهت الثورة في ' + cname(cc),
    'هدأت الأوضاع وعاد الاستقرار. عادت جباية الضرائب للعمل.', '#/economy/' + cc);
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
  // شركات الحاكم الذكي بلا مالك مستخدم
  try { await q('ALTER TABLE companies ALTER COLUMN owner_id DROP NOT NULL'); } catch (e) { /* مدعوم */ }
  // المرحلة 4: منتج الشركة + الاستقرار/الدعم الشعبي/التضخم لكل دولة
  try { await q(`ALTER TABLE companies ADD COLUMN product TEXT DEFAULT ''`); } catch (e) { /* موجود */ }
  for (const colDef of [
    'stability DOUBLE PRECISION DEFAULT 70', 'public_support DOUBLE PRECISION DEFAULT 60',
    'inflation DOUBLE PRECISION DEFAULT 2',
  ]) { try { await q(`ALTER TABLE country_economy ADD COLUMN ${colDef}`); } catch (e) { /* موجود */ } }
  await q('UPDATE country_economy SET stability=70 WHERE stability IS NULL');
  await q('UPDATE country_economy SET public_support=60 WHERE public_support IS NULL');
  await q('UPDATE country_economy SET inflation=2 WHERE inflation IS NULL');
  // ترقية السوق: التسليم بزمن اللعبة (يتجمد مع إيقاف الساعة)
  try { await q('ALTER TABLE market_orders ADD COLUMN deliver_game_at BIGINT'); } catch (e) { /* موجود */ }
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
  // عروض الدول الذكية بلا مستخدم بائع
  for (const t of ['market_listings', 'market_orders']) {
    try { await q(`ALTER TABLE ${t} ALTER COLUMN seller_id DROP NOT NULL`); } catch (e) { /* مدعوم */ }
  }
  await q("UPDATE market_listings SET kind='weapon' WHERE kind IS NULL");
  await q("UPDATE market_orders SET kind='weapon' WHERE kind IS NULL");
  await q(`UPDATE companies SET host_country=country_code WHERE host_country IS NULL`);
  await q(`UPDATE companies SET capital_usd=capital WHERE capital_usd IS NULL`);
  // seed_meta أُنشئ أعلاه — لا تكرار (pg-mem يتعثر في التكرار)
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
    product: c.product || '',
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
  const aiRows = await all(`SELECT country_code FROM ai_nations WHERE enabled=1`);
  const aiSet = new Set(aiRows.map((r) => r.country_code));
  const claimedRows = await all(`SELECT DISTINCT country_code FROM users WHERE country_code IS NOT NULL AND role NOT IN ('system','developer','ai_embassy')`);
  const claimedSet = new Set(claimedRows.map((r) => r.country_code));
  const llmOn = await llmEnabled();
  res.json({
    economies: rows.map((r) => ({ ...econRow(r), companies_count: cmap[r.country_code] || 0,
      ai_governed: aiSet.has(r.country_code) && !claimedSet.has(r.country_code), ai_llm: llmOn })),
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
    stability: e && e.stability != null ? Number(e.stability) : 70,
    public_support: e && e.public_support != null ? Number(e.public_support) : 60,
    inflation: e && e.inflation != null ? Number(e.inflation) : 2,
    reputation: await getReputation(cc),
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
                     capital,capital_usd,description,resource_kind,workers,product,created_at,updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
    [founderCC, c.host_country, req.user.id, c.ctype, status, c.name, c.sector, c.city,
     c.capital, capUsd, c.description, c.resource_kind, c.workers,
     typeof b.product === 'string' ? b.product.trim().slice(0, 120) : '', Date.now()]);
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
  const dev = isDeveloper(req.user);
  if (!dev && req.user.country_code !== row.host_country)
    return res.status(403).json({ error: 'الموافقة لصاحب الدولة المضيفة فقط' });
  // حجز ذري: طلب معلق واحد فقط يُقبَل — يمنع الموافقة المزدوجة وخصم رأس المال مرتين
  const claim = await q(`UPDATE companies SET status='approved', updated_at=$2 WHERE id=$1 AND status='pending'`,
    [req.params.id, Date.now()]);
  if (!claim.rowCount) return res.status(400).json({ error: 'الطلب ليس معلقًا (ربما عُولج أصلًا)' });
  const ok = await deductLiquidity(row.host_country, Number(row.capital_usd) || 0);
  if (!ok) {
    await q(`UPDATE companies SET status='pending' WHERE id=$1`, [req.params.id]); // إرجاع الحالة
    return res.status(400).json({ error: 'سيولة ' + cname(row.host_country) + ' لا تكفي لرأس مال الشركة' });
  }
  await audit('company_approve', req.user.username, `الموافقة على شركة «${row.name}» الدولية في ${cname(row.host_country)}`, req);
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
  // حجز ذري — يمنع الرفض بعد القبول
  const claim = await q(`UPDATE companies SET status='rejected', updated_at=$2 WHERE id=$1 AND status='pending'`,
    [req.params.id, Date.now()]);
  if (!claim.rowCount) return res.status(400).json({ error: 'الطلب ليس معلقًا (ربما عُولج أصلًا)' });
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
  const product = typeof b.product === 'string' ? b.product.trim().slice(0, 120) : '';
  await q(`UPDATE companies SET name=$1,sector=$2,city=$3,description=$4,resource_kind=$5,workers=$6,product=$7,updated_at=$8 WHERE id=$9`,
    [b.name.trim().slice(0, 120), b.sector, city, desc, rk, wk, product, Date.now(), req.params.id]);
  res.json({ ok: true });
}));
// جمع إنتاج الشركة — شهريًا بزمن اللعبة: كل عامل ينتج كمية ثابتة حسب المورد
// جمع إنتاج الشركة — منطق داخلي مشترك (اللاعبون + الحكام الأذكياء)
async function collectCompanyInternal(id, actor) {
  const row = await one('SELECT * FROM companies WHERE id=$1', [id]);
  if (!row) throw Object.assign(new Error('الشركة غير موجودة'), { status: 404 });
  if (row.status !== 'approved') throw Object.assign(new Error('الشركة لم تُعتمد بعد'), { status: 400 });
  if (!row.resource_kind || !RES_AR[row.resource_kind])
    throw Object.assign(new Error('هذه الشركة غير متخصصة في استخراج مورد — حدد تخصصها أولًا'), { status: 400 });
  const workers = Number(row.workers) || 0;
  if (workers <= 0) throw Object.assign(new Error('حدد عدد العمال أولًا'), { status: 400 });
  const nowG = await gameNow();
  const monthStart = gameMonthIdx(nowG) * GAME_MONTH_MS; // بداية شهر اللعبة الحالي بالمللي
  // حجز ذري لشهر اللعبة: أول طلب فقط ينجح — يمنع غليتش الأموال عند الضغط المزدوج
  const claim = await q('UPDATE companies SET last_collect=$1 WHERE id=$2 AND (last_collect IS NULL OR last_collect < $3)',
    [nowG, row.id, monthStart]);
  if (!claim.rowCount)
    throw Object.assign(new Error('تم جمع إنتاج هذا الشهر — عُد الشهر القادم (شهر لعبة)'), { status: 400 });
  const reserveTotal = Number((RESERVES[row.host_country] || {})[row.resource_kind]) || 0;
  const exRow = await one('SELECT extracted FROM resource_extracted WHERE country_code=$1 AND resource=$2', [row.host_country, row.resource_kind]);
  const extractedSoFar = exRow ? Number(exRow.extracted) || 0 : 0;
  const remaining = reserveTotal - extractedSoFar;
  if (remaining <= 0)
    throw Object.assign(new Error('نفد احتياطي ' + RES_AR[row.resource_kind] + ' في ' + cname(row.host_country)), { status: 400 });
  let amount = Math.floor(Math.min(workers * RES_RATE[row.resource_kind], remaining));
  if (amount <= 0) throw Object.assign(new Error('لا يوجد إنتاج متاح هذا الشهر'), { status: 400 });
  await addStock(row.host_country, row.resource_kind, amount);
  if (exRow) await q('UPDATE resource_extracted SET extracted = extracted + $3 WHERE country_code=$1 AND resource=$2',
    [row.host_country, row.resource_kind, amount]);
  else await q('INSERT INTO resource_extracted (country_code,resource,extracted) VALUES ($1,$2,$3)',
    [row.host_country, row.resource_kind, amount]);
  await logLiq(row.host_country, 0, `إنتاج ${RES_AR[row.resource_kind]}: ${amount.toLocaleString('en-US')} ${RES_UNIT[row.resource_kind]} من «${row.name}» (${workers.toLocaleString('en-US')} عامل)`, actor);
  return { amount, unit: RES_UNIT[row.resource_kind], resource: RES_AR[row.resource_kind],
           stock: await getStock(row.host_country, row.resource_kind), reserve_remaining: remaining - amount };
}
// جمع إنتاج الشركة — شهريًا بزمن اللعبة: كل عامل ينتج كمية ثابتة حسب المورد
app.post('/api/companies/:id/collect', ah(auth), ah(async (req, res) => {
  const prow = await one('SELECT id, owner_id, status FROM companies WHERE id=$1', [req.params.id]);
  if (!prow) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const dev = isDeveloper(req.user);
  if (!dev && prow.owner_id !== req.user.id) return res.status(403).json({ error: 'غير مصرح' });
  if (prow.status !== 'approved') return res.status(400).json({ error: 'الشركة لم تُعتمد بعد' });
  const r = await collectCompanyInternal(req.params.id, req.user.username);
  res.json({ ok: true, ...r });
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
// داخلي: تغيير الضريبة — نفس التحقق للـendpoint والمستشار (المستشار يمر عبر الموافقات)
async function setCountryTax(cc, rate, actorUsername, actorId) {
  const nr = Math.max(0, Math.min(100, Number(rate) || 0));
  const row = await one('SELECT tax_rate FROM country_economy WHERE country_code=$1', [cc]);
  if (!row) {
    await q('INSERT INTO country_economy (country_code,tax_rate,updated_by,updated_at) VALUES ($1,$2,$3,$4)',
      [cc, nr, actorId || null, Date.now()]);
  } else {
    await q('UPDATE country_economy SET tax_rate=$2, updated_by=$3, updated_at=$4 WHERE country_code=$1',
      [cc, nr, actorId || null, Date.now()]);
  }
  await audit('tax_change', actorUsername, `تغيير ضريبة ${cname(cc)} إلى ${nr}%`);
  const pressure = nr > 25 ? `ضغط مرتفع على الاستقرار (${Math.round((nr - 25) * 0.6 * 10) / 10} نقطة/شهر)` : nr > 15 ? 'ضغط معتدل' : 'ضغط منخفض — الاستقرار يتعافى';
  return { tax_rate: nr, pressure };
}
app.put('/api/economy/:code', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = isDeveloper(req.user);
  const isOwner = req.user.country_code === cc;
  if (!dev && !isOwner) return res.status(403).json({ error: 'غير مصرح' });
  const b = req.body || {};
  // نسبة الضريبة — يحددها صاحب الدولة (0-100)
  // لا عتبة صلبة: الضغط الضريبي تراكمي عبر الاستقرار (المحرك الشهري) — الثورة عند انهيار الاستقرار
  let taxPressure = null;
  if (b.tax_rate !== undefined) {
    const r = await setCountryTax(cc, b.tax_rate, req.user.username, req.user.id);
    taxPressure = r.pressure;
    if (!dev) return res.json({ ok: true, tax_rate: r.tax_rate, pressure: r.pressure });
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
  res.json({ ok: true, pressure: taxPressure });
}));

// جباية الضرائب — مرة كل شهر لعبة: الناتج السنوي × النسبة ÷ 12 (ممنوعة أثناء الثورة)
// جباية الضرائب الشهرية — منطق داخلي مشترك (اللاعبون + الحكام الأذكياء)
async function collectTaxesInternal(cc, actor) {
  const e = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  if (!e) throw Object.assign(new Error('لا توجد بيانات اقتصادية'), { status: 400 });
  if (e.revolt_active) throw Object.assign(new Error('لا يمكن جباية الضرائب أثناء الثورة الشعبية'), { status: 403 });
  const nowG = await gameNow();
  const monthStart = gameMonthIdx(nowG) * GAME_MONTH_MS; // بداية شهر اللعبة الحالي بالمللي
  // حجز ذري لشهر اللعبة: أول طلب فقط ينجح — يمنع غليتش الأموال عند الضغط المزدوج
  const claim = await q('UPDATE country_economy SET last_tax_collect=$1 WHERE country_code=$2 AND (last_tax_collect IS NULL OR last_tax_collect < $3)',
    [nowG, cc, monthStart]);
  if (!claim.rowCount)
    throw Object.assign(new Error('تمت الجباية هذا الشهر — عُد الشهر القادم (شهر لعبة = ساعتان)'), { status: 400 });
  const rate = e.tax_rate != null ? Number(e.tax_rate) : 10;
  const gdp = e.gdp_m_intl != null ? Number(e.gdp_m_intl) : null;
  const liq = e.liquidity_m_usd != null ? Number(e.liquidity_m_usd) : null;
  const base = gdp || (liq != null ? liq / 0.04 : 0);
  const amount = Math.round(base * (rate / 100) / 12);
  await q('UPDATE country_economy SET liquidity_m_usd = COALESCE(liquidity_m_usd,0) + $2 WHERE country_code=$1',
    [cc, amount]);
  await logLiq(cc, amount, `جباية الضرائب الشهرية بنسبة ${rate}%`, actor);
  const ne = await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc]);
  return { amount, liquidity: Number(ne.liquidity_m_usd) || 0 };
}
app.post('/api/economy/:code/collect-taxes', ah(auth), ah(async (req, res) => {
  const cc = String(req.params.code || '').toUpperCase();
  if (!validCountry(cc)) return res.status(400).json({ error: 'كود دولة غير صالح' });
  const dev = isDeveloper(req.user);
  if (!dev && req.user.country_code !== cc) return res.status(403).json({ error: 'غير مصرح' });
  const r = await collectTaxesInternal(cc, req.user.username);
  res.json({ ok: true, ...r });
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
// ---------- سجل أحداث العالم (عام) وسجل التدقيق (مطورون فقط) ----------
app.get('/api/events', ah(async (req, res) => {
  const lim = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const rows = await all(`SELECT * FROM game_events ORDER BY id DESC LIMIT $1`, [lim]);
  res.json({ events: rows.map((e) => ({
    id: e.id, type: e.type, actor_code: e.actor_code, target_code: e.target_code,
    title: e.title, data: (() => { try { return JSON.parse(e.data || '{}'); } catch (_) { return {}; } })(),
    game_time: Number(e.game_time), created_at: Number(e.created_at),
  })) });
}));
app.get('/api/admin/audit', ah(auth), requireDeveloper, ah(async (req, res) => {
  const lim = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const rows = await all(`SELECT * FROM audit_log ORDER BY id DESC LIMIT $1`, [lim]);
  res.json({ audit: rows.map((a) => ({
    id: a.id, action: a.action, actor: a.actor, details: a.details, ip: a.ip,
    created_at: Number(a.created_at),
  })) });
}));

// ============================================================================
// ARGOS AI ADVISOR — طبقة المستشار الذكي
// ----------------------------------------------------------------------------
// مبادئ ملزمة:
//  1. المستشار لا يلمس قاعدة البيانات مباشرة — كل شيء عبر Tool Layer أدناه.
//  2. لا يرى المستشار إلا ما يسمح نظام اللعبة للاعب برؤيته (server-side).
//  3. أي إجراء كتابة يمر: صلاحية → تحقق قواعد اللعبة → موارد → موافقة → تنفيذ → تدقيق → إشعار.
//  4. مزود الذكاء AIProvider قابل للتبديل (rule-based افتراضيًا؛ مفاتيح LLM تبقى server-side فقط).
//  5. فشل المستشار لا يكسر اللعبة أبدًا.
// ============================================================================

// ---------- جداول المستشار ----------
async function initAdvisorTables() {
  await q(`CREATE TABLE IF NOT EXISTS advisor_settings (
    country_code TEXT PRIMARY KEY, mode INT DEFAULT 1, domains TEXT DEFAULT '{}',
    advisor_name TEXT, updated_at BIGINT)`);
  await q(`CREATE TABLE IF NOT EXISTS advisor_memory (
    id SERIAL PRIMARY KEY, country_code TEXT NOT NULL, mkey TEXT NOT NULL, mvalue TEXT,
    updated_at BIGINT, UNIQUE(country_code, mkey))`);
  await q(`CREATE TABLE IF NOT EXISTS advisor_tasks (
    id SERIAL PRIMARY KEY, country_code TEXT NOT NULL, kind TEXT NOT NULL,
    title TEXT NOT NULL, detail TEXT, action TEXT, payload TEXT DEFAULT '{}',
    risk TEXT DEFAULT 'low', status TEXT DEFAULT 'pending',
    created_game_time BIGINT, decided_game_time BIGINT, decided_by TEXT,
    result TEXT, created_at BIGINT)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_adv_tasks_cc ON advisor_tasks(country_code, status)`);
  await q(`CREATE TABLE IF NOT EXISTS advisor_briefs (
    id SERIAL PRIMARY KEY, country_code TEXT NOT NULL, kind TEXT NOT NULL,
    game_day BIGINT NOT NULL, content TEXT, created_at BIGINT,
    UNIQUE(country_code, kind, game_day))`);
  await q(`CREATE TABLE IF NOT EXISTS advisor_chat (
    id SERIAL PRIMARY KEY, country_code TEXT NOT NULL, role TEXT NOT NULL,
    text TEXT NOT NULL, created_at BIGINT)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_adv_chat_cc ON advisor_chat(country_code, id)`);
}
initAdvisorTables().catch((e) => console.error('advisor tables:', e.message));

// ---------- أسماء المستشارين حسب الدولة ----------
const ADVISOR_NAMES = {
  RU: 'أليكسي', DE: 'أوتو', FR: 'ألبير', GB: 'Arthur', US: 'Thaddeus',
  IT: 'إنزو', ES: 'دييغو', AT: 'فرانز', OT: 'كمال', CN: 'لي وي',
  JP: 'كينجي', PT: 'جواو', NL: 'هندريك', BE: 'إميل', GR: 'نيكوس',
  RS: 'ميلان', MX: 'إميليانو', BR: 'جواكيم', AR: 'مانويل',
};
const advisorNameFor = (cc) => ADVISOR_NAMES[cc] || 'المستشار العام';

// ---------- AIProvider — طبقة تجريد قابلة للتبديل ----------
// المزود الافتراضي rule-based يعمل محليًا بالكامل (لا مفاتيح، لا شبكة).
// لإضافة LLM لاحقًا (OpenAI/Gemini/DeepSeek): سجّل مزودًا جديدًا هنا يطبق
// generate(ctx) ويقرأ مفتاحه من process.env فقط — لا يصل المفتاح للواجهة أبدًا.
const AIProviders = {
  'rule-based': {
    id: 'rule-based', label: 'ARGOS ADVISOR',
    async generate(intentCtx) { return ruleBasedGenerate(intentCtx); },
  },
};
const ACTIVE_AI_PROVIDER = process.env.ARGOS_AI_PROVIDER && AIProviders[process.env.ARGOS_AI_PROVIDER]
  ? process.env.ARGOS_AI_PROVIDER : 'rule-based';
const aiProvider = () => AIProviders[ACTIVE_AI_PROVIDER];

// تنسيق زمن اللعبة (elapsed ms) كنص عربي: «12 مارس 1900»
const ADV_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function advDateStr(elapsed) {
  const d = gameDateOf(0, Math.max(0, Number(elapsed) || 0));
  return `${d.day} ${ADV_MONTHS[d.month - 1]} ${d.year}`;
}
// ---------- إعدادات المستشار (الأوضاع 1/2/3 + صلاحيات المجالات) ----------
const ADVISOR_DOMAINS = { economy: 'الاقتصاد', media: 'الإعلام', companies: 'الشركات', military: 'الجيش', diplomacy: 'الدبلوماسية', intel: 'الاستخبارات' };
async function getAdvisorSettings(cc) {
  let s = await one('SELECT * FROM advisor_settings WHERE country_code=$1', [cc]);
  if (!s) {
    await q(`INSERT INTO advisor_settings (country_code,mode,domains,advisor_name,updated_at)
             VALUES ($1,1,'{}',$2,$3)`, [cc, advisorNameFor(cc), Date.now()]);
    s = await one('SELECT * FROM advisor_settings WHERE country_code=$1', [cc]);
  }
  let domains = {};
  try { domains = JSON.parse(s.domains || '{}'); } catch (e) { domains = {}; }
  return { country_code: cc, mode: Number(s.mode) || 1, domains, advisor_name: s.advisor_name || advisorNameFor(cc) };
}
async function setAdvisorSettings(cc, mode, domains) {
  const m = [1, 2, 3].includes(Number(mode)) ? Number(mode) : 1;
  const d = {};
  for (const k of Object.keys(ADVISOR_DOMAINS)) d[k] = !!(domains && domains[k]);
  await q(`INSERT INTO advisor_settings (country_code,mode,domains,advisor_name,updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (country_code) DO UPDATE SET mode=$2, domains=$3, updated_at=$5`,
    [cc, m, JSON.stringify(d), advisorNameFor(cc), Date.now()]);
  return getAdvisorSettings(cc);
}

// ---------- ذاكرة المستشار (مرتبطة بالدولة فقط) ----------
async function advMemoryGet(cc, key) {
  const r = await one('SELECT mvalue FROM advisor_memory WHERE country_code=$1 AND mkey=$2', [cc, key]);
  return r ? r.mvalue : null;
}
async function advMemorySet(cc, key, value) {
  await q(`INSERT INTO advisor_memory (country_code,mkey,mvalue,updated_at) VALUES ($1,$2,$3,$4)
           ON CONFLICT (country_code,mkey) DO UPDATE SET mvalue=$3, updated_at=$4`,
    [cc, key, String(value).slice(0, 2000), Date.now()]);
}
async function advMemoryAll(cc) {
  return all('SELECT mkey,mvalue,updated_at FROM advisor_memory WHERE country_code=$1 ORDER BY updated_at DESC LIMIT 50', [cc]);
}

// ---------- READ TOOLS — لا ترى إلا ما يسمح به نظام اللعبة ----------
// القاعدة: المستشار يرى دولته بدقة كاملة، والدول الأخرى عبر ضباب الحرب فقط.
async function advSnapshot(cc) {
  const g = await gameNow();
  const econ = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  const army = await getArmy(cc);
  const diplo = await one('SELECT reputation FROM country_diplo WHERE country_code=$1', [cc]);
  const sec = await getSecurity(cc);
  const wars = await all(`SELECT * FROM wars WHERE (attacker_code=$1 OR defender_code=$1)
                          ORDER BY id DESC LIMIT 10`, [cc]);
  const treaties = await all(`SELECT id,type,from_code,to_code,status,secret FROM treaties
                              WHERE (from_code=$1 OR to_code=$1) AND status IN ('proposed','active')
                              ORDER BY id DESC LIMIT 20`, [cc]);
  const intel = await all(`SELECT id,target_code,kind,confidence,data,expires_game_time FROM intel_reports
                           WHERE spy_code=$1 AND expires_game_time > $2 ORDER BY id DESC LIMIT 10`, [cc, g]);
  const companies = await all('SELECT id,name,sector,city,capital_usd FROM companies WHERE country_code=$1 ORDER BY id DESC LIMIT 20', [cc]);
  const stockRows = await all('SELECT resource, stock FROM country_stocks WHERE country_code=$1', [cc]);
  const resInfo = (RESERVES[cc] && typeof RESERVES[cc] === 'object') ? RESERVES[cc] : {};
  const stocks = Object.keys(RES_AR).map((k) => {
    const sr = stockRows.find((x) => x.resource === k);
    return { resource_key: k, label: RES_AR[k], stock: sr ? Number(sr.stock) || 0 : 0, reserves: Number(resInfo[k]) || 0 };
  });
  const orders = await all(`SELECT id,listing_id,qty,total_m_usd,status,deliver_game_at FROM market_orders
                            WHERE buyer_country=$1 AND status='in_transit' ORDER BY id DESC LIMIT 10`, [cc]);
  const events = await all(`SELECT type AS kind,title,game_time FROM game_events
                            WHERE actor_code=$1 OR target_code=$1 ORDER BY id DESC LIMIT 15`, [cc]);
  const myUserIds = (await all(`SELECT id FROM users WHERE country_code=$1 AND role='player'`, [cc])).map((u) => Number(u.id));
  const dispatches = myUserIds.length
    ? await all(`SELECT body,created_at FROM dispatches WHERE user_id IN (${myUserIds.join(',')}) ORDER BY id DESC LIMIT 5`) : [];
  const notifs = myUserIds.length
    ? await all(`SELECT title,created_at FROM notifications WHERE user_id IN (${myUserIds.join(',')}) ORDER BY id DESC LIMIT 5`) : [];
  const wsum = await one(`SELECT COALESCE(SUM(workers),0) s FROM companies WHERE host_country=$1 AND status='approved'`, [cc]);
  const employed = (Number(wsum.s) || 0) * 100;
  const pop = econ && econ.population ? Number(econ.population) : null;
  const laborForce = pop ? Math.round(pop * 0.35) : null;
  const unempRate = laborForce ? Math.max(0, Math.round((laborForce - employed) / laborForce * 1000) / 10) : null;
  return {
    cc, name: cname(cc), game_time: g, game_date: advDateStr(g),
    economy: econ ? {
      liquidity: Number(econ.liquidity_m_usd) || 0, gdp: econ.gdp_m_intl,
      population: econ.population, currency: econ.currency_name, currency_symbol: econ.currency_symbol,
      fx: econ.fx_to_usd, tax_rate: Number(econ.tax_rate) || 0, stability: Number(econ.stability) || 0,
      public_support: Number(econ.public_support) || 0, inflation: Number(econ.inflation) || 0,
      unemployment: unempRate,
    } : null,
    army: { soldiers: army.soldiers, readiness: army.readiness, morale: army.morale, training: army.training },
    reputation: diplo ? Number(diplo.reputation) : 50, security_level: sec,
    wars: wars.map((w) => ({ id: w.id, vs: w.attacker_code === cc ? w.defender_code : w.attacker_code,
      role: w.attacker_code === cc ? 'مهاجم' : 'مدافع', status: w.status, war_score: w.war_score })),
    treaties: treaties.map((t) => ({ id: t.id, type: t.type, label: TREATY_TYPES[t.type] || t.type,
      with: t.from_code === cc ? t.to_code : t.from_code, status: t.status, secret: !!t.secret })),
    intel_reports: intel.map((r) => ({ id: r.id, target: r.target_code, target_name: cname(r.target_code),
      kind: r.kind, confidence: r.confidence, data: JSON.parse(r.data || '{}') })),
    companies, stocks, orders,
    events: events.map((e) => ({ kind: e.kind, title: e.title, date: advDateStr(Number(e.game_time)) })),
    dispatches: dispatches.map((d) => d.body.slice(0, 120)),
    notifications: notifs.map((n) => n.title),
    cities_count: (citiesOf(cc) || []).length,
  };
}
// نظرة على دولة أجنبية — ضباب الحرب فقط (نطاقات عامة أو تقارير استخبارية مسموحة)
async function advForeignPeek(viewerCC, targetCC) {
  if (!validCountry(targetCC) || targetCC === viewerCC) return null;
  const g = await gameNow();
  const a = await getArmy(targetCC);
  const band = (v) => v >= 80 ? 'ممتازة' : v >= 60 ? 'جيدة' : v >= 40 ? 'متوسطة' : v >= 20 ? 'ضعيفة' : 'منهارة';
  const rep = await one(`SELECT data, confidence FROM intel_reports
                         WHERE spy_code=$1 AND target_code=$2 AND kind='military' AND expires_game_time > $3
                         ORDER BY id DESC LIMIT 1`, [viewerCC, targetCC, g]);
  const diplo = await one('SELECT reputation FROM country_diplo WHERE country_code=$1', [targetCC]);
  const pubTreaties = await all(`SELECT type,from_code,to_code FROM treaties
    WHERE (from_code=$1 OR to_code=$1) AND status='active' AND (secret IS NOT TRUE) LIMIT 10`, [targetCC]);
  const atWar = await all(`SELECT attacker_code,defender_code FROM wars
    WHERE status='active' AND (attacker_code=$1 OR defender_code=$1) LIMIT 5`, [targetCC]);
  return {
    cc: targetCC, name: cname(targetCC),
    military: rep
      ? { source: 'تقرير استخباري', confidence: rep.confidence, data: JSON.parse(rep.data || '{}') }
      : { source: 'تقديرات عامة', soldiers_approx: Math.round(a.soldiers / 5000) * 5000,
          readiness: band(a.readiness), morale: band(a.morale) },
    reputation: diplo ? Number(diplo.reputation) : 50,
    public_treaties: pubTreaties.map((t) => ({ type: TREATY_TYPES[t.type] || t.type, with: t.from_code === targetCC ? t.to_code : t.from_code })),
    active_wars: atWar.map((w) => cname(w.attacker_code === targetCC ? w.defender_code : w.attacker_code)),
  };
}

// ---------- مولدات التحليل — كلها من World State الحقيقي، لا اختلاق ----------
// ملاحظة أمان: أي حقل غير موجود يُعرض «غير متاح» — لا تُخترع أرقام أبدًا.
const advNA = 'غير متاح';
function econBrief(s) {
  const e = s.economy || {};
  const problems = [], opportunities = [], risks = [], options = [];
  const liq = Number(e.liquidity) || 0, tax = Number(e.tax_rate) || 0, stab = Number(e.stability) || 0;
  const infl = Number(e.inflation) || 0, unemp = Number(e.unemployment) || 0;
  if (liq < 50) problems.push(`الخزينة منخفضة (${liq.toFixed(0)} مليون $) — هامش المناورة محدود.`);
  if (tax > 25) problems.push(`الضريبة ${tax}% تفرض ضغطًا مرتفعًا على الاستقرار.`);
  if (stab < 40) risks.push(`الاستقرار ${stab}/100 — خطر اضطرابات يتصاعد.`);
  if (stab <= 20) risks.push('خطر ثورة شعبية حقيقي — الأولوية القصوى للتهدئة.');
  if (infl > 8) problems.push(`التضخم ${infl}% يلتهم القوة الشرائية.`);
  if (unemp > 15) problems.push(`البطالة ${unemp}% — طاقة بشرية معطلة.`);
  if ((s.companies || []).length === 0) opportunities.push('لا شركات وطنية بعد — تأسيس شركة استخراج أو صناعة يولّد دخلًا.');
  if ((s.stocks || []).some((x) => Number(x.stock) > 0)) opportunities.push('لديك مخزون موارد قابل للبيع في السوق.');
  const activeWars = (s.wars || []).filter((w) => w.status === 'active').length;
  if (activeWars > 0) risks.push(`الحرب النشطة تستنزف الخزينة والاستقرار.`);
  // 3 خيارات محسوبة من الأرقام الفعلية
  const monthlyTax = tax > 0 && e.gdp ? (Number(e.gdp) * (tax / 100)) / 12 : null;
  options.push({ id: 'tax_up', label: 'رفع الضرائب 5%', risk: 'medium',
    desc: `إيراد إضافي ≈ ${monthlyTax != null ? (monthlyTax * 0.05 / (tax / 100) || 0).toFixed(0) : advNA} مليون $/شهر، لكن الاستقرار سيتآكل أكثر.` });
  options.push({ id: 'cut_military', label: 'مراجعة الإنفاق العسكري', risk: 'low',
    desc: 'الجيش يستهلك صيانة شهرية — في غياب حرب نشطة يمكن تخفيض الجاهزية مؤقتًا.' });
  options.push({ id: 'expand_industry', label: 'توسيع الإنتاج الصناعي', risk: 'low',
    desc: 'تأسيس شركات استخراج للموارد المتاحة يرفع الدخل دون المساس بالاستقرار.' });
  return { kind: 'economic', title: 'الموجز الاقتصادي', problems, opportunities, risks, options,
    note: 'كل الأرقام من سجلات دولتك الفعلية بتاريخ ' + s.game_date };
}
function milBrief(s) {
  const a = s.army || {};
  const strengths = [], weaknesses = [], risks = [], needs = [], options = [];
  if (a.readiness >= 70) strengths.push(`جاهزية عالية (${a.readiness}/100).`); else weaknesses.push(`الجاهزية ${a.readiness}/100 — تحتاج رفعًا قبل أي عملية.`);
  if (a.morale >= 70) strengths.push(`معنويات مرتفعة (${a.morale}/100).`); else weaknesses.push(`المعنويات ${a.morale}/100 — خطر الانهيار في المعارك الطويلة.`);
  if (a.training >= 70) strengths.push('تدريب متقدم.'); else weaknesses.push(`التدريب ${a.training}/100.`);
  if ((a.soldiers || 0) < 10000) weaknesses.push('قوة بشرية محدودة — تجنب الحروب الممتدة.');
  const activeWars = (s.wars || []).filter((w) => w.status === 'active');
  if (activeWars.length) {
    risks.push(`حرب نشطة ضد: ${activeWars.map((w) => cname(w.vs)).join('، ')}.`);
    options.push({ id: 'defensive', label: 'خطة دفاعية', risk: 'medium', desc: 'تحصين الجبهات ورفع الجاهزية — تنفذ بعد موافقتك.' });
    options.push({ id: 'seek_peace', label: 'استكشاف السلام', risk: 'low', desc: 'فتح قناة تفاوض عبر وزير الخارجية.' });
  } else {
    options.push({ id: 'readiness_drive', label: 'رفع الجاهزية', risk: 'low', desc: 'تدريب مكثف يرفع الجاهزية تدريجيًا.' });
  }
  if ((s.intel_reports || []).length === 0 && activeWars.length === 0) needs.push('لا تقارير استخبارية حديثة — ضباب الحرب كثيف.');
  return { kind: 'military', title: 'الموجز العسكري — رئيس الأركان',
    status: activeWars.length ? `في حرب (${activeWars.length})` : 'سلم',
    strengths, weaknesses, risks, needs, options,
    warn: 'لن أعلن حربًا أو أحرّك قوات دون تفويض صريح منك.' };
}
function intelBrief(s, aboutCC, aboutName) {
  // CONFIRMED = أحداث مسجلة فعليًا. غير ذلك حسب ثقة التقارير — لا اختلاق.
  const reps = (s.intel_reports || []).filter((r) => !aboutCC || r.target === aboutCC);
  const confLabel = (c) => c === 'عالية' ? 'LIKELY — مرجح' : c === 'متوسطة' ? 'POSSIBLE — ممكن' : 'UNCONFIRMED — غير مؤكد';
  const items = reps.map((r) => ({
    target: r.target_name, kind: r.kind, confidence: confLabel(r.confidence), data: r.data,
  }));
  const confirmed = (s.events || []).filter((e) => aboutCC ? e.title.includes(aboutName || '') : true).slice(0, 5);
  return { kind: 'intel', title: 'تقرير استخباري سري', about: aboutName || 'عام',
    confirmed: confirmed.map((e) => ({ level: 'CONFIRMED — مؤكد', text: `${e.date}: ${e.title}` })),
    assessments: items,
    note: items.length ? 'التقديرات من تقارير عملائك فقط — ما ليس فيها أقول لك إنه غير متاح.'
      : 'لا تقارير استخبارية مسجلة. أقترح عملية تجسس عبر الأدوات الرسمية — أجهزها لك بموافقتك.' };
}
function diploBrief(s) {
  const sug = [];
  const active = (s.treaties || []).filter((t) => t.status === 'active');
  const proposed = (s.treaties || []).filter((t) => t.status === 'proposed');
  if (!active.some((t) => t.type === 'trade')) sug.push('لا اتفاقية تجارية نشطة — أقترح استهداف شريك تجاري.');
  if (!active.some((t) => t.type === 'alliance')) sug.push('لا تحالف عسكري — في بيئة 1900 المتوترة هذا خطر.');
  if (s.reputation < 40) sug.push(`السمعة ${s.reputation}/100 منخفضة — تجنب كسر المعاهدات حاليًا.`);
  return { kind: 'diplomacy', title: 'الموجز الدبلوماسي — وزير الخارجية',
    reputation: s.reputation, active_treaties: active, pending: proposed, suggestions: sug,
    note: 'أُعدّ المسودات وأنتظر موافقتك — لا أتحكم بقرار الطرف الآخر.' };
}
function cabinetBrief(s) {
  const e = s.economy || {}, a = s.army || {};
  const activeWars = (s.wars || []).filter((w) => w.status === 'active').length;
  const liq = Number(e.liquidity) || 0, stab = Number(e.stability) || 0;
  const ministers = [
    { role: 'وزير الحرب', icon: '⚔️', say: activeWars ? `نخوض حربًا — أوصي برفع الجاهزية إلى 85 قبل أي هجوم جديد (حاليًا ${a.readiness}/100).` : `الجيش في سلم — الجاهزية ${a.readiness}/100 والمعنويات ${a.morale}/100. أوصي بتدريب مستمر.` },
    { role: 'وزير المالية', icon: '💰', say: liq < 50 ? `الخزينة ${liq.toFixed(0)} مليون $ فقط — لا أتحمل إنفاقًا عسكريًا جديدًا.` : `الخزينة ${liq.toFixed(0)} مليون $ — وضع يسمح بمناورة محدودة.` },
    { role: 'وزير الخارجية', icon: '🤝', say: (s.treaties || []).filter((t) => t.status === 'active').length ? 'لدينا معاهدات نشطة — أقترح تعميق التجارة مع الحلفاء.' : 'لا معاهدات نشطة كافية — هناك فرصة لاتفاق تجاري.' },
    { role: 'مدير الاستخبارات', icon: '🕵️', say: (s.intel_reports || []).length ? `لدينا ${(s.intel_reports || []).length} تقارير — بعضها غير مؤكد، أوصي بتحديث المراقبة.` : 'لا معلومات مؤكدة عن الخصوم — أطلب تفويض عمليات رصد.' },
    { role: 'وزير الصناعة', icon: '🏭', say: (s.companies || []).length ? `لدينا ${(s.companies || []).length} شركات — الإنتاج مستمر.` : 'لا شركات وطنية — أقترح تأسيس شركة استخراج فورًا.' },
    { role: 'وزير الإعلام', icon: '📰', say: (s.events || []).length ? 'سأحوّل آخر الأحداث المسجلة إلى بيانات رسمية — دون اختلاق.' : 'لا أحداث جديدة للصياغة الصحفية.' },
  ];
  const chief = stab <= 20 ? 'أوصي بتأجيل أي قرار تصعيدي — الاستقرار على حافة الانهيار.'
    : activeWars ? 'أوصي بتثبيت الجبهات دبلوماسيًا قبل أي مغامرة جديدة.'
    : 'الوضع قابل للإدارة — أوصي بالبناء الاقتصادي الهادئ.';
  return { kind: 'cabinet', title: 'اجتماع مجلس الوزراء', date: s.game_date, ministers, chief,
    note: 'القرار الأخير لك وحدك — «قرار القائد».' };
}
async function dailyBrief(s) {
  const g = s.game_time, dayMs = GAME_MONTH_MS / 30;
  const dayIdx = Math.floor(g / dayMs);
  const since = dayIdx * dayMs;
  const evs = await all(`SELECT type AS kind,title,game_time FROM game_events
    WHERE (actor_code=$1 OR target_code=$1) AND game_time >= $2 ORDER BY id DESC LIMIT 20`, [s.cc, since]);
  const sections = {
    '🌍 العالم': evs.filter((e) => ['treaty_proposed', 'treaty_signed'].includes(e.kind)).map((e) => e.title),
    '⚔️ العسكرية': evs.filter((e) => ['war_declared', 'battle', 'peace'].includes(e.kind)).map((e) => e.title),
    '💰 الاقتصاد': evs.filter((e) => ['tax_change', 'revolution'].includes(e.kind)).map((e) => e.title),
    '🕵️ الاستخبارات': evs.filter((e) => ['spy_caught'].includes(e.kind)).map((e) => e.title),
    '📰 الصحافة': (s.dispatches || []).slice(0, 3),
  };
  return { kind: 'daily', title: 'الموجز اليومي', date: s.game_date, sections,
    summary: evs.length ? `${evs.length} أحداث مسجلة اليوم في نطاق دولتك.` : 'يوم هادئ — لا أحداث مسجلة في نطاق دولتك.' };
}

// ---------- WRITE TOOLS — سجل الإجراءات المسموحة فقط ----------
// أي إجراء خارج هذا السجل = مرفوض + مسجل. لا وصول مباشر للـDB.
const ADVISOR_ACTIONS = {
  change_tax:       { domain: 'economy', risk: 'high', label: 'تغيير الضريبة',
    execute: async (cc, p, actor) => setCountryTax(cc, p.rate, actor.name, actor.userId) },
  publish_dispatch: { domain: 'media', risk: 'medium', label: 'نشر برقية',
    execute: async (cc, p, actor) => ({ id: await publishDispatchAs(actor.userId, p.body) }) },
  intel_spy:        { domain: 'intel', risk: 'medium', label: 'عملية استخبارية',
    execute: async (cc, p, actor) => runSpyOp(cc, p.target_code, p.kind, actor.name) },
  treaty_propose:   { domain: 'diplomacy', risk: 'high', label: 'اقتراح معاهدة',
    execute: async (cc, p, actor) => ({ id: await proposeTreaty(cc, p.to_code, p.type, p.secret, actor.name) }) },
};
// خط الأنابيب: صلاحية → قواعد اللعبة → موارد → موافقة → تنفيذ → تدقيق → إشعار
async function advisorPropose(cc, user, spec) {
  const settings = await getAdvisorSettings(cc);
  const def = ADVISOR_ACTIONS[spec.action];
  const g = await gameNow();
  if (settings.mode === 1) {
    await audit('advisor_blocked', settings.advisor_name, `${cname(cc)}: محاولة إجراء في وضع المستشار (اقتراح فقط) — ${spec.title}`);
    return { ok: false, error: 'أنا في وضع «مستشار» — أقترح فقط ولا أنفذ. بدّل الوضع إلى «مساعد تنفيذي» من صفحة المستشار.' };
  }
  if (!def) {
    await audit('advisor_blocked', settings.advisor_name, `${cname(cc)}: إجراء مرفوض خارج السجل — ${spec.action}`);
    return { ok: false, error: 'هذا الإجراء خارج صلاحياتي — رُفض وسُجّل.' };
  }
  const risk = spec.risk || def.risk;
  const r = await q(`INSERT INTO advisor_tasks (country_code,kind,title,detail,action,payload,risk,status,created_game_time,created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9) RETURNING id`,
    [cc, spec.kind || 'action', spec.title, spec.detail || '', spec.action, JSON.stringify(spec.payload || {}), risk, g, Date.now()]);
  const taskId = r.rows[0].id;
  await audit('advisor_propose', user.username, `${cname(cc)}: المستشار يقترح «${spec.title}» (مهمة #${taskId})`);
  // الوضع 3 + المجال مفوَّض + مخاطرة منخفضة = تنفيذ تلقائي
  if (settings.mode === 3 && settings.domains[def.domain] && risk === 'low') {
    return advisorExecute(taskId, { name: user.username + ' (تفويض تلقائي)', userId: user.id }, cc);
  }
  await notifyCountry(cc, 'advisor', 'قرار يحتاج موافقتك', spec.title, '#/advisor');
  return { ok: true, task_id: taskId, status: 'pending' };
}
async function advisorExecute(taskId, actor, cc) {
  const t = await one('SELECT * FROM advisor_tasks WHERE id=$1', [taskId]);
  if (!t || t.status !== 'pending') throw new Error('المهمة غير معلقة أو غير موجودة');
  if (t.country_code !== cc) throw new Error('غير مصرح — المهمة لدولة أخرى');
  const def = ADVISOR_ACTIONS[t.action];
  const g = await gameNow();
  if (!def) {
    await q(`UPDATE advisor_tasks SET status='blocked', decided_game_time=$1, decided_by=$2, result=$3 WHERE id=$4`,
      [g, actor.name, 'إجراء خارج السجل', taskId]);
    await audit('advisor_blocked', actor.name, `حظر تنفيذ ${t.action} لدولة ${cname(cc)} — خارج السجل`);
    return { ok: false, error: 'إجراء محظور — سُجّل في التدقيق.' };
  }
  try {
    const payload = JSON.parse(t.payload || '{}');
    const res = await def.execute(t.country_code, payload, actor);
    await q(`UPDATE advisor_tasks SET status='executed', decided_game_time=$1, decided_by=$2, result=$3 WHERE id=$4`,
      [g, actor.name, JSON.stringify(res).slice(0, 2000), taskId]);
    await audit('advisor_action', actor.name,
      `AI ACTION | دولة: ${cname(cc)} | المستشار: ${advisorNameFor(cc)} | الإجراء: ${def.label} «${t.title}» | الموافقة: ${actor.name} | زمن اللعبة: ${advDateStr(g)} | النتيجة: نجاح`);
    await notifyCountry(t.country_code, 'advisor', 'نفّذ المستشار إجراءً', `${t.title} — تم بنجاح.`, '#/advisor');
    return { ok: true, result: res };
  } catch (e) {
    await q(`UPDATE advisor_tasks SET status='failed', decided_game_time=$1, decided_by=$2, result=$3 WHERE id=$4`,
      [g, actor.name, String(e.message).slice(0, 500), taskId]);
    await audit('advisor_action_failed', actor.name,
      `AI ACTION | دولة: ${cname(cc)} | الإجراء: ${t.title} | النتيجة: فشل — ${e.message}`);
    return { ok: false, error: e.message };
  }
}
async function advisorDecide(taskId, cc, user, approve) {
  const t = await one('SELECT * FROM advisor_tasks WHERE id=$1', [taskId]);
  if (!t || t.country_code !== cc) throw new Error('غير مصرح');
  if (t.status !== 'pending') throw new Error('تم البت في هذا القرار مسبقًا');
  const g = await gameNow();
  if (!approve) {
    await q(`UPDATE advisor_tasks SET status='rejected', decided_game_time=$1, decided_by=$2 WHERE id=$3`, [g, user.username, taskId]);
    await audit('advisor_reject', user.username, `رفض قرار المستشار «${t.title}» لدولة ${cname(cc)}`);
    return { ok: true, status: 'rejected' };
  }
  return advisorExecute(taskId, { name: user.username, userId: user.id }, cc);
}

// ---------- كشف ذكر دولة في النص ----------
function findCountryMention(text) {
  for (const c of COUNTRIES) {
    if (c.name && text.includes(c.name)) return c;
    if (c.code && text.includes(c.code)) return c;
  }
  return null;
}
const advNum = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? advNA : Number(v).toLocaleString('en');

// ---------- ruleBasedGenerate — عقل المستشار الافتراضي (محلي بالكامل) ----------
async function ruleBasedGenerate(ctx) {
  const { cc, user, text, snap, settings } = ctx;
  const name = settings.advisor_name;
  const t = text.trim();
  // 1) ذاكرة: «تذكر ...»
  let m = t.match(/^(?:تذكر|احفظ)(?:\s*[:：]|\s+أن\s+)?(.+)/);
  if (m && m[1].trim().length > 2) {
    const val = m[1].trim();
    const key = /هدف|استراتيج|أولوي/.test(val) ? 'goal' : 'note_' + Date.now();
    await advMemorySet(cc, key, val);
    await audit('advisor_memory', user.username, `${cname(cc)}: المستشار حفظ في الذاكرة — ${val.slice(0, 80)}`);
    return { reply: `حفظت ذلك في ذاكرتي الخاصة بدولة ${snap.name}، سيدي. سأبني عليها توصياتي القادمة.` };
  }
  if (/تتذكر|ذاكرتك|أهدافي|ما هي أهدافي/.test(t)) {
    const mem = await advMemoryAll(cc);
    if (!mem.length) return { reply: 'ذاكرتي عن دولتك فارغة بعد، سيدي. قل لي: «تذكر أن هدفي...» وسأحفظه.' };
    return { reply: 'ما أحفظه عن دولتك، سيدي:\n' + mem.map((x) => `• ${x.mvalue}`).join('\n') };
  }
  // 2) اقتصاد
  if (/اقتصاد|المالية|الخزينة|الضرائب|ضريبة|التضخم|البطالة/.test(t)) {
    const b = econBrief(snap);
    const tm = t.match(/(\d+)\s*%/);
    if (/ارفع|زيادة|ز[يّ]د/.test(t) && /ضريب/.test(t) && tm) {
      const rate = Math.max(0, Math.min(100, parseInt(tm[1], 10)));
      const p = await advisorPropose(cc, user, { kind: 'tax', action: 'change_tax',
        title: `رفع ضريبة الدخل إلى ${rate}%`,
        detail: `من ${snap.economy ? snap.economy.tax_rate : advNA}% إلى ${rate}% — ${b.options[0].desc}`,
        payload: { rate }, risk: rate - (snap.economy ? snap.economy.tax_rate : 0) > 10 ? 'high' : 'medium' });
      if (!p.ok && !p.task_id) return { reply: `سيدي، ${p.error}` };
      return { reply: `أعددت القرار، سيدي — بانتظار موافقتك من «الإجراءات المعلقة».\n⚠️ هذا القرار يحمل مخاطرة ${p.status === 'executed' ? 'وقد نُفّذ بتفويضك' : 'متوسطة على الاستقرار'}.`, tasks: p.task_id ? [p.task_id] : [] };
    }
    let r = `الموجز الاقتصادي — ${snap.game_date}\n`;
    if (b.problems.length) r += '\nالمشاكل:\n' + b.problems.map((x) => `• ${x}`).join('\n');
    if (b.opportunities.length) r += '\n\nالفرص:\n' + b.opportunities.map((x) => `• ${x}`).join('\n');
    if (b.risks.length) r += '\n\n⚠️ المخاطر:\n' + b.risks.map((x) => `• ${x}`).join('\n');
    r += '\n\nالخيارات الاستراتيجية:\n' + b.options.map((o, i) => `${['أ','ب','ج'][i]}. ${o.label}: ${o.desc}`).join('\n');
    r += '\n\nقل «ارفع الضريبة إلى X%» لأجهّز القرار لموافقتك.';
    return { reply: r, brief: b };
  }
  // 3) عسكري
  if (/عسكري|الجيش|الأركان|جاهزية|الجنود|دفاع|هجوم/.test(t)) {
    const b = milBrief(snap);
    let r = `الموجز العسكري — ${b.status}\n`;
    if (b.strengths.length) r += '\nنقاط القوة:\n' + b.strengths.map((x) => `• ${x}`).join('\n');
    if (b.weaknesses.length) r += '\nنقاط الضعف:\n' + b.weaknesses.map((x) => `• ${x}`).join('\n');
    if (b.risks.length) r += '\nالمخاطر:\n' + b.risks.map((x) => `• ${x}`).join('\n');
    if (b.needs.length) r += '\nالاحتياجات:\n' + b.needs.map((x) => `• ${x}`).join('\n');
    r += '\n\n' + b.warn;
    return { reply: r, brief: b };
  }
  // 4) استخبارات
  if (/استخبار|تجسس|راقب|جاسوس|تقرير سري/.test(t)) {
    const mc = findCountryMention(t);
    if (/راقب|تجسس/.test(t) && mc && mc.code !== cc) {
      const kind = /اقتصاد/.test(t) ? 'economy' : /سياس/.test(t) ? 'political' : 'military';
      const p = await advisorPropose(cc, user, { kind: 'intel', action: 'intel_spy',
        title: `عملية تجسس ${kind === 'military' ? 'عسكرية' : kind === 'economy' ? 'اقتصادية' : 'سياسية'} ضد ${mc.name}`,
        detail: `الهدف: ${mc.name} — التكلفة تُخصم من الخزينة، وخطر الانكشاف يضر السمعة.`,
        payload: { target_code: mc.code, kind }, risk: 'medium' });
      if (!p.ok && !p.task_id) return { reply: `سيدي، ${p.error}` };
      return { reply: p.status === 'executed'
        ? `نُفّذت العملية بتفويضك، سيدي. ${p.result && p.result.report ? 'وصل تقرير — تجده في قسم الاستخبارات.' : 'للأسف فشلت هذه المرة.'}`
        : `سيدي، أعددت عملية التجسس ضد ${mc.name} — أحتاج موافقتك من «الإجراءات المعلقة». أذكّرك: لا أعرف الحقيقة إلا عبر أدوات اللعبة، ولن أختلق شيئًا.`,
        tasks: p.task_id ? [p.task_id] : [] };
    }
    const b = intelBrief(snap, mc ? mc.code : null, mc ? mc.name : null);
    let r = `تقرير استخباري سري — ${b.about}\n`;
    if (b.confirmed.length) r += '\nمؤكد (CONFIRMED):\n' + b.confirmed.map((x) => `• ${x.text}`).join('\n');
    if (b.assessments.length) r += '\nالتقديرات:\n' + b.assessments.map((x) => `• ${x.target} [${x.confidence}]`).join('\n');
    r += '\n\n' + b.note;
    return { reply: r, brief: b };
  }
  // 5) دبلوماسية
  if (/دبلوماس|معاهدة|تحالف|علاقات|اتفاق|فرنسا|خارجية/.test(t)) {
    const mc = findCountryMention(t);
    if (mc && mc.code !== cc && /حسّن|اتفاق|تحالف|عرض|تجاري/.test(t)) {
      const type = /تحالف/.test(t) ? 'alliance' : /عدم اعتداء/.test(t) ? 'non_aggression' : 'trade';
      const p = await advisorPropose(cc, user, { kind: 'diplomacy', action: 'treaty_propose',
        title: `اقتراح ${TREATY_TYPES[type]} على ${mc.name}`,
        detail: `سأحلّل العلاقة والمعاهدات القائمة ثم أرسل العرض عبر نظام اللعبة — القرار النهائي للطرف الآخر.`,
        payload: { to_code: mc.code, type, secret: 0 }, risk: 'high' });
      if (!p.ok && !p.task_id) return { reply: `سيدي، ${p.error}` };
      return { reply: p.status === 'executed' ? `أُرسل العرض إلى ${mc.name} بتفويضك، سيدي. بانتظار ردهم.`
        : `سيدي، جهّزت مسودة العرض لـ${mc.name} — بانتظار موافقتك. لا أستطيع التحكم بقرارهم.`,
        tasks: p.task_id ? [p.task_id] : [] };
    }
    const b = diploBrief(snap);
    let r = `الموجز الدبلوماسي — السمعة ${b.reputation}/100\n`;
    r += `\nمعاهدات نشطة: ${b.active_treaties.length} | معروضة: ${b.pending.length}`;
    if (b.suggestions.length) r += '\n\nتوصياتي:\n' + b.suggestions.map((x) => `• ${x}`).join('\n');
    r += '\n\n' + b.note + '\nجرّب: «جهّز اتفاقًا تجاريًا مع فرنسا».';
    return { reply: r, brief: b };
  }
  // 6) إعلام
  if (/بيان|برقية|صياغة|اكتب|إعلام|صحافة|خبر/.test(t)) {
    const topic = t.replace(/اكتب|بيان|برقية|صياغة|رسمي[ة]?|عنه|عن/g, '').trim();
    const ev = (snap.events || [])[0];
    const draft = topic
      ? `بيان رسمي من حكومة ${snap.name} — ${snap.game_date}\n\n«${topic}»\n\nصدر عن مكتب المستشار العام.`
      : ev ? `بيان رسمي من حكومة ${snap.name} — ${ev.date}\n\n«${ev.title}»\n\nصدر عن مكتب المستشار العام.`
      : null;
    if (!draft) return { reply: 'سيدي، لا أحداث مسجلة أصيغها حاليًا — حدّد لي الموضوع وسأصيغه دون اختلاق.' };
    if (/انشر|أرسل/.test(t)) {
      const p = await advisorPropose(cc, user, { kind: 'media', action: 'publish_dispatch',
        title: 'نشر برقية رسمية', detail: draft.slice(0, 200), payload: { body: draft }, risk: 'medium' });
      if (!p.ok && !p.task_id) return { reply: `سيدي، ${p.error}` };
      return { reply: p.status === 'executed' ? 'تم النشر بتفويضك، سيدي.' : 'جهّزت البرقية — بانتظار موافقتك للنشر.', tasks: p.task_id ? [p.task_id] : [] };
    }
    return { reply: `مسودة البيان (من حدث حقيقي مسجل — لم أختلق شيئًا):\n\n${draft}\n\nقل «انشر» لأجهّزها لموافقتك.` };
  }
  // 7) مجلس الوزراء
  if (/وزراء|اجتماع|مجلس/.test(t)) {
    const b = cabinetBrief(snap);
    let r = `🏛️ اجتماع مجلس الوزراء — ${b.date}\n`;
    r += b.ministers.map((x) => `\n${x.icon} ${x.role}:\n«${x.say}»`).join('\n');
    r += `\n\n🧠 المستشار العام (${name}):\n«${b.chief}»\n\n${b.note}`;
    return { reply: r, brief: b };
  }
  // 8) الموجز اليومي
  if (/الموجز اليومي|موجز اليوم|ملخص اليوم/.test(t)) {
    const b = await dailyBrief(snap);
    let r = `📰 الموجز اليومي — ${b.date}\n${b.summary}\n`;
    for (const [k, v] of Object.entries(b.sections)) if (v.length) r += `\n${k}\n` + v.map((x) => `• ${x}`).join('\n');
    return { reply: r, brief: b };
  }
  // 9) الحالة العامة
  if (/الحالة|الوضع|حال دولتي|ملخص/.test(t) || /تحليل الدولة/.test(t)) {
    const e = snap.economy || {};
    return { reply:
      `سيدي، هذا موجز دولتك ${snap.name} بتاريخ ${snap.game_date}:\n` +
      `• الخزينة: ${advNum(e.liquidity)} مليون $ | الضريبة: ${e.tax_rate != null ? e.tax_rate + '%' : advNA}\n` +
      `• الاستقرار: ${e.stability != null ? e.stability + '/100' : advNA} | السمعة: ${snap.reputation}/100\n` +
      `• الجيش: ${advNum(snap.army.soldiers)} جندي — جاهزية ${snap.army.readiness}/100\n` +
      `• الحروب النشطة: ${snap.wars.filter((w) => w.status === 'active').length} | الشركات: ${snap.companies.length}\n` +
      `ما لا أعرفه سأقول لك إنه غير متاح — لا أخترع أرقامًا.\nجرّب: «حلل الاقتصاد» أو «حلل وضعي العسكري» أو «اجتماع مجلس الوزراء».` };
  }
  // 10) الأوضاع
  if (/وضع المستشار|الأوضاع|مستشار فقط|مساعد تنفيذي|مدير مفوض/.test(t)) {
    return { reply:
      `أوضاعي الثلاثة، سيدي (تُبدَّل من صفحة المستشار):\n` +
      `1. مستشار — أقترح فقط، لا أنفذ شيئًا.\n` +
      `2. مساعد تنفيذي — أنفذ الإجراءات منخفضة الخطورة، والحساسة تبقى بموافقتك.\n` +
      `3. مدير مفوض — أدير المجالات التي تفوّضني فيها تلقائيًا (الاقتصاد، الإعلام، الشركات...)، والحساسة دائمًا بموافقتك.\n` +
      `أنا الآن في الوضع ${settings.mode}.` };
  }
  // افتراضي: تحية + توجيه
  const mem = await advMemoryGet(cc, 'goal');
  return { reply:
    `سيدي، أنا ${name} — مستشار ${snap.name} العام. ● متصل\n` +
    (mem ? `أتذكر أن هدفك: ${mem}\n` : '') +
    `أقرأ دولتك لحظة بلحظة من سجلات اللعبة الحقيقية.\n\n` +
    `جرّب أن تقول:\n• «حلل الاقتصاد»\n• «حلل وضعي العسكري»\n• «راقب بريطانيا»\n• «جهّز اتفاقًا تجاريًا مع فرنسا»\n• «اجتماع مجلس الوزراء»\n• «الموجز اليومي»` };
}

// ---------- API المستشار ----------
// ملاحظة: كل endpoint يتحقق server-side من ملكية الدولة — المستشار لا يتجاوز صلاحيات اللاعب أبدًا.
function advCountryOf(req) {
  const dev = isDeveloper(req.user);
  const qcc = req.query && req.query.as_code ? String(req.query.as_code).toUpperCase() : null;
  const bcc = req.body && req.body.as_code ? String(req.body.as_code).toUpperCase() : null;
  const cc = (dev && (qcc || bcc)) || req.user.country_code;
  return validCountry(cc) ? cc : null;
}
// الحالة: المستشار + بطاقات الموجز + العدادات
app.get('/api/advisor/state', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا ليكون لك مستشار' });
    const settings = await getAdvisorSettings(cc);
    const snap = await advSnapshot(cc);
    const pend = await one(`SELECT COUNT(*) AS c FROM advisor_tasks WHERE country_code=$1 AND status='pending'`, [cc]);
    const active = await one(`SELECT COUNT(*) AS c FROM advisor_tasks WHERE country_code=$1 AND status='executed'
                              AND created_at > $2`, [cc, Date.now() - 86400000]);
    const e = snap.economy || {};
    res.json({
      advisor: { name: settings.advisor_name, title: 'المستشار العام', status: 'متصل',
        model: aiProvider().label, role: 'Chief State Advisor',
        autonomy: settings.mode === 1 ? 'مستشار' : settings.mode === 2 ? 'مساعد تنفيذي' : 'مدير مفوض',
        mode: settings.mode, domains: settings.domains },
      country: { code: cc, name: snap.name, date: snap.game_date },
      cards: {
        treasury: e.liquidity != null ? `${advNum(e.liquidity)} مليون $` : advNA,
        economy: e.gdp ? `ناتج ${advNum(e.gdp)} مليون $` : advNA,
        military: `${advNum(snap.army.soldiers)} جندي — جاهزية ${snap.army.readiness}`,
        stability: e.stability != null ? `${e.stability}/100` : advNA,
        war: snap.wars.filter((w) => w.status === 'active').length
          ? `حرب نشطة (${snap.wars.filter((w) => w.status === 'active').length})` : 'سلم',
        diplomacy: `${snap.treaties.filter((t) => t.status === 'active').length} معاهدات نشطة — سمعة ${snap.reputation}`,
        intel: `${snap.intel_reports.length} تقارير — أمن مضاد ${snap.security_level}`,
      },
      pending_approvals: Number((pend && pend.c) || 0),
      active_tasks: Number((active && active.c) || 0),
      last_update: snap.game_date,
    });
  } catch (err) { res.status(500).json({ error: 'المستشار غير متاح مؤقتًا' }); }
}));
// المحادثة
app.post('/api/advisor/chat', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا' });
    const text = String((req.body && req.body.text) || '').slice(0, 1000).trim();
    if (!text) return res.status(400).json({ error: 'اكتب رسالتك' });
    const settings = await getAdvisorSettings(cc);
    const snap = await advSnapshot(cc);
    await q('INSERT INTO advisor_chat (country_code,role,text,created_at) VALUES ($1,$2,$3,$4)', [cc, 'user', text, Date.now()]);
    let out;
    try {
      out = await aiProvider().generate({ cc, user: req.user, text, snap, settings });
    } catch (e) {
      out = { reply: 'المستشار غير متاح مؤقتًا — اللعبة تعمل طبيعيًا. حاول مجددًا.' };
    }
    await q('INSERT INTO advisor_chat (country_code,role,text,created_at) VALUES ($1,$2,$3,$4)', [cc, 'advisor', out.reply.slice(0, 4000), Date.now()]);
    await q(`DELETE FROM advisor_chat WHERE country_code=$1 AND id NOT IN
             (SELECT id FROM advisor_chat WHERE country_code=$1 ORDER BY id DESC LIMIT 100)`, [cc, cc]);
    res.json({ ok: true, reply: out.reply, brief: out.brief || null, tasks: out.tasks || [] });
  } catch (err) { res.status(500).json({ error: 'المستشار غير متاح مؤقتًا' }); }
}));
app.get('/api/advisor/history', ah(auth), ah(async (req, res) => {
  const cc = advCountryOf(req);
  if (!cc) return res.json({ messages: [] });
  const rows = await all('SELECT role,text,created_at FROM advisor_chat WHERE country_code=$1 ORDER BY id DESC LIMIT 30', [cc]);
  res.json({ messages: rows.reverse() });
}));
// المهام المعلقة (Approval Cards)
app.get('/api/advisor/tasks', ah(auth), ah(async (req, res) => {
  const cc = advCountryOf(req);
  if (!cc) return res.json({ tasks: [] });
  const st = req.query.status === 'all' ? null : 'pending';
  const rows = st
    ? await all('SELECT * FROM advisor_tasks WHERE country_code=$1 AND status=$2 ORDER BY id DESC LIMIT 20', [cc, st])
    : await all('SELECT * FROM advisor_tasks WHERE country_code=$1 ORDER BY id DESC LIMIT 30', [cc]);
  res.json({ tasks: rows.map((t) => ({ id: t.id, kind: t.kind, title: t.title, detail: t.detail,
    action: t.action, risk: t.risk, status: t.status, date: advDateStr(Number(t.created_game_time)),
    decided_by: t.decided_by, result: t.result })) });
}));
app.post('/api/advisor/tasks/:id/approve', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا' });
    const r = await advisorDecide(parseInt(req.params.id, 10) || 0, cc, req.user, true);
    res.json(Object.assign({ ok: true }, r));
  } catch (e) { res.status(400).json({ error: e.message }); }
}));
app.post('/api/advisor/tasks/:id/reject', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا' });
    const r = await advisorDecide(parseInt(req.params.id, 10) || 0, cc, req.user, false);
    res.json(Object.assign({ ok: true }, r));
  } catch (e) { res.status(400).json({ error: e.message }); }
}));
// الأوضاع والصلاحيات
app.post('/api/advisor/settings', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا' });
    const s = await setAdvisorSettings(cc, (req.body || {}).mode, (req.body || {}).domains);
    await audit('advisor_settings', req.user.username, `${cname(cc)}: وضع المستشار → ${s.mode}`);
    res.json({ ok: true, settings: { mode: s.mode, domains: s.domains, advisor_name: s.advisor_name } });
  } catch (e) { res.status(500).json({ error: 'تعذر الحفظ' }); }
}));
// الموجزات: daily | economic | military | intel | diplomacy | cabinet
app.get('/api/advisor/brief/:kind', ah(auth), ah(async (req, res) => {
  try {
    const cc = advCountryOf(req);
    if (!cc) return res.status(400).json({ error: 'اختر دولة أولًا' });
    const kind = String(req.params.kind || '');
    const snap = await advSnapshot(cc);
    if (kind === 'daily') {
      const g = snap.game_time, dayIdx = Math.floor(g / (GAME_MONTH_MS / 30));
      const cached = await one('SELECT content FROM advisor_briefs WHERE country_code=$1 AND kind=$2 AND game_day=$3', [cc, 'daily', dayIdx]);
      if (cached) return res.json({ ok: true, cached: true, brief: JSON.parse(cached.content) });
      const b = await dailyBrief(snap);
      await q(`INSERT INTO advisor_briefs (country_code,kind,game_day,content,created_at) VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT DO NOTHING`, [cc, 'daily', dayIdx, JSON.stringify(b), Date.now()]);
      return res.json({ ok: true, cached: false, brief: b });
    }
    const makers = { economic: () => econBrief(snap), military: () => milBrief(snap),
      diplomacy: () => diploBrief(snap), cabinet: () => cabinetBrief(snap) };
    if (kind === 'intel') {
      const mc = req.query.about && validCountry(String(req.query.about).toUpperCase()) ? String(req.query.about).toUpperCase() : null;
      return res.json({ ok: true, brief: intelBrief(snap, mc, mc ? cname(mc) : null) });
    }
    if (!makers[kind]) return res.status(400).json({ error: 'نوع موجز غير صالح' });
    res.json({ ok: true, brief: makers[kind]() });
  } catch (e) { res.status(500).json({ error: 'المستشار غير متاح مؤقتًا' }); }
}));
// الذاكرة
app.get('/api/advisor/memory', ah(auth), ah(async (req, res) => {
  const cc = advCountryOf(req);
  if (!cc) return res.json({ memory: [] });
  res.json({ memory: await advMemoryAll(cc) });
}));

// ---------- سوق السلاح ----------
// التسليم بزمن اللعبة فقط (GAME_TIME واحد) — يتجمد مع إيقاف الساعة
async function processDeliveries() {
  const g = await gameNow();
  // ترحيل الطلبات القديمة (كانت بزمن واقعي) إلى زمن اللعبة — لمرة واحدة
  try {
    await q(`UPDATE market_orders SET deliver_game_at = $1 + GREATEST(0, deliver_at - $2)
             WHERE status='in_transit' AND deliver_game_at IS NULL`, [g, Date.now()]);
  } catch (e) { /* غير حرج */ }
  const due = await all(`SELECT * FROM market_orders WHERE status='in_transit' AND deliver_game_at <= $1`, [g]);
  for (const o of due) {
    const isRes = o.kind === 'resource' && o.resource && RES_AR[o.resource];
    if (isRes) {
      await addStock(o.seller_country, o.resource, -o.qty);
      await addStock(o.buyer_country, o.resource, o.qty);
      await q(`UPDATE market_orders SET status='delivered' WHERE id=$1`, [o.id]);
      await emitEvent('market_delivery', o.seller_country, o.buyer_country, `تسليم ${o.qty} ${o.unit || ''} ${o.title || ''}`, { order_id: o.id });
      await notify(o.buyer_id, 'market_delivery', 'وصلت شحنة الموارد',
        `اكتمل تسليم ${o.qty.toLocaleString('en-US')} ${o.unit || ''} ${o.title || ''} إلى مخزون ${cname(o.buyer_country)}.`, `#/market`);
      continue;
    }
    const w = await one('SELECT * FROM weapons WHERE id=$1', [o.weapon_id]);
    if (w) {
      // خصم الكمية من ترسانة البائع (كانت ثغرة: البائع يحتفظ بسلاحه والمشتري يستلم نسخة)
      await q('UPDATE weapons SET quantity = GREATEST(0, COALESCE(quantity,0) - $2) WHERE id=$1', [o.weapon_id, o.qty]);
      await q(`INSERT INTO weapons (country_code,name,class,wtype,model,quantity,image_url,
               created_by,created_at,source_url,confidence,note)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.buyer_country, w.name, w.class, w.wtype, w.model, o.qty, w.image_url,
         o.buyer_id, Date.now(), w.source_url, w.confidence,
         `شراء من ${cname(o.seller_country)} عبر سوق السلاح`]);
    }
    await q(`UPDATE market_orders SET status='delivered' WHERE id=$1`, [o.id]);
    await emitEvent('market_delivery', o.seller_country, o.buyer_country, `تسليم ${o.qty} × ${w ? w.name : 'سلاح'}`, { order_id: o.id });
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
  // الحظر التجاري: عروض الدولة المحظورة (في أي اتجاه) لا تظهر للمشتري
  let embargoed = new Set();
  if (req.user.country_code) {
    const eb = await all(`SELECT from_code, to_code FROM treaties WHERE status='active' AND type='embargo'
                          AND (from_code=$1 OR to_code=$1)`, [req.user.country_code]);
    embargoed = new Set(eb.map((e) => e.from_code === req.user.country_code ? e.to_code : e.from_code));
  }
  res.json({ listings: rows
    .filter((l) => !embargoed.has(l.seller_country))
    .map((l) => ({
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
  // منع التكرار: نفس المفتاح = نفس الرد (يحمي من الضغط المزدوج)
  const idemKey = (req.body && req.body.idempotency_key) || req.headers['x-idempotency-key'] || null;
  const { duplicate, response } = await withIdempotency(idemKey, async () => {
    const l = await one('SELECT * FROM market_listings WHERE id=$1', [req.params.id]);
    if (!l || l.status !== 'active') throw { status: 404, message: 'العرض غير متاح' };
    if (l.seller_id === req.user.id) throw { status: 400, message: 'لا يمكنك شراء عرضك الخاص' };
    if (!req.user.country_code) throw { status: 400, message: 'تحتاج دولة لاستلام الشحنة' };
    const qty = Math.max(1, parseInt((req.body || {}).qty, 10) || 0);
    // حجز ذري للكمية: جملة واحدة تتحقق وتخصم — تمنع بيع نفس الكمية مرتين
    const claim = await q(`UPDATE market_listings SET qty = qty - $1
                           WHERE id=$2 AND status='active' AND qty >= $1 RETURNING qty`,
      [qty, l.id]);
    if (!claim.rowCount) throw { status: 400, message: 'الكمية لم تعد متاحة في العرض' };
    const total = qty * Number(l.price_unit_m_usd);
    const paid = await deductLiquidity(req.user.country_code, total); // ذري
    if (!paid) {
      // إرجاع الكمية المحجوزة
      await q(`UPDATE market_listings SET qty = qty + $1 WHERE id=$2`, [qty, l.id]);
      throw { status: 400, message: 'سيولة دولتك لا تكفي لإتمام الشراء' };
    }
    await addLiquidity(l.seller_country, total);
    await logLiq(req.user.country_code, -total, `شراء ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} من السوق`, req.user.username);
    await logLiq(l.seller_country, total, `بيع ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} في السوق`, req.user.username);
    let days = deliveryGameDays(req.user.country_code, l.seller_country);
    // الاتفاقية التجارية تختصر زمن التسليم
    if (await activeTreaty(req.user.country_code, l.seller_country, 'trade')) days = Math.max(3, days - 2);
    const isRes = l.kind === 'resource';
    const g = await gameNow();
    const r = await q(`INSERT INTO market_orders (listing_id,weapon_id,seller_id,seller_country,
                       buyer_id,buyer_country,qty,total_m_usd,game_days,kind,title,unit,resource,status,deliver_at,deliver_game_at,created_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'in_transit',$14,$15,$16) RETURNING id`,
      [l.id, l.weapon_id, l.seller_id, l.seller_country, req.user.id, req.user.country_code,
       qty, total, days, l.kind || 'weapon', l.title, l.unit, l.resource,
       Date.now() + days * GAME_DAY_MS, g + days * GAME_DAY_MS, Date.now()]);
    const left = Number(claim.rows[0].qty);
    if (left <= 0) await q(`UPDATE market_listings SET status='sold' WHERE id=$1`, [l.id]);
    await emitEvent('market_buy', req.user.country_code, l.seller_country,
      `${cname(req.user.country_code)} تشتري ${qty} × ${l.title || 'سلعة'}`, { order_id: r.rows[0].id, total });
    await audit('market_buy', req.user.username, `شراء ${qty} × ${l.title || 'سلعة'} من ${cname(l.seller_country)} مقابل ${total} مليون دولار`, req);
    await notify(l.seller_id, 'market_sale', isRes ? 'بيع مورد جديد' : 'بيع سلاح جديد',
      `${req.user.username} (${cname(req.user.country_code)}) اشترى ${qty.toLocaleString('en-US')} × ${l.title || 'سلعة'} مقابل ${total} مليون دولار. المبلغ أُضيف لسيولة ${cname(l.seller_country)}.`,
      `#/market`);
    return { ok: true, order_id: r.rows[0].id, game_days: days };
  });
  if (duplicate) return res.json(Object.assign({ duplicate: true }, response));
  res.json(response);
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
// داخلي: نشر برقية — نفس التحقق للـendpoint والمستشار
async function publishDispatchAs(userId, body, image) {
  if (!body || body.trim().length < 2) throw new Error('اكتب نص البرقية');
  if (body.length > 500) throw new Error('البرقية 500 حرف كحد أقصى');
  const r = await one(
    'INSERT INTO dispatches (user_id,body,image,created_at) VALUES ($1,$2,$3,$4) RETURNING id',
    [userId, body.trim(), cleanImage(image), Date.now()]
  );
  return r.id;
}
app.post('/api/dispatches', ah(auth), ah(async (req, res) => {
  const { body, image } = req.body || {};
  try {
    const id = await publishDispatchAs(req.user.id, body, image);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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
  const other = await one("SELECT id,username,country_code,avatar FROM users WHERE username=$1 AND role NOT IN ('system','developer')", [req.params.username])
    || await one("SELECT id,username,country_code,avatar FROM users WHERE username=$1 AND role='ai_embassy'", [req.params.username]);
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
// ============================================================================
// سفارات الدول الذكية — مراسلة الحكام عبر الرسائل
// لكل دولة ذكية «سفارة» (مستخدم نظام) يرد عليها حاكمها دبلوماسيًا، وأحيانًا
// بأفعال حقيقية: قبول/اقتراح السلام، معاهدات عدم اعتداء وتجارة.
// ============================================================================
const EMBASSY_COOLDOWN_MS = 45000;
async function ensureAiEmbassy(cc) {
  const uname = `🤖 ${cname(cc)}`;
  let u = await one('SELECT * FROM users WHERE username=$1', [uname]);
  if (!u) {
    const r = await q(`INSERT INTO users (username,email,password_hash,country_code,role,created_at)
                       VALUES ($1,$2,'!',$3,'ai_embassy',$4) RETURNING *`,
      [uname, `ai_${cc}@argos.internal`.toLowerCase(), cc, Date.now()]);
    u = r.rows[0];
  }
  return u;
}
async function aiEmbassyActive(cc) {
  const ai = await one('SELECT enabled FROM ai_nations WHERE country_code=$1', [cc]);
  if (!ai || !ai.enabled) return false;
  return !(await aiClaimedSet()).has(cc);
}
// قائمة السفارات النشطة
app.get('/api/ai/embassies', ah(auth), ah(async (req, res) => {
  const rows = await all(`SELECT country_code, strategy FROM ai_nations WHERE enabled=1 ORDER BY country_code`);
  const claimed = await aiClaimedSet();
  const out = [];
  for (const r of rows) {
    if (claimed.has(r.country_code)) continue;
    const u = await ensureAiEmbassy(r.country_code);
    out.push({ username: u.username, country_code: r.country_code, name: cname(r.country_code), strategy: r.strategy });
  }
  res.json(out);
}));
// العقل الدبلوماسي: رد نصي + أفعال حقيقية أحيانًا
async function aiDiplomaticReply(playerCC, aiCC, body) {
  // 🧠 رد لغوي طبيعي + فعل آمن — عند الفشل يُستخدم القاعدي
  if (await llmEnabled()) {
    try {
      const lr = await llmEmbassyReply(playerCC, aiCC, body);
      const act = String(lr.action || 'none');
      const w = await activeWarBetween(aiCC, playerCC);
      if (act === 'peace' && w) { try { await peaceInternal(w.id, aiCC, LLM_ACTOR); } catch (e) { /* رفضها المحرك */ } }
      else if (['non_aggression', 'trade', 'alliance'].includes(act)) {
        try { await proposeTreaty(aiCC, playerCC, act, 0, LLM_ACTOR); } catch (e) { /* مكررة */ }
      }
      await audit('ai_embassy_llm', LLM_ACTOR, `رد لغوي لسفارة ${cname(aiCC)} على ${cname(playerCC)} [${act}]`);
      return lr.reply;
    } catch (e) { /* عودة للقاعدي */ }
  }
  const strategy = aiStrategyFor(aiCC);
  const aiName = cname(aiCC);
  const w = await activeWarBetween(aiCC, playerCC);
  const t = String(body || '').toLowerCase();
  const has = (...ws) => ws.some(x => t.includes(x));
  const flavor = { conservative: 'بحكمة وحذر', balanced: 'بواقعية', expansionist: 'بثقة وكبرياء' }[strategy] || 'بواقعية';
  const stab = await getEconStat(aiCC, 'stability', 70);
  let reply;
  const tryAct = async (fn, okText, failText) => {
    try { await fn(); return okText; } catch (e) { return failText; }
  };
  if (has('سلام', 'صلح', 'هدنة', 'peace', 'paix')) {
    if (w) {
      const myDiff = w.attacker_code === aiCC ? Number(w.score_a) - Number(w.score_b) : Number(w.score_b) - Number(w.score_a);
      const res = await tryAct(() => peaceInternal(w.id, aiCC, AI_ACTOR),
        myDiff >= 50 ? 'done_win' : 'done', 'fail');
      if (res === 'done_win') reply = `قبلنا السلام — الحرب انتهت لصالحنا، والتعويضات دُفعت. لنطوِ هذه الصفحة ${flavor}.`;
      else if (res === 'done') reply = w.proposed_by
        ? `قبلنا عرض السلام رسميًا — انتهت الحرب بيننا. نتمنى أن تدوم ${flavor}.`
        : `عرضنا السلام رسميًا على طاولة الحرب — بانتظار قبولكم لإنهاء هذا الصراع ${flavor}.`;
      else reply = `السلام يحتاج إجراءات رسمية — راجعوا صفحة الحرب، فعرضنا قائم ${flavor}.`;
    } else {
      reply = await tryAct(() => proposeTreaty(aiCC, playerCC, 'non_aggression', 0, AI_ACTOR),
        `السلام غايتنا ${flavor} — أرسلنا لكم معاهدة عدم اعتداء رسمية، وقّعوها ولنبدأ صفحة جديدة.`,
        `بيننا سلام ومعاهدات سارية — نحرص على استمرارها ${flavor}.`);
    }
  } else if (has('تحالف', 'حلف', 'alliance')) {
    const accept = strategy === 'balanced' && Math.random() < 0.3;
    reply = accept
      ? await tryAct(() => proposeTreaty(aiCC, playerCC, 'alliance', 0, AI_ACTOR),
          `تحالف؟ قرار مدروس ${flavor} — أرسلنا معاهدة تحالف رسمية. التاريخ سيذكر هذا اليوم.`,
          `ظروفنا لا تسمح بتحالف كامل الآن — لكن عدم الاعتداء بيننا خطوة أولى حكيمة.`)
      : `نقدّر عرضكم، لكن سياستنا ${flavor} لا تسمح بتحالفات متسرعة — لنبدأ بعدم اعتداء يبني الثقة.`;
  } else if (has('تجار', 'سوق', 'اقتصاد', 'trade', 'commerce')) {
    reply = await tryAct(() => proposeTreaty(aiCC, playerCC, 'trade', 0, AI_ACTOR),
      `التجارة لغة العقلاء — أرسلنا اتفاقية تجارية رسمية. أسواقنا مفتوحة لكم ${flavor}.`,
      `اتفاقنا التجاري قائم — زوروا السوق وستجدون عروضنا بانتظاركم.`);
  } else if (has('تهديد', 'سأهاجم', 'سنهاجم', 'احذرو', 'ويلكم', 'سأدمر')) {
    reply = strategy === 'expansionist'
      ? `تهديد؟ نحن لا نركع — جيوشنا جاهزة والتاريخ يشهد. فكّروا مليًا قبل أي حماقة.`
      : `نأسف لهذه اللغة — لكن اعلموا أن دفاعنا صلب، والحرب لن تكون نزهة لأحد ${flavor}.`;
  } else if (has('شكرا', 'ممتاز', 'أحسنت', 'احسنت', 'صديق', 'أصدقاء')) {
    reply = `يسعدنا سماع ذلك ${flavor} — الصداقة بين الأمم كنز نحافظ عليه.`;
  } else if (has('حرب', 'war', 'guerre') && !w) {
    reply = `الحرب كلمة ثقيلة ${flavor} — نفضل أن نحل خلافاتنا بالحوار والمعاهدات.`;
  } else {
    const state = stab < 40 ? ' نمر بظروف داخلية دقيقة، لكن أبوابنا مفتوحة للحوار.' : '';
    const defs = {
      conservative: `نستلم رسالتكم وندرسها بحكمة.${state} دولتنا منشغلة ببناء اقتصادها وأمنها — اقترحوا شيئًا ملموسًا كمعاهدة أو تجارة.`,
      balanced: `رسالتكم وصلت.${state} نحن منفتحون على الحوار — السلام والتجارة لغتنا. اطرحوا ما لديكم بوضوح.`,
      expansionist: `نتسلم رسالتكم.${state} دولتنا قوية وماضية في طريقها — من يريد الحديث معنا فليأتِ بلغة المصالح.`,
    };
    reply = defs[strategy] || defs.balanced;
  }
  return reply;
}

// إرسال رسالة
app.post('/api/messages', ah(auth), ah(async (req, res) => {
  const { to, body, image } = req.body || {};
  let other = await one("SELECT id,role,country_code FROM users WHERE username=$1 AND role NOT IN ('system','developer','ai_embassy')", [to]);
  let embassyCC = null;
  if (!other) {
    const emb = await one("SELECT id,country_code FROM users WHERE username=$1 AND role='ai_embassy'", [to]);
    if (emb) {
      if (!(await aiEmbassyActive(emb.country_code)))
        return res.status(400).json({ error: 'هذه الدولة أصبحت بيد لاعب — ابحث عنه وراسله مباشرة' });
      other = emb; embassyCC = emb.country_code;
    }
  }
  if (!other) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (other.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك مراسلة نفسك' });
  const b = String(body || '').trim().slice(0, 1000);
  const img = cleanImage(image);
  if (!b && !img) return res.status(400).json({ error: 'الرسالة فارغة' });
  const r = await one(
    'INSERT INTO messages (sender_id,receiver_id,body,image,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',
    [req.user.id, other.id, b, img, Date.now()]
  );
  // رد الحاكم الذكي — بمهلة لمنع الإغراق
  if (embassyCC && b) {
    const last = await one(`SELECT created_at FROM messages WHERE sender_id=$1 AND receiver_id=$2
                            ORDER BY created_at DESC LIMIT 1`, [other.id, req.user.id]);
    if (!last || Date.now() - Number(last.created_at) > EMBASSY_COOLDOWN_MS) {
      try {
        const reply = await aiDiplomaticReply(req.user.country_code, embassyCC, b);
        await q('INSERT INTO messages (sender_id,receiver_id,body,created_at) VALUES ($1,$2,$3,$4)',
          [other.id, req.user.id, reply, Date.now()]);
        await audit('ai_embassy', AI_ACTOR, `رد سفارة ${cname(embassyCC)} على ${req.user.username}`);
      } catch (e) { /* الرد تجميلي — لا يفشل الإرسال */ }
    }
  }
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
  if (err && err.status) return res.status(err.status).json({ error: err.message || 'خطأ' });
  console.error('خطأ:', err && err.message);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// ============================================================================
// الدول الذكية AI Nations — حكام مستقلون للدول غير المحجوزة
// ----------------------------------------------------------------------------
// كل شهر لعبة، كل دولة بلا لاعب تحصل على «دور» مستقل بنفس قواعد اللعبة تمامًا:
// جباية الضرائب، ضبط الضريبة حسب الاستقرار، جمع إنتاج شركات الاستخراج،
// وتأسيس شركات وطنية جديدة عند توفر السيولة. كل إجراء مسجل في audit_log.
// عندما يحجز لاعب دولة كانت ذكية، يتوقف حاكمها تلقائيًا ويرث اللاعب ما بناه.
// ============================================================================
const AI_ACTOR = '🤖 الحاكم الذكي';
async function initAiNations() {
  await q(`CREATE TABLE IF NOT EXISTS ai_nations (
    country_code TEXT PRIMARY KEY, enabled INT DEFAULT 1,
    strategy TEXT DEFAULT 'balanced', last_tick_month BIGINT, updated_at BIGINT)`);
  const claimed = await aiClaimedSet();
  for (const c of COUNTRIES) {
    if (claimed.has(c.code)) continue;
    await q(`INSERT INTO ai_nations (country_code, enabled, strategy, updated_at)
             VALUES ($1, 1, $2, $3) ON CONFLICT (country_code) DO NOTHING`,
      [c.code, aiStrategyFor(c.code), Date.now()]);
  }
}
// استراتيجية حتمية حسب كود الدولة — نفس الدولة دائمًا نفس الشخصية
function aiStrategyFor(cc) {
  let h = 0; for (const ch of cc) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 3 === 0 ? 'conservative' : h % 3 === 1 ? 'balanced' : 'expansionist';
}
async function aiClaimedSet() {
  const rows = await all(`SELECT DISTINCT country_code FROM users WHERE country_code IS NOT NULL AND role NOT IN ('system','developer','ai_embassy')`);
  return new Set(rows.map((r) => r.country_code));
}
// ============================================================================
// 🧠 الحاكم اللغوي LLM — نموذج ذكاء اصطناعي حقيقي (مفتوح المصدر عبر OpenRouter)
// ----------------------------------------------------------------------------
// كل شهر لعبة، الدولة الذكية ترسل حالتها للنموذج فيقترح قرارات JSON.
// المحرك يتحقق من كل قرار ضد قواعد اللعبة نفسها قبل التنفيذ — النموذج
// يقترح والمحرك يقرر. أي فشل (شبكة/مهلة/تحليل) = عودة فورية للحاكم القاعدي.
// مفتاح API يُحفظ في system_settings عبر لوحة الإدارة فقط — لا يصل الواجهة أبدًا.
// ============================================================================
const LLM_ACTOR = '🧠 الحاكم الذكي';
async function ensureSettingsTable() {
  await q(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at BIGINT)`);
}
async function getSetting(k) {
  await ensureSettingsTable();
  const r = await one('SELECT value FROM system_settings WHERE key=$1', [k]);
  return r ? r.value : null;
}
async function setSetting(k, v) {
  await ensureSettingsTable();
  await q(`INSERT INTO system_settings (key,value,updated_at) VALUES ($1,$2,$3)
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=$3`, [k, String(v), Date.now()]);
}
// مزودو النماذج اللغوية — كلها بواجهة متوافقة مع OpenAI
// pollinations وllm7 مجانيان تمامًا بلا حساب ولا مفتاح؛ groq وgemini بطبقة مجانية سخية (مفتاح مجاني)
const LLM_PROVIDERS = {
  pollinations: { name: 'Pollinations (مجاني — بدون مفتاح)', url: 'https://text.pollinations.ai/openai',
    keyRequired: false, defaultModel: 'openai', jsonMode: false },
  llm7: { name: 'LLM7 (مجاني — بدون حساب)', url: 'https://api.llm7.io/v1/chat/completions',
    keyRequired: false, defaultModel: 'DeepSeek-V4-Flash-0731', jsonMode: true, anonKey: 'unused' },
  groq: { name: 'Groq (مجاني بحدود — مفتاح مجاني)', url: 'https://api.groq.com/openai/v1/chat/completions',
    keyRequired: true, defaultModel: 'llama-3.3-70b-versatile', jsonMode: true },
  gemini: { name: 'Gemini (مجاني بحدود — مفتاح مجاني)', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyRequired: true, defaultModel: 'gemini-3.6-flash', jsonMode: true },
  openrouter: { name: 'OpenRouter (مدفوع)', url: 'https://openrouter.ai/api/v1/chat/completions',
    keyRequired: true, defaultModel: 'meta-llama/llama-3.3-70b-instruct', jsonMode: true,
    extraHeaders: { 'HTTP-Referer': 'https://argos-press.game', 'X-Title': 'ARGOS AI Nations' } },
};
function llmProviderOf(id) { return LLM_PROVIDERS[id] || LLM_PROVIDERS.pollinations; }
async function getAiConfig() {
  const providerId = (await getSetting('llm_provider')) || 'pollinations';
  const p = llmProviderOf(providerId);
  return {
    enabled: (await getSetting('llm_enabled')) === '1',
    provider: LLM_PROVIDERS[providerId] ? providerId : 'pollinations',
    model: (await getSetting('llm_model')) || p.defaultModel,
    api_key: (await getSetting('llm_api_key')) || '',
  };
}
async function llmEnabled() {
  try {
    const c = await getAiConfig();
    const p = llmProviderOf(c.provider);
    return c.enabled && (!p.keyRequired || !!c.api_key);
  } catch (e) { return false; }
}
// استدعاء النموذج — يقترح فقط، والمحرك يتحقق وينفذ
async function llmChat(messages, { maxTokens = 1500, json = true, temperature = 0.7, timeoutMs = 30000 } = {}) {
  const cfg = await getAiConfig();
  const p = llmProviderOf(cfg.provider);
  if (!cfg.enabled) throw new Error('LLM_DISABLED');
  const key = cfg.api_key || p.anonKey || '';
  if (p.keyRequired && !key) throw new Error('LLM_NO_KEY');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(p.url, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        ...(key ? { 'Authorization': 'Bearer ' + key } : {}),
        'Content-Type': 'application/json',
        ...(p.extraHeaders || {}),
      },
      body: JSON.stringify({
        model: cfg.model || p.defaultModel, messages, max_tokens: maxTokens, temperature,
        ...(json && p.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error('LLM_HTTP_' + r.status + ' ' + String(t).slice(0, 200));
    }
    const j = await r.json();
    const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!c) throw new Error('LLM_EMPTY');
    return c;
  } finally { clearTimeout(timer); }
}
function llmParseJSON(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM_NO_JSON');
  return JSON.parse(m[0]);
}
// دور الحاكم اللغوي لشهر لعبة — يقترح النموذج، والمحرك يتحقق وينفذ
async function llmGovernTurn(cc, monthIdx) {
  const strategy = aiStrategyFor(cc);
  const e = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  if (!e || e.revolt_active) return false; // ثورة = شلل
  const army = await getArmy(cc);
  const liq0 = Number(e.liquidity_m_usd) || 0;
  const stab = Number(e.stability ?? 70), sup = Number(e.public_support ?? 60);
  const tax = e.tax_rate != null ? Number(e.tax_rate) : 10;
  const pop = Number(e.population) || 0;
  const comps = await all(`SELECT id FROM companies WHERE host_country=$1 AND status='approved' AND resource_kind IS NOT NULL`, [cc]);
  const wars = await all(`SELECT id, attacker_code, defender_code, score_a, score_b FROM wars
                          WHERE status='active' AND (attacker_code=$1 OR defender_code=$1)`, [cc]);
  const treaties = await all(`SELECT type, from_code, to_code FROM treaties
                              WHERE status='active' AND (from_code=$1 OR to_code=$1)`, [cc]);
  const pending = await all(`SELECT id, type, from_code FROM treaties WHERE to_code=$1 AND status='proposed'`, [cc]);
  const claimed = await aiClaimedSet();
  const armies = await all(`SELECT country_code, soldiers FROM armies ORDER BY soldiers DESC LIMIT 10`);
  const state = {
    country: cname(cc), code: cc, strategy, month: monthIdx,
    economy: { liquidity_m_usd: Math.round(liq0), tax_rate: tax, stability: Math.round(stab), public_support: Math.round(sup), population: pop },
    army: { soldiers: army.soldiers, readiness: Math.round(army.readiness), training: Math.round(army.training) },
    companies: comps.length,
    active_wars: wars.map((w) => ({
      id: w.id, enemy: w.attacker_code === cc ? w.defender_code : w.attacker_code,
      my_score: w.attacker_code === cc ? w.score_a : w.score_b,
      enemy_score: w.attacker_code === cc ? w.score_b : w.score_a,
    })),
    treaties: treaties.map((t) => ({ type: t.type, with: t.from_code === cc ? t.to_code : t.from_code })),
    pending_treaties: pending.map((t) => ({ id: t.id, type: t.type, from: t.from_code, from_name: cname(t.from_code) })),
    top_armies: armies.filter((a) => a.country_code !== cc).map((a) => ({
      code: a.country_code, soldiers: a.soldiers, human: claimed.has(a.country_code),
    })),
  };
  const sys = 'أنت الحاكم الأعلى لدولة ' + state.country + ' في لعبة محاكاة جيوسياسية سنة 1900. '
    + 'شخصيتك الاستراتيجية: ' + strategy + ' (conservative حذر دفاعي، balanced متوازن، expansionist توسعي طموح). '
    + 'كل شهر لعبة تتخذ قرارات حكيمة تحفظ الدولة وتنميها. أجب بـJSON فقط بهذا الشكل (كل حقل اختياري):\n'
    + '{"tax_rate": 0-30, "recruit": 0-20000, "train": true/false, "found_company": true/false,\n'
    + ' "treaty_decisions": [{"id": 123, "accept": true/false}],\n'
    + ' "treaties": [{"type": "non_aggression|trade|alliance|defensive", "to": "CODE"}],\n'
    + ' "spy": {"target": "CODE", "kind": "economy|stability"},\n'
    + ' "declare_war": "CODE أو null",\n'
    + ' "reason": "سطر واحد يشرح منطقك"}\n'
    + 'قواعد صارمة: الضريبة المرتفعة تهز الاستقرار. لا تعلن حربًا إلا بتفوق عسكري واضح واستقرار فوق 55. '
    + 'الحروب المنطقية فقط: نفس قارتك، أو قوة عظمى (80 ألف+ جندي) داخل إقليمك، أو قوة بحرية عظمى (100 ألف+ جندي ببحرية حربية) عبر البحار — سويسرا محايدة دائمًا فلا تهاجمها أبدًا. '
    + 'لا تقترح معاهدة من نوع سارٍ أصلًا مع نفس الدولة. التجسس مكلف وقد يُكشف فيهبط سمعتك.';
  const raw = await llmChat([
    { role: 'system', content: sys },
    { role: 'user', content: 'حالة الدولة هذا الشهر (أرقام بالمليون دولار والجنود):\n' + JSON.stringify(state) },
  ], { timeoutMs: 30000 });
  const d = llmParseJSON(raw);
  const notes = [];
  const A = LLM_ACTOR;
  const liqOf = async () => Number((await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc])).liquidity_m_usd) || 0;
  // صيانة حتمية: جباية + جمع إنتاج
  try { await collectTaxesInternal(cc, A); } catch (err) { /* جُبيت مسبقًا */ }
  for (const c of comps) { try { await collectCompanyInternal(c.id, A); } catch (err) { /* نفد أو جُمع */ } }
  let liq = await liqOf();
  // 1) الضريبة — بحد 30%
  if (Number.isFinite(d.tax_rate)) {
    const t = Math.max(0, Math.min(30, Math.round(d.tax_rate)));
    if (t !== tax) { await setCountryTax(cc, t, A, null); notes.push('ضريبة ' + t + '%'); }
  }
  // 2) الرد على المعاهدات المعلقة — عبر نفس المسار الموحد
  if (Array.isArray(d.treaty_decisions)) {
    for (const td of d.treaty_decisions.slice(0, 10)) {
      const t = pending.find((p) => Number(p.id) === Number(td.id));
      if (!t) continue;
      await respondTreaty({ ...t, to_code: cc }, !!td.accept, A);
      notes.push((td.accept ? 'قبول ' : 'رفض ') + (TREATY_TYPES[t.type] || t.type));
    }
  }
  // 3) التجنيد — سقف 20000 و4 آلاف دولار للجندي
  if (Number.isFinite(d.recruit)) {
    const pct = { conservative: 0.004, balanced: 0.007, expansionist: 0.012 }[strategy] || 0.007;
    const targetSoldiers = Math.round(pop * pct);
    const mil = await getArmy(cc);
    let need = Math.max(0, Math.min(20000, Math.round(d.recruit)));
    need = Math.min(need, Math.max(0, targetSoldiers - mil.soldiers)); // لا يتجاوز الهدف السكاني
    const cost = Math.round(need * 0.004 * 100) / 100;
    if (need > 0 && liq >= cost && await deductLiquidity(cc, cost)) {
      await setArmyStat(cc, { soldiers: mil.soldiers + need });
      await logLiq(cc, -cost, `تجنيد ${need.toLocaleString('en-US')} جندي`, A);
      await audit('army_recruit', A, `${cname(cc)}: تجنيد ${need.toLocaleString('en-US')} جندي`);
      liq = await liqOf(); notes.push('تجنيد ' + need);
    }
  }
  // 4) التدريب — 30 مليونًا
  if (d.train === true) {
    const mil = await getArmy(cc);
    if (mil.training < 95 && liq > 500 && await deductLiquidity(cc, 30)) {
      await setArmyStat(cc, { training: Math.min(100, mil.training + 3) });
      await logLiq(cc, -30, 'برنامج تدريب عسكري', A);
      liq = await liqOf(); notes.push('تدريب');
    }
  }
  // 5) تأسيس شركة — نفس شروط القاعدي
  if (d.found_company === true && liq > 400 && comps.length < 6) {
    try { await aiFoundCompany(cc, liq); liq = await liqOf(); notes.push('شركة جديدة'); } catch (err) { /* بلا احتياطي */ }
  }
  // 6) معاهدات جديدة — proposeTreaty يرفض المكرر والذاتي
  if (Array.isArray(d.treaties)) {
    for (const pt of d.treaties.slice(0, 3)) {
      const to = String(pt.to || '').toUpperCase();
      const type = String(pt.type || '');
      if (!['non_aggression', 'trade', 'alliance', 'defensive'].includes(type)) continue;
      if (to === cc || !COUNTRIES.some((c) => c.code === to)) continue;
      try { await proposeTreaty(cc, to, type, 0, A); notes.push('معاهدة ' + type + ' مع ' + cname(to)); }
      catch (err) { /* مكررة أو محظورة */ }
    }
  }
  // 7) التجسس — نفس القيود والحد الشهري
  if (d.spy && typeof d.spy.target === 'string') {
    const tg = d.spy.target.toUpperCase();
    const kind = d.spy.kind === 'stability' ? 'stability' : 'economy';
    if (tg !== cc && COUNTRIES.some((c) => c.code === tg) && liq > 200) {
      try { await runSpyOp(cc, tg, kind, A); notes.push('تجسس على ' + cname(tg)); }
      catch (err) { /* حد شهري أو سيولة */ }
    }
  }
  // 8) إعلان الحرب — نفس البوابات الصارمة للقاعدي
  if (typeof d.declare_war === 'string' && d.declare_war) {
    const tc = d.declare_war.toUpperCase();
    const mil = await getArmy(cc);
    const gates = strategy !== 'conservative' && wars.length === 0 && stab > 55
      && mil.soldiers > 30000 && mil.readiness > 60
      && tc !== cc && COUNTRIES.some((c) => c.code === tc);
    if (gates) {
      const ta = await getArmy(tc);
      const blocked = await one(`SELECT id FROM treaties WHERE status='active'
        AND ((from_code=$1 AND to_code=$2) OR (from_code=$2 AND to_code=$1))
        AND type IN ('non_aggression','alliance','defensive')`, [cc, tc]);
      if (ta.soldiers <= mil.soldiers * 0.6 && !blocked && !(await activeWarBetween(cc, tc)) && await aiWarPlausible(cc, tc)) {
        try { await declareWarInternal(cc, tc, A); notes.push('حرب على ' + cname(tc)); }
        catch (err) { /* رفضها المحرك */ }
      }
    }
  }
  await audit('ai_llm_turn', A, `${cname(cc)}: دور لغوي — ${notes.length ? notes.join('، ') : 'مراقبة بلا تغيير'}${d.reason ? ' — ' + String(d.reason).slice(0, 140) : ''}`);
  return true;
}
// رد السفارة عبر النموذج — نص طبيعي + فعل آمن واحد
async function llmEmbassyReply(playerCC, aiCC, body) {
  const strategy = aiStrategyFor(aiCC);
  const w = await activeWarBetween(aiCC, playerCC);
  const trs = await all(`SELECT type FROM treaties WHERE status='active'
    AND ((from_code=$1 AND to_code=$2) OR (from_code=$2 AND to_code=$1))`, [aiCC, playerCC]);
  const sys = 'أنت الحاكم الأعلى لدولة ' + cname(aiCC) + ' سنة 1900، شخصيتك: ' + strategy
    + '. وصلتك رسالة دبلوماسية من حاكم ' + cname(playerCC) + '. رد بعربية فصيحة موجزة (جملتان فقط) بأسلوب يليق بشخصيتك. '
    + 'أجب JSON فقط: {"reply": "نص الرد", "action": "none|non_aggression|trade|alliance|peace"} — '
    + 'اختر peace فقط إن كنتم في حرب وتريد إنهاءها، ومعاهدة فقط إن لم تكن سارية.';
  const ctx = 'السياق: ' + (w ? 'في حرب نشطة بيننا' : 'لا حرب بيننا')
    + '. معاهدات سارية: ' + (trs.map((t) => t.type).join('، ') || 'لا شيء')
    + '. الرسالة: "' + String(body).slice(0, 500) + '"';
  const d = llmParseJSON(await llmChat(
    [{ role: 'system', content: sys }, { role: 'user', content: ctx }],
    { maxTokens: 600, temperature: 0.8, timeoutMs: 20000 }
  ));
  const reply = String(d.reply || '').slice(0, 1000);
  if (!reply) throw new Error('LLM_EMPTY_REPLY');
  return { reply, action: d.action };
}

// الدور الشهري للدول الذكية — يُستدعى من المحرك الشهري لكل شهر لعبة منقضٍ
async function aiNationsTick(monthIdx) {
  const useLLM = await llmEnabled();
  let rows;
  try {
    rows = await all(`SELECT country_code, strategy FROM ai_nations
                      WHERE enabled=1 AND (last_tick_month IS NULL OR last_tick_month < $1)`, [monthIdx]);
  } catch (e) { return; } // الجدول غير جاهز بعد
  if (!rows.length) return;
  const claimed = await aiClaimedSet();
  for (const r of rows) {
    const cc = r.country_code;
    try {
      if (claimed.has(cc)) {
        // حُجزت الدولة بلاعب — إيقاف حاكمها الذكي نهائيًا
        await q('UPDATE ai_nations SET enabled=0, updated_at=$2 WHERE country_code=$1', [cc, Date.now()]);
        await audit('ai_nation', AI_ACTOR, `${cname(cc)}: توقف الحاكم الذكي — الدولة أصبحت بيد لاعب`);
        continue;
      }
      // 🧠 الحاكم اللغوي أولًا — عند أي فشل يعود القاعدي تلقائيًا
      let handled = false;
      if (useLLM) {
        try { handled = await llmGovernTurn(cc, monthIdx); }
        catch (e) { handled = false; }
      }
      if (!handled) await aiGovern(cc, r.strategy || 'balanced');
    } catch (e) { console.error('AI govern:', cc, e.message); }
    await q('UPDATE ai_nations SET last_tick_month=$2, updated_at=$3 WHERE country_code=$1', [cc, monthIdx, Date.now()]);
  }
}
// دور واحد لدولة ذكية — كأن لاعبًا حقيقيًا يديرها: اقتصاد + جيش + دبلوماسية + استخبارات
// الحاكم الذكي لاعب كامل: حروب محسوبة ومعاهدات وتجسس تشمل البشر — باحتمالات شهرية منخفضة وشروط صارمة
// الرد على معاهدة معروضة — قبول أو رفض بنفس الآثار للجميع (قاعدي ولغوي وبشري)
async function respondTreaty(t, accept, actor) {
  const g = await gameNow();
  const cc = t.to_code;
  if (accept) {
    await q(`UPDATE treaties SET status='active', decided_game_time=$1 WHERE id=$2`, [g, t.id]);
    await emitEvent('treaty_signed', t.from_code, t.to_code,
      `توقيع ${TREATY_TYPES[t.type]} بين ${cname(t.from_code)} و${cname(t.to_code)}`, { treaty_id: t.id });
    await audit('treaty_accept', actor, `${cname(cc)} قبلت ${TREATY_TYPES[t.type]} من ${cname(t.from_code)}`);
    await notifyCountry(t.from_code, 'treaty', `قُبِلت معاهدتك!`,
      `${cname(t.to_code)} قبلت: ${TREATY_TYPES[t.type]}.`, '#/news');
  } else {
    await q(`UPDATE treaties SET status='rejected', decided_game_time=$1 WHERE id=$2`, [g, t.id]);
    await audit('treaty_reject', actor, `${cname(cc)} رفضت ${TREATY_TYPES[t.type] || t.type} من ${cname(t.from_code)}`);
    await notifyCountry(t.from_code, 'treaty', `رُفِضت معاهدتك`,
      `${cname(t.to_code)} رفضت: ${TREATY_TYPES[t.type]}.`, '#/news');
  }
}
async function aiGovern(cc, strategy, actor = AI_ACTOR, domains = null) {
  const e = await one('SELECT * FROM country_economy WHERE country_code=$1', [cc]);
  if (!e || e.revolt_active) return; // ثورة شعبية = شلل — لا جباية ولا استثمار
  const liqOf = async () => Number((await one('SELECT liquidity_m_usd FROM country_economy WHERE country_code=$1', [cc])).liquidity_m_usd) || 0;

  const D = domains || { economy: 1, companies: 1, military: 1, diplomacy: 1, intel: 1 };
  // ---------- 1) الاقتصاد ----------
  if (D.economy) {
    try { await collectTaxesInternal(cc, actor); } catch (err) { /* جُبيت مسبقًا هذا الشهر */ }
  const stab = await getEconStat(cc, 'stability', 70);
  const cur = e.tax_rate != null ? Number(e.tax_rate) : 10;
  const band = { conservative: [8, 13], balanced: [12, 18], expansionist: [17, 24] }[strategy] || [12, 18];
  let target = Math.round((band[0] + band[1]) / 2);
  if (stab < 25) target = 8;
  else if (stab < 45) target = Math.min(target, 12);
  else if (stab > 85) target = Math.min(band[1], target + 2);
  if (target !== cur) await setCountryTax(cc, target, actor, null);
  }
  const comps = D.companies ? await all(`SELECT id FROM companies WHERE host_country=$1 AND status='approved' AND resource_kind IS NOT NULL`, [cc]) : [];
  for (const c of comps) {
    try { await collectCompanyInternal(c.id, actor); } catch (err) { /* نفد الاحتياطي أو جُمع مسبقًا */ }
  }
  let liq = await liqOf();
  if (D.companies && liq > 400 && comps.length < 6) {
    try { await aiFoundCompany(cc, liq); liq = await liqOf(); } catch (err) { /* بلا احتياطي أو سيولة غير كافية */ }
  }
  // بيع فائض الموارد في السوق — عرض واحد شهريًا كحد أقصى (تجارة طبيعية مع البشر)
  if (D.companies) {
    const AI_RES_PRICE = { oil: 0.02, gas: 0.015, iron: 0.01, coal: 0.008, grain: 0.005, cotton: 0.008 };
    const bigStocks = await all(`SELECT resource, stock FROM country_stocks WHERE country_code=$1 AND stock > 20000`, [cc]);
    for (const s of bigStocks) {
      if (!RES_AR[s.resource]) continue;
      const listed = await one(`SELECT id FROM market_listings WHERE seller_country=$1 AND resource=$2 AND status='active' AND kind='resource'`, [cc, s.resource]);
      if (listed) continue;
      const avail = Number(s.stock) - Number(await reservedStock(cc, s.resource) || 0);
      const qty = Math.floor(avail * 0.25);
      if (qty < 1000) continue;
      await q(`INSERT INTO market_listings (seller_id,seller_country,weapon_id,qty,price_unit_m_usd,kind,title,unit,resource,created_at)
               VALUES (NULL,$1,NULL,$2,$3,'resource',$4,$5,$6,$7)`,
        [cc, qty, AI_RES_PRICE[s.resource] || 0.01, RES_AR[s.resource], RES_UNIT[s.resource], s.resource, Date.now()]);
      await logLiq(cc, 0, `عرض ${qty.toLocaleString('en-US')} ${RES_UNIT[s.resource]} ${RES_AR[s.resource]} للبيع في السوق`, actor);
      break;
    }
  }

  // ---------- 2) الجيش: تجنيد نحو هدف سكاني + تدريب ----------
  if (D.military) {
  const pop = Number(e.population) || 0;
  const pct = { conservative: 0.004, balanced: 0.007, expansionist: 0.012 }[strategy] || 0.007;
  const mil = await getArmy(cc);
  const targetSoldiers = Math.round(pop * pct);
  if (mil.soldiers < targetSoldiers && liq > 300) {
    const need = Math.min(targetSoldiers - mil.soldiers, 20000); // سقف تجنيد شهري
    const cost = Math.round(need * 0.004 * 100) / 100; // 4 آلاف دولار للجندي
    if (await deductLiquidity(cc, cost)) {
      await setArmyStat(cc, { soldiers: mil.soldiers + need });
      await logLiq(cc, -cost, `تجنيد ${need.toLocaleString('en-US')} جندي`, actor);
      await audit('army_recruit', actor, `${cname(cc)}: تجنيد ${need.toLocaleString('en-US')} جندي بتكلفة ~${cost} مليون دولار`);
      liq = await liqOf();
    }
  }
  if (mil.training < 80 && liq > 500) {
    const tCost = 30;
    if (await deductLiquidity(cc, tCost)) {
      await setArmyStat(cc, { training: Math.min(100, mil.training + 3) });
      await logLiq(cc, -tCost, 'برنامج تدريب عسكري', actor);
      liq = await liqOf();
    }
  }

  }
  // ---------- 3) الدبلوماسية ----------
  if (D.diplomacy) {
  // الرد على العروض المعلقة: قبول عدم الاعتداء دائمًا، والتجاري غالبًا، ورفض الباقي
  const pending = await all(`SELECT * FROM treaties WHERE to_code=$1 AND status='proposed'`, [cc]);
  for (const t of pending) {
    if (t.type === 'non_aggression' || (t.type === 'trade' && Math.random() < 0.6)) {
      await respondTreaty(t, true, actor);
    } else if (['alliance', 'defensive', 'military_access', 'embargo'].includes(t.type)) {
      await respondTreaty(t, false, actor);
    }
  }
  // مبادرة محسوبة: معاهدة مع دولة ذكية أخرى فقط (10% شهريًا — بلا إزعاج للبشر)
  if (Math.random() < 0.10 && liq > 200) {
    const pool = COUNTRIES.map(c => c.code).filter(c => c !== cc); // ذكية وبشرية — لعب طبيعي
    const o = pool[Math.floor(Math.random() * pool.length)];
    const type = Math.random() < 0.5 ? 'non_aggression' : 'trade';
    try { await proposeTreaty(cc, o, type, 0, actor); } catch (err) { /* معاهدة قائمة أصلًا */ }
  }

  }
  // ---------- 4) الاستخبارات: تجسس محسوب + أمن مضاد ----------
  if (D.intel) {
  if (Math.random() < 0.12 && liq > 200) {
    const pool = COUNTRIES.map(c => c.code).filter(c => c !== cc); // ذكية وبشرية — لعب طبيعي
    const o = pool[Math.floor(Math.random() * pool.length)];
    const kind = Math.random() < 0.5 ? 'economy' : 'stability';
    try { await runSpyOp(cc, o, kind, actor); } catch (err) { /* سيولة أو حد شهري */ }
  }
  try {
    const sec = await getSecurity(cc);
    if (sec < 40 && liq > 600) {
      const want = 50, cost = (want - sec) * 1;
      if (await deductLiquidity(cc, cost)) {
        await q(`UPDATE intel_security SET level=$2, updated_at=$3 WHERE country_code=$1`, [cc, want, Date.now()]);
        await logLiq(cc, -cost, `تشديد الأمن المضاد إلى ${want}`, actor);
        await audit('intel_security', actor, `${cname(cc)} رفع الأمن إلى ${want}`);
      }
    }
  } catch (err) { /* غير حرج */ }
  }
  // ---------- 5) الحرب والسلام: إعلان محسوب + معارك + سلام عند الاستنزاف ----------
  if (D.military) {
    const wmil = await getArmy(cc);
    const stabNow = await getEconStat(cc, 'stability', 70);
    const gNow = await gameNow();
    let myWars = await all(`SELECT * FROM wars WHERE status='active' AND (attacker_code=$1 OR defender_code=$1)`, [cc]);
    // السلام: تفوق ساحق (فرض بتعويضات)، خسارة فادحة، أو حرب مستنزفة تجاوزت سنة لعبة
    for (const w of myWars) {
      const myDiff = w.attacker_code === cc ? Number(w.score_a) - Number(w.score_b) : Number(w.score_b) - Number(w.score_a);
      const monthsAtWar = (gNow - Number(w.started_game_time || gNow)) / GAME_MONTH_MS;
      if (myDiff >= 50 || myDiff <= -30 || monthsAtWar > 12) {
        try { await peaceInternal(w.id, cc, actor); } catch (e) { /* عرض قائم أو حرب انتهت */ }
      }
    }
    myWars = await all(`SELECT * FROM wars WHERE status='active' AND (attacker_code=$1 OR defender_code=$1)`, [cc]);
    // المعارك: دور المهاجم فقط — هجوم شهري محسوب عند الجاهزية الكافية + أسلحة تلقائية من الترسانة
    for (const w of myWars) {
      if (w.attacker_code !== cc) continue;
      const a2 = await getArmy(cc);
      if (a2.readiness > 45 && a2.soldiers > 8000 && Math.random() < 0.6) {
        const units = Math.min(Math.floor(a2.soldiers * 0.25), 40000);
        if (units >= 1000) {
          try { await battleInternal(w.id, cc, units, '', actor, await aiPickWeapons(cc)); }
          catch (e) { /* */ }
        }
      }
    }
    // إعلان الحرب: التوسعيون (ونادرًا المتوازنون) — بتفوق عددي واضح ومنطقية جغرافية فقط
    const busy = myWars.length > 0;
    if (!busy) {
      const warP = strategy === 'expansionist' ? 0.03 : strategy === 'balanced' ? 0.008 : 0;
      if (Math.random() < warP && stabNow > 55 && wmil.soldiers > 30000 && wmil.readiness > 60) {
        const pool = [];
        for (const c of COUNTRIES) {
          const t = c.code;
          if (t === cc) continue;
          if (await activeWarBetween(cc, t)) continue;
          let blocked = false;
          for (const tt of ['non_aggression', 'alliance', 'defensive']) {
            if (await activeTreaty(cc, t, tt)) { blocked = true; break; }
          }
          if (blocked) continue;
          const tm = await getArmy(t);
          if (tm.soldiers > wmil.soldiers * 0.6) continue; // تفوق واضح فقط — لا حروب انتحارية
          if (!(await aiWarPlausible(cc, t))) continue; // بلا حروب عبثية عبر القارات
          pool.push({ t, d: capitalDistKm(cc, t) });
        }
        pool.sort((a, b) => a.d - b.d); // الأقرب أولًا — الحروب الإقليمية منطقية
        for (const { t } of pool.slice(0, 5)) {
          try { await declareWarInternal(cc, t, actor); break; } catch (e) { /* جرّب التالي */ }
        }
      }
    }
  }
}
// تأسيس شركة استخراج وطنية — تختار المورد الأكبر احتياطيًا المتبقي
async function aiFoundCompany(cc, liq) {
  const res = RESERVES[cc] || {};
  let best = null, bestRem = 0;
  for (const rk of Object.keys(RES_AR)) {
    const total = Number(res[rk]) || 0;
    if (!total) continue;
    const exRow = await one('SELECT extracted FROM resource_extracted WHERE country_code=$1 AND resource=$2', [cc, rk]);
    const rem = total - (exRow ? Number(exRow.extracted) || 0 : 0);
    if (rem > bestRem) { bestRem = rem; best = rk; }
  }
  if (!best || bestRem <= 0) return;
  const cities = citiesOf(cc);
  if (!cities.length) return;
  const erow = await one('SELECT units_per_usd FROM country_economy WHERE country_code=$1', [cc]);
  const rate = erow && erow.units_per_usd ? Number(erow.units_per_usd) : 1;
  const capUsd = Math.max(60, Math.min(1500, Math.round(liq * 0.08))); // 8% من السيولة بحدود آمنة
  const ok = await deductLiquidity(cc, capUsd); // خصم ذري — يفشل بأمان لو نقص الرصيد
  if (!ok) return;
  const name = `الشركة الوطنية لل${RES_AR[best]} — ${cname(cc)}`;
  const city = cities[Math.floor(Math.random() * cities.length)];
  await logLiq(cc, -capUsd, `تأسيس شركة «${name}» (${city})`, AI_ACTOR);
  await q(`INSERT INTO companies (country_code,host_country,owner_id,ctype,status,name,sector,city,
           capital,capital_usd,description,resource_kind,workers,product,created_at,updated_at)
           VALUES ($1,$1,NULL,'national','approved',$2,'تعدين',$3,$4,$5,$6,$7,800,'',$8,$8)`,
    [cc, name, city, Math.round(capUsd * rate), capUsd, 'شركة وطنية أسسها الحاكم الذكي', best, Date.now()]);
  await audit('company_found', AI_ACTOR, `${cname(cc)}: تأسيس «${name}» لاستخراج ${RES_AR[best]} برأس مال ~${capUsd} مليون دولار`);
}


// التفويض الكامل للدول المحجوزة: مستشار بالوضع 3 (مدير مفوض) يدير مجالاته تلقائيًا كل شهر لعبة
async function advisorAutoTick(monthIdx) {
  try { await q(`ALTER TABLE advisor_settings ADD COLUMN IF NOT EXISTS last_auto_month BIGINT`); } catch (e) { /* موجود */ }
  let rows;
  try {
    rows = await all(`SELECT country_code, advisor_name, domains FROM advisor_settings
                      WHERE mode=3 AND (last_auto_month IS NULL OR last_auto_month < $1)`, [monthIdx]);
  } catch (e) { return; }
  if (!rows.length) return;
  const claimed = await aiClaimedSet();
  for (const r of rows) {
    const cc = r.country_code;
    try {
      if (!claimed.has(cc)) continue; // لم تعد محجوزة — يتولاها الحاكم الذكي العام
      let domains = null;
      try { domains = JSON.parse(r.domains || '{}'); } catch (e) { domains = {}; }
      if (!Object.values(domains).some(Boolean)) continue; // لا مجالات مفوضة
      const actor = `🤖 ${(r.advisor_name || 'المستشار').slice(0, 40)}`;
      await aiGovern(cc, aiStrategyFor(cc), actor, domains);
      await audit('advisor_auto', actor, `${cname(cc)}: دور شهري تلقائي للمجالات المفوضة`);
    } catch (e) { console.error('advisor auto:', cc, e.message); }
    await q('UPDATE advisor_settings SET last_auto_month=$2 WHERE country_code=$1', [cc, monthIdx]);
  }
}
// ---------------- بدء التشغيل ----------------
(async () => {
  await initDb();
  try { await initAiNations(); } catch (e) { console.error('ai_nations:', e.message); }
  app.listen(PORT, () => console.log(`📰 جريدة أرجوس تعمل على http://localhost:${PORT}`));
})();
