const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('Set SESSION_SECRET to a random value at least 32 characters long.');
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

let db;
const emailOK = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
const textOK = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

async function start() {
  db = await open({ filename: path.join(__dirname, 'data', 'visionmate.sqlite'), driver: sqlite3.Database });
  await db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!textOK(name, 80) || !emailOK(email) || typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Enter a name, valid email and password (8–72 characters).' });
    }
    try {
      const hash = await bcrypt.hash(password, 12);
      const result = await db.run('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', name.trim(), email.toLowerCase().trim(), hash);
      req.session.userId = result.lastID;
      res.status(201).json({ message: 'Account created successfully.' });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with this email already exists.' });
      console.error(err); res.status(500).json({ error: 'Could not create account.' });
    }
  });

  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 15 }), async (req, res) => {
    const { email, password } = req.body || {};
    if (!emailOK(email) || typeof password !== 'string' || password.length > 72) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const user = await db.get('SELECT id,name,email,password_hash FROM users WHERE email = ?', email.toLowerCase().trim());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Incorrect email or password.' });
    req.session.userId = user.id;
    res.json({ message: `Welcome, ${user.name}.` });
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await db.get('SELECT id,name,email,created_at FROM users WHERE id = ?', req.session.userId);
    res.json({ user: user || null });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Logged out.' }));
  });

  app.post('/api/feedback', async (req, res) => {
    const { name, email, message } = req.body || {};
    if (!textOK(name, 80) || !emailOK(email) || !textOK(message, 2000)) return res.status(400).json({ error: 'Please complete all fields with a valid email.' });
    await db.run('INSERT INTO feedback (name,email,message) VALUES (?,?,?)', name.trim(), email.toLowerCase().trim(), message.trim());
    res.status(201).json({ message: 'Thank you. Your message has been saved.' });
  });

  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.listen(PORT, () => console.log(`VisionMate running at http://localhost:${PORT}`));
}
start().catch(err => { console.error(err); process.exit(1); });
