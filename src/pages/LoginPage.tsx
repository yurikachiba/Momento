import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { safeJson } from '../lib/api';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, user } = useAuth();

  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  // Check if WebAuthn is available for this username
  useEffect(() => {
    if (!username || isRegister) {
      setWebauthnAvailable(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/webauthn/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await safeJson<{ available: boolean }>(res);
        setWebauthnAvailable(data.available);
      } catch {
        setWebauthnAvailable(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password, displayName || username);
      } else {
        await login(username, password);
      }
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Get options from server
      const optionsRes = await fetch('/api/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!optionsRes.ok) throw new Error('生体認証の準備に失敗しました');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = await safeJson<any>(optionsRes);
      const { _challengeKey, ...authOptions } = options;

      // Start browser WebAuthn authentication
      const authResponse = await startAuthentication({ optionsJSON: authOptions });

      // Verify with server
      const verifyRes = await fetch('/api/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authResponse, _challengeKey }),
      });
      if (!verifyRes.ok) {
        const data = await safeJson<{ error?: string }>(verifyRes).catch(() => null);
        throw new Error(data?.error || '生体認証ログインに失敗しました');
      }
      const data = await safeJson<{ token: string; user: { id: string; username: string; displayName: string } }>(verifyRes);
      localStorage.setItem('momento-token', data.token);
      localStorage.setItem('momento-user', JSON.stringify(data.user));
      window.location.href = '/app';
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('生体認証がキャンセルされました');
      } else {
        setError(err instanceof Error ? err.message : '生体認証に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <Link to="/" className="login-back">&larr; 戻る</Link>
        <div className="login-header">
          <div className="login-logo">MomentoLite</div>
          <h1 className="login-title">
            {isRegister ? 'アカウント作成' : 'ログイン'}
          </h1>
          <p className="login-desc">
            {isRegister
              ? 'ユーザー名とパスワードだけでOK'
              : 'おかえりなさい'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="username" className="login-label">ユーザー名</label>
            <input
              id="username"
              type="text"
              className="input-name"
              placeholder="例: mama"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              required
            />
          </div>

          {isRegister && (
            <div className="login-field">
              <label htmlFor="displayName" className="login-label">表示名（任意）</label>
              <input
                id="displayName"
                type="text"
                className="input-name"
                placeholder="例: お母さん"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="password" className="login-label">パスワード</label>
            <input
              id="password"
              type="password"
              className="input-name"
              placeholder={isRegister ? '4文字以上' : 'パスワード'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading
              ? '処理中…'
              : isRegister
                ? 'アカウントを作成'
                : 'ログイン'}
          </button>

          {!isRegister && webauthnAvailable && (
            <button
              type="button"
              className="btn-secondary login-webauthn"
              onClick={handleWebAuthnLogin}
              disabled={loading}
            >
              顔認証 / 生体認証でログイン
            </button>
          )}
        </form>

        <div className="login-switch">
          {isRegister ? (
            <p>
              すでにアカウントがある方は
              <button
                className="login-switch-btn"
                onClick={() => { setIsRegister(false); setError(''); }}
              >
                ログイン
              </button>
            </p>
          ) : (
            <p>
              はじめての方は
              <button
                className="login-switch-btn"
                onClick={() => { setIsRegister(true); setError(''); }}
              >
                アカウント作成
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
