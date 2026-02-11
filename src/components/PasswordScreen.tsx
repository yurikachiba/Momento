import { type FC, useState } from 'react';

interface PasswordScreenProps {
  mode: 'unlock' | 'setup';
  onUnlock: (password: string) => Promise<boolean>;
  onSetup: (password: string) => Promise<void>;
  error?: string;
}

const PasswordScreen: FC<PasswordScreenProps> = ({ mode, onUnlock, onSetup, error }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleUnlock = async () => {
    if (!password) return;
    setBusy(true);
    setLocalError('');
    const ok = await onUnlock(password);
    if (!ok) setLocalError('パスワードが正しくありません');
    setBusy(false);
  };

  const handleSetup = async () => {
    if (!password) return;
    if (password.length < 4) {
      setLocalError('4文字以上のパスワードを設定してください');
      return;
    }
    if (password !== confirm) {
      setLocalError('パスワードが一致しません');
      return;
    }
    setBusy(true);
    setLocalError('');
    await onSetup(password);
    setBusy(false);
  };

  const displayError = error || localError;

  return (
    <div className="password-screen">
      <div className="password-card">
        <p className="password-icon">🔒</p>
        <h2 className="password-title">
          {mode === 'unlock' ? 'Momento' : 'パスワードを設定'}
        </h2>
        <p className="password-desc">
          {mode === 'unlock'
            ? 'パスワードを入力して写真を表示'
            : '写真を暗号化して保護します'}
        </p>

        <input
          type="password"
          className="input-name password-input"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (mode === 'unlock') handleUnlock();
              else if (confirm) handleSetup();
            }
          }}
          autoFocus
          disabled={busy}
        />

        {mode === 'setup' && (
          <input
            type="password"
            className="input-name password-input"
            placeholder="パスワード（確認）"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
            disabled={busy}
          />
        )}

        {displayError && <p className="password-error">{displayError}</p>}

        <button
          className="btn-primary password-submit"
          onClick={mode === 'unlock' ? handleUnlock : handleSetup}
          disabled={busy || !password}
        >
          {busy ? '処理中...' : mode === 'unlock' ? 'ロック解除' : '設定する'}
        </button>
      </div>
    </div>
  );
};

export default PasswordScreen;
