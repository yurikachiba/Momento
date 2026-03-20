import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { safeJson } from '../lib/api';

type Step = 'request' | 'verify';

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await safeJson<{ ok?: boolean; message?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'リクエストに失敗しました');
      setMessage('メールアドレスが登録されている場合、リセットコードを送信しました');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code, newPassword }),
      });
      const data = await safeJson<{ ok?: boolean; token?: string; user?: { id: string; username: string; displayName: string }; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'リセットに失敗しました');

      if (data.token && data.user) {
        localStorage.setItem('momento-token', data.token);
        localStorage.setItem('momento-user', JSON.stringify(data.user));
        window.location.href = '/app';
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <Link to="/login" className="login-back">&larr; ログインに戻る</Link>
        <div className="login-header">
          <div className="login-logo">MomentoLite</div>
          <h1 className="login-title">パスワードリセット</h1>
          <p className="login-desc">
            {step === 'request'
              ? 'ユーザー名を入力してください'
              : 'メールに届いたコードを入力してください'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="login-form">
            <div className="login-field">
              <label htmlFor="reset-username" className="login-label">ユーザー名</label>
              <input
                id="reset-username"
                type="text"
                className="input-name"
                placeholder="ユーザー名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}
            {message && <p className="reset-message">{message}</p>}

            <button type="submit" className="btn-primary login-submit" disabled={loading}>
              {loading ? '送信中…' : 'リセットコードを送信'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="login-form">
            <div className="login-field">
              <label htmlFor="reset-code" className="login-label">リセットコード</label>
              <input
                id="reset-code"
                type="text"
                className="input-name reset-code-input"
                placeholder="6桁のコード"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="reset-new-password" className="login-label">新しいパスワード</label>
              <input
                id="reset-new-password"
                type="password"
                className="input-name"
                placeholder="4文字以上"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}
            {message && <p className="reset-message">{message}</p>}

            <button type="submit" className="btn-primary login-submit" disabled={loading || code.length !== 6}>
              {loading ? '処理中…' : 'パスワードを再設定'}
            </button>

            <button
              type="button"
              className="btn-secondary login-webauthn"
              onClick={() => { setStep('request'); setError(''); setMessage(''); setCode(''); setNewPassword(''); }}
            >
              コードを再送信
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
