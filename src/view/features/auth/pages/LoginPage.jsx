import React from 'react';
import authClient from '../../../../shared/authClient.js';

export default function LoginPage({ onLoginSuccess = null }) {
  const [id, setId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedId = String(id || '').trim();
    if (!trimmedId || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await authClient.login({ id: trimmedId, password });
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(result);
      }
    } catch (submitError) {
      setError(submitError?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-card__eyebrow">Company Search</p>
        <h1>로그인</h1>
        <p className="login-card__description">관리자 계정으로 로그인해 주세요.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            아이디
            <input
              type="text"
              autoComplete="username"
              value={id}
              onChange={(event) => setId(event.target.value)}
              disabled={loading}
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
            />
          </label>
          {error ? <p className="login-form__error">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  );
}
