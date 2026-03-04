const API_BASE_URL = String(import.meta.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const API_TIMEOUT_MS = Number(import.meta.env.NEXT_PUBLIC_API_TIMEOUT_MS || 20000);

function buildApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${String(path || '')}`;
  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }
  if (!API_BASE_URL) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is not set. Add your backend URL to apps/web/.env.',
    );
  }
  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function extractErrorMessage(payload, fallback) {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  }
  return fallback;
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    token,
    body,
    headers = {},
  } = options;

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const init = {
    method,
    headers: requestHeaders,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId = null;
  if (controller && Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0) {
    timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    init.signal = controller.signal;
  }

  let response;
  try {
    response = await fetch(buildApiUrl(path), init);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timeout after ${API_TIMEOUT_MS}ms. Check backend/network and retry.`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const defaultMessage = `Request failed (${response.status})`;
    throw new Error(extractErrorMessage(payload, defaultMessage));
  }
  return payload;
}

export async function loginWithPassword(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: String(email || '').trim(),
      password: String(password || ''),
    },
  });
}

export async function registerWithPassword(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchProfile(token) {
  return apiRequest('/users/profile', { token });
}

export async function fetchNotifications(token) {
  return apiRequest('/notifications', { token });
}

export async function fetchRoleOverview(role, token, profile) {
  const normalizedRole = String(role || '').toUpperCase();
  const tenants = Array.isArray(profile?.user?.tenants) ? profile.user.tenants : [];

  if (normalizedRole === 'PATIENT') {
    return apiRequest('/users/patient-dashboard', { token });
  }
  if (normalizedRole === 'MEDIC') {
    return apiRequest('/medics/analytics/me', { token });
  }
  if (normalizedRole === 'HOSPITAL_ADMIN') {
    return apiRequest('/shifts/analytics/hospital', { token });
  }
  if (normalizedRole === 'PHARMACY_ADMIN') {
    const pharmacyTenant =
      tenants.find((tenant) => String(tenant?.type || '').toUpperCase() === 'PHARMACY') ||
      tenants[0];
    if (!pharmacyTenant?.id) {
      return { warning: 'No pharmacy tenant linked to this account yet.' };
    }
    return apiRequest(`/pharmacy/${pharmacyTenant.id}/analytics`, { token });
  }
  if (normalizedRole === 'SUPER_ADMIN') {
    return apiRequest('/admin/overview', { token });
  }
  return { warning: `No dashboard adapter yet for role: ${normalizedRole || 'UNKNOWN'}` };
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
