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

const PORT = process.env.PORT || 3000;

const CATEGORIES = {
  official: 'بيانات رسمية',
  war: 'سيناريوهات الحروب',
  events: 'أحداث اللعبة',
};

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

  // مستخدم النظام (مقر أرجوس) + مقال ترحيبي
  let sys = await one("SELECT id FROM users WHERE username='argos_hq'");
  if (!sys) {
    sys = await one(
      'INSERT INTO users (username,email,password_hash,country_code,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      ['argos_hq', 'hq@argos.internal', '!', 'HQ', 'system', Date.now()]
    );
  }
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
    'SELECT u.id,u.username,u.email,u.country_code,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2',
    [t, Date.now()]
  );
  if (!row) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجددًا' });
  req.user = row;
  next();
}
const validCountry = (c) => COUNTRIES.some((x) => x.code === c);
const cleanImage = (v) =>
  (typeof v === 'string' && v.startsWith('https://') && v.length < 600 ? v : null);

// ---------- الدول ----------
app.get('/api/countries', (req, res) => res.json(COUNTRIES));

// الدول المحجوزة من طرف لاعبين (لمنع تكرار اختيار نفس الدولة)
app.get('/api/taken-countries', ah(async (req, res) => {
  const rows = await all("SELECT DISTINCT country_code FROM users WHERE role!='system'");
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
    WHERE u.role != 'system'
    ORDER BY u.id ASC`);
  res.json(rows);
}));

// ملف كامل لعميل
app.get('/api/dossier/:username', ah(async (req, res) => {
  const u = await one("SELECT id, username, country_code, role FROM users WHERE username=$1 AND role!='system'", [req.params.username]);
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
  const target = await one("SELECT id FROM users WHERE id=$1 AND role!='system'", [targetId]);
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
  const taken = await one("SELECT username FROM users WHERE country_code=$1 AND role!='system'", [country_code]);
  if (taken) return res.status(409).json({ error: 'هذه الدولة محجوزة مسبقًا من طرف لاعب آخر — اختر دولة أخرى' });

  const hash = bcrypt.hashSync(password, 10);
  const cnt = await one("SELECT COUNT(*) AS c FROM users WHERE role!='system'");
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
  if (!u || u.role === 'system' || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  await setSession(res, u.id);
  res.json({ ok: true, role: u.role });
}));

app.post('/api/logout', ah(async (req, res) => { await clearSession(req, res); res.json({ ok: true }); }));

app.get('/api/me', ah(async (req, res) => {
  const t = getToken(req);
  if (!t) return res.json({ user: null });
  const row = await one(
    'SELECT u.id,u.username,u.email,u.country_code,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2',
    [t, Date.now()]
  );
  res.json({ user: row || null });
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
    author: { username: a.username, country_code: a.country_code, role: a.role },
  };
}
app.get('/api/articles', ah(async (req, res) => {
  const { category, limit } = req.query;
  const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  let rows;
  if (category && CATEGORIES[category]) {
    rows = await all(
      `SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id
       WHERE a.category=$1 ORDER BY a.created_at DESC LIMIT $2`,
      [category, lim]
    );
  } else {
    rows = await all(
      `SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [lim]
    );
  }
  res.json(rows.map(articleRow));
}));
app.get('/api/articles/:id', ah(async (req, res) => {
  const a = await one(
    'SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id WHERE a.id=$1',
    [req.params.id]
  );
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  res.json(articleRow(a));
}));
app.post('/api/articles', ah(auth), ah(async (req, res) => {
  const { title, body, category, image } = req.body || {};
  if (!title || title.trim().length < 5) return res.status(400).json({ error: 'العنوان قصير جدًا' });
  if (!body || body.trim().length < 20) return res.status(400).json({ error: 'نص المقال قصير جدًا (20 حرفًا على الأقل)' });
  const cat = CATEGORIES[category] ? category : 'events';
  if (cat === 'official' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'البيانات الرسمية تصدر عن إدارة المقر فقط' });
  const r = await one(
    'INSERT INTO articles (user_id,title,body,image,category,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.user.id, title.trim(), body.trim(), cleanImage(image), cat, Date.now()]
  );
  res.json({ ok: true, id: r.id });
}));
app.delete('/api/articles/:id', ah(auth), ah(async (req, res) => {
  const a = await one('SELECT user_id FROM articles WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  if (a.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  await q('DELETE FROM articles WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- برقيات الدول (تغريد باسم الدولة) ----------
function dispatchRow(d) {
  return {
    id: d.id, body: d.body, image: d.image, created_at: Number(d.created_at),
    author: { username: d.username, country_code: d.country_code },
  };
}
app.get('/api/dispatches', ah(async (req, res) => {
  const lim = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const rows = await all(
    `SELECT d.*,u.username,u.country_code FROM dispatches d JOIN users u ON u.id=d.user_id
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
