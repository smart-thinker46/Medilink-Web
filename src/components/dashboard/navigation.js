const ROLE_MENU = {
  PATIENT: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { id: 'appointments', label: 'Appointments', route: '/dashboard/appointments' },
    { id: 'book-appointment', label: 'Book Appointment', route: '/dashboard/book-appointment' },
    { id: 'find-medics', label: 'Find Medics', route: '/dashboard/find-medics' },
    { id: 'medical-records', label: 'Medical Records', route: '/dashboard/medical-records' },
    { id: 'health-hub', label: 'Health Hub', route: '/dashboard/health-hub' },
    { id: 'ai-assistant', label: 'AI Assistant', route: '/dashboard/ai-assistant' },
    { id: 'voice-ai', label: 'Voice AI', route: '/dashboard/voice-ai' },
    { id: 'pharmacy', label: 'Pharmacy', route: '/dashboard/pharmacy' },
    { id: 'cart', label: 'Cart', route: '/dashboard/cart' },
    { id: 'payment-methods', label: 'Payment Methods', route: '/dashboard/payment-methods' },
    { id: 'emergency', label: 'Emergency', route: '/dashboard/emergency' },
    { id: 'chat', label: 'Chat', route: '/dashboard/chat' },
    { id: 'video-call', label: 'Video Call', route: '/dashboard/video-call' },
    { id: 'notifications', label: 'Notifications', route: '/dashboard/notifications' },
    { id: 'profile', label: 'Profile', route: '/dashboard/profile' },
    { id: 'edit-profile', label: 'Edit Profile', route: '/dashboard/edit-profile' },
    { id: 'medical-info', label: 'Medical Info', route: '/dashboard/medical-info' },
  ],
  MEDIC: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { id: 'patients', label: 'Patients', route: '/dashboard/patients' },
    { id: 'appointments', label: 'Appointments', route: '/dashboard/appointments' },
    { id: 'shifts', label: 'Shifts', route: '/dashboard/shifts' },
    { id: 'pharmacy', label: 'Pharmacy', route: '/dashboard/pharmacy' },
    { id: 'analytics', label: 'Analytics', route: '/dashboard/analytics' },
    { id: 'payments', label: 'Payments', route: '/dashboard/payments' },
    { id: 'chat', label: 'Chat', route: '/dashboard/chat' },
    { id: 'video-call', label: 'Video Call', route: '/dashboard/video-call' },
    { id: 'notifications', label: 'Notifications', route: '/dashboard/notifications' },
    { id: 'profile', label: 'Profile', route: '/dashboard/profile' },
    { id: 'edit-profile', label: 'Edit Profile', route: '/dashboard/edit-profile' },
  ],
  HOSPITAL_ADMIN: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { id: 'create-shift', label: 'Create Shift', route: '/dashboard/create-shift' },
    { id: 'medics', label: 'Medics', route: '/dashboard/medics' },
    { id: 'appointments', label: 'Appointments', route: '/dashboard/appointments' },
    { id: 'inventory', label: 'Inventory', route: '/dashboard/inventory' },
    { id: 'payments', label: 'Payments', route: '/dashboard/payments' },
    { id: 'pharmacy', label: 'Pharmacy', route: '/dashboard/pharmacy' },
    { id: 'analytics', label: 'Analytics', route: '/dashboard/analytics' },
    { id: 'notifications', label: 'Notifications', route: '/dashboard/notifications' },
    { id: 'profile', label: 'Profile', route: '/dashboard/profile' },
    { id: 'settings', label: 'Settings', route: '/dashboard/settings' },
  ],
  PHARMACY_ADMIN: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { id: 'orders', label: 'Orders', route: '/dashboard/orders' },
    { id: 'products', label: 'Products', route: '/dashboard/products' },
    { id: 'pos', label: 'POS', route: '/dashboard/pos' },
    { id: 'analytics', label: 'Analytics', route: '/dashboard/analytics' },
    { id: 'voice-ai', label: 'Voice AI', route: '/dashboard/voice-ai' },
    { id: 'stock-history', label: 'Stock History', route: '/dashboard/stock-history' },
    { id: 'location', label: 'Location', route: '/dashboard/location' },
    { id: 'payments', label: 'Payments', route: '/dashboard/payments' },
    { id: 'chat', label: 'Chat', route: '/dashboard/chat' },
    { id: 'video-call', label: 'Video Call', route: '/dashboard/video-call' },
    { id: 'notifications', label: 'Notifications', route: '/dashboard/notifications' },
    { id: 'profile', label: 'Profile', route: '/dashboard/profile' },
    { id: 'edit-profile', label: 'Edit Profile', route: '/dashboard/edit-profile' },
  ],
  SUPER_ADMIN: [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { id: 'users', label: 'Users', route: '/dashboard/users' },
    { id: 'subscriptions', label: 'Subscriptions', route: '/dashboard/subscriptions' },
    { id: 'control-center', label: 'Control Center', route: '/dashboard/control-center' },
    { id: 'complaints', label: 'Complaints', route: '/dashboard/complaints' },
    { id: 'audit-logs', label: 'Audit Logs', route: '/dashboard/audit-logs' },
    { id: 'chat', label: 'Chat', route: '/dashboard/chat' },
    { id: 'notifications', label: 'Notifications', route: '/dashboard/notifications' },
    { id: 'email-center', label: 'Email Center', route: '/dashboard/email-center' },
    { id: 'video-call', label: 'Video Call', route: '/dashboard/video-call' },
    { id: 'settings', label: 'Settings', route: '/dashboard/settings' },
  ],
};

const QUICK_ACTION_ROUTE_MAP = {
  PATIENT: {
    'find-medics': '/dashboard/find-medics',
    'book-appointment': '/dashboard/book-appointment',
    'medical-records': '/dashboard/medical-records',
    'health-hub': '/dashboard/health-hub',
    'ai-assistant': '/dashboard/ai-assistant',
    'voice-ai': '/dashboard/voice-ai',
    pharmacy: '/dashboard/pharmacy',
    cart: '/dashboard/cart',
    'payment-methods': '/dashboard/payment-methods',
    emergency: '/dashboard/emergency',
  },
  MEDIC: {
    patients: '/dashboard/patients',
    sessions: '/dashboard/appointments',
    shifts: '/dashboard/shifts',
    payments: '/dashboard/payments',
    pharmacy: '/dashboard/pharmacy',
    analytics: '/dashboard/analytics',
  },
  HOSPITAL_ADMIN: {
    'create-shift': '/dashboard/create-shift',
    'review-medics': '/dashboard/medics',
    appointments: '/dashboard/appointments',
    payments: '/dashboard/payments',
  },
  PHARMACY_ADMIN: {
    pos: '/dashboard/pos',
    orders: '/dashboard/orders',
    products: '/dashboard/products',
    payments: '/dashboard/payments',
    'ai-assistant': '/dashboard/voice-ai',
    analytics: '/dashboard/analytics',
  },
  SUPER_ADMIN: {
    users: '/dashboard/users',
    subscriptions: '/dashboard/subscriptions',
    'control-center': '/dashboard/control-center',
    complaints: '/dashboard/complaints',
    'audit-logs': '/dashboard/audit-logs',
    'email-center': '/dashboard/email-center',
  },
};

export function normalizeRole(role) {
  return String(role || '').toUpperCase();
}

export function getRoleMenu(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_MENU[normalizedRole] || ROLE_MENU.PATIENT;
}

export function getRoleMenuTitle(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'MEDIC') return 'Medic Menu';
  if (normalizedRole === 'HOSPITAL_ADMIN') return 'Hospital Menu';
  if (normalizedRole === 'PHARMACY_ADMIN') return 'Pharmacy Menu';
  if (normalizedRole === 'SUPER_ADMIN') return 'Admin Menu';
  return 'Patient Menu';
}

export function getSidebarRoute(role, label) {
  const menu = getRoleMenu(role);
  const item = menu.find((entry) => entry.label === label || entry.id === label);
  return item?.route || '/dashboard';
}

export function getQuickActionRoute(role, actionId) {
  const normalizedRole = normalizeRole(role);
  const map = QUICK_ACTION_ROUTE_MAP[normalizedRole] || {};
  return map[String(actionId || '')] || '/dashboard';
}

export function getActiveMenuItem(role, pathname) {
  const normalizedPath = String(pathname || '/dashboard').replace(/\/+$/, '') || '/dashboard';
  const menu = getRoleMenu(role);
  return (
    menu.find((item) => {
      if (item.route === '/dashboard') return normalizedPath === '/dashboard';
      return normalizedPath === item.route || normalizedPath.startsWith(`${item.route}/`);
    }) || menu[0]
  );
}

export function getSectionMeta(role, sectionSlug) {
  const section = String(sectionSlug || '').toLowerCase();
  const menu = getRoleMenu(role);
  const item = menu.find((entry) => entry.id === section || entry.route.endsWith(`/${section}`));
  if (item) {
    return {
      id: item.id,
      title: item.label,
      route: item.route,
    };
  }
  return {
    id: section || 'dashboard',
    title: section
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    route: `/dashboard/${section}`,
  };
}

export function getSectionRouteList(role) {
  return getRoleMenu(role).map((item) => item.route);
}
