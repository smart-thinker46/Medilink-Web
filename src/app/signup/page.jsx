import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import ThemeModeSwitch from '@/components/ThemeModeSwitch';
import { useWebTheme } from '@/components/WebThemeProvider';
import { getApiBaseUrl, registerWithPassword } from '@/utils/medilink-api';
import { getAccessToken, saveSession } from '@/utils/medilink-session';

const ROLE_OPTIONS = [
  { label: 'Patient', value: 'PATIENT' },
  { label: 'Medic', value: 'MEDIC' },
  { label: 'Hospital Admin', value: 'HOSPITAL_ADMIN' },
  { label: 'Pharmacy Admin', value: 'PHARMACY_ADMIN' },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { theme, isDark } = useWebTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'PATIENT',
    password: '',
    confirmPassword: '',
    tenantName: '',
    specialization: '',
    licenseNumber: '',
  });

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    if (getAccessToken()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const isHospital = form.role === 'HOSPITAL_ADMIN';
  const isPharmacy = form.role === 'PHARMACY_ADMIN';
  const isMedic = form.role === 'MEDIC';

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if ((isHospital || isPharmacy) && !form.tenantName.trim()) {
      setError('Facility name is required for hospital/pharmacy admin signup.');
      return;
    }

    setLoading(true);
    try {
      const payload = await registerWithPassword({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        password: form.password,
        tenantName: isHospital || isPharmacy ? form.tenantName.trim() : undefined,
        tenantType: isHospital ? 'HOSPITAL' : isPharmacy ? 'PHARMACY' : undefined,
        specialization: isMedic ? form.specialization.trim() || undefined : undefined,
        licenseNumber: isMedic ? form.licenseNumber.trim() || undefined : undefined,
      });

      if (!payload?.accessToken) {
        throw new Error('Signup succeeded but access token is missing.');
      }

      saveSession({
        accessToken: payload.accessToken,
        user: payload.user || null,
        tenantId: payload?.tenant?.id || null,
        loggedInAt: new Date().toISOString(),
      });

      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError?.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

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
          maxWidth: '560px',
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '18px',
          padding: '24px',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.4)' : '0 20px 45px rgba(15, 23, 42, 0.08)',
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
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: theme.text }}>Create Account</h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Join Medilink web platform
              </p>
            </div>
          </div>
          <ThemeModeSwitch />
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
          <input
            required
            value={form.fullName}
            onChange={update('fullName')}
            placeholder="Full name"
            style={{
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '11px',
              padding: '12px',
              fontSize: '14px',
              background: theme.inputBackground,
              color: theme.text,
            }}
          />

          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <input
              required
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="Email"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
            />
            <input
              value={form.phone}
              onChange={update('phone')}
              placeholder="Phone (optional)"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
            />
          </div>

          <select
            value={form.role}
            onChange={update('role')}
            style={{
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '11px',
              padding: '12px',
              fontSize: '14px',
              background: theme.inputBackground,
              color: theme.text,
            }}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {isHospital || isPharmacy ? (
            <input
              required
              value={form.tenantName}
              onChange={update('tenantName')}
              placeholder={isHospital ? 'Hospital Name' : 'Pharmacy Name'}
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
            />
          ) : null}

          {isMedic ? (
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <input
                value={form.specialization}
                onChange={update('specialization')}
                placeholder="Specialization"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
              />
              <input
                value={form.licenseNumber}
                onChange={update('licenseNumber')}
                placeholder="License Number"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
              />
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <input
              required
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="Password"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
            />
            <input
              required
              type="password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              placeholder="Confirm Password"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '11px', padding: '12px', fontSize: '14px', background: theme.inputBackground, color: theme.text }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="ml-button-primary"
            style={{
              marginTop: '4px',
              border: 'none',
              borderRadius: '11px',
              padding: '12px 14px',
              fontSize: '14px',
              fontWeight: 800,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {error ? (
          <p
            style={{
              marginTop: '10px',
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

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="ml-button-secondary"
            style={{ borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}
          >
            Already have an account? Sign in
          </button>
          <small style={{ color: theme.textTertiary }}>API base: {apiBaseUrl || 'Not configured'}</small>
        </div>
      </section>
    </main>
  );
}
