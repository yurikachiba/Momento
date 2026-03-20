import { useState, type FC } from 'react';
import { useAuth } from '../lib/auth';
import { safeJson } from '../lib/api';
import { startRegistration } from '@simplewebauthn/browser';

interface SettingsMenuProps {
  onClose: () => void;
  usage: { count: number; totalSize: number; limit: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SettingsMenu: FC<SettingsMenuProps> = ({ onClose, usage }) => {
  const { user, token, logout } = useAuth();
  const [webauthnStatus, setWebauthnStatus] = useState<string>('');
  const [webauthnLoading, setWebauthnLoading] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // メールアドレス取得
  useState(() => {
    if (!token) return;
    fetch('/api/auth/email', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { email: string | null }) => {
        if (data.email) {
          setEmail(data.email);
          setEmailInput(data.email);
        }
      })
      .catch(() => {});
  });

  const handleSaveEmail = async () => {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailStatus('有効なメールアドレスを入力してください');
      return;
    }
    setEmailLoading(true);
    setEmailStatus('');
    try {
      const res = await fetch('/api/auth/email', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput }),
      });
      if (!res.ok) {
        const data = await safeJson<{ error?: string }>(res).catch(() => null);
        throw new Error(data?.error || '保存に失敗しました');
      }
      setEmail(emailInput);
      setEmailEditing(false);
      setEmailStatus('メールアドレスを保存しました');
      setTimeout(() => setEmailStatus(''), 3000);
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.username);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
      window.location.href = '/';
    }
  };

  const handleSetupWebAuthn = async () => {
    setWebauthnLoading(true);
    setWebauthnStatus('');
    try {
      // Get registration options
      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!optionsRes.ok) throw new Error('準備に失敗しました');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = await safeJson<any>(optionsRes);

      // Start browser WebAuthn registration
      const regResponse = await startRegistration({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(regResponse),
      });
      if (!verifyRes.ok) {
        const data = await safeJson<{ error?: string }>(verifyRes).catch(() => null);
        throw new Error(data?.error || '登録に失敗しました');
      }
      setWebauthnStatus('生体認証を登録しました');
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setWebauthnStatus('キャンセルされました');
      } else {
        setWebauthnStatus(err instanceof Error ? err.message : '登録に失敗しました');
      }
    } finally {
      setWebauthnLoading(false);
    }
  };

  return (
    <div className="category-add-overlay" onClick={onClose}>
      <div
        className="category-add-dialog settings-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>設定</h3>

        {usage && (
          <div className="settings-section">
            <p className="settings-section-title">クラウドストレージ</p>
            <div className="storage-info">
              <span className="storage-size">
                {formatBytes(usage.totalSize)}
              </span>
              <span className="storage-count">
                / {formatBytes(usage.limit)}
              </span>
            </div>
            <div className="usage-bar-track" style={{ marginTop: '8px' }}>
              <div
                className="usage-bar-fill"
                style={{
                  width: `${Math.min(100, (usage.totalSize / usage.limit) * 100)}%`,
                }}
              />
            </div>
            <p className="storage-meta-text">
              写真 {usage.count}枚 クラウドに保存済み
            </p>
          </div>
        )}

        <div className="settings-section">
          <p className="settings-section-title">アカウント</p>
          {user && (
            <>
              <div className="user-id-display">
                <code>{user.displayName || user.username}</code>
              </div>
              <div className="user-id-display user-id-copyable" onClick={handleCopyUserId}>
                <span className="user-id-label">ID</span>
                <code>{user.username}</code>
                <span className="user-id-copy-btn">
                  {idCopied ? '✓' : '📋'}
                </span>
              </div>
              {idCopied && (
                <p className="settings-hint" style={{ color: 'var(--accent)' }}>
                  コピーしました
                </p>
              )}
            </>
          )}

          <div className="settings-email-section">
            <p className="settings-email-label">メールアドレス（パスワードリセット用）</p>
            {emailEditing ? (
              <div className="settings-email-edit">
                <input
                  type="email"
                  className="input-name settings-email-input"
                  placeholder="example@mail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                <div className="settings-email-actions">
                  <button
                    className="btn-primary settings-email-save"
                    onClick={handleSaveEmail}
                    disabled={emailLoading}
                  >
                    {emailLoading ? '保存中…' : '保存'}
                  </button>
                  <button
                    className="btn-secondary settings-email-cancel"
                    onClick={() => { setEmailEditing(false); setEmailInput(email); setEmailStatus(''); }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="settings-email-display" onClick={() => setEmailEditing(true)}>
                <span className="settings-email-value">
                  {email || '未設定'}
                </span>
                <span className="settings-email-edit-btn">編集</span>
              </div>
            )}
            {emailStatus && (
              <p className="settings-hint" style={{ marginTop: '4px', color: 'var(--accent)' }}>
                {emailStatus}
              </p>
            )}
          </div>

          <button className="settings-btn" onClick={handleSetupWebAuthn} disabled={webauthnLoading}>
            <span className="settings-btn-icon">
              {webauthnLoading ? '...' : '🔐'}
            </span>
            <span className="settings-btn-text">
              <strong>顔認証 / 生体認証を設定</strong>
              <small>Face ID・指紋・Windows Helloで素早くログイン</small>
            </span>
          </button>
          {webauthnStatus && (
            <p className="settings-hint" style={{ marginTop: '8px', color: 'var(--accent)' }}>
              {webauthnStatus}
            </p>
          )}

          <button className="settings-btn" onClick={handleLogout} style={{ marginTop: '8px' }}>
            <span className="settings-btn-icon">🚪</span>
            <span className="settings-btn-text">
              <strong>ログアウト</strong>
              <small>アカウントからログアウトする</small>
            </span>
          </button>
        </div>

        <div className="settings-section">
          <p className="settings-section-title">アプリ情報</p>
          <p className="settings-hint">
            MomentoLite v1.0
            <br />
            写真はCloudinaryに安全に保存されます。
            <br />
            端末の容量は使用しません。
          </p>
        </div>

        <button className="btn-secondary settings-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
};

export default SettingsMenu;
