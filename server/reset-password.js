#!/usr/bin/env node
/**
 * 管理者用パスワードリセットスクリプト
 *
 * 使い方:
 *   node server/reset-password.js <ユーザー名> <新しいパスワード>
 *
 * メール未登録でパスワードを忘れたユーザーのために、
 * サーバー管理者が直接パスワードをリセットできます。
 */
import crypto from 'crypto';
import { initDb, getDb } from './db.js';

const [username, newPassword] = process.argv.slice(2);

if (!username || !newPassword) {
  console.error('使い方: node server/reset-password.js <ユーザー名> <新しいパスワード>');
  process.exit(1);
}

if (newPassword.length < 4) {
  console.error('エラー: パスワードは4文字以上にしてください');
  process.exit(1);
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      resolve(salt.toString('hex') + ':' + derived.toString('hex'));
    });
  });
}

initDb();
const db = getDb();

const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`エラー: ユーザー「${username}」が見つかりません`);
  process.exit(1);
}

const passwordHash = await hashPassword(newPassword);
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

// 既存セッションを全て無効化（セキュリティのため）
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

console.log(`ユーザー「${username}」のパスワードをリセットしました。`);
console.log('既存のセッションは全て無効化されました。新しいパスワードでログインしてください。');
