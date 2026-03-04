import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useWebTheme } from '@/components/WebThemeProvider';

export default function SplashPage() {
  const navigate = useNavigate();
  const { isDark, theme } = useWebTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/landing', { replace: true });
    }, 1700);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
      className={isDark ? 'ml-dark-gradient-bg' : 'ml-kenya-flag-bg'}
    >
      <section
        style={{
          textAlign: 'center',
          color: '#ffffff',
          textShadow: '0 2px 8px rgba(0,0,0,0.35)',
          padding: '20px',
        }}
      >
        <div
          className="ml-splash-logo-pulse"
          style={{
            width: '116px',
            height: '116px',
            margin: '0 auto 20px',
            borderRadius: '58px',
            border: '2px solid rgba(255,255,255,0.38)',
            background: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.94)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '102px',
              height: '102px',
              borderRadius: '51px',
              background: isDark
                ? 'rgba(0, 0, 0, 0.25)'
                : 'linear-gradient(to bottom, #111111 0 31%, #ffffff 31% 34%, #c62828 34% 66%, #ffffff 66% 69%, #1b8f3a 69% 100%)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '34px',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              M+
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: '34px', margin: 0, fontWeight: 800 }}>Medilink Kenya</h1>
        <p style={{ margin: '8px 0 0', fontSize: '15px', opacity: 0.95 }}>
          Connecting Healthcare Across Kenya
        </p>

        <div style={{ marginTop: '36px', display: 'grid', placeItems: 'center' }}>
          <div
            className="ml-splash-dot"
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '999px',
              background: isDark ? theme.primary : '#ffffff',
            }}
          />
        </div>
      </section>

      <p
        style={{
          position: 'absolute',
          bottom: '22px',
          margin: 0,
          color: 'rgba(255,255,255,0.92)',
          fontSize: '12px',
          letterSpacing: '0.2px',
          textShadow: '0 1px 4px rgba(0,0,0,0.35)',
        }}
      >
        Empowering Healthcare Access for All
      </p>
    </main>
  );
}
