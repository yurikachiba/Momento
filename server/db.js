import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function initDb() {
  const isVercel = !!process.env.VERCEL;
  const defaultPath = isVercel ? '/tmp/momento.db' : path.join(__dirname, '..', 'data', 'momento.db');
  const dbPath = process.env.DB_PATH || defaultPath;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Schema migration: if the users table exists but is missing expected columns,
  // drop all tables so they get recreated with the correct schema.
  const usersInfo = db.pragma('table_info(users)');
  if (usersInfo.length > 0) {
    const columnNames = usersInfo.map(c => c.name);
    if (!columnNames.includes('username')) {
      db.pragma('foreign_keys = OFF');
      db.exec('DROP TABLE IF EXISTS photo_albums');
      db.exec('DROP TABLE IF EXISTS photos');
      db.exec('DROP TABLE IF EXISTS albums');
      db.exec('DROP TABLE IF EXISTS webauthn_credentials');
      db.exec('DROP TABLE IF EXISTS sessions');
      db.exec('DROP TABLE IF EXISTS users');
      db.pragma('foreign_keys = ON');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      cloudinary_id TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      quality TEXT NOT NULL DEFAULT 'auto',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS photo_albums (
      photo_id TEXT NOT NULL,
      album_id TEXT NOT NULL,
      PRIMARY KEY (photo_id, album_id),
      FOREIGN KEY (photo_id) REFERENCES photos(id),
      FOREIGN KEY (album_id) REFERENCES albums(id)
    );

    CREATE TABLE IF NOT EXISTS album_shares (
      id TEXT PRIMARY KEY,
      album_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      shared_with_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (album_id) REFERENCES albums(id),
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
      UNIQUE(album_id, shared_with_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
    CREATE INDEX IF NOT EXISTS idx_albums_user ON albums(user_id);
    CREATE INDEX IF NOT EXISTS idx_photo_albums_photo ON photo_albums(photo_id);
    CREATE INDEX IF NOT EXISTS idx_photo_albums_album ON photo_albums(album_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);
    CREATE INDEX IF NOT EXISTS idx_album_shares_album ON album_shares(album_id);
    CREATE INDEX IF NOT EXISTS idx_album_shares_shared_with ON album_shares(shared_with_user_id);
  `);

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}
