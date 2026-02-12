import { Link } from 'react-router-dom';

export default function SitemapPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/" className="legal-back">&larr; トップに戻る</Link>
        <h1 className="legal-title">サイトマップ</h1>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>公開ページ</h2>
          <ul className="sitemap-list">
            <li>
              <Link to="/">トップページ</Link>
              <span className="sitemap-desc">Momentoの紹介・機能説明</span>
            </li>
            <li>
              <Link to="/login">ログイン / 新規登録</Link>
              <span className="sitemap-desc">アカウントの作成・ログイン</span>
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>アプリ（ログイン後）</h2>
          <ul className="sitemap-list">
            <li>
              <Link to="/app">写真一覧</Link>
              <span className="sitemap-desc">写真の閲覧・アップロード・管理</span>
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>規約・ポリシー</h2>
          <ul className="sitemap-list">
            <li>
              <Link to="/privacy">プライバシーポリシー</Link>
              <span className="sitemap-desc">個人情報の取り扱いについて</span>
            </li>
            <li>
              <Link to="/terms">利用規約</Link>
              <span className="sitemap-desc">サービス利用条件</span>
            </li>
            <li>
              <Link to="/sitemap">サイトマップ</Link>
              <span className="sitemap-desc">サイト構成の一覧（このページ）</span>
            </li>
          </ul>
        </section>
      </div>

      <div className="legal-footer-nav">
        <Link to="/privacy">プライバシーポリシー</Link>
        <Link to="/terms">利用規約</Link>
      </div>
    </div>
  );
}
