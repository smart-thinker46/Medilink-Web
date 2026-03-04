import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWebTheme } from '@/components/WebThemeProvider';
import heroImage from '@/assets/images/Medillinkhome.png';

const COPY = {
  en: {
    welcomeTitle: 'Your Health, Connected.',
    welcomeTagline: 'Your complete healthcare ecosystem in one platform',
    highlightsTitle: "Built for Kenya's healthcare",
    highlightsText:
      'From consultations to pharmacy orders and hospital staffing, Medilink keeps every step smooth, secure, and professional.',
    rolePatient: 'Patient',
    rolePatientDesc: 'Book appointments, manage records, and access care quickly.',
    roleMedic: 'Medic',
    roleMedicDesc: 'Manage shifts, patients, notes, and follow-up care.',
    roleHospital: 'Hospital',
    roleHospitalDesc: 'Coordinate staff, appointments, analytics, and payments.',
    rolePharmacy: 'Pharmacy',
    rolePharmacyDesc: 'Sell products, process orders, and monitor stock in real-time.',
    careForEveryRole: 'Care for every role',
    benefitsTitle: 'Why teams choose Medilink',
    securePrivate: 'Secure & Private',
    fastReliable: 'Fast & Reliable',
    trustedNetwork: 'Trusted Network',
    getStarted: 'Get Started',
    signIn: 'Sign In',
    termsText: 'By continuing, you agree to our Terms and Privacy Policy',
    footerLine: 'Empowering Healthcare Access for All',
    footerLocation: 'Nairobi, Kenya',
    footerSupport: 'Support',
  },
  sw: {
    welcomeTitle: 'Afya Yako, Imeunganishwa.',
    welcomeTagline: 'Mfumo kamili wa huduma za afya katika jukwaa moja',
    highlightsTitle: 'Imejengwa kwa afya ya Kenya',
    highlightsText:
      'Kutoka ushauri wa daktari hadi oda za pharmacy na usimamizi wa hospitali, Medilink hurahisisha kila hatua kwa usalama na ubora.',
    rolePatient: 'Mgonjwa',
    rolePatientDesc: 'Panga miadi, simamia rekodi, na pata huduma kwa haraka.',
    roleMedic: 'Mhudumu',
    roleMedicDesc: 'Simamia zamu, wagonjwa, kumbukumbu, na ufuatiliaji.',
    roleHospital: 'Hospitali',
    roleHospitalDesc: 'Ratibu wafanyakazi, miadi, takwimu, na malipo.',
    rolePharmacy: 'Pharmacy',
    rolePharmacyDesc: 'Uza bidhaa, simamia oda, na fuatilia stock kwa muda halisi.',
    careForEveryRole: 'Huduma kwa kila jukumu',
    benefitsTitle: 'Kwa nini timu huchagua Medilink',
    securePrivate: 'Salama & Faragha',
    fastReliable: 'Haraka & Imara',
    trustedNetwork: 'Mtandao wa Kuaminika',
    getStarted: 'Anza Sasa',
    signIn: 'Ingia',
    termsText: 'Kwa kuendelea, unakubali Sheria na Sera ya Faragha',
    footerLine: 'Kuimarisha upatikanaji wa huduma za afya kwa wote',
    footerLocation: 'Nairobi, Kenya',
    footerSupport: 'Msaada',
  },
};

const ROLE_FEATURES = (text) => [
  { icon: '❤', title: text.rolePatient, description: text.rolePatientDesc, color: '#E11D48' },
  { icon: '✓', title: text.roleMedic, description: text.roleMedicDesc, color: '#2563EB' },
  { icon: '🏥', title: text.roleHospital, description: text.roleHospitalDesc, color: '#F59E0B' },
  { icon: '💊', title: text.rolePharmacy, description: text.rolePharmacyDesc, color: '#16A34A' },
];

const BENEFITS = (text) => [
  { icon: '🛡', text: text.securePrivate },
  { icon: '⚡', text: text.fastReliable },
  { icon: '👥', text: text.trustedNetwork },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, isDark } = useWebTheme();
  const [language, setLanguage] = useState('en');
  const text = useMemo(() => COPY[language] || COPY.en, [language]);
  const features = useMemo(() => ROLE_FEATURES(text), [text]);
  const benefits = useMemo(() => BENEFITS(text), [text]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: isDark
          ? 'linear-gradient(180deg, #0A0A0A 0%, #141414 100%)'
          : 'linear-gradient(180deg, #FFFFFF 0%, #FDEFF0 100%)',
        color: theme.text,
      }}
    >
      <section
        style={{
          width: '100%',
          flex: 1,
          padding: '18px 20px 30px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', gap: '8px' }}>
            {['en', 'sw'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                style={{
                  borderRadius: '12px',
                  border: `1px solid ${language === option ? theme.primary : theme.border}`,
                  background: language === option ? `${theme.primary}20` : theme.card,
                  color: language === option ? theme.primary : theme.textSecondary,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>

          <div
            style={{
              borderRadius: '28px',
              overflow: 'hidden',
              marginBottom: '24px',
              border: `1px solid ${theme.border}`,
              minHeight: '420px',
              backgroundImage: `url(${heroImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                width: '100%',
                padding: '20px',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.78) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    marginRight: '12px',
                  }}
                >
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>M+</span>
                </div>
                <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '20px' }}>Medilink Kenya</p>
              </div>
              <h1
                style={{
                  margin: 0,
                  color: '#fff',
                  fontSize: '34px',
                  lineHeight: 1.2,
                  fontWeight: 900,
                  maxWidth: '620px',
                }}
              >
                {text.welcomeTitle}
              </h1>
              <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '15px', maxWidth: '620px' }}>
                {text.welcomeTagline}
              </p>
            </div>
          </div>

          <div
            style={{
              background: theme.card,
              borderRadius: '22px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              marginBottom: '24px',
            }}
          >
            <p style={{ margin: '0 0 10px', color: theme.text, fontWeight: 800, fontSize: '16px' }}>
              {text.highlightsTitle}
            </p>
            <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px', lineHeight: 1.45 }}>
              {text.highlightsText}
            </p>
          </div>

          <h2
            style={{
              margin: '0 0 16px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 800,
              color: theme.text,
            }}
          >
            {text.careForEveryRole}
          </h2>

          <div
            style={{
              display: 'grid',
              gap: '16px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginBottom: '24px',
            }}
          >
            {features.map((feature) => (
              <article
                key={feature.title}
                style={{
                  background: theme.card,
                  borderRadius: '18px',
                  padding: '16px',
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '27px',
                    background: `${feature.color}18`,
                    color: feature.color,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '24px',
                    marginBottom: '10px',
                  }}
                >
                  {feature.icon}
                </div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, color: theme.text }}>{feature.title}</p>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: theme.textSecondary }}>
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <div
            style={{
              background: theme.surface,
              borderRadius: '18px',
              padding: '18px',
              border: `1px solid ${theme.border}`,
            }}
          >
            <p style={{ margin: '0 0 14px', textAlign: 'center', fontWeight: 800, color: theme.text }}>
              {text.benefitsTitle}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {benefits.map((benefit) => (
                <div key={benefit.text} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      margin: '0 auto 6px',
                      borderRadius: '22px',
                      background: `${theme.primary}18`,
                      color: theme.primary,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '21px',
                    }}
                  >
                    {benefit.icon}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary, fontWeight: 700 }}>
                    {benefit.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          width: '100%',
          padding: '0 20px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            background: theme.background,
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            border: `1px solid ${theme.border}`,
            borderBottom: `1px solid ${theme.border}`,
            padding: '18px',
            boxShadow: isDark ? '0 -8px 24px rgba(0,0,0,0.35)' : '0 -8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="ml-button-primary"
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '16px',
              padding: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            {text.getStarted}
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="ml-button-secondary"
            style={{
              width: '100%',
              borderRadius: '16px',
              padding: '15px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {text.signIn}
          </button>
          <p style={{ margin: '10px 0 0', textAlign: 'center', color: theme.textSecondary, fontSize: '12px' }}>
            {text.termsText}
          </p>
        </div>
      </section>

      <footer
        style={{
          width: '100%',
          borderTop: `1px solid ${theme.border}`,
          background: theme.card,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '12px' }}>
            © {new Date().getFullYear()} Medilink Kenya. {text.footerLine}
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: theme.textSecondary, fontSize: '12px' }}>{text.footerLocation}</span>
            <a
              href="tel:+254718835212"
              style={{ color: theme.primary, fontSize: '12px', textDecoration: 'none', fontWeight: 700 }}
            >
              +254 718 835 212
            </a>
            <a
              href="mailto:alimalickkweyu46@gmail.com"
              style={{ color: theme.primary, fontSize: '12px', textDecoration: 'none', fontWeight: 700 }}
            >
              {text.footerSupport}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
