# CLAUDE.md - MomentoLite 開発ガイド

## 基本方針
- コード内のUI文言・コメント・コミットメッセージは **日本語** で書く
- 会話も日本語で行う
- 依存パッケージは最小限に保つ（必要な場合のみ追加）
- エラーメッセージはユーザーにわかりやすい日本語にする
- PRは自動作成できない環境のため、ブランチをプッシュしたらPR作成用URLを提示する

## 技術スタック
- **フロントエンド**: React 19 + TypeScript + Vite + React Router DOM + TanStack Query
- **バックエンド**: Express.js (ESM) + better-sqlite3
- **画像保存**: Cloudinary (authenticated URLs)
- **認証**: パスワード (scrypt) + WebAuthn + メールによるパスワードリセット
- **メール送信**: nodemailer (SMTP設定は環境変数で指定)

## プロジェクト構成
```
src/           - Reactフロントエンド
  pages/       - ページコンポーネント (LoginPage, PasswordResetPage, etc.)
  components/  - UIコンポーネント
  lib/         - API・認証・ユーティリティ
server/        - Expressバックエンド
  index.js     - 全APIルート
  db.js        - SQLiteスキーマ・マイグレーション
```

## 環境変数 (SMTP)
パスワードリセット機能を有効にするには以下を設定:
- `SMTP_HOST` - SMTPサーバーホスト
- `SMTP_PORT` - ポート番号 (デフォルト: 587)
- `SMTP_SECURE` - TLS使用 ("true" / "false")
- `SMTP_USER` - SMTPユーザー
- `SMTP_PASS` - SMTPパスワード
- `SMTP_FROM` - 送信元アドレス (省略時はSMTP_USERを使用)

## 開発コマンド
- `npm run dev` - フロントエンド開発サーバー
- `npm run server` - バックエンドサーバー
- `npm run build` - プロダクションビルド
- `npm run lint` - ESLint実行
