
const mobileWebUrl = import.meta.env.NEXT_PUBLIC_MOBILE_WEB_URL;

export default function Page() {
  if (mobileWebUrl) {
    return (
      <main style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
        <iframe
          title="MediLink Mobile Web"
          src={mobileWebUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '32px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>MediLink Web</h1>
      <p style={{ marginBottom: '12px' }}>
        Web app server is running, but this project is not yet wired to render the mobile dashboard
        screens directly.
      </p>
      <p style={{ marginBottom: '12px' }}>
        If you want to view mobile screens in this web app, set:
      </p>
      <code
        style={{
          display: 'inline-block',
          background: '#e2e8f0',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        NEXT_PUBLIC_MOBILE_WEB_URL=http://localhost:8081
      </code>
      <p>
        Then restart <code>npm run dev</code> in <code>apps/web</code>.
      </p>
    </main>
  );
}
