import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWebTheme } from '@/components/WebThemeProvider';
import ThemeModeSwitch from '@/components/ThemeModeSwitch';
import { getApiBaseUrl, loginWithPassword } from '@/utils/medilink-api';
import { getAccessToken, saveSession } from '@/utils/medilink-session';

export default function LoginPage() {
  const navigate = useNavigate();
  const { theme, isDark } = useWebTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    if (getAccessToken()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = await loginWithPassword(email, password);
      if (!payload?.accessToken) {
        throw new Error('Login succeeded but access token is missing.');
      }
      saveSession({
        accessToken: payload.accessToken,
        user: payload.user || null,
        tenantId: payload.tenantId || null,
        loggedInAt: new Date().toISOString(),
      });
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: isDark
          ? 'linear-gradient(180deg, #0A0A0A 0%, #1A1A1A 100%)'
          : 'linear-gradient(180deg, #FFFFFF 0%, #FDEFF0 100%)',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '480px',
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '18px',
          padding: '24px',
          boxShadow: isDark
            ? '0 20px 50px rgba(0,0,0,0.4)'
            : '0 20px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/icon.png"
              alt="Medilink"
              width={38}
              height={38}
              style={{ borderRadius: '8px', border: `1px solid ${theme.border}` }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: theme.text }}>
                Medilink Kenya
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Secure healthcare access
              </p>
            </div>
          </div>
          <ThemeModeSwitch />
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: theme.text }}>Email</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{
                width: '100%',
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '11px',
                padding: '12px',
                fontSize: '14px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: theme.text }}>Password</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{
                width: '100%',
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '11px',
                padding: '12px',
                fontSize: '14px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="ml-button-primary"
            style={{
              marginTop: '8px',
              border: 'none',
              borderRadius: '11px',
              padding: '12px 14px',
              fontSize: '14px',
              fontWeight: 800,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {error ? (
          <p
            style={{
              marginTop: '12px',
              borderRadius: '10px',
              padding: '10px 12px',
              background: `${theme.error}1A`,
              border: `1px solid ${theme.error}66`,
              color: theme.error,
              fontSize: '13px',
            }}
          >
            {error}
          </p>
        ) : null}

        <p style={{ marginTop: '14px', color: theme.textTertiary, fontSize: '12px' }}>
          API base: {apiBaseUrl || 'Not configured'}
        </p>

        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="ml-button-secondary"
            style={{ borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => navigate('/landing')}
            className="ml-button-secondary"
            style={{ borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}
          >
            Back to landing
          </button>
        </div>
      </section>
    </main>
  );
}
