import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';

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

// --- Middleware ---

function getUserId(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId || typeof userId !== 'string' || userId.length > 100) {
    return res.status(400).json({ error: 'Missing or invalid X-User-Id header' });
  }
  req.userId = userId;
  next();
}

function ensureUser(req, res, next) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').run(req.userId, Date.now());
  }
  next();
}

// --- Routes ---

// Upload photo
app.post('/api/upload', getUserId, ensureUser, upload.single('photo'), async (req, res) => {
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

// Get photos
app.get('/api/photos', getUserId, ensureUser, (req, res) => {
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

// Update photo metadata
app.patch('/api/photos/:id', getUserId, ensureUser, (req, res) => {
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

// Delete photo
app.delete('/api/photos/:id', getUserId, ensureUser, async (req, res) => {
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

// Get albums
app.get('/api/albums', getUserId, ensureUser, (req, res) => {
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

// Create album
app.post('/api/albums', getUserId, ensureUser, (req, res) => {
  const db = getDb();
  const { name, icon } = req.body;
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  db.prepare(
    'INSERT INTO albums (id, user_id, name, icon, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.userId, name, icon || '', createdAt);
  res.json({ id, name, icon: icon || '', createdAt });
});

// Delete album
app.delete('/api/albums/:id', getUserId, ensureUser, (req, res) => {
  const db = getDb();
  const album = db.prepare(
    'SELECT * FROM albums WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!album) return res.status(404).json({ error: 'Album not found' });

  db.prepare('DELETE FROM photo_albums WHERE album_id = ?').run(req.params.id);
  db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Add photo to album
app.post('/api/photos/:photoId/albums/:albumId', getUserId, ensureUser, (req, res) => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO photo_albums (photo_id, album_id) VALUES (?, ?)'
  ).run(req.params.photoId, req.params.albumId);
  res.json({ ok: true });
});

// Remove photo from album
app.delete('/api/photos/:photoId/albums/:albumId', getUserId, ensureUser, (req, res) => {
  const db = getDb();
  db.prepare(
    'DELETE FROM photo_albums WHERE photo_id = ? AND album_id = ?'
  ).run(req.params.photoId, req.params.albumId);
  res.json({ ok: true });
});

// Get usage stats
app.get('/api/usage', getUserId, ensureUser, (req, res) => {
  const db = getDb();
  const stats = db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as totalSize FROM photos WHERE user_id = ?'
  ).get(req.userId);
  res.json({
    count: stats.count,
    totalSize: stats.totalSize,
    limit: 25 * 1024 * 1024 * 1024, // 25GB Cloudinary free plan
  });
});

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Start
const PORT = process.env.PORT || 3001;
initDb();
app.listen(PORT, () => {
  console.log(`Momento server running on port ${PORT}`);
});
