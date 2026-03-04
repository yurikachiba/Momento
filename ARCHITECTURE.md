# MomentoLite — 設計と技術と思想

## 「iCloudは怖い。でもiPadの容量がない」

母からの一言だった。

iCloudの仕組みがよくわからない。勝手に同期される感じが気持ち悪い。Googleアカウントも持っていない。でもiPadの写真がもう入らない。どうにかして。

これがMomentoLiteの出発点だ。

写真を「自分の見える場所」に、「自分のわかる操作で」保存したい。iCloudのような目に見えない同期ではなく、自分でアップロードして、自分で見て、自分で消す。ただそれだけのことを、ただそれだけの複雑さでやりたい。

そういうアプリを作った。

---

## 思想 — 何を作らないかを決める

MomentoLiteの設計は「何を入れるか」ではなく「何を入れないか」から始まっている。

### 入れなかったもの

- **メールアドレス登録** — 母はメールアドレスを覚えていない。パスワードリセットのためだけにメールを要求するのは、ユーザーに負担を押し付ける設計だ。ユーザー名とパスワードだけで始められるようにした。
- **Googleログイン/Appleログイン** — 「Googleって何」から説明が始まる人に、OAuthの同意画面を見せたくなかった。
- **SNS的機能** — フォロー、いいね、コメント、共有アルバム。すべて削った。これは家族の写真を守るアプリであって、人に見せるアプリではない。
- **フォルダ階層** — 「アルバムの中にアルバム」は作れない。階層が深くなるほど写真は見つからなくなる。フラットなアルバムが一列に並ぶだけ。
- **自動整理/AI分類** — 人間が自分で分類する。機械に勝手に分けられると「あの写真どこ行った」が始まる。
- **トラッキング/アナリティクス** — 母の写真閲覧パターンを収集する理由がない。Google Analyticsは入れていない。広告もない。

### 入れたもの

残ったのは3つだけだ。

1. **写真を上げる**
2. **写真を見る**
3. **写真をアルバムに分ける**

ランディングページのコピーにそのまま書いた。

> 容量ゼロ・高画質・消えない。
> いちばんシンプルな写真保存アプリ。

「いちばんシンプル」は制約であり、設計原則であり、品質基準だ。機能を足すたびにこの言葉に立ち返った。

---

## アーキテクチャ — 意図のある技術選定

### 全体構成

```
┌─────────────┐     HTTPS      ┌──────────────┐     Stream     ┌──────────────┐
│   iPad /    │  ──────────▶  │   Express.js  │  ──────────▶  │  Cloudinary  │
│   iPhone    │  ◀──────────  │   (Render)    │  ◀──────────  │     CDN      │
│   Browser   │    JSON/HTML   │              │    URL/Meta    │              │
└─────────────┘               └──────┬───────┘               └──────────────┘
       │                             │
       │  Service Worker             │  SQLite (WAL)
       │  (Offline Cache)            │  better-sqlite3
       │                             │
       ▼                             ▼
  ローカルキャッシュ            /data/momento.db
  (写真の高速表示)             (メタデータ永続化)
```

フロントエンドはVercelから配信し、APIリクエストだけをRender上のExpressサーバーにプロキシする。写真の実体はCloudinaryのCDNに載る。ユーザーのデバイスには**一切の写真データを保存しない**。これが「容量ゼロ」の正体だ。

### なぜこの構成なのか

| 選択 | 理由 |
|------|------|
| **React + TypeScript** | 型安全。コンポーネント分割の粒度が小さい写真アプリに向いている。Vueも検討したが、エコシステムの厚みでReactを選んだ |
| **Vite** | Create React Appは遅すぎた。Vite 7.xのHMRは体感0.1秒。開発効率が文字通り10倍になる |
| **Express.js** | Next.jsは過剰だった。APIが15エンドポイント程度のアプリにフレームワークの魔法は要らない。`server/index.js`が712行で全APIが読める。これが「読めるバックエンド」の価値 |
| **SQLite + better-sqlite3** | PostgreSQLはこの規模に対して重すぎる。SQLiteは単一ファイル、バックアップはファイルコピー、WALモードで読み書き並行。個人〜家族規模のアプリにはこれが最適解 |
| **Cloudinary** | S3 + CloudFrontの構成も考えた。しかしCloudinaryは画像アップロード時に自動最適化・サムネイル生成・CDN配信を一発でやる。写真アプリにとってS3は「ストレージ」でしかないが、Cloudinaryは「画像プラットフォーム」だ |
| **PWA** | ネイティブアプリ（Swift/Kotlin）は論外。App Storeの審査を待つ間に母のiPadは満杯になる。PWAなら「ホーム画面に追加」で即座にアプリになる |

---

## 認証 — 徹底的に敷居を下げる

### パスワード認証

登録に必要なのはユーザー名とパスワードだけ。メールもSMS認証も要求しない。

```
POST /api/auth/register
Body: { username: "mama", password: "1234" }
```

ユーザー名には日本語（ひらがな・カタカナ・漢字）を許可している。正規表現 `/^[a-zA-Z0-9_\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+$/` で、「おかあさん」というユーザー名で登録できる。

パスワードは `crypto.scrypt` でハッシュ化する。16バイトのランダムsaltを生成し、64バイトの派生鍵を得る。bcryptではなくscryptを選んだのは、Node.js標準ライブラリだけで完結させたかったから。外部依存を1つ減らすことは、将来の脆弱性リスクを1つ減らすことだ。

```javascript
// salt:hash の形式で保存
// "a1b2c3...（salt 32文字）:d4e5f6...（hash 128文字）"
const salt = crypto.randomBytes(16);
crypto.scrypt(password, salt, 64, (err, derived) => {
  const stored = salt.toString('hex') + ':' + derived.toString('hex');
});
```

### セッション管理

ログイン成功時に32バイトのランダムトークンを発行し、30日間有効。短すぎるとログインの手間が増え、長すぎるとセキュリティリスクが増える。30日は「月に一度くらいログインし直す」という感覚的な妥協点だ。

サーバー起動時に期限切れセッションを一括削除する。`cleanExpiredSessions()` が `initDb()` の直後に呼ばれる。このタイミング選択には理由がある — cron等の外部スケジューラに依存せず、Renderのデプロイ（=サーバー再起動）のたびに自然にクリーンアップされる。

### WebAuthn — 「顔で入れる」をつくる

パスワードを覚えられない人のために、WebAuthn（FIDO2）による生体認証ログインを実装した。iPad/iPhoneのFace ID、AndroidのFingerprint、WindowsのHelloに対応する。

技術的に難しかったのは**Relying Party IDの動的解決**だ。フロントエンドがVercel（`*.vercel.app`）にあり、バックエンドがRender（`*.onrender.com`）にある。WebAuthnのRP IDはユーザーがアクセスしているドメインと一致する必要がある。

```javascript
function getWebAuthnConfig(req) {
  const originHeader = req.get('origin');
  if (originHeader) {
    const url = new URL(originHeader);
    return { rpID: url.hostname, origin: url.origin };
  }
  // フォールバック
  return {
    rpID: process.env.RP_ID || req.hostname,
    origin: process.env.ORIGIN || `${req.protocol}://${req.get('host')}`,
  };
}
```

ブラウザの `Origin` ヘッダーからRP IDを導出することで、Vercel経由でもRender直接でも正しく動作する。チャレンジはインメモリの `Map` に保存し、5分でTTL失効させる。Redisを使わなかったのは、同時認証フローが数件しか発生しない家族用アプリに分散キャッシュは過剰だから。

---

## 写真管理 — アップロードからCDN配信まで

### アップロードフロー

```
1. ユーザーがファイルを選択（最大50MB）
2. 画質を選択: 高画質(90) / 自動(auto) / 軽量(50)
3. XMLHttpRequestでmultipart/form-data送信（プログレスバー付き）
4. Express側でmulter(memoryStorage)が受け取り
5. Cloudinary Upload Streamにパイプ
6. Cloudinaryが最適化＋サムネイル生成
7. 戻り値のsecure_url, public_id, bytes, width, heightをSQLiteに保存
8. フロントに写真メタデータを返却
```

`multer.memoryStorage()` を使っている。ディスクではなくメモリにバッファする。理由は2つ：Renderの永続ディスクはSQLite用に予約したい。そしてストリーミングアップロードならメモリ使用量は一時的で、Cloudinaryへの転送完了とともに解放される。

画質設定は3段階。母に聞いた。「キレイなまま残したい」（高画質）、「おまかせでいい」（自動）、「容量が気になる」（軽量）。技術的な圧縮率ではなく、気持ちのレベルで選べるようにした。

### サムネイル

```javascript
const thumbnailUrl = cloudinary.url(result.public_id, {
  width: 300, height: 300,
  crop: 'fill',
  quality: 'auto',
  fetch_format: 'auto',
});
```

300x300のfill croppingでサムネイルURLを生成する。Cloudinaryの変換URLは動的に生成されるため、サムネイル用の別画像を保存する必要がない。オリジナル画像1枚からあらゆるサイズのサムネイルを作れる。これはCloudinaryを選んだ最大の理由のひとつ。

### フォルダ構造

Cloudinary上の写真は `momento/{userId}/` に保存される。ユーザーIDでフォルダ分離することで、万が一のCloudinaryダッシュボード操作時にも他ユーザーの写真に触れない。

### ダウンロードプロキシ

PWAのstandaloneモードでは `<a download>` 属性が無視される（iOS Safariの仕様）。これに1日ハマった。

解決策として、サーバー側にダウンロードプロキシを実装した。

```javascript
app.get('/api/photos/:id/download', getSessionUser, async (req, res) => {
  const upstream = await fetch(photo.url);
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});
```

Cloudinaryから画像をfetchし、`Content-Disposition: attachment` ヘッダーを付けてクライアントに返す。二度手間に見えるが、PWAで「写真を端末に保存する」という基本動作を確実に動かすために必要だった。

さらにiOS Safariでは `Content-Disposition` による保存すら不安定なため、フロントエンド側で `navigator.share()` API（Share Sheet）をフォールバックとして使っている。Share Sheetから「画像を保存」を選べば確実にカメラロールに保存される。

```javascript
// モバイルではShare APIで確実に保存
if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({ files: [file] });
  return;
}
// デスクトップではblob URLダウンロード
const blobUrl = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = blobUrl;
a.download = filename;
a.click();
```

3段階のフォールバック（Share API → blob URL download → window.open）で、あらゆる環境で写真を手元に保存できるようにした。

---

## データベース設計 — 小さくて正しいスキーマ

```sql
users              1つのアカウント
  └── sessions     複数の端末からログイン可能
  └── webauthn_credentials   複数の生体認証を登録可能
  └── photos       ユーザーの全写真
  └── albums       ユーザーの全アルバム

photo_albums       多対多の中間テーブル（写真は複数アルバムに所属可能）
```

6テーブル。8インデックス。外部キー制約ON。WALモード。

テーブル設計で意識したのは「1人のユーザーのデータが1クエリで完結すること」。`WHERE user_id = ?` をすべてのクエリに付けることで、アプリケーションレベルでのデータ分離を保証している。ORMは使っていない。`db.prepare('SELECT ...').all(userId)` のプリペアドステートメントで十分であり、SQLが直接読めることの方が保守性に勝る。

スキーママイグレーションは最小限の仕組みで実装した。`initDb()` 内で既存テーブルのカラム構成をチェックし、スキーマが古ければ全テーブルをDROPして再作成する。本番環境では乱暴に見えるが、ユーザーが数人の家族用アプリでは「データ移行スクリプトを書いて検証する工数」よりも「写真を再アップロードしてもらう手間」の方が軽い。写真の実体はCloudinaryにあるため、DBを消してもデータは消えない。

---

## フロントエンド — 触って気持ちいいUI

### スワイプナビゲーション

PhotoViewerは3枚構成のスワイプUIを実装している。現在の写真の左右に前後の写真を配置し、`translateX` で遷移する。

```
[前の写真] [現在の写真] [次の写真]
              ← スワイプ →
```

タッチイベントの処理には3つのポイントがある。

1. **縦スクロールとの競合解決** — `touchMove` の初期段階で `dx` と `dy` を比較し、縦方向の動きが大きければスワイプを中断する
2. **端のダンピング** — 最初/最後の写真でスワイプしようとすると `dx * 0.3` で抵抗感を出す。「もうない」ことが指で分かる
3. **速度ベースの判定** — 距離だけでなく速度（`velocity = |offsetX| / elapsed`）でページ送りを判定。素早いフリックは短い距離でもページが切り替わる

```javascript
const threshold = width * 0.3;
const shouldAdvance = Math.abs(offsetX) > threshold || velocity > 0.3;
```

アニメーションは `cubic-bezier(0.25, 0.46, 0.45, 0.94)` のイージング。iOSの写真アプリに近い減速曲線を意識した。

### 画像プリロード

PhotoViewerが開くと、現在の写真の前後2枚を `new Image()` でプリロードする。

```javascript
useEffect(() => {
  const start = Math.max(0, currentIndex - PRELOAD_COUNT);
  const end = Math.min(photos.length - 1, currentIndex + PRELOAD_COUNT);
  for (let i = start; i <= end; i++) {
    if (i !== currentIndex) {
      const img = new Image();
      img.src = photos[i].url;
    }
  }
}, [currentIndex, photos]);
```

スワイプしたときに「読み込み中」のブランクが表示されると体験が壊れる。先読みによって、ほとんどの場合で瞬時に次の写真が表示される。

### ダークモード

`<html>` 要素に `.dark` クラスを付与し、CSS変数で色を切り替える。状態は `localStorage` に永続化される。母は夜に写真を見返すことが多い。暗い部屋で白い画面はつらい。

### セレクトモード

長押しではなくボタンタップで選択モードに入る。iOSの写真アプリは長押しで選択モードに入るが、長押しは「操作が見えない」。明示的な「選択」ボタンの方が、何が起きているか分かりやすい。

選択中は上部にツールバーが表示され、「全選択」「アルバムから外す」「削除」が操作できる。

---

## PWA — 「アプリみたい」を本当のアプリにする

### Service Worker

Service Workerのキャッシュ戦略は3層構造になっている。

```javascript
// 1. API — キャッシュしない（常に最新データ）
if (request.url.includes('/api/')) return;

// 2. Cloudinary画像 — Cache-first（一度見た写真は即座に表示）
if (request.url.includes('res.cloudinary.com')) {
  // ただしCORSモードのfetch（ダウンロード用）はNetwork-first
  if (request.mode === 'cors') { ... }
  // 通常の<img>ロードはcacheを優先
  return caches.match(request) || fetch(request);
}

// 3. アプリシェル — Network-first, cache fallback
fetch(request).catch(() => caches.match(request));
```

ここで重要なのは「Cloudinary画像のCORSモード分岐」だ。`<img>` タグのロードは `no-cors` モードで行われ、opaque responseがキャッシュに入る。しかしダウンロード用の `fetch()` は `cors` モードで実行されるため、opaque responseを返すとblobが読めない。CORSモードのリクエストだけNetwork-firstにすることで、キャッシュの高速性とダウンロードの確実性を両立させた。

### Manifest

```json
{
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#e8725a"
}
```

`standalone` でブラウザのアドレスバーを消し、ネイティブアプリと同じ見た目にする。`portrait` で縦固定。写真アプリは縦持ちが基本だ。テーマカラーの `#e8725a` は温かみのあるコーラルピンク。写真と記憶を連想させる色を選んだ。

---

## セキュリティ — 家族の写真を守る

### 多層防御

```
[クライアント] sanitizeText(), sanitizeFileName()   ← XSS防止
      ↓
[通信] HTTPS強制                                    ← 盗聴防止
      ↓
[サーバー] Parameterized Queries                    ← SQLi防止
      ↓
[サーバー] user_id による全クエリのフィルタリング      ← 認可
      ↓
[レスポンス] CSP, X-Frame-Options, nosniff          ← ブラウザ保護
```

#### Content Security Policy（Vercel）

```
default-src 'self';
script-src 'self';
img-src 'self' blob: https://res.cloudinary.com;
connect-src 'self' https://res.cloudinary.com;
object-src 'none';
frame-ancestors 'none';
```

`'unsafe-inline'` は `style-src` にのみ許可している。Reactの動的スタイル（`style={{transform: ...}}`）がCSPに引っかかるため。`script-src` には `'unsafe-inline'` を入れていない。

#### 入力サニタイゼーション

```typescript
// XSS対策: HTMLエンティティエンコード
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// パストラバーサル防止
export function sanitizeFileName(name: string): string {
  return stripHtmlTags(name)
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\.\./g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
}
```

ファイル名にユーザー入力を使うため、パストラバーサル（`../../etc/passwd`）と制御文字を除去する。

#### データ分離

すべてのAPIエンドポイントで `getSessionUser` ミドルウェアが `req.userId` をセットし、すべてのSQLクエリが `WHERE user_id = ?` でフィルタする。JOINを使う場合も、必ずユーザーIDで絞る。

```javascript
// 他人の写真にアクセスできない設計
const photo = db.prepare(
  'SELECT * FROM photos WHERE id = ? AND user_id = ?'
).get(req.params.id, req.userId);
if (!photo) return res.status(404).json({ error: 'Photo not found' });
```

「写真が存在するが自分のものでない」場合も404を返す。403ではなく404にすることで、他人の写真IDの存在自体を知らせない。

---

## デプロイ — 分離と信頼性

### フロントエンド: Vercel

Vercelはビルド済み静的ファイル（`dist/`）を配信する。APIリクエストは `vercel.json` のrewriteルールでRenderにプロキシされる。

```json
{ "source": "/api/(.*)", "destination": "https://momento-bc8j.onrender.com/api/$1" }
```

この構成により、フロントエンドとバックエンドを完全に独立してデプロイできる。フロントのCSS修正でバックエンドが再起動されることはない。

### バックエンド: Render

Renderの永続ディスク（1GB）にSQLiteデータベースを配置する。

```yaml
disk:
  name: momento-data
  mountPath: /data
  sizeGB: 1
```

1GBのディスクにSQLiteのメタデータだけを保存する。写真の実体はCloudinaryにあるため、メタデータだけなら数十万枚分は余裕で収まる。

サーバーの `export default app` によってVercelのサーバーレス関数としてもデプロイ可能な設計になっているが、SQLiteの永続性が必要なため本番はRenderの常時起動インスタンスを使う。

---

## 開発プロセス — 106コミットの記録

開発はすべてGitHub上のPull Requestベースで行った。`claude/` プレフィックスのブランチで機能を開発し、PRを経てmainにマージする。

コミットログには開発の試行錯誤が刻まれている。

```
PWAスタンドアロンモードで写真保存できない問題を修正
スマホで保存ボタンが動作しない問題を修正
アルバム写真選択をフルスクリーン一枚表示に改善
共有ボタンが動作しない問題を修正
モバイル版アルバム選択UIのレイアウト崩れを修正
```

「動作しない問題を修正」が並んでいる。きれいな設計書からコードが生まれたわけではない。実機で触り、動かない箇所を見つけ、直す。その繰り返しで磨いた。特にPWAの保存機能は、iOS Safari、Android Chrome、デスクトップブラウザで挙動が異なり、すべての環境で動くフォールバックチェーンを組み上げるのに複数回のイテレーションが必要だった。

---

## 依存関係 — 少なさは強さ

`package.json` の `dependencies` は10パッケージのみ。

```json
{
  "@simplewebauthn/browser": "^13.2.2",
  "@simplewebauthn/server": "^13.2.2",
  "better-sqlite3": "^11.7.0",
  "cloudinary": "^2.5.1",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "multer": "^1.4.5-lts.1",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.13.0"
}
```

状態管理ライブラリなし（React Context APIで十分）。CSSフレームワークなし（手書きCSS）。ORMなし（better-sqlite3のプリペアドステートメント直書き）。テストフレームワークなし（E2Eで実機確認を優先）。

依存が少ないということは：
- `npm audit` で引っかかるパッケージが少ない
- メジャーバージョンアップで壊れる箇所が少ない
- `node_modules` が小さく、ビルドが速い
- コードを読むとき「このライブラリは何をしているのか」の調査が少ない

写真アプリに必要な依存を選び、それ以外は自分で書いた。

---

## UIの言語 — 日本語ファースト

すべてのUIテキスト、エラーメッセージ、プレースホルダーは日本語で書かれている。

```
「ユーザー名とパスワードは必須です」
「この写真を削除しますか？」
「写真をアップロード中…」
「おかえりなさい」
```

i18n（国際化）ライブラリは入れていない。このアプリのユーザーは日本語を話す家族だ。`t('error.required')` のようなキーを通して翻訳する必要はない。直接日本語を書く方が、メッセージの温度感を調整しやすい。

ログイン画面の「おかえりなさい」という言葉。技術的には不要だ。しかしアプリを開いたときに「おかえりなさい」と書いてあると、道具ではなく場所に帰ってきた感覚になる。コードで情緒を表現できる場面は少ない。あるならやる。

---

## まとめ — 誰のために書いたコード

MomentoLiteは、技術的に特別なことはしていない。React、Express、SQLite、Cloudinary。どれも枯れた技術であり、どれも代替がある。

特別なのは「誰のために」「何を削るか」を決め続けたことだ。

iCloudが怖いと言った母のために、同期しない写真保存を作った。Googleアカウントを持たない母のために、メール不要の認証を作った。パスワードを忘れる母のために、顔認証ログインを作った。iPadの容量が足りない母のために、デバイスに1バイトも保存しないストレージを作った。

すべての技術選定、すべてのUI設計、すべてのAPIエンドポイントは、最終的に1人のユーザーの「これなら使える」に向かっている。

ソフトウェアは、使う人の問題を解決するために存在する。MomentoLiteは、母の「iPadの容量がない」という問題を解決するために存在する。

> 大切な写真を、ずっと残そう。

それだけのアプリを、本気で作った。
