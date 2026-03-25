/* ══════════════════════════════════════════════════════════════════
   PROPREP — NODE.JS BACKEND
   Stack : Express · better-sqlite3 · bcryptjs · jsonwebtoken · cors
   Deploy: Railway / Render / Fly.io (all free tiers)
══════════════════════════════════════════════════════════════════ */
'use strict';

const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const Database   = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'proprep_dev_secret_change_in_production';

/* ── Database ──────────────────────────────────────────────── */
const db = new Database(path.join(__dirname, 'proprep.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ── Schema ─────────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    UNIQUE NOT NULL,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK(role IN ('candidate','expert','admin')),
    fname       TEXT    NOT NULL,
    lname       TEXT,
    mobile      TEXT,
    target_role TEXT,
    target_country TEXT,
    experience  TEXT,
    position    TEXT,
    industry    TEXT,
    country     TEXT,
    linkedin    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interviewers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    name        TEXT    NOT NULL,
    role        TEXT,
    industry    TEXT,
    country     TEXT,
    tier        TEXT    DEFAULT 'Tier 2',
    experience  INTEGER DEFAULT 0,
    rating      REAL    DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    status      TEXT    DEFAULT 'Pending' CHECK(status IN ('Active','On Leave','Pending','Suspended')),
    bio         TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER REFERENCES users(id),
    candidate_name TEXT,
    interviewer_id INTEGER REFERENCES interviewers(id),
    interviewer_name TEXT,
    type         TEXT    DEFAULT 'HSE Mock Interview',
    focus        TEXT,
    session_date TEXT    NOT NULL,
    session_time TEXT    DEFAULT '15:00',
    duration     INTEGER DEFAULT 60,
    status       TEXT    DEFAULT 'Upcoming' CHECK(status IN ('Upcoming','In Progress','Completed','Cancelled')),
    score_tech   REAL,
    score_comm   REAL,
    score_norm   REAL,
    score_scen   REAL,
    score_cv     REAL,
    overall_score REAL,
    feedback_text TEXT,
    fb_strengths  TEXT,
    fb_improve    TEXT,
    fb_nextsteps  TEXT,
    meeting_link  TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_interviewers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT    UNIQUE NOT NULL,
    role         TEXT,
    industry     TEXT,
    country      TEXT,
    tier         TEXT,
    experience   INTEGER DEFAULT 0,
    status       TEXT    DEFAULT 'Review',
    applied_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT    NOT NULL,
    message      TEXT    NOT NULL,
    target_role  TEXT    DEFAULT 'admin',
    target_user  INTEGER REFERENCES users(id),
    is_read      INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS availability (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    interviewer_id INTEGER REFERENCES interviewers(id) UNIQUE,
    days         TEXT    DEFAULT '[]',
    start_time   TEXT    DEFAULT '09:00',
    end_time     TEXT    DEFAULT '18:00',
    duration_mins INTEGER DEFAULT 60,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ── Seed demo data ─────────────────────────────────────────── */
(function seedDemoData() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (existing.c > 0) return;

  const hash = (p) => bcrypt.hashSync(p, 10);

  // Demo users
  const insertUser = db.prepare(`INSERT INTO users (email,password,role,fname,lname,target_role,target_country,experience,position,industry,country) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insertUser.run('rahul.mehta@gmail.com',    hash('Gulf@2025'),   'candidate','Rahul','Mehta','HSE Officer','UAE / Gulf','2-5 years',null,null,null);
  insertUser.run('arun.kumar.hse@gmail.com', hash('Expert@2025'), 'expert',   'Arun', 'Kumar',null,null,null,'Senior HSE Manager, ADNOC','HSE/EHS','UAE');
  insertUser.run('admin.proprep@gmail.com',  hash('Admin@2025'),  'admin',    'Admin','ProPrep',null,null,null,null,null,null);

  // Interviewers
  const insertInt = db.prepare(`INSERT INTO interviewers (user_id,name,role,industry,country,tier,experience,rating,total_sessions,status,bio) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const arunId = db.prepare('SELECT id FROM users WHERE email=?').get('arun.kumar.hse@gmail.com')?.id;
  insertInt.run(arunId,'Arun Kumar','Senior HSE Manager','Oil & Gas','UAE','Tier 1',14,4.9,128,'Active','ADNOC veteran. Gulf HSE standards, PTW, ALARP specialist.');
  insertInt.run(null,'Ravi Venkatesh','Construction PM','Construction','KSA','Tier 1',11,4.8,92,'Active','Riyadh-based PM. Civil and MEP across Saudi mega-projects.');
  insertInt.run(null,'Meera Pillai','EHS Engineer','HSE/EHS','UK','Tier 2',7,4.7,64,'Active','London. CDM 2015, COSHH, North Sea offshore experience.');
  insertInt.run(null,'Suresh Nair','Process Safety Specialist','Oil & Gas','India','Tier 2',9,4.9,98,'Active','Chennai. HAZOP, LOPA, process safety for refinery operations.');
  insertInt.run(null,'Lakshmi Devi','Environmental Officer','Environmental','Australia','Tier 2',8,4.6,41,'On Leave','Melbourne. WHS Act, EPA compliance, mine site environmental management.');

  // Demo sessions
  const rahulId = db.prepare('SELECT id FROM users WHERE email=?').get('rahul.mehta@gmail.com')?.id;
  const arunIntId = db.prepare('SELECT id FROM interviewers WHERE name=?').get('Arun Kumar')?.id;
  const raviIntId = db.prepare('SELECT id FROM interviewers WHERE name=?').get('Ravi Venkatesh')?.id;
  db.prepare(`INSERT INTO sessions (candidate_id,candidate_name,interviewer_id,interviewer_name,type,focus,session_date,session_time,duration,status,score_tech,score_comm,score_norm,score_scen,score_cv,overall_score,feedback_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(rahulId,'Rahul Mehta',arunIntId,'Arun Kumar','HSE Mock Interview','Gulf / UAE','2025-03-22','15:00',60,'Completed',7.6,7.2,6.9,7.4,8.1,7.4,'Strong PTW knowledge. Needs ALARP work. Strengthen Gulf-specific regulatory awareness.');
  db.prepare(`INSERT INTO sessions (candidate_id,candidate_name,interviewer_id,interviewer_name,type,focus,session_date,session_time,duration,status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(rahulId,'Rahul Mehta',raviIntId,'Ravi Venkatesh','CV Review','Gulf / UAE','2025-03-26','17:00',45,'Upcoming');

  // Pending interviewers
  db.prepare(`INSERT INTO pending_interviewers (name,email,role,industry,country,tier,experience,status) VALUES (?,?,?,?,?,?,?,?)`).run('Sameer Khan','sameer.k@gmail.com','HSE Manager','Oil & Gas','UAE','Tier 1',12,'Review');
  db.prepare(`INSERT INTO pending_interviewers (name,email,role,industry,country,tier,experience,status) VALUES (?,?,?,?,?,?,?,?)`).run('Leela Rao','leela.r@gmail.com','EHS Specialist','Manufacturing','India','Tier 2',7,'Review');

  // Notifications
  db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('session','New booking: Rahul M. with Arun K. on 26 Mar','admin');
  db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('register','New candidate registered: Demo User','admin');

  console.log('✓ Demo data seeded');
})();

/* ── Middleware ──────────────────────────────────────────────── */
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve frontend if in same folder

// JWT auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

/* ══════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════ */
app.post('/api/auth/register', (req, res) => {
  const { email, password, role, fname, lname, mobile,
          target_role, target_country, experience,
          position, industry, country, linkedin } = req.body;

  if (!email || !password || !role || !fname)
    return res.status(400).json({ error: 'email, password, role and fname are required' });
  if (!['candidate','expert'].includes(role))
    return res.status(400).json({ error: 'Invalid role. Use candidate or expert' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`INSERT INTO users (email,password,role,fname,lname,mobile,target_role,target_country,experience,position,industry,country,linkedin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const result = stmt.run(email.toLowerCase(), hash, role, fname, lname||'', mobile||'', target_role||'', target_country||'', experience||'', position||'', industry||'', country||'', linkedin||'');

  // If expert, create pending interviewer record
  if (role === 'expert') {
    db.prepare(`INSERT OR IGNORE INTO pending_interviewers (name,email,role,industry,country,tier,status) VALUES (?,?,?,?,?,'Tier 2','Review')`).run((fname+' '+(lname||'')).trim(), email.toLowerCase(), position||'', industry||'', country||'');
    db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('approval', 'New interviewer application: '+(fname+' '+(lname||'')).trim(), 'admin');
  } else {
    db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('register', 'New candidate registered: '+(fname+' '+(lname||'')).trim(), 'admin');
  }

  const user = db.prepare('SELECT id,email,role,fname,lname,target_role,target_country FROM users WHERE id=?').get(result.lastInsertRowid);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  delete user.password;
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,email,role,fname,lname,mobile,target_role,target_country,experience,position,industry,country,linkedin FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.put('/api/auth/me', auth, (req, res) => {
  const { fname, lname, mobile, target_role, target_country, experience, position, industry, country, linkedin } = req.body;
  db.prepare(`UPDATE users SET fname=COALESCE(?,fname),lname=COALESCE(?,lname),mobile=COALESCE(?,mobile),target_role=COALESCE(?,target_role),target_country=COALESCE(?,target_country),experience=COALESCE(?,experience),position=COALESCE(?,position),industry=COALESCE(?,industry),country=COALESCE(?,country),linkedin=COALESCE(?,linkedin) WHERE id=?`).run(fname,lname,mobile,target_role,target_country,experience,position,industry,country,linkedin,req.user.id);
  const user = db.prepare('SELECT id,email,role,fname,lname,mobile,target_role,target_country,experience,position,industry,country,linkedin FROM users WHERE id=?').get(req.user.id);
  res.json(user);
});

/* ══════════════════════════════════════════════════════════════
   INTERVIEWERS
══════════════════════════════════════════════════════════════ */
app.get('/api/interviewers', (req, res) => {
  const { industry, country, tier, status } = req.query;
  let sql = 'SELECT * FROM interviewers WHERE 1=1';
  const params = [];
  if (industry) { sql += ' AND industry LIKE ?'; params.push('%'+industry+'%'); }
  if (country)  { sql += ' AND country=?';        params.push(country); }
  if (tier)     { sql += ' AND tier=?';            params.push(tier); }
  sql += ` AND status=?`; params.push(status || 'Active');
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/interviewers/:id', (req, res) => {
  const interviewer = db.prepare('SELECT * FROM interviewers WHERE id=?').get(req.params.id);
  if (!interviewer) return res.status(404).json({ error: 'Not found' });
  res.json(interviewer);
});

app.put('/api/interviewers/:id', auth, (req, res) => {
  const { bio, status } = req.body;
  db.prepare('UPDATE interviewers SET bio=COALESCE(?,bio), status=COALESCE(?,status) WHERE id=?').run(bio, status, req.params.id);
  res.json(db.prepare('SELECT * FROM interviewers WHERE id=?').get(req.params.id));
});

/* ── Availability ── */
app.get('/api/interviewers/:id/availability', (req, res) => {
  const avail = db.prepare('SELECT * FROM availability WHERE interviewer_id=?').get(req.params.id);
  res.json(avail || { days: '[]', start_time: '09:00', end_time: '18:00', duration_mins: 60 });
});

app.put('/api/interviewers/:id/availability', auth, (req, res) => {
  const { days, start_time, end_time, duration_mins } = req.body;
  const daysJson = JSON.stringify(days || []);
  db.prepare(`INSERT INTO availability (interviewer_id,days,start_time,end_time,duration_mins,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(interviewer_id) DO UPDATE SET days=excluded.days,start_time=excluded.start_time,end_time=excluded.end_time,duration_mins=excluded.duration_mins,updated_at=CURRENT_TIMESTAMP`).run(req.params.id, daysJson, start_time||'09:00', end_time||'18:00', duration_mins||60);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════
   SESSIONS
══════════════════════════════════════════════════════════════ */
app.get('/api/sessions', auth, (req, res) => {
  let sql, params;
  if (req.user.role === 'candidate') {
    sql = 'SELECT * FROM sessions WHERE candidate_id=? ORDER BY session_date DESC';
    params = [req.user.id];
  } else if (req.user.role === 'expert') {
    const interviewer = db.prepare('SELECT id FROM interviewers WHERE user_id=?').get(req.user.id);
    if (!interviewer) return res.json([]);
    sql = 'SELECT * FROM sessions WHERE interviewer_id=? ORDER BY session_date DESC';
    params = [interviewer.id];
  } else { // admin
    sql = 'SELECT * FROM sessions ORDER BY created_at DESC LIMIT 100';
    params = [];
  }
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/sessions', auth, (req, res) => {
  const { interviewer_id, type, focus, session_date, session_time, duration } = req.body;
  if (!interviewer_id || !session_date) return res.status(400).json({ error: 'interviewer_id and session_date are required' });
  const interviewer = db.prepare('SELECT * FROM interviewers WHERE id=?').get(interviewer_id);
  if (!interviewer) return res.status(404).json({ error: 'Interviewer not found' });
  const user = db.prepare('SELECT fname,lname FROM users WHERE id=?').get(req.user.id);
  const candName = (user.fname+' '+(user.lname||'')).trim();
  const result = db.prepare(`INSERT INTO sessions (candidate_id,candidate_name,interviewer_id,interviewer_name,type,focus,session_date,session_time,duration,status) VALUES (?,?,?,?,?,?,?,?,?,'Upcoming')`).run(req.user.id, candName, interviewer_id, interviewer.name, type||'HSE Mock Interview', focus||'Gulf / UAE', session_date, session_time||'15:00', duration||60);

  // Update candidate's session count
  db.prepare('UPDATE users SET target_country=COALESCE(target_country,?) WHERE id=?').run(focus, req.user.id);

  // Notifications
  db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('session', 'New booking: '+candName+' with '+interviewer.name+' on '+session_date, 'admin');

  res.status(201).json(db.prepare('SELECT * FROM sessions WHERE id=?').get(result.lastInsertRowid));
});

app.put('/api/sessions/:id/feedback', auth, (req, res) => {
  const { score_tech, score_comm, score_norm, score_scen, score_cv, feedback_text, fb_strengths, fb_improve, fb_nextsteps } = req.body;
  const overall = ((score_tech||5)+(score_comm||5)+(score_norm||5)+(score_scen||5)+(score_cv||5))/5;
  db.prepare(`UPDATE sessions SET status='Completed',score_tech=?,score_comm=?,score_norm=?,score_scen=?,score_cv=?,overall_score=?,feedback_text=?,fb_strengths=?,fb_improve=?,fb_nextsteps=? WHERE id=?`).run(score_tech,score_comm,score_norm,score_scen,score_cv,parseFloat(overall.toFixed(1)),feedback_text||'',fb_strengths||'',fb_improve||'',fb_nextsteps||'',req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);

  // Update interviewer's session count
  db.prepare('UPDATE interviewers SET total_sessions=total_sessions+1 WHERE id=?').run(session.interviewer_id);

  // Notify admin & candidate
  db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('feedback', 'Feedback submitted for '+session.candidate_name+' — Score '+overall.toFixed(1), 'admin');

  res.json(session);
});

app.put('/api/sessions/:id', auth, adminOnly, (req, res) => {
  const { status, session_date, session_time } = req.body;
  db.prepare('UPDATE sessions SET status=COALESCE(?,status),session_date=COALESCE(?,session_date),session_time=COALESCE(?,session_time) WHERE id=?').run(status,session_date,session_time,req.params.id);
  res.json(db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id));
});

app.delete('/api/sessions/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════
   CANDIDATES (admin)
══════════════════════════════════════════════════════════════ */
app.get('/api/candidates', auth, adminOnly, (req, res) => {
  const rows = db.prepare(`SELECT u.id,u.email,u.fname,u.lname,u.target_role,u.target_country,u.experience,u.created_at, COUNT(s.id) as total_sessions FROM users u LEFT JOIN sessions s ON s.candidate_id=u.id WHERE u.role='candidate' GROUP BY u.id ORDER BY u.created_at DESC`).all();
  res.json(rows);
});

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════════════════ */
app.get('/api/notifications', auth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare("SELECT * FROM notifications WHERE target_role='admin' ORDER BY created_at DESC LIMIT 50").all();
  } else {
    rows = db.prepare('SELECT * FROM notifications WHERE target_user=? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  }
  res.json(rows);
});

app.put('/api/notifications/read', auth, (req, res) => {
  if (req.user.role === 'admin') {
    db.prepare("UPDATE notifications SET is_read=1 WHERE target_role='admin'").run();
  } else {
    db.prepare('UPDATE notifications SET is_read=1 WHERE target_user=?').run(req.user.id);
  }
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════════════
   PENDING INTERVIEWERS (admin)
══════════════════════════════════════════════════════════════ */
app.get('/api/pending-interviewers', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM pending_interviewers ORDER BY applied_at DESC').all());
});

app.post('/api/pending-interviewers/:id/approve', auth, adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM pending_interviewers WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  // Create interviewer record
  db.prepare(`INSERT INTO interviewers (name,role,industry,country,tier,experience,rating,total_sessions,status) VALUES (?,?,?,?,?,?,0,0,'Active')`).run(p.name, p.role, p.industry, p.country, p.tier, p.experience);
  db.prepare('DELETE FROM pending_interviewers WHERE id=?').run(req.params.id);
  db.prepare(`INSERT INTO notifications (type,message,target_role) VALUES (?,?,?)`).run('approval', p.name+' approved as interviewer', 'admin');
  res.json({ ok: true });
});

app.delete('/api/pending-interviewers/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM pending_interviewers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* ── Admin stats ── */
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  res.json({
    total_sessions:      db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    completed_sessions:  db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status='Completed'").get().c,
    total_candidates:    db.prepare("SELECT COUNT(*) as c FROM users WHERE role='candidate'").get().c,
    active_interviewers: db.prepare("SELECT COUNT(*) as c FROM interviewers WHERE status='Active'").get().c,
    pending_approvals:   db.prepare('SELECT COUNT(*) as c FROM pending_interviewers').get().c,
    unread_notifs:       db.prepare("SELECT COUNT(*) as c FROM notifications WHERE target_role='admin' AND is_read=0").get().c,
  });
});

/* ── Health check ── */
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

/* ── Serve frontend from /public if deployed together ── */
app.get('*', (req, res) => {
  const fp = path.join(__dirname, 'public', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(fp)) res.sendFile(fp);
  else res.json({ message: 'ProPrep API running. Frontend not found in /public.' });
});

app.listen(PORT, () => console.log(`✓ ProPrep API running on port ${PORT}`));
module.exports = app;
