import React from 'react';
import { getRoleMenu, getRoleMenuTitle } from './navigation';

function formatLabel(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function money(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function SimpleList({ items, renderItem, emptyLabel, theme }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={{ margin: 0, color: theme.textSecondary }}>{emptyLabel}</p>;
  }
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {items.map((item, index) => (
        <div key={item?.id || item?.productId || item?.tenantId || index}>{renderItem(item)}</div>
      ))}
    </div>
  );
}

export function RoleSidebar({ role, unreadCount, theme, onMenuClick, activePath = '/dashboard' }) {
  const items = getRoleMenu(role);

  return (
    <aside
      style={{
        width: '240px',
        borderRight: `1px solid ${theme.border}`,
        background: theme.card,
        padding: '18px 14px',
      }}
    >
      <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800 }}>{getRoleMenuTitle(role)}</h2>
      <div style={{ display: 'grid', gap: '6px' }}>
        {items.map((item) => {
          const showBadge = item.label === 'Notifications' && unreadCount > 0;
          const isActive =
            String(activePath || '').replace(/\/+$/, '') === item.route ||
            (item.route !== '/dashboard' &&
              String(activePath || '').replace(/\/+$/, '').startsWith(`${item.route}/`));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onMenuClick(item)}
              style={{
                border: 'none',
                textAlign: 'left',
                borderRadius: '11px',
                padding: '10px 12px',
                background: isActive ? theme.primaryLight : 'transparent',
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: isActive ? 800 : 600 }}>{item.label}</span>
              {showBadge ? (
                <span
                  style={{
                    minWidth: '20px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: theme.error,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function QuickActions({ items, theme, onClick = () => {} }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="ml-card" style={{ padding: '14px', background: theme.card, marginTop: '12px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 800 }}>Quick Actions</h3>
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onClick(item)}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              background: theme.surface,
              padding: '12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <p style={{ margin: 0, color: item.color || theme.primary, fontSize: '13px', fontWeight: 800 }}>
              {item.title}
            </p>
            <p style={{ margin: '5px 0 0', color: theme.textSecondary, fontSize: '12px' }}>{item.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MetricGrid({ metrics, theme }) {
  const entries = Object.entries(metrics || {}).filter(
    ([, value]) => typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean',
  );
  if (!entries.length) return null;
  return (
    <section
      style={{
        display: 'grid',
        gap: '12px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      }}
    >
      {entries.slice(0, 12).map(([key, value]) => (
        <article key={key} className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '12px' }}>{formatLabel(key)}</p>
          <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800 }}>
            {typeof value === 'number' ? value.toLocaleString() : String(value)}
          </p>
        </article>
      ))}
    </section>
  );
}

function PatientContent({ theme, overview, onQuickAction }) {
  const quickActions = [
    { id: 'find-medics', title: 'Find Medics', description: 'Search specialists', color: theme.primary },
    { id: 'book-appointment', title: 'Book Appointment', description: 'Schedule care', color: theme.accent },
    { id: 'medical-records', title: 'Medical Records', description: 'View your records', color: theme.success },
    { id: 'ai-assistant', title: 'AI Assistant', description: 'Smart search and summary', color: theme.info },
    { id: 'health-hub', title: 'Health Hub', description: 'Care plan and alerts', color: theme.warning },
    { id: 'voice-ai', title: 'Voice AI', description: 'Talk to AI assistant', color: theme.info },
    { id: 'pharmacy', title: 'Pharmacy', description: 'Buy medicine and supplies', color: theme.primary },
    { id: 'cart', title: 'Cart', description: 'Checkout selected products', color: theme.accent },
    { id: 'payment-methods', title: 'Payment Methods', description: 'IntaSend payment setup', color: theme.success },
    { id: 'emergency', title: 'Emergency', description: 'Fast emergency help', color: theme.error },
  ];

  const metrics = {
    healthScore: overview?.adherence?.overallScore || 0,
    medicationAdherence: overview?.adherence?.medicationAdherence || 0,
    appointmentAdherence: overview?.adherence?.appointmentAdherence || 0,
    activeMedications: Array.isArray(overview?.carePlan?.medications)
      ? overview.carePlan.medications.length
      : 0,
    preventiveReminders: Array.isArray(overview?.preventiveReminders)
      ? overview.preventiveReminders.length
      : 0,
    criticalAlerts: Array.isArray(overview?.criticalAlerts) ? overview.criticalAlerts.length : 0,
  };

  return (
    <>
      <MetricGrid metrics={metrics} theme={theme} />
      <QuickActions
        items={quickActions}
        theme={theme}
        onClick={onQuickAction}
      />
      <div style={{ display: 'grid', gap: '12px', marginTop: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Care Plan</h3>
          <SimpleList
            items={overview?.carePlan?.medications || []}
            theme={theme}
            emptyLabel="No medications in care plan."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.text }}>
                  {item?.medication || item?.name || 'Medication'}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.dosage || '-'} • {item?.frequency || 'As prescribed'}
                </p>
              </div>
            )}
          />
        </section>

        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Preventive Reminders</h3>
          <SimpleList
            items={overview?.preventiveReminders || []}
            theme={theme}
            emptyLabel="No reminders."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.text }}>{item?.title || 'Reminder'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>{item?.due || '-'}</p>
              </div>
            )}
          />
        </section>
      </div>
    </>
  );
}

function MedicContent({ theme, overview, onQuickAction }) {
  const quickActions = [
    { id: 'patients', title: 'My Patients', description: 'Active patients', color: theme.primary },
    { id: 'sessions', title: 'Sessions', description: 'Booked appointments', color: theme.accent },
    { id: 'shifts', title: 'Apply for Shifts', description: 'Hospital openings', color: theme.success },
    { id: 'payments', title: 'Payments', description: 'Income tracking', color: theme.warning },
    { id: 'pharmacy', title: 'Pharmacy', description: 'Buy medicines', color: theme.primary },
    { id: 'analytics', title: 'Analytics', description: 'Performance insights', color: theme.info },
  ];

  const totals = overview?.totals || {};
  const wallet = overview?.wallet || {};
  const metrics = {
    patientsServed: totals?.patientsServed || 0,
    underTreatment: totals?.underTreatment || 0,
    recoveredPatients: totals?.recoveredPatients || 0,
    criticalPatients: totals?.criticalPatients || 0,
    moneyMade: totals?.moneyMade || 0,
    pendingMoney: totals?.pendingMoney || 0,
  };

  return (
    <>
      <MetricGrid metrics={metrics} theme={theme} />
      <QuickActions
        items={quickActions}
        theme={theme}
        onClick={onQuickAction}
      />
      <div style={{ display: 'grid', gap: '12px', marginTop: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Wallet Summary</h3>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Available: <strong style={{ color: theme.text }}>{money(wallet?.availableBalance)}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Pending: <strong style={{ color: theme.text }}>{money(wallet?.pendingBalance)}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Paid transactions: <strong style={{ color: theme.text }}>{wallet?.paidTransactions || 0}</strong></p>
        </section>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Clinical Output</h3>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Total records: <strong style={{ color: theme.text }}>{totals?.totalRecords || 0}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Prescriptions issued: <strong style={{ color: theme.text }}>{totals?.prescriptionsIssued || 0}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Clinical updates: <strong style={{ color: theme.text }}>{totals?.clinicalUpdates || 0}</strong></p>
        </section>
      </div>
    </>
  );
}

function HospitalContent({ theme, overview, onQuickAction }) {
  const quickActions = [
    { id: 'create-shift', title: 'Create Shift', description: 'Post available shifts', color: theme.primary },
    { id: 'review-medics', title: 'Review Medics', description: 'Approve applications', color: theme.accent },
    { id: 'appointments', title: 'Patient Requests', description: 'Appointments inbox', color: theme.success },
    { id: 'payments', title: 'Payments', description: 'Receive and pay', color: theme.warning },
  ];

  const totals = overview?.totals || {};
  const metrics = {
    shiftsCreated: totals?.shiftsCreated || 0,
    shiftsCancelled: totals?.shiftsCancelled || 0,
    appliedShifts: totals?.appliedShifts || 0,
    hiredMedics: totals?.hiredMedics || 0,
    amountPaid: totals?.amountPaid || 0,
    pendingAmount: totals?.pendingAmount || 0,
    totalProducts: totals?.totalProducts || 0,
    salesRevenue: totals?.salesRevenue || 0,
  };

  return (
    <>
      <MetricGrid metrics={metrics} theme={theme} />
      <QuickActions
        items={quickActions}
        theme={theme}
        onClick={onQuickAction}
      />
      <section className="ml-card" style={{ padding: '14px', background: theme.card, marginTop: '12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Top Bought Products</h3>
        <SimpleList
          items={overview?.topBoughtProducts || []}
          theme={theme}
          emptyLabel="No product sales data yet."
          renderItem={(item) => (
            <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: theme.text }}>{item?.productName || 'Product'}</span>
              <strong style={{ fontSize: '13px', color: theme.primary }}>{item?.quantity || 0}</strong>
            </div>
          )}
        />
      </section>
    </>
  );
}

function PharmacyContent({ theme, overview, onQuickAction }) {
  const quickActions = [
    { id: 'pos', title: 'POS', description: 'Make a sale', color: theme.primary },
    { id: 'orders', title: 'Orders', description: 'Incoming requests', color: theme.accent },
    { id: 'products', title: 'Products', description: 'Manage inventory', color: theme.success },
    { id: 'payments', title: 'Payments', description: 'Subscription and payouts', color: theme.warning },
    { id: 'ai-assistant', title: 'AI Assistant', description: 'Smart pharmacy insights', color: theme.info },
    { id: 'analytics', title: 'Analytics', description: 'Store performance', color: theme.info },
  ];

  const totals = overview?.totals || {};
  const wallet = overview?.wallet || {};
  const metrics = {
    totalOrders: totals?.totalOrders || 0,
    completedOrders: totals?.completedOrders || 0,
    pendingOrders: totals?.pendingOrders || 0,
    totalProducts: totals?.totalProducts || 0,
    lowStock: totals?.lowStock || 0,
    moneyFromSales: totals?.moneyFromSales || 0,
    walletAvailable: wallet?.availableBalance || 0,
    walletPending: wallet?.pendingBalance || 0,
  };

  return (
    <>
      <MetricGrid metrics={metrics} theme={theme} />
      <QuickActions
        items={quickActions}
        theme={theme}
        onClick={onQuickAction}
      />
      <div style={{ display: 'grid', gap: '12px', marginTop: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Top Sold Products</h3>
          <SimpleList
            items={overview?.topSoldProducts || []}
            theme={theme}
            emptyLabel="No sold products yet."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: theme.text }}>{item?.productName || 'Product'}</span>
                <strong style={{ fontSize: '13px', color: theme.primary }}>{item?.quantity || 0}</strong>
              </div>
            )}
          />
        </section>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Risk Checks</h3>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Failed payments: <strong style={{ color: theme.text }}>{overview?.riskChecks?.failedPayments || 0}</strong>
          </p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Pending over SLA: <strong style={{ color: theme.text }}>{overview?.slaDashboard?.pendingOverSla || 0}</strong>
          </p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Checkout abandonment: <strong style={{ color: theme.text }}>{overview?.conversionFunnel?.abandonmentRate || 0}%</strong>
          </p>
        </section>
      </div>
    </>
  );
}

function AdminContent({ theme, overview, onQuickAction }) {
  const quickActions = [
    { id: 'users', title: 'Users', description: 'Manage users', color: theme.primary },
    { id: 'subscriptions', title: 'Subscriptions', description: 'Update plans', color: theme.accent },
    { id: 'control-center', title: 'Control Center', description: 'Platform controls', color: theme.success },
    { id: 'complaints', title: 'Complaints', description: 'Resolve issues', color: theme.warning },
    { id: 'audit-logs', title: 'Audit Logs', description: 'Track actions', color: theme.info },
    { id: 'email-center', title: 'Email Center', description: 'Send announcements', color: theme.primary },
  ];

  const totals = overview?.totals || {};
  const revenue = overview?.revenue || {};
  const metrics = {
    totalUsers: totals?.totalUsers || 0,
    patients: totals?.patients || 0,
    medics: totals?.medics || 0,
    hospitals: totals?.hospitals || 0,
    pharmacies: totals?.pharmacies || 0,
    subscriptionActive: totals?.subscriptionActive || 0,
    subscriptionInactive: totals?.subscriptionInactive || 0,
    revenueTotal: revenue?.total || 0,
    subscriptionRevenue: revenue?.subscriptions || 0,
    complaintsCount: overview?.complaintsCount || 0,
  };

  return (
    <>
      <MetricGrid metrics={metrics} theme={theme} />
      <QuickActions items={quickActions} theme={theme} onClick={onQuickAction} />
      <div style={{ display: 'grid', gap: '12px', marginTop: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Top Hospitals</h3>
          <SimpleList
            items={overview?.top?.hospitals || []}
            theme={theme}
            emptyLabel="No ranking data."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.text }}>
                  {item?.fullName || item?.email || 'Hospital'}
                </p>
              </div>
            )}
          />
        </section>
        <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Top Medics</h3>
          <SimpleList
            items={overview?.top?.medics || []}
            theme={theme}
            emptyLabel="No ranking data."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '10px', background: theme.surface }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: theme.text }}>
                  {item?.fullName || item?.email || 'Medic'}
                </p>
              </div>
            )}
          />
        </section>
      </div>
      <section className="ml-card" style={{ padding: '14px', background: theme.card, marginTop: '12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>System Signals</h3>
        <p style={{ margin: '4px 0', color: theme.textSecondary }}>
          Blocked users: <strong style={{ color: theme.text }}>{overview?.analytics?.blocked?.blocked || 0}</strong>
        </p>
        <p style={{ margin: '4px 0', color: theme.textSecondary }}>
          Online users: <strong style={{ color: theme.text }}>{overview?.analytics?.onlineStatus?.online || 0}</strong>
        </p>
        <p style={{ margin: '4px 0', color: theme.textSecondary }}>
          Unpaid users: <strong style={{ color: theme.text }}>{overview?.analytics?.subscriptions?.unpaidUsersCount || 0}</strong>
        </p>
      </section>
    </>
  );
}

export function RoleDashboardContent({ role, theme, overview, onQuickAction }) {
  const normalizedRole = String(role || '').toUpperCase();

  if (normalizedRole === 'PATIENT')
    return <PatientContent theme={theme} overview={overview} onQuickAction={onQuickAction} />;
  if (normalizedRole === 'MEDIC')
    return <MedicContent theme={theme} overview={overview} onQuickAction={onQuickAction} />;
  if (normalizedRole === 'HOSPITAL_ADMIN')
    return <HospitalContent theme={theme} overview={overview} onQuickAction={onQuickAction} />;
  if (normalizedRole === 'PHARMACY_ADMIN')
    return <PharmacyContent theme={theme} overview={overview} onQuickAction={onQuickAction} />;
  if (normalizedRole === 'SUPER_ADMIN') {
    return <AdminContent theme={theme} overview={overview} onQuickAction={onQuickAction} />;
  }

  return (
    <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800 }}>Dashboard</h3>
      <p style={{ margin: 0, color: theme.textSecondary }}>
        Unsupported role: {normalizedRole || 'UNKNOWN'}
      </p>
      <pre
        style={{
          marginTop: '10px',
          fontSize: '12px',
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: '8px',
          padding: '10px',
          overflow: 'auto',
          maxHeight: '280px',
        }}
      >
        {JSON.stringify(overview, null, 2)}
      </pre>
    </section>
  );
}

export function getRoleMetrics(role, overview) {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole === 'PATIENT') {
    return {
      healthScore: overview?.adherence?.overallScore || 0,
      medicationAdherence: overview?.adherence?.medicationAdherence || 0,
      appointmentAdherence: overview?.adherence?.appointmentAdherence || 0,
      activeMedications: Array.isArray(overview?.carePlan?.medications)
        ? overview.carePlan.medications.length
        : 0,
    };
  }
  if (normalizedRole === 'MEDIC' || normalizedRole === 'HOSPITAL_ADMIN') {
    return { ...(overview?.totals || {}) };
  }
  if (normalizedRole === 'PHARMACY_ADMIN') {
    return {
      ...(overview?.totals || {}),
      walletAvailable: overview?.wallet?.availableBalance || 0,
      walletPending: overview?.wallet?.pendingBalance || 0,
    };
  }
  if (normalizedRole === 'SUPER_ADMIN') {
    return {
      ...(overview?.totals || {}),
      revenueTotal: overview?.revenue?.total || 0,
      subscriptionRevenue: overview?.revenue?.subscriptions || 0,
      complaintsCount: overview?.complaintsCount || 0,
    };
  }
  return {};
}
