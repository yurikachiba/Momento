import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/" className="legal-back">&larr; トップに戻る</Link>
        <h1 className="legal-title">プライバシーポリシー</h1>
        <p className="legal-updated">最終更新日: 2026年2月12日</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. はじめに</h2>
          <p>
            Momento（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
            本プライバシーポリシーは、本サービスの利用に際して収集する情報、その利用方法、および保護方法について説明します。
          </p>
        </section>

        <section className="legal-section">
          <h2>2. 収集する情報</h2>
          <p>本サービスでは、以下の情報を収集します。</p>
          <ul>
            <li><strong>アカウント情報:</strong> ユーザー名、パスワード（ハッシュ化して保存）、表示名</li>
            <li><strong>写真データ:</strong> アップロードされた写真およびそのメタデータ（ファイル名、サイズ等）</li>
            <li><strong>アルバム情報:</strong> 作成されたアルバム名およびアイコン</li>
            <li><strong>利用情報:</strong> ストレージ使用量、アップロード回数</li>
            <li><strong>認証情報:</strong> WebAuthn/生体認証を利用する場合、認証に必要な公開鍵情報</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. 情報の利用目的</h2>
          <p>収集した情報は、以下の目的で利用します。</p>
          <ul>
            <li>本サービスの提供および運営</li>
            <li>ユーザー認証およびアカウント管理</li>
            <li>写真の保存・表示・管理機能の提供</li>
            <li>サービスの改善および品質向上</li>
            <li>不正利用の防止およびセキュリティの確保</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. 写真データの保存</h2>
          <p>
            アップロードされた写真は、外部クラウドストレージサービス（Cloudinary）に保存されます。
            写真データは、ユーザーが削除するまで保持されます。
            暗号化機能を有効にしている場合、写真はクライアント側で暗号化された状態でアップロードされます。
          </p>
        </section>

        <section className="legal-section">
          <h2>5. 第三者への提供</h2>
          <p>
            本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
          </p>
          <ul>
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>サービスの提供に必要な外部サービス（クラウドストレージ等）への連携</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. データの安全管理</h2>
          <p>
            本サービスは、収集した情報の漏洩、紛失、改ざんを防ぐため、適切な安全管理措置を講じます。
            パスワードはハッシュ化して保存し、通信はHTTPSによって暗号化されます。
          </p>
        </section>

        <section className="legal-section">
          <h2>7. ユーザーの権利</h2>
          <p>ユーザーは、以下の権利を有します。</p>
          <ul>
            <li>自身のアカウント情報の確認</li>
            <li>アップロードした写真の削除</li>
            <li>アカウントの削除（設定画面から実行可能）</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>8. Cookieの使用</h2>
          <p>
            本サービスは、認証状態の維持のためにCookieまたはローカルストレージを使用します。
            これらはサービスの機能提供に必要なものであり、広告目的では使用しません。
          </p>
        </section>

        <section className="legal-section">
          <h2>9. ポリシーの変更</h2>
          <p>
            本プライバシーポリシーは、必要に応じて変更されることがあります。
            重要な変更がある場合は、本サービス上でお知らせします。
          </p>
        </section>

        <section className="legal-section">
          <h2>10. お問い合わせ</h2>
          <p>
            本プライバシーポリシーに関するお問い合わせは、本サービスの設定画面よりご連絡ください。
          </p>
        </section>
      </div>

      <div className="legal-footer-nav">
        <Link to="/terms">利用規約</Link>
        <Link to="/sitemap">サイトマップ</Link>
      </div>
    </div>
  );
}
