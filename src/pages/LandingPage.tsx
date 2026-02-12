import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-logo">MomentoLite</div>
        <h1 className="landing-title">
          大切な写真を
          <br />
          ずっと残そう
        </h1>
        <p className="landing-subtitle">
          容量ゼロ・高画質・消えない。
          <br />
          いちばんシンプルな写真保存アプリ。
        </p>
      </div>

      <div className="landing-features">
        <div className="landing-feature">
          <span className="landing-feature-icon">0GB</span>
          <div className="landing-feature-text">
            <strong>端末の容量を使わない</strong>
            <span>写真はクラウドに保存。iPadもiPhoneも容量ゼロ。</span>
          </div>
        </div>
        <div className="landing-feature">
          <span className="landing-feature-icon">HD</span>
          <div className="landing-feature-text">
            <strong>画質そのまま保存</strong>
            <span>高画質モードで撮ったままの美しさをキープ。</span>
          </div>
        </div>
        <div className="landing-feature">
          <span className="landing-feature-icon">&#x221E;</span>
          <div className="landing-feature-text">
            <strong>消えない安心</strong>
            <span>クラウド保存だから、キャッシュクリアしても大丈夫。</span>
          </div>
        </div>
      </div>

      <div className="landing-actions">
        <Link to="/login?mode=register" className="btn-primary landing-cta">
          はじめる
        </Link>
        <Link to="/login" className="btn-secondary landing-login">
          ログイン
        </Link>
      </div>

      <p className="landing-footer">
        Googleアカウント不要・メール不要
      </p>

      <nav className="landing-legal-links">
        <Link to="/privacy">プライバシーポリシー</Link>
        <span className="landing-legal-sep">|</span>
        <Link to="/terms">利用規約</Link>
        <span className="landing-legal-sep">|</span>
        <Link to="/sitemap">サイトマップ</Link>
      </nav>
    </div>
  );
}
