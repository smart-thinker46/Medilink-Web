import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import ThemeModeSwitch from '@/components/ThemeModeSwitch';
import { useWebTheme } from '@/components/WebThemeProvider';
import {
  RoleDashboardContent,
  RoleSidebar,
  getRoleMetrics,
} from '@/components/dashboard/RoleDashboardViews';
import { getQuickActionRoute } from '@/components/dashboard/navigation';
import { fetchNotifications, fetchProfile, fetchRoleOverview } from '@/utils/medilink-api';
import { clearSession, loadSession } from '@/utils/medilink-session';

function getFirstName(user) {
  const fullName = String(user?.fullName || '').trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const email = String(user?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return 'User';
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, isDark } = useWebTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [overview, setOverview] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setIsWide(window.innerWidth >= 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate('/login', { replace: true });
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = loadSession();
      const token = session?.accessToken;
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      const profilePayload = await fetchProfile(token);
      const role = profilePayload?.user?.role || session?.user?.role;
      const [overviewPayload, notificationsPayload] = await Promise.all([
        fetchRoleOverview(role, token, profilePayload),
        fetchNotifications(token).catch(() => []),
      ]);

      setProfile(profilePayload);
      setOverview(overviewPayload);
      setNotifications(Array.isArray(notificationsPayload) ? notificationsPayload : []);
    } catch (requestError) {
      const message = requestError?.message || 'Failed to load dashboard.';
      if (message.toLowerCase().includes('unauthorized')) {
        logout();
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [navigate, logout]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const user = profile?.user || {};
  const role = String(user?.role || '').toUpperCase();
  const unreadCount = notifications.filter((item) => !item?.isRead).length;
  const metrics = getRoleMetrics(role, overview);
  const greeting = getTimeGreeting();
  const firstName = getFirstName(user);
  const profileCompletionPercent = Math.max(
    0,
    Math.min(100, Number(user?.profileCompletionPercent || 0)),
  );

  const handleMenuClick = (menuItem) => {
    const route = menuItem?.route || '/dashboard';
    if (route === location.pathname) return;
    navigate(route);
  };

  const handleQuickAction = (action) => {
    const route = getQuickActionRoute(role, action?.id);
    if (route === location.pathname) return;
    navigate(route);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: isDark
          ? 'linear-gradient(180deg, #0A0A0A 0%, #141414 100%)'
          : 'linear-gradient(180deg, #FFFFFF 0%, #F9F7F7 100%)',
        color: theme.text,
      }}
    >
      <header
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.bottomBorder}`,
          background: theme.bottomArea,
          position: 'sticky',
          top: 0,
          zIndex: 4,
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/icon.png"
              alt="Medilink"
              width={36}
              height={36}
              style={{ borderRadius: '8px', border: `1px solid ${theme.border}` }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 800 }}>MediLink Dashboard</h1>
              <p style={{ margin: '2px 0 0', color: theme.textSecondary, fontSize: '13px' }}>
                {greeting}, {firstName} ({role || 'UNKNOWN'})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ThemeModeSwitch />
            <button
              type="button"
              onClick={loadData}
              className="ml-button-secondary"
              style={{
                borderRadius: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={logout}
              style={{
                border: 'none',
                borderRadius: '10px',
                padding: '8px 12px',
                background: theme.accent,
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          height: '4px',
          background:
            'linear-gradient(to right, #111111 0 24%, #ffffff 24% 26%, #c62828 26% 50%, #ffffff 50% 52%, #1b8f3a 52% 100%)',
        }}
      />

      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', minHeight: 'calc(100vh - 86px)' }}>
        <div style={{ display: isWide ? 'block' : 'none' }}>
          <RoleSidebar
            role={role}
            unreadCount={unreadCount}
            theme={theme}
            onMenuClick={handleMenuClick}
            activePath={location.pathname}
          />
        </div>

        <section style={{ flex: 1, padding: '20px' }}>
          {loading ? <p style={{ color: theme.textSecondary }}>Loading dashboard...</p> : null}

          {error ? (
            <p
              style={{
                margin: '0 0 14px',
                padding: '10px 12px',
                border: `1px solid ${theme.error}66`,
                borderRadius: '10px',
                background: `${theme.error}1A`,
                color: theme.error,
              }}
            >
              {error}
            </p>
          ) : null}

          {!loading && !error ? (
            <>
              {profileCompletionPercent < 100 ? (
                <div className="ml-card" style={{ padding: '14px', background: theme.card, marginBottom: '12px' }}>
                  <p style={{ margin: 0, color: theme.textSecondary, fontSize: '13px' }}>
                    Profile Completion: {profileCompletionPercent}%
                  </p>
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '999px',
                      background: theme.surface,
                      marginTop: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${profileCompletionPercent}%`,
                        background: theme.primary,
                      }}
                    />
                  </div>
                  <p style={{ margin: '8px 0 0', color: theme.textTertiary, fontSize: '12px' }}>
                    Metrics loaded: {Object.keys(metrics || {}).length} • Notifications: {unreadCount}
                  </p>
                </div>
              ) : null}

          <RoleDashboardContent
            role={role}
            theme={theme}
            overview={overview}
            onQuickAction={handleQuickAction}
          />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
