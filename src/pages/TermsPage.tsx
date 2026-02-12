import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/" className="legal-back">&larr; トップに戻る</Link>
        <h1 className="legal-title">利用規約</h1>
        <p className="legal-updated">最終更新日: 2026年2月12日</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>第1条（適用）</h2>
          <p>
            本利用規約（以下「本規約」）は、MomentoLite（以下「本サービス」）の利用に関する条件を定めるものです。
            ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。
          </p>
        </section>

        <section className="legal-section">
          <h2>第2条（アカウント）</h2>
          <ul>
            <li>ユーザーは、正確な情報を提供してアカウントを作成するものとします。</li>
            <li>アカウントの管理責任はユーザーにあり、第三者への貸与・譲渡はできません。</li>
            <li>パスワードの管理はユーザーの責任とし、不正利用による損害について本サービスは責任を負いません。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第3条（サービス内容）</h2>
          <p>本サービスは、以下の機能を提供します。</p>
          <ul>
            <li>写真のクラウドアップロードおよび保存</li>
            <li>写真の閲覧・管理・削除</li>
            <li>アルバムの作成・編集</li>
            <li>写真データのエクスポート（バックアップ）</li>
            <li>クライアント側暗号化による写真の保護</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第4条（禁止事項）</h2>
          <p>ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
          <ul>
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪に関連する行為</li>
            <li>本サービスのサーバーまたはネットワークに過度な負荷をかける行為</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>他のユーザーの情報を不正に収集する行為</li>
            <li>第三者の知的財産権、肖像権、プライバシーを侵害するコンテンツのアップロード</li>
            <li>本サービスを商業目的で無断利用する行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第5条（コンテンツの権利）</h2>
          <p>
            ユーザーがアップロードした写真およびコンテンツの著作権は、ユーザーに帰属します。
            本サービスは、サービス提供に必要な範囲でのみ、これらのコンテンツを利用します。
          </p>
        </section>

        <section className="legal-section">
          <h2>第6条（サービスの変更・停止）</h2>
          <ul>
            <li>本サービスは、事前の通知なくサービス内容を変更または一時停止することがあります。</li>
            <li>メンテナンスやシステム障害等によりサービスが利用できない場合がありますが、これによる損害について本サービスは責任を負いません。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第7条（データの保存）</h2>
          <ul>
            <li>本サービスはユーザーデータの保存に努めますが、データの完全性・永続性を保証するものではありません。</li>
            <li>重要なデータは、エクスポート機能を利用して定期的にバックアップすることを推奨します。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第8条（免責事項）</h2>
          <ul>
            <li>本サービスは「現状有姿」で提供され、特定の目的への適合性を保証しません。</li>
            <li>本サービスの利用により生じた損害について、運営者の故意または重過失による場合を除き、責任を負いません。</li>
            <li>外部サービス（クラウドストレージ等）の障害に起因する損害については、責任を負いかねます。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>第9条（アカウントの削除）</h2>
          <p>
            ユーザーは、設定画面からいつでもアカウントを削除できます。
            アカウントを削除した場合、保存されたすべてのデータ（写真、アルバム等）は削除されます。
            削除されたデータの復旧はできません。
          </p>
        </section>

        <section className="legal-section">
          <h2>第10条（規約の変更）</h2>
          <p>
            本規約は、必要に応じて変更されることがあります。
            変更後の規約は、本サービス上に掲載した時点で効力を生じるものとします。
          </p>
        </section>

        <section className="legal-section">
          <h2>第11条（準拠法・管轄）</h2>
          <p>
            本規約の解釈は日本法に準拠するものとします。
            本サービスに関する紛争については、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>
      </div>

      <div className="legal-footer-nav">
        <Link to="/privacy">プライバシーポリシー</Link>
        <Link to="/sitemap">サイトマップ</Link>
      </div>
    </div>
  );
}
