// ============================================================
// جريدة أرجوس | Argos Press — الخادم الخلفي
// حسابات لاعبين + مقالات + برقيات الدول + رفع الصور
// ============================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { DatabaseSync } = require('node:sqlite');
const { COUNTRIES } = require('./countries');

// مهارات العملاء (مصفوفة المهارات في الملف الاستخباراتي)
const SKILLS = {
  intel: 'الاستخبارات والتجسس',
  diplomacy: 'التفاوض والتحالفات',
  econwar: 'الحرب الاقتصادية والدبلوماسية',
  analysis: 'التحليل الجيوسياسي',
  planning: 'التخطيط طويل المدى وإدارة الأزمات',
  resources: 'إدارة الموارد وتحليل البيانات',
};

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'argos.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CATEGORIES = {
  official: 'بيانات رسمية',
  war: 'سيناريوهات الحروب',
  events: 'أحداث اللعبة',
};

// ---------------- قاعدة البيانات ----------------
const db = new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  country_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image TEXT,
  category TEXT NOT NULL DEFAULT 'events',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  image TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_time ON dispatches(created_at);
CREATE TABLE IF NOT EXISTS dossiers (
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
  updated_at INTEGER
);
`);

// مستخدم النظام (مقر أرجوس) + مقال ترحيبي
(function seed() {
  let sys = db.prepare("SELECT id FROM users WHERE username='argos_hq'").get();
  if (!sys) {
    const r = db.prepare(
      "INSERT INTO users (username,email,password_hash,country_code,role,created_at) VALUES (?,?,?,?,?,?)"
    ).run('argos_hq', 'hq@argos.internal', '!', 'HQ', 'system', Date.now());
    sys = { id: Number(r.lastInsertRowid) };
  }
  const n = db.prepare('SELECT COUNT(*) AS c FROM articles').get().c;
  if (n === 0) {
    db.prepare(
      "INSERT INTO articles (user_id,title,body,category,created_at) VALUES (?,?,?,?,?)"
    ).run(
      sys.id,
      'انطلاق جريدة أرجوس — الصحيفة الرسمية للمحاكاة',
      `يُعلن مقر أرجوس عن انطلاق الجريدة الرسمية للمحاكاة، المنصة التي توثّق سيناريوهات الحروب وأحداث اللعبة لحظة بلحظة، اعتبارًا من الأول من يناير سنة 1900.

على كل لاعب إنشاء حسابه واختيار الدولة التي سيلعب بها، ثم التغريد والتصريح باسم دولته عبر «برقيات الدول»، ونشر سيناريوهات المعارك والتطورات عبر المقالات.

القاعدة الذهبية للمحاكاة: الواقعية الصارمة — كل قرار يُقيَّم بمنطق حقيقي، وكل حدث يُسجَّل في الأرشيف فور حدوثه.

العالم ينتظر قادةً... فهل أنت جاهز لترك بصمتك في التاريخ الجديد؟`,
      'official',
      Date.now()
    );
  }
})();

// ---------------- رفع الصور ----------------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '').toLowerCase().match(/\.[a-z0-9]+/) || ['.jpg'])[0];
    cb(null, Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('يُسمح برفع الصور فقط'));
  },
});

// ---------------- التطبيق ----------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- الجلسات ----------
function getToken(req) {
  const h = req.headers.cookie || '';
  const m = h.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 30 * 24 * 3600 * 1000;
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(token, userId, expires);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`);
}
function clearSession(req, res) {
  const t = getToken(req);
  if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}
function auth(req, res, next) {
  const t = getToken(req);
  if (!t) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  const row = db.prepare(
    'SELECT u.id,u.username,u.email,u.country_code,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?'
  ).get(t, Date.now());
  if (!row) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجددًا' });
  req.user = row;
  next();
}
const validCountry = (c) => COUNTRIES.some((x) => x.code === c);
const cleanImage = (v) => (typeof v === 'string' && v.startsWith('/uploads/') ? v : null);

// ---------- الدول ----------
app.get('/api/countries', (req, res) => res.json(COUNTRIES));

// الدول المحجوزة من طرف لاعبين (لمنع تكرار اختيار نفس الدولة)
app.get('/api/taken-countries', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT country_code FROM users WHERE role!='system'").all();
  res.json(rows.map((r) => r.country_code));
});

// ---------- الملفات الاستخباراتية (إنجازات اللاعبين) ----------
const parseJson = (s, fb) => { try { const v = JSON.parse(s); return v ?? fb; } catch { return fb; } };
const DOSSIER_STATUSES = ['ACTIVE', 'INACTIVE', 'MIA', 'KIA'];
const DOSSIER_CLEARANCES = ['LEVEL 1', 'LEVEL 2', 'LEVEL 3', 'LEVEL 4', 'LEVEL 5'];

// قائمة الملفات (نبذة)
app.get('/api/dossiers', (req, res) => {
  const rows = db.prepare(`
    SELECT d.user_id, d.alias, d.status, d.clearance, d.avatar, u.username, u.country_code
    FROM dossiers d JOIN users u ON u.id = d.user_id
    WHERE u.role != 'system'
    ORDER BY u.id ASC`).all();
  res.json(rows);
});

// ملف كامل لعميل
app.get('/api/dossier/:username', (req, res) => {
  const u = db.prepare("SELECT id, username, country_code, role FROM users WHERE username=? AND role!='system'").get(req.params.username);
  if (!u) return res.status(404).json({ error: 'الملف غير موجود' });
  let d = db.prepare('SELECT * FROM dossiers WHERE user_id=?').get(u.id);
  if (!d) {
    db.prepare('INSERT INTO dossiers (user_id, updated_at) VALUES (?,?)').run(u.id, Date.now());
    d = db.prepare('SELECT * FROM dossiers WHERE user_id=?').get(u.id);
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
});

// إنشاء/تحديث الملف (صاحبه أو المدير)
app.post('/api/dossier', auth, (req, res) => {
  const me = req.user;
  let targetId = me.id;
  if (req.body && req.body.user_id && me.role === 'admin') targetId = Number(req.body.user_id);
  if (targetId !== me.id && me.role !== 'admin')
    return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الملف' });
  const target = db.prepare("SELECT id FROM users WHERE id=? AND role!='system'").get(targetId);
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
  db.prepare(`INSERT INTO dossiers (user_id, alias, status, clearance, profile, avatar, theaters, roles, achievements, skills, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET alias=excluded.alias, status=excluded.status, clearance=excluded.clearance,
      profile=excluded.profile, avatar=excluded.avatar, theaters=excluded.theaters, roles=excluded.roles,
      achievements=excluded.achievements, skills=excluded.skills, updated_at=excluded.updated_at`)
    .run(targetId, str(b.alias, 60), status, clearance, str(b.profile, 2000), str(b.avatar, 300),
      JSON.stringify(arr(b.theaters, 43, 5)), JSON.stringify(arr(b.roles, 20, 200)),
      JSON.stringify(arr(b.achievements, 30, 200)), JSON.stringify(skills), Date.now());
  res.json({ ok: true });
});

// ---------- الحسابات ----------
app.post('/api/register', (req, res) => {
  const { username, email, password, country_code } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'اسم المستخدم 3-20 حرفًا (أحرف وأرقام و _ فقط)' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  if (!validCountry(country_code))
    return res.status(400).json({ error: 'اختر الدولة التي ستلعب بها' });
  const dup = db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(username, email);
  if (dup) return res.status(409).json({ error: 'اسم المستخدم أو البريد مسجّل مسبقًا' });
  const taken = db.prepare("SELECT username FROM users WHERE country_code=? AND role!='system'").get(country_code);
  if (taken) return res.status(409).json({ error: 'هذه الدولة محجوزة مسبقًا من طرف لاعب آخر — اختر دولة أخرى' });

  const hash = bcrypt.hashSync(password, 10);
  const others = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role!='system'").get().c;
  const role = others === 0 ? 'admin' : 'player'; // أول لاعب يسجّل = إدارة المقر
  const r = db.prepare(
    'INSERT INTO users (username,email,password_hash,country_code,role,created_at) VALUES (?,?,?,?,?,?)'
  ).run(username, email.toLowerCase(), hash, country_code, role, Date.now());
  db.prepare('INSERT INTO dossiers (user_id, updated_at) VALUES (?,?)').run(Number(r.lastInsertRowid), Date.now());
  setSession(res, Number(r.lastInsertRowid));
  res.json({ ok: true, role });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!u || u.role === 'system' || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  setSession(res, u.id);
  res.json({ ok: true, role: u.role });
});

app.post('/api/logout', (req, res) => { clearSession(req, res); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  const t = getToken(req);
  if (!t) return res.json({ user: null });
  const row = db.prepare(
    'SELECT u.id,u.username,u.email,u.country_code,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?'
  ).get(t, Date.now());
  res.json({ user: row || null });
});

// ---------- رفع صورة ----------
app.post('/api/upload', auth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'فشل الرفع' });
    if (!req.file) return res.status(400).json({ error: 'اختر صورة أولاً' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// ---------- المقالات ----------
function articleRow(a) {
  return {
    id: a.id, title: a.title, body: a.body, image: a.image,
    category: a.category, category_label: CATEGORIES[a.category] || a.category,
    created_at: a.created_at,
    author: { username: a.username, country_code: a.country_code, role: a.role },
  };
}
app.get('/api/articles', (req, res) => {
  const { category, limit } = req.query;
  const lim = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  let rows;
  if (category && CATEGORIES[category]) {
    rows = db.prepare(
      `SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id
       WHERE a.category=? ORDER BY a.created_at DESC LIMIT ?`
    ).all(category, lim);
  } else {
    rows = db.prepare(
      `SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id
       ORDER BY a.created_at DESC LIMIT ?`
    ).all(lim);
  }
  res.json(rows.map(articleRow));
});
app.get('/api/articles/:id', (req, res) => {
  const a = db.prepare(
    'SELECT a.*,u.username,u.country_code,u.role FROM articles a JOIN users u ON u.id=a.user_id WHERE a.id=?'
  ).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  res.json(articleRow(a));
});
app.post('/api/articles', auth, (req, res) => {
  const { title, body, category, image } = req.body || {};
  if (!title || title.trim().length < 5) return res.status(400).json({ error: 'العنوان قصير جدًا' });
  if (!body || body.trim().length < 20) return res.status(400).json({ error: 'نص المقال قصير جدًا (20 حرفًا على الأقل)' });
  const cat = CATEGORIES[category] ? category : 'events';
  if (cat === 'official' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'البيانات الرسمية تصدر عن إدارة المقر فقط' });
  const r = db.prepare(
    'INSERT INTO articles (user_id,title,body,image,category,created_at) VALUES (?,?,?,?,?,?)'
  ).run(req.user.id, title.trim(), body.trim(), cleanImage(image), cat, Date.now());
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
app.delete('/api/articles/:id', auth, (req, res) => {
  const a = db.prepare('SELECT user_id FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'المقال غير موجود' });
  if (a.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- برقيات الدول (تغريد باسم الدولة) ----------
function dispatchRow(d) {
  return {
    id: d.id, body: d.body, image: d.image, created_at: d.created_at,
    author: { username: d.username, country_code: d.country_code },
  };
}
app.get('/api/dispatches', (req, res) => {
  const lim = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const rows = db.prepare(
    `SELECT d.*,u.username,u.country_code FROM dispatches d JOIN users u ON u.id=d.user_id
     ORDER BY d.created_at DESC LIMIT ?`
  ).all(lim);
  res.json(rows.map(dispatchRow));
});
app.post('/api/dispatches', auth, (req, res) => {
  const { body, image } = req.body || {};
  if (!body || body.trim().length < 2) return res.status(400).json({ error: 'اكتب نص البرقية' });
  if (body.length > 500) return res.status(400).json({ error: 'البرقية 500 حرف كحد أقصى' });
  const r = db.prepare(
    'INSERT INTO dispatches (user_id,body,image,created_at) VALUES (?,?,?,?)'
  ).run(req.user.id, body.trim(), cleanImage(image), Date.now());
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
app.delete('/api/dispatches/:id', auth, (req, res) => {
  const d = db.prepare('SELECT user_id FROM dispatches WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'البرقية غير موجودة' });
  if (d.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'لا تملك صلاحية الحذف' });
  db.prepare('DELETE FROM dispatches WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- الصفحة الرئيسية (التطبيق) ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`📰 جريدة أرجوس تعمل على http://localhost:${PORT}`));
