import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// --- WebAuthn Config ---
const RP_NAME = 'Momento Lite';

function getWebAuthnConfig(req) {
  // Derive RP ID from the browser's Origin header so it matches the domain
  // the user is actually on (e.g. Vercel frontend proxying to Render backend)
  const originHeader = req.get('origin');
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      return { rpID: url.hostname, origin: url.origin };
    } catch {
      // fall through to defaults
    }
  }
  const rpID = process.env.RP_ID || req.hostname;
  const origin = process.env.ORIGIN || `${req.protocol}://${req.get('host')}`;
  return { rpID, origin };
}

// In-memory challenge store (per-session, short-lived)
const challengeStore = new Map();

// --- Helpers ---

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      resolve(salt.toString('hex') + ':' + derived.toString('hex'));
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [saltHex, hashHex] = stored.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      resolve(derived.toString('hex') === hashHex);
    });
  });
}

function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token, userId, now, expiresAt
  );
  return { token, expiresAt };
}

function cleanExpiredSessions() {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

// --- Auth Middleware ---

function getSessionUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }
  const token = authHeader.slice(7);
  const db = getDb();
  const session = db.prepare(
    'SELECT s.user_id, u.username, u.display_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?'
  ).get(token, Date.now());
  if (!session) {
    return res.status(401).json({ error: 'セッションが無効です' });
  }
  req.userId = session.user_id;
  req.userName = session.username;
  req.userDisplayName = session.display_name;
  next();
}

// --- Auth Routes ---

// Register (username + password only, no email)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
    }
    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({ error: 'ユーザー名は2〜30文字にしてください' });
    }
    if (!/^[a-zA-Z0-9_\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+$/.test(username)) {
      return res.status(400).json({ error: 'ユーザー名に使えない文字が含まれています' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'パスワードは4文字以上にしてください' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'このユーザー名は既に使われています' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    db.prepare(
      'INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, username, passwordHash, displayName || username, now);

    const session = createSession(id);
    res.json({
      token: session.token,
      user: { id, username, displayName: displayName || username },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

// Login (username + password)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' });
    }

    const session = createSession(user.id);
    res.json({
      token: session.token,
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

// Check session
app.get('/api/auth/me', getSessionUser, (req, res) => {
  res.json({
    user: { id: req.userId, username: req.userName, displayName: req.userDisplayName },
  });
});

// --- WebAuthn Routes ---

// Start registration (generate options)
app.post('/api/webauthn/register/options', getSessionUser, async (req, res) => {
  try {
    const db = getDb();
    const existingCreds = db.prepare(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?'
    ).all(req.userId);

    const { rpID, origin } = getWebAuthnConfig(req);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpID,
      userID: new TextEncoder().encode(req.userId),
      userName: req.userName,
      userDisplayName: req.userDisplayName || req.userName,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credential_id,
        transports: JSON.parse(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    challengeStore.set(req.userId, options.challenge);
    setTimeout(() => challengeStore.delete(req.userId), 5 * 60 * 1000);

    res.json(options);
  } catch (err) {
    console.error('WebAuthn register options error:', err);
    res.status(500).json({ error: '生体認証の設定準備に失敗しました' });
  }
});

// Complete registration (verify response)
app.post('/api/webauthn/register/verify', getSessionUser, async (req, res) => {
  try {
    const expectedChallenge = challengeStore.get(req.userId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'もう一度やり直してください' });
    }

    const { rpID, origin } = getWebAuthnConfig(req);
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: '生体認証の登録に失敗しました' });
    }

    const { credential } = verification.registrationInfo;
    const db = getDb();
    const id = crypto.randomUUID();

    db.prepare(
      'INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      req.userId,
      Buffer.from(credential.id).toString('base64url'),
      Buffer.from(credential.publicKey).toString('base64'),
      credential.counter,
      JSON.stringify(req.body.response?.transports || []),
      Date.now()
    );

    challengeStore.delete(req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('WebAuthn register verify error:', err);
    res.status(500).json({ error: '生体認証の登録に失敗しました' });
  }
});

// Start authentication (generate options)
app.post('/api/webauthn/login/options', async (req, res) => {
  try {
    const { username } = req.body;
    const db = getDb();

    let allowCredentials = [];
    let userId = null;

    if (username) {
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (user) {
        userId = user.id;
        const creds = db.prepare(
          'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?'
        ).all(user.id);
        allowCredentials = creds.map((c) => ({
          id: c.credential_id,
          transports: JSON.parse(c.transports),
        }));
      }
    }

    const { rpID } = getWebAuthnConfig(req);
    const options = await generateAuthenticationOptions({
      rpID: rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeKey = userId || `anon_${options.challenge}`;
    challengeStore.set(challengeKey, { challenge: options.challenge, userId });
    setTimeout(() => challengeStore.delete(challengeKey), 5 * 60 * 1000);

    res.json({ ...options, _challengeKey: challengeKey });
  } catch (err) {
    console.error('WebAuthn login options error:', err);
    res.status(500).json({ error: '生体認証ログインの準備に失敗しました' });
  }
});

// Complete authentication (verify response)
app.post('/api/webauthn/login/verify', async (req, res) => {
  try {
    const { _challengeKey, ...authResponse } = req.body;
    const stored = challengeStore.get(_challengeKey);
    if (!stored) {
      return res.status(400).json({ error: 'チャレンジが見つかりません' });
    }

    const db = getDb();
    const credentialIdFromResponse = authResponse.id;

    const credential = db.prepare(
      'SELECT * FROM webauthn_credentials WHERE credential_id = ?'
    ).get(credentialIdFromResponse);

    if (!credential) {
      return res.status(400).json({ error: '登録されていない認証情報です' });
    }

    const { rpID, origin } = getWebAuthnConfig(req);
    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, 'base64'),
        counter: credential.counter,
        transports: JSON.parse(credential.transports),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: '生体認証に失敗しました' });
    }

    db.prepare('UPDATE webauthn_credentials SET counter = ? WHERE id = ?').run(
      verification.authenticationInfo.newCounter,
      credential.id
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(credential.user_id);
    const session = createSession(user.id);
    challengeStore.delete(_challengeKey);

    res.json({
      token: session.token,
      user: { id: user.id, username: user.username, displayName: user.display_name },
    });
  } catch (err) {
    console.error('WebAuthn login verify error:', err);
    res.status(500).json({ error: '生体認証ログインに失敗しました' });
  }
});

// Check if user has WebAuthn credentials
app.get('/api/webauthn/status', getSessionUser, (req, res) => {
  const db = getDb();
  const creds = db.prepare(
    'SELECT id, created_at FROM webauthn_credentials WHERE user_id = ?'
  ).all(req.userId);
  res.json({ registered: creds.length > 0, count: creds.length });
});

// Check if a username has WebAuthn credentials (for login page)
app.post('/api/webauthn/check', (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ available: false });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) return res.json({ available: false });
  const creds = db.prepare(
    'SELECT id FROM webauthn_credentials WHERE user_id = ?'
  ).all(user.id);
  res.json({ available: creds.length > 0 });
});

// --- Photo Routes ---

app.post('/api/upload', getSessionUser, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const quality = req.body.quality || 'auto';
    const albumId = req.body.albumId || null;
    const name = req.body.name || 'photo';

    const qualityMap = { high: 90, auto: 'auto', light: 50 };
    const q = qualityMap[quality] || 'auto';

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `momento/${req.userId}`,
          quality: q,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const thumbnailUrl = cloudinary.url(result.public_id, {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
    });

    const db = getDb();
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    db.prepare(`
      INSERT INTO photos (id, user_id, cloudinary_id, url, thumbnail_url, name, memo, width, height, size, quality, created_at)
      VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)
    `).run(id, req.userId, result.public_id, result.secure_url, thumbnailUrl, name, result.width, result.height, result.bytes, quality, createdAt);

    if (albumId) {
      const album = db.prepare('SELECT id FROM albums WHERE id = ? AND user_id = ?').get(albumId, req.userId);
      if (album) {
        db.prepare('INSERT OR IGNORE INTO photo_albums (photo_id, album_id) VALUES (?, ?)').run(id, albumId);
      }
    }

    res.json({
      id,
      url: result.secure_url,
      thumbnailUrl,
      name,
      memo: '',
      albumIds: albumId ? [albumId] : [],
      createdAt,
      width: result.width,
      height: result.height,
      size: result.bytes,
      quality,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/photos', getSessionUser, (req, res) => {
  const db = getDb();
  const albumId = req.query.albumId;

  let photos;
  if (albumId) {
    photos = db.prepare(`
      SELECT p.* FROM photos p
      JOIN photo_albums pa ON p.id = pa.photo_id
      WHERE p.user_id = ? AND pa.album_id = ?
      ORDER BY p.created_at DESC
    `).all(req.userId, albumId);
  } else {
    photos = db.prepare(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.userId);
  }

  const result = photos.map((p) => {
    const albumRows = db.prepare(
      'SELECT album_id FROM photo_albums WHERE photo_id = ?'
    ).all(p.id);
    return {
      id: p.id,
      url: p.url,
      thumbnailUrl: p.thumbnail_url,
      name: p.name,
      memo: p.memo,
      albumIds: albumRows.map((r) => r.album_id),
      createdAt: p.created_at,
      width: p.width,
      height: p.height,
      size: p.size,
      quality: p.quality,
    };
  });

  res.json(result);
});

app.patch('/api/photos/:id', getSessionUser, (req, res) => {
  const db = getDb();
  const photo = db.prepare(
    'SELECT * FROM photos WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const { name, memo } = req.body;
  if (name !== undefined) {
    db.prepare('UPDATE photos SET name = ? WHERE id = ?').run(name, req.params.id);
  }
  if (memo !== undefined) {
    db.prepare('UPDATE photos SET memo = ? WHERE id = ?').run(memo, req.params.id);
  }

  res.json({ ok: true });
});

// Bulk delete photos
app.post('/api/photos/bulk-delete', getSessionUser, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '削除する写真を選択してください' });
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const photos = db.prepare(
    `SELECT * FROM photos WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, req.userId);

  // Delete from Cloudinary (best effort)
  for (const photo of photos) {
    try {
      await cloudinary.uploader.destroy(photo.cloudinary_id);
    } catch (err) {
      console.error('Cloudinary delete error:', err);
    }
  }

  const photoIds = photos.map((p) => p.id);
  if (photoIds.length > 0) {
    const ph = photoIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM photo_albums WHERE photo_id IN (${ph})`).run(...photoIds);
    db.prepare(`DELETE FROM photos WHERE id IN (${ph})`).run(...photoIds);
  }

  res.json({ ok: true, deleted: photoIds.length });
});

app.delete('/api/photos/:id', getSessionUser, async (req, res) => {
  const db = getDb();
  const photo = db.prepare(
    'SELECT * FROM photos WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  try {
    await cloudinary.uploader.destroy(photo.cloudinary_id);
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }

  db.prepare('DELETE FROM photo_albums WHERE photo_id = ?').run(req.params.id);
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);

  res.json({ ok: true });
});

app.get('/api/albums', getSessionUser, (req, res) => {
  const db = getDb();
  const albums = db.prepare(
    'SELECT * FROM albums WHERE user_id = ? ORDER BY created_at ASC'
  ).all(req.userId);
  res.json(
    albums.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      createdAt: a.created_at,
    }))
  );
});

app.post('/api/albums', getSessionUser, (req, res) => {
  const db = getDb();
  const { name, icon } = req.body;
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  db.prepare(
    'INSERT INTO albums (id, user_id, name, icon, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.userId, name, icon || '', createdAt);
  res.json({ id, name, icon: icon || '', createdAt });
});

app.delete('/api/albums/:id', getSessionUser, (req, res) => {
  const db = getDb();
  const album = db.prepare(
    'SELECT * FROM albums WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!album) return res.status(404).json({ error: 'Album not found' });

  db.prepare('DELETE FROM photo_albums WHERE album_id = ?').run(req.params.id);
  db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/photos/:photoId/albums/:albumId', getSessionUser, (req, res) => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO photo_albums (photo_id, album_id) VALUES (?, ?)'
  ).run(req.params.photoId, req.params.albumId);
  res.json({ ok: true });
});

app.delete('/api/photos/:photoId/albums/:albumId', getSessionUser, (req, res) => {
  const db = getDb();
  db.prepare(
    'DELETE FROM photo_albums WHERE photo_id = ? AND album_id = ?'
  ).run(req.params.photoId, req.params.albumId);
  res.json({ ok: true });
});

app.get('/api/usage', getSessionUser, (req, res) => {
  const db = getDb();
  const stats = db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as totalSize FROM photos WHERE user_id = ?'
  ).get(req.userId);
  res.json({
    count: stats.count,
    totalSize: stats.totalSize,
    limit: 25 * 1024 * 1024 * 1024,
  });
});

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Initialize DB
initDb();
cleanExpiredSessions();

// Export for Vercel serverless
export default app;

// Start server only when not on Vercel (Vercel uses serverless handler)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Momento server running on port ${PORT}`);
  });
}
