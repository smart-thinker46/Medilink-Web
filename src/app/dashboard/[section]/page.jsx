import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import ThemeModeSwitch from '@/components/ThemeModeSwitch';
import { useWebTheme } from '@/components/WebThemeProvider';
import { RoleSidebar } from '@/components/dashboard/RoleDashboardViews';
import {
  getRoleMenu,
  getSectionMeta,
  normalizeRole,
} from '@/components/dashboard/navigation';
import {
  apiRequest,
  fetchNotifications,
  fetchProfile,
  fetchRoleOverview,
  getApiBaseUrl,
} from '@/utils/medilink-api';
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

function money(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

const API_BASE_URL = String(getApiBaseUrl() || '').replace(/\/+$/, '');

function resolveImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!API_BASE_URL) return raw;
  return `${API_BASE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function normalizeLocation(value) {
  if (!value) return null;
  if (typeof value === 'string') return { address: value };
  const latitude = Number(
    value?.latitude ?? value?.lat ?? value?.locationLat ?? value?.locationCoordinates?.lat,
  );
  const longitude = Number(
    value?.longitude ?? value?.lng ?? value?.locationLng ?? value?.locationCoordinates?.lng,
  );
  const address = String(value?.address ?? value?.locationAddress ?? value?.location ?? '').trim();
  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    address: address || null,
  };
}

function getDistanceKm(origin, target) {
  const lat1 = Number(origin?.latitude);
  const lon1 = Number(origin?.longitude);
  const lat2 = Number(target?.latitude);
  const lon2 = Number(target?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toDialablePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function getAttachmentType(file) {
  const name = String(file?.name || file?.url || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return 'image';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return 'file';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

const PATIENT_CART_STORAGE_KEY = 'medilink:web:patient-cart';

function loadPatientCartFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PATIENT_CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePatientCartToStorage(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PATIENT_CART_STORAGE_KEY, JSON.stringify(toArray(items)));
  } catch {
    /* noop */
  }
}

function pickTenant(profile, type) {
  const wanted = String(type || '').toUpperCase();
  const tenants = toArray(profile?.user?.tenants);
  return tenants.find((tenant) => String(tenant?.type || '').toUpperCase() === wanted) || tenants[0] || null;
}

function SectionCard({ title, subtitle, children, theme }) {
  return (
    <section className="ml-card" style={{ padding: '14px', background: theme.card }}>
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{title}</h3>
      {subtitle ? <p style={{ margin: '4px 0 10px', color: theme.textSecondary, fontSize: '12px' }}>{subtitle}</p> : null}
      {children}
    </section>
  );
}

function ListRows({ items, renderItem, emptyLabel, theme }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={{ margin: 0, color: theme.textSecondary }}>{emptyLabel}</p>;
  }
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {items.map((item, index) => (
        <div key={item?.id || item?.user?.id || item?.email || index}>{renderItem(item)}</div>
      ))}
    </div>
  );
}

async function loadSectionData({ section, role, token, profile, overview, searchQuery }) {
  const normalizedRole = normalizeRole(role);
  const slug = String(section || '').toLowerCase();
  const searchParams = new URLSearchParams(String(searchQuery || ''));
  const recordId = String(searchParams.get('recordId') || '').trim();
  const productId = String(searchParams.get('productId') || '').trim();

  if (slug === 'appointments') {
    const appointments = await apiRequest('/appointments', { token });
    if (normalizedRole === 'PATIENT') {
      const [myLocation, linkedLocations, medics] = await Promise.all([
        apiRequest('/users/location', { token }).catch(() => null),
        apiRequest('/users/linked-locations', { token }).catch(() => []),
        apiRequest('/medics', { token }).catch(() => []),
      ]);
      return { appointments, myLocation, linkedLocations, medics };
    }
    if (normalizedRole === 'MEDIC') {
      const records = await apiRequest('/medical-records', { token }).catch(() => []);
      return { appointments, records };
    }
    return appointments;
  }

  if (slug === 'book-appointment') {
    const [medics, appointments, myLocation, userProfile] = await Promise.all([
      apiRequest('/medics', { token }),
      apiRequest('/appointments', { token }).catch(() => []),
      apiRequest('/users/location', { token }).catch(() => null),
      apiRequest('/users/profile', { token }).catch(() => null),
    ]);
    return { medics, appointments, myLocation, profile: userProfile };
  }

  if (slug === 'patients') {
    if (normalizedRole === 'MEDIC') {
      const [records, hires, analytics] = await Promise.all([
        apiRequest('/medical-records', { token }).catch(() => []),
        apiRequest('/medics/hires', { token }).catch(() => []),
        apiRequest('/medics/analytics/me', { token }).catch(() => null),
      ]);
      const patientIds = Array.from(
        new Set(
          [...toArray(records), ...toArray(hires)]
            .map((item) => String(item?.patientId || '').trim())
            .filter(Boolean),
        ),
      );
      const patients = (
        await Promise.all(
          patientIds.slice(0, 60).map((patientId) =>
            apiRequest(`/users/${patientId}`, { token }).catch(() => null),
          ),
        )
      )
        .filter(Boolean)
        .map((item) => item?.user || item);
      return { patients, records, hires, analytics };
    }
    return apiRequest('/medics', { token });
  }

  if (slug === 'find-medics' || slug === 'medics') {
    if (normalizedRole === 'HOSPITAL_ADMIN') {
      const [medics, hires] = await Promise.all([
        apiRequest('/medics', { token }).catch(() => []),
        apiRequest('/medics/hires', { token }).catch(() => []),
      ]);
      return { medics, hires };
    }
    if (normalizedRole === 'PATIENT') {
      const [medics, profileInfo] = await Promise.all([
        apiRequest('/medics', { token }).catch(() => []),
        apiRequest('/users/profile', { token }).catch(() => null),
      ]);
      return { medics, profile: profileInfo };
    }
    return apiRequest('/medics', { token });
  }

  if (slug === 'medical-records') {
    const [records, accessRequests, recordDetail] = await Promise.all([
      apiRequest('/medical-records', { token }).catch(() => []),
      apiRequest('/medical-records/access/requests?status=PENDING', { token }).catch(() => []),
      recordId ? apiRequest(`/medical-records/${recordId}`, { token }).catch(() => null) : Promise.resolve(null),
    ]);
    return { records, accessRequests, recordDetail };
  }

  if (slug === 'health-hub') {
    return apiRequest('/users/patient-dashboard', { token });
  }

  if (slug === 'ai-assistant') {
    const [settings, history] = await Promise.all([
      apiRequest('/ai/settings', { token }).catch(() => ({})),
      apiRequest('/ai/voice/history?limit=8', { token }).catch(() => []),
    ]);
    return { settings, history };
  }

  if (slug === 'voice-ai') {
    const [settings, history] = await Promise.all([
      apiRequest('/ai/settings', { token }).catch(() => ({})),
      apiRequest('/ai/voice/history?limit=8', { token }).catch(() => []),
    ]);
    return { settings, history };
  }

  if (slug === 'emergency') {
    const [supportAdmin, linkedLocations, medics, myLocation, userProfile] = await Promise.all([
      apiRequest('/users/support-admin', { token }).catch(() => null),
      apiRequest('/users/linked-locations', { token }).catch(() => []),
      apiRequest('/medics?limit=100', { token }).catch(() => []),
      apiRequest('/users/location', { token }).catch(() => null),
      apiRequest('/users/profile', { token }).catch(() => null),
    ]);
    return { supportAdmin, linkedLocations, medics, myLocation, profile: userProfile };
  }

  if (slug === 'chat') {
    return apiRequest('/messages/conversations', { token });
  }

  if (slug === 'video-call') {
    return apiRequest('/video-calls/history', { token });
  }

  if (slug === 'notifications') {
    return apiRequest('/notifications', { token });
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'settings') {
    const [rolePermissions, featureFlags] = await Promise.all([
      apiRequest('/admin/role-permissions', { token }).catch(() => ({})),
      apiRequest('/admin/feature-flags', { token }).catch(() => ({})),
    ]);
    return { rolePermissions, featureFlags };
  }

  if (slug === 'profile' || slug === 'edit-profile' || slug === 'settings' || slug === 'medical-info') {
    const [userProfile, location] = await Promise.all([
      apiRequest('/users/profile', { token }),
      apiRequest('/users/location', { token }).catch(() => null),
    ]);
    return { userProfile, location };
  }

  if (slug === 'location') {
    return apiRequest('/users/location', { token });
  }

  if (slug === 'shifts' || slug === 'create-shift') {
    if (slug === 'create-shift') {
      return apiRequest('/shifts?mine=true', { token });
    }
    return apiRequest('/shifts', { token });
  }

  if (slug === 'orders') {
    const [orders, payments] = await Promise.all([
      apiRequest('/orders', { token }).catch(() => []),
      apiRequest('/payments/history', { token }).catch(() => []),
    ]);
    return { orders, payments };
  }

  if (slug === 'products' || slug === 'inventory' || slug === 'stock-history' || slug === 'pos') {
    const tenantType = normalizedRole === 'HOSPITAL_ADMIN' ? 'HOSPITAL' : 'PHARMACY';
    const tenant = pickTenant(profile, tenantType);
    if (!tenant?.id) {
      return { warning: 'No linked tenant found for this account.' };
    }
    const [products, stockMovements] = await Promise.all([
      apiRequest(`/pharmacy/${tenant.id}/products`, { token }).catch(() => []),
      apiRequest(`/pharmacy/${tenant.id}/stock-movements`, { token }).catch(() => []),
    ]);
    const analytics = await apiRequest(`/pharmacy/${tenant.id}/analytics`, { token }).catch(() => null);
    const orders = slug === 'pos' ? await apiRequest('/orders', { token }).catch(() => []) : [];
    return { tenant, products, stockMovements, analytics, orders };
  }

  if (slug === 'pharmacy') {
    const [marketplace, methods, rates, productDetail] = await Promise.all([
      apiRequest('/pharmacy/marketplace', { token }).catch(() => ({ products: [] })),
      apiRequest('/payments/methods', { token }).catch(() => []),
      apiRequest('/payments/rates', { token }).catch(() => ({})),
      productId ? apiRequest(`/pharmacy/products/${productId}`, { token }).catch(() => null) : Promise.resolve(null),
    ]);
    return { marketplace, methods, rates, productDetail };
  }

  if (slug === 'cart' || slug === 'payment-methods') {
    const [methods, rates] = await Promise.all([
      apiRequest('/payments/methods', { token }).catch(() => []),
      apiRequest('/payments/rates', { token }).catch(() => ({})),
    ]);
    return { methods, rates };
  }

  if (slug === 'analytics') {
    return overview || fetchRoleOverview(role, token, profile);
  }

  if (slug === 'payments') {
    const [history, wallet] = await Promise.all([
      apiRequest('/payments/history', { token }).catch(() => []),
      apiRequest('/payments/wallet', { token }).catch(() => null),
    ]);
    return { history, wallet };
  }

  if (normalizedRole === 'SUPER_ADMIN') {
    if (slug === 'users') return apiRequest('/admin/users', { token });
    if (slug === 'subscriptions') return apiRequest('/admin/subscriptions', { token });
    if (slug === 'control-center') return apiRequest('/admin/control-center', { token });
    if (slug === 'complaints') return apiRequest('/admin/complaints', { token });
    if (slug === 'audit-logs') return apiRequest('/admin/audit-logs', { token });
    if (slug === 'email-center') {
      const [adminNotifications, users] = await Promise.all([
        apiRequest('/admin/notifications', { token }).catch(() => []),
        apiRequest('/admin/users?page=1&pageSize=20', { token }).catch(() => ({ items: [] })),
      ]);
      return { adminNotifications, users };
    }
    if (slug === 'chat') return apiRequest('/messages/conversations', { token });
    if (slug === 'video-call') return apiRequest('/video-calls/history', { token });
    if (slug === 'notifications') return apiRequest('/notifications', { token });
  }

  return { message: 'This screen is wired and ready for the next mobile parity pass.' };
}

function SectionRenderer({
  role,
  userId,
  section,
  searchQuery,
  sectionData,
  sectionLoading,
  sectionError,
  theme,
  token,
  onReload,
}) {
  const normalizedRole = normalizeRole(role);
  const slug = String(section || '').toLowerCase();
  const [filter, setFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [appointmentsTab, setAppointmentsTab] = useState('upcoming');
  const [recordsTab, setRecordsTab] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [showEmergencyContacts, setShowEmergencyContacts] = useState(false);
  const [voiceMode, setVoiceMode] = useState('general');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voiceToolName, setVoiceToolName] = useState('search_medics');
  const [voiceSessionInfo, setVoiceSessionInfo] = useState(null);
  const [voiceToolResult, setVoiceToolResult] = useState(null);
  const [medicationCheckInput, setMedicationCheckInput] = useState('');
  const [newMedicationName, setNewMedicationName] = useState('');
  const [newMedicationDosage, setNewMedicationDosage] = useState('');
  const [vitalSystolic, setVitalSystolic] = useState('');
  const [vitalDiastolic, setVitalDiastolic] = useState('');
  const [vitalSugar, setVitalSugar] = useState('');
  const [medicFilters, setMedicFilters] = useState({
    location: '',
    category: '',
    specialization: '',
    experience: 'any',
  });
  const [appointmentForm, setAppointmentForm] = useState({
    medicId: '',
    date: '',
    time: '',
    mode: 'video',
    reason: '',
    treatmentLocation: '',
  });
  const [shiftForm, setShiftForm] = useState({
    title: '',
    description: '',
    specialization: '',
    requiredMedics: 1,
    hours: 8,
    payType: 'hourly',
    payAmount: 1000,
  });
  const [complaintResolutionMap, setComplaintResolutionMap] = useState({});
  const [emailDraft, setEmailDraft] = useState({
    title: '',
    message: '',
    audience: 'ALL',
    sendEmail: true,
  });
  const [profileDraft, setProfileDraft] = useState({
    fullName: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    locationAddress: '',
    lat: '',
    lng: '',
  });
  const [medicalInfoDraft, setMedicalInfoDraft] = useState({
    allergies: '',
    bloodGroup: '',
    chronicConditions: '',
    insuranceProvider: '',
    insuranceNumber: '',
  });
  const [aiAssistantSearchQuery, setAiAssistantSearchQuery] = useState('');
  const [aiAssistantQuery, setAiAssistantQuery] = useState('');
  const [aiAssistantSearchResults, setAiAssistantSearchResults] = useState([]);
  const [aiAssistantAnswer, setAiAssistantAnswer] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [cartPhone, setCartPhone] = useState('');
  const [cartNotes, setCartNotes] = useState('');
  const [cartCurrency, setCartCurrency] = useState('KES');
  const [cartPaymentMethod, setCartPaymentMethod] = useState('intasend');
  const [pharmacyCategory, setPharmacyCategory] = useState('all');
  const [pharmacyLocationFilter, setPharmacyLocationFilter] = useState('');
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const initialMedicId = useMemo(
    () => new URLSearchParams(String(searchQuery || '')).get('medicId') || '',
    [searchQuery],
  );
  const initialRecordsTab = useMemo(() => {
    const tab = new URLSearchParams(String(searchQuery || '')).get('tab') || '';
    const allowed = new Set(['all', 'prescriptions', 'conditions', 'notes']);
    return allowed.has(tab) ? tab : 'all';
  }, [searchQuery]);
  const initialPrescriptionId = useMemo(
    () => new URLSearchParams(String(searchQuery || '')).get('prescriptionId') || '',
    [searchQuery],
  );
  const initialRecordId = useMemo(
    () => new URLSearchParams(String(searchQuery || '')).get('recordId') || '',
    [searchQuery],
  );
  const initialProductId = useMemo(
    () => new URLSearchParams(String(searchQuery || '')).get('productId') || '',
    [searchQuery],
  );
  const profileCompletionPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        sectionData?.profile?.user?.profileCompletionPercent ||
          sectionData?.userProfile?.user?.profileCompletionPercent ||
          sectionData?.user?.profileCompletionPercent ||
          0,
      ),
    ),
  );
  const isProfileComplete = profileCompletionPercent >= 99;

  useEffect(() => {
    setActionError('');
    setSuccess('');
  }, [slug]);

  useEffect(() => {
    setShowAdvancedFilters(false);
    setAppointmentsTab('upcoming');
    setRecordsTab(initialRecordsTab);
    setShowEmergencyContacts(false);
    setVoiceMode('general');
    setVoiceQuery('');
    setVoiceToolName('search_medics');
    setVoiceSessionInfo(null);
    setVoiceToolResult(null);
    setMedicationCheckInput('');
    setNewMedicationName('');
    setNewMedicationDosage('');
    setVitalSystolic('');
    setVitalDiastolic('');
    setVitalSugar('');
    setMedicFilters({
      location: '',
      category: '',
      specialization: '',
      experience: 'any',
    });
    setAiAssistantSearchQuery('');
    setAiAssistantQuery('');
    setAiAssistantSearchResults([]);
    setAiAssistantAnswer('');
    setPharmacyCategory('all');
    setPharmacyLocationFilter('');
    setSelectedPrescriptionId(initialPrescriptionId);
    setCartCurrency('KES');
    setCartPaymentMethod('intasend');
    setCartPhone('');
    setCartNotes('');
    setAiSummary(null);
  }, [slug, initialRecordsTab, initialPrescriptionId]);

  useEffect(() => {
    if (slug !== 'edit-profile' && slug !== 'settings' && slug !== 'location' && slug !== 'medical-info') return;
    const profile = sectionData?.userProfile?.user || sectionData?.user || {};
    const location = sectionData?.location || {};
    setProfileDraft({
      fullName: profile?.fullName || '',
      phone: profile?.phone || '',
      emergencyContactName: profile?.emergencyContactName || '',
      emergencyContactPhone: profile?.emergencyContactPhone || '',
      locationAddress: location?.address || profile?.locationAddress || '',
      lat: location?.lat !== undefined && location?.lat !== null ? String(location.lat) : '',
      lng: location?.lng !== undefined && location?.lng !== null ? String(location.lng) : '',
    });
    setMedicalInfoDraft({
      allergies: String(profile?.allergies || '').trim(),
      bloodGroup: String(profile?.bloodGroup || '').trim(),
      chronicConditions: String(profile?.chronicConditions || '').trim(),
      insuranceProvider: String(profile?.insuranceProvider || '').trim(),
      insuranceNumber: String(profile?.insuranceNumber || '').trim(),
    });
  }, [slug, sectionData]);

  const medics = useMemo(() => {
    const all = toArray(sectionData?.medics || sectionData);
    if (!filter.trim()) return all;
    const value = filter.toLowerCase();
    return all.filter((medic) => {
      const bundle = [
        medic?.name,
        medic?.fullName,
        medic?.specialization,
        medic?.category,
        medic?.location,
        toArray(medic?.availabilityDays).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return bundle.includes(value);
    });
  }, [sectionData, filter]);

  useEffect(() => {
    if (slug !== 'book-appointment' || !initialMedicId) return;
    setAppointmentForm((prev) => ({ ...prev, medicId: initialMedicId }));
  }, [slug, initialMedicId]);

  useEffect(() => {
    if (slug !== 'pharmacy' && slug !== 'cart' && slug !== 'payment-methods') return;
    setCartItems(loadPatientCartFromStorage());
  }, [slug]);

  useEffect(() => {
    savePatientCartToStorage(cartItems);
  }, [cartItems]);

  const submitAppointment = async (event) => {
    event.preventDefault();
    if (!isProfileComplete) {
      setActionError('Complete at least 99% of your profile before booking.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const selectedMedicId = String(appointmentForm.medicId || '').trim();
      await apiRequest('/appointments', {
        method: 'POST',
        token,
        body: {
          medicId: selectedMedicId,
          medic_id: selectedMedicId,
          date: appointmentForm.date,
          time: appointmentForm.time,
          mode: appointmentForm.mode,
          reason: appointmentForm.reason,
          treatmentLocation: appointmentForm.treatmentLocation,
        },
      });
      setSuccess('Appointment booked successfully.');
      setAppointmentForm({
        medicId: '',
        date: '',
        time: '',
        mode: 'video',
        reason: '',
        treatmentLocation: '',
      });
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to create appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitShift = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/shifts', {
        method: 'POST',
        token,
        body: shiftForm,
      });
      setSuccess('Shift created successfully.');
      setShiftForm({
        title: '',
        description: '',
        specialization: '',
        requiredMedics: 1,
        hours: 8,
        payType: 'hourly',
        payAmount: 1000,
      });
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to create shift.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyShift = async (shiftId, shouldCancel = false) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/shifts/${shiftId}/${shouldCancel ? 'unapply' : 'apply'}`, {
        method: 'POST',
        token,
      });
      setSuccess(shouldCancel ? 'Shift application canceled.' : 'Shift applied successfully.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update shift application.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/appointments/${appointmentId}`, {
        method: 'PUT',
        token,
        body: { status },
      });
      setSuccess(`Appointment marked as ${String(status).toLowerCase()}.`);
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/orders/${orderId}`, {
        method: 'PUT',
        token,
        body: { status },
      });
      setSuccess(`Order marked as ${String(status).toLowerCase()}.`);
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update order.');
    } finally {
      setSubmitting(false);
    }
  };

  const hireMedic = async (medicId) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/medics/${medicId}/hire`, {
        method: 'POST',
        token,
      });
      setSuccess('Medic hired successfully.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to hire medic.');
    } finally {
      setSubmitting(false);
    }
  };

  const approveMedic = async (medicId) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/medics/${medicId}/approve`, {
        method: 'POST',
        token,
      });
      setSuccess('Medic approved successfully.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to approve medic.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAdminUser = async (targetUserId) => {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this user account?') : true;
    if (!confirmed) return;
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/users/${targetUserId}`, {
        method: 'DELETE',
        token,
      });
      setSuccess('User deleted.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to delete user.');
    } finally {
      setSubmitting(false);
    }
  };

  const blockAdminUser = async (targetUserId, blocked) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/users/${targetUserId}/block`, {
        method: 'PUT',
        token,
        body: { blocked },
      });
      setSuccess(blocked ? 'User blocked.' : 'User unblocked.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update block status.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAdminUser = async (targetUserId, verified) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/users/${targetUserId}/verify`, {
        method: 'PUT',
        token,
        body: { verified },
      });
      setSuccess(verified ? 'User verified.' : 'Verification removed.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId, status) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/subscriptions/${subscriptionId}/status`, {
        method: 'PUT',
        token,
        body: { status },
      });
      setSuccess(`Subscription set to ${status}.`);
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update subscription.');
    } finally {
      setSubmitting(false);
    }
  };

  const resolveComplaint = async (complaintId) => {
    const resolution = String(complaintResolutionMap[complaintId] || '').trim();
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/complaints/${complaintId}/resolve`, {
        method: 'PUT',
        token,
        body: { status: 'RESOLVED', resolution },
      });
      setSuccess('Complaint resolved.');
      setComplaintResolutionMap((prev) => ({ ...prev, [complaintId]: '' }));
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to resolve complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendAdminNotification = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/admin/notifications', {
        method: 'PUT',
        token,
        body: emailDraft,
      });
      setSuccess('Announcement sent.');
      setEmailDraft((prev) => ({ ...prev, title: '', message: '' }));
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to send announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/users/profile', {
        method: 'PUT',
        token,
        body: {
          fullName: profileDraft.fullName,
          phone: profileDraft.phone,
          emergencyContactName: profileDraft.emergencyContactName,
          emergencyContactPhone: profileDraft.emergencyContactPhone,
          locationAddress: profileDraft.locationAddress,
        },
      });
      if (profileDraft.locationAddress || profileDraft.lat || profileDraft.lng) {
        await apiRequest('/users/location', {
          method: 'PUT',
          token,
          body: {
            address: profileDraft.locationAddress || null,
            lat: profileDraft.lat ? Number(profileDraft.lat) : null,
            lng: profileDraft.lng ? Number(profileDraft.lng) : null,
          },
        }).catch(() => null);
      }
      setSuccess('Profile updated successfully.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PUT', token });
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to mark notification as read.');
    }
  };

  const respondRecordAccessRequest = async (requestId, accept) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/medical-records/access/requests/${requestId}/respond`, {
        method: 'POST',
        token,
        body: { accept: Boolean(accept) },
      });
      setSuccess(accept ? 'Access approved.' : 'Access request declined.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to respond to access request.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateAiHealthSummary = async () => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const summary = await apiRequest('/ai/health-summary', {
        method: 'POST',
        token,
        body: {},
      });
      setAiSummary(summary || null);
      setSuccess('AI health summary generated.');
    } catch (error) {
      setActionError(error?.message || 'Failed to generate AI summary.');
    } finally {
      setSubmitting(false);
    }
  };

  const addPatientVitals = async () => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/users/patient-vitals', {
        method: 'POST',
        token,
        body: {
          bloodPressureSystolic: vitalSystolic || undefined,
          bloodPressureDiastolic: vitalDiastolic || undefined,
          bloodSugar: vitalSugar || undefined,
        },
      });
      setVitalSystolic('');
      setVitalDiastolic('');
      setVitalSugar('');
      setSuccess('Vitals saved successfully.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to save vitals.');
    } finally {
      setSubmitting(false);
    }
  };

  const runMedicationCheck = async () => {
    const medications = String(medicationCheckInput || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!medications.length) {
      setActionError('Enter at least one medication.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const result = await apiRequest('/users/patient-medication-check', {
        method: 'POST',
        token,
        body: { medications },
      });
      const interactions = toArray(result?.interactions).length;
      setSuccess(
        result?.safe
          ? 'Medication check complete. No critical interactions found.'
          : `Medication check complete. ${interactions} interaction(s) detected.`,
      );
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to check medication safety.');
    } finally {
      setSubmitting(false);
    }
  };

  const createHealthShare = async () => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const share = await apiRequest('/users/patient-health-share', {
        method: 'POST',
        token,
        body: { scope: 'SUMMARY', expiresHours: 24 },
      });
      const tokenPreview = String(share?.share?.token || '').slice(0, 12);
      setSuccess(
        tokenPreview
          ? `Health share link created. Token: ${tokenPreview}...`
          : 'Health share link created for 24 hours.',
      );
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to create health share link.');
    } finally {
      setSubmitting(false);
    }
  };

  const addCarePlanMedication = async () => {
    const name = String(newMedicationName || '').trim();
    if (!name) {
      setActionError('Medication name is required.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/users/patient-care-plan/medications', {
        method: 'POST',
        token,
        body: { name, dosage: String(newMedicationDosage || '').trim() || undefined },
      });
      setNewMedicationName('');
      setNewMedicationDosage('');
      setSuccess('Medication added to care plan.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to add medication.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateCarePlanMedicationState = async (medicationId, action) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(`/users/patient-care-plan/medications/${medicationId}/${action}`, {
        method: 'POST',
        token,
      });
      setSuccess(action === 'take' ? 'Medication marked as taken.' : 'Medication marked as missed.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update medication status.');
    } finally {
      setSubmitting(false);
    }
  };

  const createVoiceSession = async () => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/ai/voice/session', {
        method: 'POST',
        token,
        body: {
          mode: voiceMode,
          platform: 'web',
          locale: 'en-KE',
        },
      });
      setVoiceSessionInfo(payload || null);
      setSuccess(payload?.vapi?.configured ? 'Voice session started.' : 'Voice session started (guided mode).');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to start voice session.');
    } finally {
      setSubmitting(false);
    }
  };

  const runVoiceTool = async () => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const query = String(voiceQuery || '').trim();
      const args =
        voiceToolName === 'search_medics'
          ? { specialization: query, location: query, name: query }
          : voiceToolName === 'search_hospitals'
            ? { name: query, location: query, services: query ? [query] : [] }
            : voiceToolName === 'search_pharmacy_products'
              ? { productName: query, location: query }
              : voiceToolName === 'summarize_health_record'
                ? {}
                : voiceToolName === 'get_emergency_contacts'
                  ? {}
                  : { note: query };
      const payload = await apiRequest('/ai/voice/tool', {
        method: 'POST',
        token,
        body: { toolName: voiceToolName, args },
      });
      setVoiceToolResult(payload || null);
      setSuccess('Voice tool completed.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to run voice tool.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateAiAssistantSettings = async (enabled) => {
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/ai/settings', {
        method: 'PUT',
        token,
        body: { enabled: Boolean(enabled) },
      });
      setSuccess(enabled ? 'AI Assistant enabled.' : 'AI Assistant disabled.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update AI assistant settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const runAiAssistantSearch = async () => {
    const query = String(aiAssistantSearchQuery || '').trim();
    if (!query) {
      setActionError('Type a search query first.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/ai/search', {
        method: 'POST',
        token,
        body: {
          query,
          include: ['medic', 'hospital', 'pharmacy'],
          limit: 10,
        },
      });
      setAiAssistantSearchResults(toArray(payload?.results));
      setSuccess('AI search completed.');
    } catch (error) {
      setActionError(error?.message || 'AI search failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const runAiAssistantQuery = async () => {
    const query = String(aiAssistantQuery || '').trim();
    if (!query) {
      setActionError('Type a question for AI assistant.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/ai/assistant', {
        method: 'POST',
        token,
        body: { query },
      });
      setAiAssistantAnswer(String(payload?.answer || 'No response from assistant.'));
      setSuccess('AI assistant response ready.');
    } catch (error) {
      setActionError(error?.message || 'AI assistant failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveMedicalInfo = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest('/users/profile', {
        method: 'PUT',
        token,
        body: {
          allergies: medicalInfoDraft.allergies || null,
          bloodGroup: medicalInfoDraft.bloodGroup || null,
          chronicConditions: medicalInfoDraft.chronicConditions || null,
          insuranceProvider: medicalInfoDraft.insuranceProvider || null,
          insuranceNumber: medicalInfoDraft.insuranceNumber || null,
        },
      });
      setSuccess('Medical information updated.');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Failed to update medical information.');
    } finally {
      setSubmitting(false);
    }
  };

  const addPatientCartItem = (product) => {
    const productId = String(product?.id || '').trim();
    if (!productId) return;
    const price = Number(product?.price || 0);
    const stock = Number(product?.stock ?? product?.quantity ?? product?.numberInStock ?? 0);
    const existing = cartItems.find((entry) => String(entry?.id) === productId);
    if (existing) {
      const nextQty = Number(existing?.cartQuantity || 1) + 1;
      if (stock > 0 && nextQty > stock) {
        setActionError('Cannot add more than available stock.');
        return;
      }
      setCartItems((prev) =>
        prev.map((entry) =>
          String(entry?.id) === productId ? { ...entry, cartQuantity: nextQty } : entry,
        ),
      );
      setSuccess('Cart updated.');
      return;
    }
    const pharmacyId = String(product?.pharmacyId || product?.pharmacy?.id || '').trim();
    if (cartItems.length > 0) {
      const existingPharmacyId = String(cartItems[0]?.pharmacyId || '').trim();
      if (existingPharmacyId && pharmacyId && existingPharmacyId !== pharmacyId) {
        setActionError('Checkout current pharmacy cart first before mixing pharmacies.');
        return;
      }
    }
    if (stock <= 0) {
      setActionError('Product is out of stock.');
      return;
    }
    const cartItem = {
      id: productId,
      name: product?.name || product?.productName || 'Product',
      price: Number.isFinite(price) ? price : 0,
      stock,
      image: resolveImageUrl(product?.imageUrl || product?.image || product?.photo || product?.thumbnail),
      pharmacyId: pharmacyId || null,
      pharmacyName: product?.pharmacy?.name || product?.pharmacyName || 'Pharmacy',
      prescriptionRequired: Boolean(product?.requiresPrescription || product?.prescriptionRequired),
      cartQuantity: 1,
    };
    setCartItems((prev) => [...prev, cartItem]);
    setSuccess('Added to cart.');
  };

  const removePatientCartItem = (productId) => {
    setCartItems((prev) => prev.filter((entry) => String(entry?.id) !== String(productId)));
  };

  const setPatientCartQuantity = (productId, quantity) => {
    const nextQuantity = Math.max(0, Number(quantity || 0));
    setCartItems((prev) =>
      prev
        .map((entry) => {
          if (String(entry?.id) !== String(productId)) return entry;
          if (nextQuantity === 0) return null;
          const maxStock = Number(entry?.stock || 0);
          const clamped = maxStock > 0 ? Math.min(nextQuantity, maxStock) : nextQuantity;
          return { ...entry, cartQuantity: clamped };
        })
        .filter(Boolean),
    );
  };

  const clearPatientCart = () => {
    setCartItems([]);
    setSuccess('Cart cleared.');
  };

  const checkoutPatientCart = async () => {
    if (!cartItems.length) {
      setActionError('Cart is empty.');
      return;
    }
    const pharmacyId = String(cartItems?.[0]?.pharmacyId || '').trim();
    if (!pharmacyId) {
      setActionError('Missing pharmacy in cart.');
      return;
    }
    const hasRxItem = cartItems.some((entry) => Boolean(entry?.prescriptionRequired));
    if (hasRxItem && !String(selectedPrescriptionId || '').trim()) {
      setActionError('Prescription ID is required for prescription-only products.');
      return;
    }
    const totalKes = cartItems.reduce(
      (sum, entry) => sum + Number(entry?.price || 0) * Number(entry?.cartQuantity || 0),
      0,
    );
    const usdKesRate = Number(sectionData?.rates?.USD_KES || 150);
    const paymentAmount =
      cartCurrency === 'USD' ? Number((totalKes / usdKesRate).toFixed(2)) : Number(totalKes.toFixed(2));
    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const order = await apiRequest('/orders', {
        method: 'POST',
        token,
        body: {
          pharmacyId,
          items: cartItems.map((entry) => ({
            id: entry.id,
            name: entry.name,
            price: Number(entry.price || 0),
            quantity: Number(entry.cartQuantity || 1),
            prescriptionRequired: Boolean(entry.prescriptionRequired),
          })),
          total: totalKes,
          currency: 'KES',
          notes: cartNotes || undefined,
          prescriptionId: selectedPrescriptionId || undefined,
        },
      });
      const payment = await apiRequest('/payments', {
        method: 'POST',
        token,
        body: {
          amount: paymentAmount,
          currency: cartCurrency,
          method: cartPaymentMethod || 'intasend',
          type: 'ORDER',
          orderId: order?.id,
          recipientId: pharmacyId,
          recipientRole: 'PHARMACY_ADMIN',
          phone: cartPhone || undefined,
          description: 'Pharmacy order payment',
        },
      });
      const checkoutUrl =
        payment?.checkoutUrl ||
        payment?.gatewayResponse?.url ||
        payment?.gatewayResponse?.checkout_url ||
        '';
      if (checkoutUrl && typeof window !== 'undefined') {
        window.open(String(checkoutUrl), '_blank', 'noopener,noreferrer');
      }
      setSuccess(
        payment?.status === 'PAID'
          ? 'Order paid successfully.'
          : 'Payment initiated. Complete payment in IntaSend checkout.',
      );
      setCartItems([]);
      setSelectedPrescriptionId('');
      setCartPhone('');
      setCartNotes('');
      await onReload();
    } catch (error) {
      setActionError(error?.message || 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sectionLoading) {
    return <p style={{ color: theme.textSecondary }}>Loading section...</p>;
  }

  if (sectionError) {
    return (
      <p
        style={{
          margin: 0,
          padding: '10px 12px',
          border: `1px solid ${theme.error}66`,
          borderRadius: '10px',
          background: `${theme.error}1A`,
          color: theme.error,
        }}
      >
        {sectionError}
      </p>
    );
  }

  if (slug === 'book-appointment') {
    const selectedMedic =
      medics.find((medic) => String(medic?.id || medic?.medicId) === String(appointmentForm.medicId || '')) ||
      null;
    const myLocation = normalizeLocation(sectionData?.myLocation?.location || sectionData?.myLocation);
    const myAddress = myLocation?.address || '';

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {actionError ? (
          <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        {!isProfileComplete ? (
          <p
            style={{
              margin: 0,
              padding: '10px 12px',
              border: `1px solid ${theme.warning}66`,
              borderRadius: '10px',
              background: `${theme.warning}1A`,
              color: theme.warning,
              fontWeight: 700,
            }}
          >
            Profile completion is {profileCompletionPercent}%. Booking unlocks at 99%.
          </p>
        ) : null}

        <SectionCard title="Search Medic" subtitle="Search by name, specialization, or location" theme={theme}>
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Type medic name, specialization, or location"
            style={{
              width: '100%',
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '10px',
              padding: '10px',
              background: theme.inputBackground,
              color: theme.text,
              marginBottom: '10px',
            }}
          />
          <ListRows
            items={medics.slice(0, 12)}
            theme={theme}
            emptyLabel="No medics found."
            renderItem={(medic) => (
              <button
                type="button"
                onClick={() =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    medicId: String(medic?.id || medic?.medicId || ''),
                  }))
                }
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: `1px solid ${
                    String(appointmentForm.medicId) === String(medic?.id || medic?.medicId)
                      ? theme.primary
                      : theme.border
                  }`,
                  borderRadius: '10px',
                  padding: '10px',
                  background:
                    String(appointmentForm.medicId) === String(medic?.id || medic?.medicId)
                      ? theme.primaryLight
                      : theme.surface,
                  color: theme.text,
                  cursor: 'pointer',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>{medic?.name || medic?.fullName || 'Medic'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {medic?.specialization || 'General'} • {medic?.location || 'Location not set'}
                </p>
              </button>
            )}
          />
          {selectedMedic ? (
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: theme.primary, fontWeight: 700 }}>
              Selected: {selectedMedic?.name || selectedMedic?.fullName || 'Medic'}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Book Appointment" subtitle="Create a new booking" theme={theme}>
          <form onSubmit={submitAppointment} style={{ display: 'grid', gap: '10px' }}>
            <input
              required
              value={appointmentForm.medicId}
              onChange={(event) => setAppointmentForm((prev) => ({ ...prev, medicId: event.target.value }))}
              placeholder="Selected medic ID"
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <input
                required
                type="date"
                value={appointmentForm.date}
                onChange={(event) => setAppointmentForm((prev) => ({ ...prev, date: event.target.value }))}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '10px',
                  padding: '10px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              />
              <input
                required
                type="time"
                value={appointmentForm.time}
                onChange={(event) => setAppointmentForm((prev) => ({ ...prev, time: event.target.value }))}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '10px',
                  padding: '10px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              />
              <select
                value={appointmentForm.mode}
                onChange={(event) => setAppointmentForm((prev) => ({ ...prev, mode: event.target.value }))}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '10px',
                  padding: '10px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              >
                <option value="video">Video</option>
                <option value="in-person">In-person</option>
              </select>
            </div>
            <input
              value={appointmentForm.treatmentLocation}
              onChange={(event) =>
                setAppointmentForm((prev) => ({ ...prev, treatmentLocation: event.target.value }))
              }
              placeholder="Treatment location"
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
            <button
              type="button"
              onClick={() =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  treatmentLocation: myAddress || prev.treatmentLocation,
                }))
              }
              className="ml-button-secondary"
              style={{
                justifySelf: 'start',
                borderRadius: '999px',
                padding: '7px 12px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Use My Current Location
            </button>
            <textarea
              rows={3}
              required
              value={appointmentForm.reason}
              onChange={(event) => setAppointmentForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Reason"
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
            <button
              type="submit"
              disabled={submitting || !isProfileComplete}
              className="ml-button-primary"
              style={{
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                cursor: submitting || !isProfileComplete ? 'not-allowed' : 'pointer',
                fontWeight: 800,
              }}
            >
              {submitting ? 'Booking...' : !isProfileComplete ? 'Complete Profile First' : 'Book Appointment'}
            </button>
          </form>
        </SectionCard>
      </div>
    );
  }

  if (slug === 'find-medics' || slug === 'medics') {
    const medicList = toArray(sectionData?.medics || sectionData);
    const hiredMedicIds = new Set(
      toArray(sectionData?.hires)
        .map((item) => String(item?.medicId || '').trim())
        .filter(Boolean),
    );
    const experienceRanges = {
      any: null,
      '0-2': [0, 2],
      '3-5': [3, 5],
      '6-10': [6, 10],
      '10+': [10, 100],
    };
    const selectedExperienceRange = experienceRanges[medicFilters.experience] || null;
    const uniqueOptions = {
      locations: Array.from(
        new Set(
          medicList
            .map((medic) => String(medic?.location || medic?.city || medic?.area || '').trim())
            .filter(Boolean),
        ),
      ),
      categories: Array.from(
        new Set(
          medicList.map((medic) => String(medic?.category || medic?.type || '').trim()).filter(Boolean),
        ),
      ),
      specializations: Array.from(
        new Set(
          medicList
            .map((medic) => String(medic?.specialization || medic?.areaOfSpecialization || '').trim())
            .filter(Boolean),
        ),
      ),
    };
    const filteredMedics = medicList.filter((medic) => {
      const name = String(medic?.name || medic?.fullName || '').toLowerCase();
      const specialization = String(medic?.specialization || medic?.areaOfSpecialization || '').toLowerCase();
      const category = String(medic?.category || medic?.type || '').toLowerCase();
      const location = String(medic?.location || medic?.city || medic?.area || '').toLowerCase();
      const years =
        Number(medic?.experienceYears || medic?.yearsOfExperience || medic?.experience || 0) || 0;
      const query = String(filter || '').trim().toLowerCase();

      const matchesQuery =
        !query || name.includes(query) || specialization.includes(query) || location.includes(query);
      const matchesLocation =
        !medicFilters.location || location.includes(String(medicFilters.location).toLowerCase());
      const matchesCategory =
        !medicFilters.category || category.includes(String(medicFilters.category).toLowerCase());
      const matchesSpecialization =
        !medicFilters.specialization ||
        specialization.includes(String(medicFilters.specialization).toLowerCase());
      const matchesExperience =
        !selectedExperienceRange ||
        (years >= selectedExperienceRange[0] && years <= selectedExperienceRange[1]);
      return (
        matchesQuery &&
        matchesLocation &&
        matchesCategory &&
        matchesSpecialization &&
        matchesExperience
      );
    });

    return (
      <SectionCard title="Medics Directory" subtitle="Search by specialization, name, or location" theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search medics"
          style={{
            width: '100%',
            border: `1px solid ${theme.borderInput}`,
            borderRadius: '10px',
            padding: '10px',
            background: theme.inputBackground,
            color: theme.text,
            marginBottom: '10px',
          }}
        />
        {normalizedRole === 'PATIENT' ? (
          <button
            type="button"
            className="ml-button-secondary"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            style={{
              borderRadius: '10px',
              padding: '8px 12px',
              cursor: 'pointer',
              marginBottom: '10px',
              fontWeight: 700,
            }}
          >
            {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
          </button>
        ) : null}
        {normalizedRole === 'PATIENT' && showAdvancedFilters ? (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
            <select
              value={medicFilters.location}
              onChange={(event) =>
                setMedicFilters((prev) => ({
                  ...prev,
                  location: event.target.value,
                }))
              }
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            >
              <option value="">All Locations</option>
              {uniqueOptions.locations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={medicFilters.category}
              onChange={(event) =>
                setMedicFilters((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            >
              <option value="">All Categories</option>
              {uniqueOptions.categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={medicFilters.specialization}
              onChange={(event) =>
                setMedicFilters((prev) => ({
                  ...prev,
                  specialization: event.target.value,
                }))
              }
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '10px',
                padding: '10px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            >
              <option value="">All Specializations</option>
              {uniqueOptions.specializations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.keys(experienceRanges).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setMedicFilters((prev) => ({ ...prev, experience: range }))}
                  style={{
                    borderRadius: '999px',
                    border: `1px solid ${
                      medicFilters.experience === range ? theme.primary : theme.border
                    }`,
                    background:
                      medicFilters.experience === range ? `${theme.primary}1A` : theme.surface,
                    color: medicFilters.experience === range ? theme.primary : theme.textSecondary,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {range === 'any' ? 'Any exp' : `${range} yrs`}
                </button>
              ))}
            </div>
            {!isProfileComplete ? (
              <p style={{ margin: 0, fontSize: '12px', color: theme.warning, fontWeight: 700 }}>
                Profile completion is {profileCompletionPercent}%. Booking unlocks at 99%.
              </p>
            ) : null}
          </div>
        ) : null}
        <ListRows
          items={normalizedRole === 'PATIENT' ? filteredMedics : medics.length ? medics : medicList}
          theme={theme}
          emptyLabel="No medics available."
          renderItem={(medic) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{medic?.name || medic?.fullName || 'Medic'}</p>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '999px',
                    background:
                      medic?.isOnline || String(medic?.onlineStatus || '').toLowerCase() === 'online'
                        ? '#22c55e'
                        : theme.textSecondary,
                  }}
                />
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {medic?.specialization || 'General'} • {medic?.location || 'Location not set'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Availability: {toArray(medic?.availabilityDays).join(', ') || 'Not set'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                License: {medic?.licenseNumber || medic?.license || 'Not provided'} • Consultation:{' '}
                {money(medic?.consultationPrice || medic?.consultationFee || 0)}
              </p>
              {normalizedRole === 'PATIENT' ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={`/dashboard/chat?userId=${encodeURIComponent(String(medic?.id || medic?.medicId || ''))}`}
                    className="ml-button-secondary"
                    style={{
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Chat
                  </a>
                  <a
                    href="/dashboard/video-call"
                    className="ml-button-secondary"
                    style={{
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Video
                  </a>
                  <a
                    href={`/dashboard/book-appointment?medicId=${encodeURIComponent(
                      String(medic?.id || medic?.medicId || ''),
                    )}`}
                    className="ml-button-primary"
                    style={{
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#fff',
                      pointerEvents: isProfileComplete ? 'auto' : 'none',
                      opacity: isProfileComplete ? 1 : 0.6,
                    }}
                  >
                    Book Appointment
                  </a>
                </div>
              ) : null}
              {normalizedRole === 'HOSPITAL_ADMIN' ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => approveMedic(medic.id)}
                    className="ml-button-secondary"
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting || hiredMedicIds.has(String(medic.id))}
                    onClick={() => hireMedic(medic.id)}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {hiredMedicIds.has(String(medic.id)) ? 'Hired' : 'Hire'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'patients' && normalizedRole === 'MEDIC') {
    const patients = toArray(sectionData?.patients);
    const records = toArray(sectionData?.records);
    const analytics = sectionData?.analytics || {};
    const patientBundle = patients.map((patient) => {
      const patientRecords = records.filter((record) => String(record?.patientId || '') === String(patient?.id || ''));
      const lastRecord = patientRecords[0] || null;
      return {
        ...patient,
        recordsCount: patientRecords.length,
        lastRecord,
      };
    });
    const filteredPatients = patientBundle.filter((patient) => {
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return (
        String(patient?.fullName || '').toLowerCase().includes(q) ||
        String(patient?.email || '').toLowerCase().includes(q) ||
        String(patient?.phone || '').toLowerCase().includes(q)
      );
    });
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <SectionCard title="Patients Overview" subtitle="Patients linked to your records" theme={theme}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Patients Served</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>
                {Number(analytics?.totals?.patientsServed || 0).toLocaleString()}
              </p>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Under Treatment</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>
                {Number(analytics?.totals?.underTreatment || 0).toLocaleString()}
              </p>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Recovered</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>
                {Number(analytics?.totals?.recoveredPatients || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="My Patients" subtitle="Search patient by name, email, phone" theme={theme}>
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search patients"
            style={{
              width: '100%',
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '10px',
              padding: '10px',
              background: theme.inputBackground,
              color: theme.text,
              marginBottom: '10px',
            }}
          />
          <ListRows
            items={filteredPatients}
            theme={theme}
            emptyLabel="No patients linked yet."
            renderItem={(patient) => (
              <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{patient?.fullName || patient?.name || 'Patient'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {patient?.email || '-'} • {patient?.phone || '-'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Records: {patient?.recordsCount || 0} • Last update: {formatDate(patient?.lastRecord?.createdAt)}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'appointments') {
    const items = toArray(sectionData?.appointments || sectionData);
    if (normalizedRole === 'PATIENT') {
      const linked = toArray(sectionData?.linkedLocations);
      const myLocation = normalizeLocation(sectionData?.myLocation?.location || sectionData?.myLocation);
      const linkedMap = linked.reduce((acc, item) => {
        acc[String(item?.id || '')] = normalizeLocation(item?.location);
        return acc;
      }, {});
      const grouped = {
        upcoming: [],
        past: [],
        cancelled: [],
      };
      items.forEach((item) => {
        const status = String(item?.status || '').toLowerCase();
        if (status === 'completed') {
          grouped.past.push(item);
        } else if (status === 'cancelled') {
          grouped.cancelled.push(item);
        } else {
          grouped.upcoming.push(item);
        }
      });
      const sortedActive = grouped[appointmentsTab] || [];
      const sortedByDistance = [...sortedActive].sort((a, b) => {
        const aLoc =
          linkedMap[String(a?.medicId || a?.medic_id || a?.id || '')] ||
          normalizeLocation(a?.location);
        const bLoc =
          linkedMap[String(b?.medicId || b?.medic_id || b?.id || '')] ||
          normalizeLocation(b?.location);
        const aDist = getDistanceKm(myLocation, aLoc);
        const bDist = getDistanceKm(myLocation, bLoc);
        if (aDist === null && bDist === null) return 0;
        if (aDist === null) return 1;
        if (bDist === null) return -1;
        return aDist - bDist;
      });
      return (
        <SectionCard title="Appointments" subtitle="Upcoming, past, and cancelled appointments" theme={theme}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAppointmentsTab(tab.id)}
                style={{
                  borderRadius: '999px',
                  border: `1px solid ${appointmentsTab === tab.id ? theme.primary : theme.border}`,
                  background: appointmentsTab === tab.id ? theme.primary : theme.surface,
                  color: appointmentsTab === tab.id ? '#fff' : theme.textSecondary,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ListRows
            items={sortedByDistance}
            theme={theme}
            emptyLabel="No appointments in this tab."
            renderItem={(item) => (
              <div
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.reason || 'Appointment'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.date || '-'} {item?.time || ''} • {item?.mode || 'video'} •{' '}
                  {String(item?.status || 'pending').toUpperCase()}
                </p>
                {item?.treatmentLocation ? (
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    Location: {item.treatmentLocation}
                  </p>
                ) : null}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={`/dashboard/chat?userId=${encodeURIComponent(
                      String(item?.medicId || item?.medic_id || ''),
                    )}`}
                    className="ml-button-secondary"
                    style={{
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Message
                  </a>
                  <a
                    href="/dashboard/video-call"
                    className="ml-button-secondary"
                    style={{
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Start Call
                  </a>
                </div>
              </div>
            )}
          />
        </SectionCard>
      );
    }
    return (
      <SectionCard title="Appointments" subtitle="Current bookings and status" theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <ListRows
          items={items}
          theme={theme}
          emptyLabel="No appointments found."
          renderItem={(item) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item?.reason || 'Appointment'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {item?.date || '-'} {item?.time || ''} • {item?.mode || 'video'} • {item?.status || 'pending'}
              </p>
              {normalizedRole === 'HOSPITAL_ADMIN' ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => updateAppointmentStatus(item.id, 'COMPLETED')}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => updateAppointmentStatus(item.id, 'CANCELLED')}
                    className="ml-button-secondary"
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'medical-records') {
    const recordItems = toArray(sectionData?.records || sectionData)
      .map((record) => ({
        ...record,
        recordType: String(record?.type || 'note').toLowerCase(),
      }))
      .sort((a, b) => {
        const aDate = new Date(a?.createdAt || a?.date || 0).getTime();
        const bDate = new Date(b?.createdAt || b?.date || 0).getTime();
        return bDate - aDate;
      });
    const accessRequests = toArray(sectionData?.accessRequests);
    const recordDetail = sectionData?.recordDetail || null;
    const activeRecordId = String(initialRecordId || recordDetail?.id || '').trim();
    const detailAttachments = toArray(recordDetail?.attachments).filter((entry) => entry?.url);
    const filteredRecords = recordItems.filter((record) => {
      if (recordsTab === 'all') return true;
      if (recordsTab === 'prescriptions') return record.recordType === 'prescription';
      if (recordsTab === 'conditions') return record.recordType === 'condition';
      if (recordsTab === 'notes') {
        return ['note', 'clinical_update'].includes(record.recordType);
      }
      return true;
    });

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {actionError ? <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p> : null}
        {success ? <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p> : null}

        <SectionCard title="Record Access Requests" subtitle="Patient-controlled record visibility" theme={theme}>
          <ListRows
            items={accessRequests}
            theme={theme}
            emptyLabel="No pending medic access requests."
            renderItem={(request) => (
              <div style={{ borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface, padding: '10px' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {request?.medic?.fullName || request?.medic?.email || 'Medic'} requested access
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {formatDate(request?.requestedAt)}
                </p>
                {request?.note ? (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    Note: {request.note}
                  </p>
                ) : null}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => respondRecordAccessRequest(request.id, false)}
                    className="ml-button-secondary"
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: theme.error }}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => respondRecordAccessRequest(request.id, true)}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard title="AI Health Summary" subtitle="Generate patient summary from records" theme={theme}>
          <button
            type="button"
            disabled={submitting}
            className="ml-button-primary"
            onClick={generateAiHealthSummary}
            style={{ border: 'none', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}
          >
            {submitting ? 'Generating...' : 'Generate AI Health Summary'}
          </button>
          {aiSummary?.summary ? (
            <pre
              style={{
                margin: '10px 0 0',
                borderRadius: '10px',
                padding: '10px',
                background: theme.surface,
                color: theme.text,
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(aiSummary.summary)}
            </pre>
          ) : null}
        </SectionCard>

        <SectionCard title="Medical Records" subtitle="Prescriptions, conditions, and notes" theme={theme}>
          {recordDetail ? (
            <div
              style={{
                marginBottom: '10px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                padding: '10px',
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>
                Record Detail: {String(recordDetail?.type || 'record').replace(/_/g, ' ')}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {recordDetail?.medic?.fullName || 'Medic'} • {formatDate(recordDetail?.createdAt)}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: theme.text }}>
                {recordDetail?.notes || recordDetail?.condition || 'No details'}
              </p>
              {detailAttachments.length ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {detailAttachments.map((file, index) => {
                    const fileType = getAttachmentType(file);
                    const url = resolveImageUrl(file?.url);
                    return (
                      <a
                        key={`${file?.url || index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textDecoration: 'none',
                          borderRadius: '8px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          padding: '6px 8px',
                          fontSize: '11px',
                          color: theme.textSecondary,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {fileType === 'image' ? (
                          <img
                            src={url}
                            alt={file?.name || 'attachment'}
                            style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        ) : null}
                        <span>{file?.name || (fileType === 'pdf' ? 'PDF' : 'Attachment')}</span>
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {[
              { id: 'all', label: 'All Records' },
              { id: 'prescriptions', label: 'Prescriptions' },
              { id: 'conditions', label: 'Conditions' },
              { id: 'notes', label: 'Notes' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRecordsTab(tab.id)}
                style={{
                  borderRadius: '999px',
                  border: `1px solid ${recordsTab === tab.id ? theme.primary : theme.border}`,
                  background: recordsTab === tab.id ? theme.primary : theme.surface,
                  color: recordsTab === tab.id ? '#fff' : theme.textSecondary,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ListRows
            items={filteredRecords}
            theme={theme}
            emptyLabel="No medical records found."
            renderItem={(item) => {
              const attachments = toArray(item?.attachments).filter((entry) => entry?.url);
              const medications =
                item.recordType === 'prescription' && item?.notes
                  ? String(item.notes)
                      .split(',')
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                  : [];
              return (
                <div
                  style={{
                    borderRadius: '10px',
                    border: `1px solid ${
                      activeRecordId && activeRecordId === String(item?.id || '')
                        ? theme.primary
                        : theme.border
                    }`,
                    background:
                      activeRecordId && activeRecordId === String(item?.id || '')
                        ? theme.primaryLight
                        : theme.surface,
                    padding: '10px',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {item?.recordType === 'prescription'
                      ? 'Prescription'
                      : item?.recordType === 'condition'
                        ? 'Condition Update'
                        : item?.recordType === 'clinical_update'
                          ? 'Clinical Update'
                          : 'Medical Note'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    {item?.medic?.fullName || 'Medic'} • {formatDate(item?.createdAt)}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: theme.text }}>
                    {item?.notes || item?.condition || 'No notes'}
                  </p>
                  {medications.length ? (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                      Medications: {medications.join(', ')}
                    </p>
                  ) : null}
                  {item.recordType === 'prescription' ? (
                    <a
                      href={`/dashboard/pharmacy?prescriptionId=${encodeURIComponent(String(item?.id || ''))}`}
                      className="ml-button-secondary"
                      style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      Use Prescription in Pharmacy
                    </a>
                  ) : null}
                  <a
                    href={`/dashboard/medical-records?recordId=${encodeURIComponent(String(item?.id || ''))}&tab=${encodeURIComponent(recordsTab)}`}
                    className="ml-button-secondary"
                    style={{
                      display: 'inline-block',
                      marginTop: '8px',
                      marginLeft: '8px',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    View Details
                  </a>
                  {attachments.length ? (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {attachments.slice(0, 3).map((file, index) => (
                        <a
                          key={`${file?.url || index}`}
                          href={resolveImageUrl(file?.url)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            overflow: 'hidden',
                            display: 'inline-block',
                            background: theme.card,
                          }}
                        >
                          {/\.(png|jpe?g|gif|webp|bmp)$/i.test(String(file?.url || '')) ? (
                            <img
                              src={resolveImageUrl(file?.url)}
                              alt="attachment"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', fontSize: '11px', color: theme.textSecondary }}>
                              FILE
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'health-hub') {
    const carePlan = sectionData?.carePlan || {};
    const medications = toArray(carePlan?.medications);
    const medicationSafety = sectionData?.medicationSafety || null;
    const emergencyCard = sectionData?.emergencyCard || {};
    const vitals = toArray(sectionData?.vitals);
    const insurance = sectionData?.insurance || {};
    const labs = toArray(sectionData?.labs);
    const timeline = toArray(sectionData?.timeline);
    const healthShare = sectionData?.healthShare || {};
    const careTeam = sectionData?.careTeam || {};
    const adherence = sectionData?.adherence || {};
    const preventiveReminders = toArray(sectionData?.preventiveReminders);
    const criticalAlerts = toArray(sectionData?.criticalAlerts);

    return (
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {actionError ? <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p> : null}
        {success ? <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p> : null}

        <SectionCard title="My Care Plan" theme={theme}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: theme.textSecondary }}>
            Next follow-up:{' '}
            {carePlan?.nextFollowUp?.date || carePlan?.nextFollowUp?.createdAt
              ? formatDate(carePlan?.nextFollowUp?.date || carePlan?.nextFollowUp?.createdAt)
              : 'Not scheduled'}
          </p>
          <ListRows
            items={medications}
            theme={theme}
            emptyLabel="No medications in your plan yet."
            renderItem={(med) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{med?.name || 'Medication'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {med?.dosage || 'As prescribed'} • {med?.frequency || 'Schedule unavailable'}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Taken: {Number(med?.takenCount || 0)} • Missed: {Number(med?.missedCount || 0)}
                </p>
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={submitting}
                    className="ml-button-primary"
                    onClick={() => updateCarePlanMedicationState(med?.id, 'take')}
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Took
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    className="ml-button-secondary"
                    onClick={() => updateCarePlanMedicationState(med?.id, 'miss')}
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Missed
                  </button>
                </div>
              </div>
            )}
          />
          <div style={{ marginTop: '8px', display: 'grid', gap: '8px', gridTemplateColumns: '1fr 120px auto' }}>
            <input
              value={newMedicationName}
              onChange={(event) => setNewMedicationName(event.target.value)}
              placeholder="Medication name"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
            />
            <input
              value={newMedicationDosage}
              onChange={(event) => setNewMedicationDosage(event.target.value)}
              placeholder="Dosage"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
            />
            <button
              type="button"
              disabled={submitting}
              className="ml-button-primary"
              onClick={addCarePlanMedication}
              style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Medication Safety" theme={theme}>
          <input
            value={medicationCheckInput}
            onChange={(event) => setMedicationCheckInput(event.target.value)}
            placeholder="Enter medications (comma separated)"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <button
            type="button"
            disabled={submitting}
            className="ml-button-primary"
            onClick={runMedicationCheck}
            style={{ marginTop: '8px', border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
          >
            Check Interactions
          </button>
          {medicationSafety ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: theme.textSecondary }}>
              Last check: {medicationSafety?.safe ? 'Safe' : 'Interactions found'} •{' '}
              {formatDate(medicationSafety?.checkedAt)}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Emergency Card" theme={theme}>
          <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{emergencyCard?.fullName || 'Patient'}</p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Blood Group: {emergencyCard?.bloodGroup || 'Not set'}
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Allergies: {emergencyCard?.allergies || 'Not set'}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
            Emergency Contact: {emergencyCard?.emergencyContactName || 'Not set'}{' '}
            {emergencyCard?.emergencyContactPhone ? `(${emergencyCard.emergencyContactPhone})` : ''}
          </p>
        </SectionCard>

        <SectionCard title="Vitals Tracker" theme={theme}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <input
              value={vitalSystolic}
              onChange={(event) => setVitalSystolic(event.target.value)}
              placeholder="Sys"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
            />
            <input
              value={vitalDiastolic}
              onChange={(event) => setVitalDiastolic(event.target.value)}
              placeholder="Dia"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
            />
            <input
              value={vitalSugar}
              onChange={(event) => setVitalSugar(event.target.value)}
              placeholder="Sugar"
              style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
            />
            <button
              type="button"
              disabled={submitting}
              className="ml-button-primary"
              onClick={addPatientVitals}
              style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
          {vitals.slice(0, 3).map((item) => (
            <p key={item?.id} style={{ margin: '6px 0 0', fontSize: '12px', color: theme.textSecondary }}>
              {formatDate(item?.recordedAt)} • BP {item?.bloodPressureSystolic || '-'} /{' '}
              {item?.bloodPressureDiastolic || '-'} • Sugar {item?.bloodSugar || '-'}
            </p>
          ))}
        </SectionCard>

        <SectionCard title="Insurance Summary" theme={theme}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Provider: {insurance?.provider || 'Not linked'}
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Coverage: {Number(insurance?.coveragePercent || 0)}%
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Covered: {money(insurance?.coveredAmount)}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
            Out of pocket: {money(insurance?.outOfPocketAmount)}
          </p>
        </SectionCard>

        <SectionCard title="Lab & Imaging Results" theme={theme}>
          <ListRows
            items={labs.slice(0, 4)}
            theme={theme}
            emptyLabel="No lab or imaging results yet."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.title || 'Lab Result'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.summary || 'Result recorded'}
                </p>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard title="Visit Timeline" theme={theme}>
          <ListRows
            items={timeline.slice(0, 5)}
            theme={theme}
            emptyLabel="No timeline events yet."
            renderItem={(event) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{event?.title || 'Visit Event'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>{event?.detail || '-'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: theme.textTertiary }}>
                  {formatDate(event?.date)}
                </p>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard title="Secure Health Share" theme={theme}>
          <button
            type="button"
            disabled={submitting}
            className="ml-button-primary"
            onClick={createHealthShare}
            style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
          >
            Generate 24h Share Link
          </button>
          <ListRows
            items={toArray(healthShare?.activeLinks).slice(0, 3)}
            theme={theme}
            emptyLabel="No active share links."
            renderItem={(share) => (
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
                Token: {String(share?.token || '').slice(0, 12)}... • Expires {formatDate(share?.expiresAt)}
              </p>
            )}
          />
        </SectionCard>

        <SectionCard title="Care Team" theme={theme}>
          <p style={{ margin: '0 0 6px', fontSize: '12px', color: theme.textSecondary }}>
            Medics: {toArray(careTeam?.medics).length} • Hospitals: {toArray(careTeam?.hospitals).length} •
            Pharmacies: {toArray(careTeam?.pharmacies).length}
          </p>
          <ListRows
            items={toArray(careTeam?.medics).slice(0, 3)}
            theme={theme}
            emptyLabel="No linked medics."
            renderItem={(member) => (
              <p style={{ margin: 0, fontSize: '12px', color: theme.text }}>
                Medic: {member?.fullName || member?.email || member?.phone || '-'}
              </p>
            )}
          />
        </SectionCard>

        <SectionCard title="Adherence Score" theme={theme}>
          <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: theme.text }}>
            {Math.max(0, Math.min(100, Number(adherence?.overallScore || 0))).toFixed(0)}%
          </p>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: theme.textSecondary }}>
            Medication adherence: {Number(adherence?.medicationAdherence || 0).toFixed(1)}%
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
            Appointment adherence: {Number(adherence?.appointmentAdherence || 0).toFixed(1)}%
          </p>
        </SectionCard>

        <SectionCard title="Preventive Reminders" theme={theme}>
          <ListRows
            items={preventiveReminders.slice(0, 6)}
            theme={theme}
            emptyLabel="No preventive reminders at the moment."
            renderItem={(item) => (
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
                • {item?.title || 'Reminder'} ({item?.due || '-'})
              </p>
            )}
          />
        </SectionCard>

        <SectionCard title="Critical Alerts" theme={theme}>
          <ListRows
            items={criticalAlerts.slice(0, 5)}
            theme={theme}
            emptyLabel="No critical alerts right now."
            renderItem={(item) => (
              <div
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: String(item?.severity || '').toUpperCase() === 'HIGH' ? `${theme.error}1A` : `${theme.warning}1A`,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.title || 'Alert'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.message || '-'}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'shifts' || slug === 'create-shift') {
    const shifts = toArray(sectionData);
    const canCreate = normalizedRole === 'HOSPITAL_ADMIN' && slug === 'create-shift';
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {actionError ? (
          <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p> : null}

        {canCreate ? (
          <SectionCard title="Create Shift" subtitle="Post a new hospital shift" theme={theme}>
            <form onSubmit={submitShift} style={{ display: 'grid', gap: '10px' }}>
              <input
                required
                value={shiftForm.title}
                onChange={(event) => setShiftForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Shift title"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
              />
              <textarea
                rows={3}
                required
                value={shiftForm.description}
                onChange={(event) => setShiftForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
              />
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <input
                  value={shiftForm.specialization}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, specialization: event.target.value }))}
                  placeholder="Specialization"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
                />
                <input
                  type="number"
                  min={1}
                  value={shiftForm.requiredMedics}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, requiredMedics: Number(event.target.value || 1) }))}
                  placeholder="Required medics"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
                />
                <input
                  type="number"
                  min={1}
                  value={shiftForm.hours}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, hours: Number(event.target.value || 1) }))}
                  placeholder="Hours"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
                />
                <input
                  type="number"
                  min={0}
                  value={shiftForm.payAmount}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, payAmount: Number(event.target.value || 0) }))}
                  placeholder="Pay amount"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '10px', padding: '10px', background: theme.inputBackground, color: theme.text }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="ml-button-primary"
                style={{ border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800 }}
              >
                {submitting ? 'Creating...' : 'Create Shift'}
              </button>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard title="Available Shifts" subtitle="Apply or cancel your application" theme={theme}>
          <ListRows
            items={shifts}
            theme={theme}
            emptyLabel="No shifts available."
            renderItem={(shift) => {
              const applications = toArray(shift?.applications);
              const myApplication = applications.find((entry) => entry?.medicId === userId);
              return (
                <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{shift?.title || 'Shift'}</p>
                  <p style={{ margin: '3px 0 8px', fontSize: '12px', color: theme.textSecondary }}>
                    {shift?.hospitalName || 'Hospital'} • {shift?.location || '-'} • {money(shift?.payAmount)}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: theme.textSecondary }}>
                    Applied medics: {applications.length}
                  </p>
                  {normalizedRole === 'MEDIC' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={submitting || Boolean(myApplication)}
                        onClick={() => applyShift(shift.id, false)}
                        className="ml-button-primary"
                        style={{ border: 'none', borderRadius: '9px', padding: '7px 12px', cursor: 'pointer' }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={submitting || !myApplication}
                        onClick={() => applyShift(shift.id, true)}
                        className="ml-button-secondary"
                        style={{ borderRadius: '9px', padding: '7px 12px', cursor: 'pointer' }}
                      >
                        Cancel Application
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'orders') {
    const orders = toArray(sectionData?.orders || sectionData);
    return (
      <SectionCard title="Orders" subtitle={`Total orders: ${orders.length}`} theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <ListRows
          items={orders.slice(0, 60)}
          theme={theme}
          emptyLabel="No orders found."
          renderItem={(order) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>Order #{order?.id || '-'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Total: {money(order?.total)} • Status: {order?.status || 'PENDING'} • {formatDate(order?.createdAt)}
              </p>
              {(normalizedRole === 'PHARMACY_ADMIN' || normalizedRole === 'HOSPITAL_ADMIN') ? (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => updateOrderStatus(order.id, 'APPROVED')}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                    className="ml-button-secondary"
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Complete
                  </button>
                </div>
              ) : null}
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'products' || slug === 'inventory' || slug === 'stock-history' || slug === 'pos') {
    const products = toArray(sectionData?.products);
    const stock = toArray(sectionData?.stockMovements);
    const orders = toArray(sectionData?.orders);
    return (
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <SectionCard title="Products" subtitle={`Total products: ${products.length}`} theme={theme}>
          <ListRows
            items={products.slice(0, 20)}
            theme={theme}
            emptyLabel="No products found."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '9px', background: theme.surface }}>
                {resolveImageUrl(item?.imageUrl || item?.image || item?.photo || item?.thumbnail) ? (
                  <img
                    src={resolveImageUrl(item?.imageUrl || item?.image || item?.photo || item?.thumbnail)}
                    alt={item?.name || item?.productName || 'Product'}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      marginBottom: '8px',
                    }}
                  />
                ) : null}
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.name || item?.productName || 'Product'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Price: {money(item?.price)} • Stock: {item?.stock ?? item?.numberInStock ?? item?.quantity ?? 0}
                </p>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard title="Stock History" subtitle={`Entries: ${stock.length}`} theme={theme}>
          <ListRows
            items={stock.slice(0, 20)}
            theme={theme}
            emptyLabel="No stock movement records."
            renderItem={(entry) => (
              <div style={{ padding: '8px', borderRadius: '9px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{entry?.productName || 'Product'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {entry?.type || '-'} • Change: {entry?.quantityChange || 0} • {formatDate(entry?.createdAt)}
                </p>
              </div>
            )}
          />
        </SectionCard>

        {slug === 'pos' ? (
          <SectionCard title="Recent Orders" subtitle={`Orders: ${orders.length}`} theme={theme}>
            <ListRows
              items={orders.slice(0, 20)}
              theme={theme}
              emptyLabel="No orders yet."
              renderItem={(order) => (
                <div style={{ padding: '8px', borderRadius: '9px', background: theme.surface }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Order #{order?.id || '-'}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    {money(order?.total)} • {order?.status || 'PENDING'} • {formatDate(order?.createdAt)}
                  </p>
                </div>
              )}
            />
          </SectionCard>
        ) : null}
      </div>
    );
  }

  if (slug === 'pharmacy') {
    const marketplaceProducts = toArray(sectionData?.marketplace?.products || sectionData?.products || sectionData);
    const productDetail = sectionData?.productDetail || null;
    const activeProductId = String(initialProductId || productDetail?.id || '').trim();
    const activePrescriptionId = String(selectedPrescriptionId || initialPrescriptionId || '').trim();
    const filteredProducts = marketplaceProducts.filter((product) => {
      const q = filter.trim().toLowerCase();
      const productCategory = String(product?.category || 'otc').toLowerCase();
      const pharmacyLocation = String(
        product?.location || product?.pharmacyLocation || product?.pharmacy?.location || '',
      ).toLowerCase();
      const matchesQuery =
        !q ||
        String(product?.name || '').toLowerCase().includes(q) ||
        String(product?.description || '').toLowerCase().includes(q) ||
        String(product?.category || '').toLowerCase().includes(q) ||
        String(product?.pharmacy?.name || '').toLowerCase().includes(q) ||
        pharmacyLocation.includes(q);
      const matchesCategory =
        pharmacyCategory === 'all' ||
        productCategory === String(pharmacyCategory || '').toLowerCase();
      const matchesLocation =
        !pharmacyLocationFilter ||
        pharmacyLocation.includes(String(pharmacyLocationFilter || '').toLowerCase());
      return matchesQuery && matchesCategory && matchesLocation;
    });
    const locationOptions = Array.from(
      new Set(
        marketplaceProducts
          .map((product) =>
            String(product?.location || product?.pharmacyLocation || product?.pharmacy?.location || '').trim(),
          )
          .filter(Boolean),
      ),
    );
    const totalCartItems = cartItems.reduce((sum, entry) => sum + Number(entry?.cartQuantity || 0), 0);
    const totalCartAmount = cartItems.reduce(
      (sum, entry) => sum + Number(entry?.price || 0) * Number(entry?.cartQuantity || 0),
      0,
    );
    const isPatient = normalizedRole === 'PATIENT';
    return (
      <SectionCard title="Pharmacy Marketplace" subtitle={`Available products: ${marketplaceProducts.length}`} theme={theme}>
        {activePrescriptionId ? (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${theme.warning}66`,
              background: `${theme.warning}1A`,
            }}
          >
            <p style={{ margin: 0, color: theme.warning, fontWeight: 700, fontSize: '12px' }}>
              Prescription selected: {activePrescriptionId}
            </p>
          </div>
        ) : null}
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        {productDetail ? (
          <div
            style={{
              marginBottom: '10px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              padding: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {resolveImageUrl(
                productDetail?.imageUrl ||
                  productDetail?.image ||
                  productDetail?.photo ||
                  productDetail?.thumbnail,
              ) ? (
                <img
                  src={resolveImageUrl(
                    productDetail?.imageUrl ||
                      productDetail?.image ||
                      productDetail?.photo ||
                      productDetail?.thumbnail,
                  )}
                  alt={productDetail?.name || 'Product'}
                  style={{
                    width: '72px',
                    height: '72px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{productDetail?.name || 'Product'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {money(productDetail?.price)} • Stock:{' '}
                  {productDetail?.stock ??
                    productDetail?.numberInStock ??
                    productDetail?.quantity ??
                    0}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {productDetail?.pharmacy?.name || 'Pharmacy'} •{' '}
                  {productDetail?.pharmacy?.location ||
                    productDetail?.location ||
                    'Location unavailable'}
                </p>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: theme.text }}>
              {productDetail?.description || 'No description provided.'}
            </p>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isPatient ? (
                <button
                  type="button"
                  className="ml-button-primary"
                  onClick={() => addPatientCartItem(productDetail)}
                  disabled={
                    Number(
                      productDetail?.stock ??
                        productDetail?.numberInStock ??
                        productDetail?.quantity ??
                        0,
                    ) <= 0
                  }
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Add Detail Item to Cart
                </button>
              ) : null}
              <a
                href={`/dashboard/pharmacy${
                  activePrescriptionId
                    ? `?prescriptionId=${encodeURIComponent(activePrescriptionId)}`
                    : ''
                }`}
                className="ml-button-secondary"
                style={{
                  borderRadius: '8px',
                  textDecoration: 'none',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Clear Product Detail
              </a>
            </div>
          </div>
        ) : null}
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search medicine, category, or pharmacy"
          style={{
            width: '100%',
            border: `1px solid ${theme.borderInput}`,
            borderRadius: '10px',
            padding: '10px',
            background: theme.inputBackground,
            color: theme.text,
            marginBottom: '10px',
          }}
        />
        <div
          style={{
            display: 'grid',
            gap: '8px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            marginBottom: '10px',
          }}
        >
          <select
            value={pharmacyCategory}
            onChange={(event) => setPharmacyCategory(event.target.value)}
            style={{
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '10px',
              padding: '10px',
              background: theme.inputBackground,
              color: theme.text,
            }}
          >
            <option value="all">All categories</option>
            <option value="prescription">Prescription</option>
            <option value="otc">Over-the-counter</option>
            <option value="vitamins">Vitamins</option>
            <option value="personal_care">Personal care</option>
            <option value="first_aid">First aid</option>
          </select>
          <select
            value={pharmacyLocationFilter}
            onChange={(event) => setPharmacyLocationFilter(event.target.value)}
            style={{
              border: `1px solid ${theme.borderInput}`,
              borderRadius: '10px',
              padding: '10px',
              background: theme.inputBackground,
              color: theme.text,
            }}
          >
            <option value="">All locations</option>
            {locationOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {isPatient ? (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px',
              borderRadius: '10px',
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <p style={{ margin: 0, color: theme.textSecondary, fontSize: '12px' }}>
              Cart: <strong style={{ color: theme.text }}>{totalCartItems}</strong> item(s) •{' '}
              <strong style={{ color: theme.text }}>{money(totalCartAmount)}</strong>
            </p>
            <a
              href="/dashboard/cart"
              className="ml-button-primary"
              style={{
                borderRadius: '10px',
                textDecoration: 'none',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              Open Cart
            </a>
          </div>
        ) : null}
        <ListRows
          items={filteredProducts}
          theme={theme}
          emptyLabel="No marketplace products found."
          renderItem={(item) => {
            const productId = String(item?.id || '').trim();
            const inCart = cartItems.find((entry) => String(entry?.id) === productId);
            const stock = Number(item?.stock ?? item?.numberInStock ?? item?.quantity ?? 0);
            const isActive = activeProductId && activeProductId === productId;
            return (
              <div
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${isActive ? theme.primary : theme.border}`,
                  background: isActive ? theme.primaryLight : theme.surface,
                }}
              >
                {resolveImageUrl(item?.imageUrl || item?.image || item?.photo || item?.thumbnail) ? (
                  <img
                    src={resolveImageUrl(item?.imageUrl || item?.image || item?.photo || item?.thumbnail)}
                    alt={item?.name || 'Product'}
                    style={{
                      width: '100%',
                      height: '130px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      marginBottom: '8px',
                    }}
                  />
                ) : null}
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.name || 'Product'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {money(item?.price)} • Stock: {stock}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.pharmacy?.name || 'Pharmacy'} • {item?.pharmacy?.location || item?.location || 'Location unavailable'}
                </p>
                {item?.category ? (
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                    Category: {String(item.category)}
                    {item?.requiresPrescription || item?.prescriptionRequired ? ' • Prescription required' : ''}
                  </p>
                ) : null}
                <a
                  href={`/dashboard/pharmacy?productId=${encodeURIComponent(productId)}${
                    activePrescriptionId
                      ? `&prescriptionId=${encodeURIComponent(activePrescriptionId)}`
                      : ''
                  }`}
                  className="ml-button-secondary"
                  style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  View Details
                </a>
                {isPatient ? (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={stock <= 0}
                      className="ml-button-primary"
                      onClick={() => addPatientCartItem(item)}
                      style={{
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        cursor: stock <= 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      {stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    {inCart ? (
                      <>
                        <button
                          type="button"
                          className="ml-button-secondary"
                          onClick={() =>
                            setPatientCartQuantity(productId, Number(inCart?.cartQuantity || 1) - 1)
                          }
                          style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{inCart?.cartQuantity || 0}</span>
                        <button
                          type="button"
                          className="ml-button-secondary"
                          onClick={() =>
                            setPatientCartQuantity(productId, Number(inCart?.cartQuantity || 0) + 1)
                          }
                          style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      </SectionCard>
    );
  }

  if (slug === 'cart') {
    const methods = toArray(sectionData?.methods);
    const hasPrescriptionRequiredItems = cartItems.some((entry) => Boolean(entry?.prescriptionRequired));
    const totalKes = cartItems.reduce(
      (sum, entry) => sum + Number(entry?.price || 0) * Number(entry?.cartQuantity || 0),
      0,
    );
    const usdKesRate = Number(sectionData?.rates?.USD_KES || 150);
    const totalAmount = cartCurrency === 'USD' ? Number((totalKes / usdKesRate).toFixed(2)) : totalKes;

    return (
      <SectionCard title="Cart Checkout" subtitle="Checkout with IntaSend" theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        {!cartItems.length ? (
          <p style={{ margin: 0, color: theme.textSecondary }}>Your cart is empty.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
              {cartItems.map((item) => (
                <div
                  key={item?.id}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    background: theme.surface,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{item?.name || 'Product'}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                      {money(item?.price)} • Qty: {item?.cartQuantity || 0}
                      {item?.prescriptionRequired ? ' • Prescription required' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="ml-button-secondary"
                      onClick={() => setPatientCartQuantity(item?.id, Number(item?.cartQuantity || 1) - 1)}
                      style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="ml-button-secondary"
                      onClick={() => setPatientCartQuantity(item?.id, Number(item?.cartQuantity || 0) + 1)}
                      style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removePatientCartItem(item?.id)}
                      style={{
                        borderRadius: '8px',
                        border: 'none',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        background: theme.error,
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {hasPrescriptionRequiredItems ? (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.warning}66`,
                  background: `${theme.warning}1A`,
                }}
              >
                <p style={{ margin: 0, color: theme.warning, fontWeight: 700, fontSize: '12px' }}>
                  Prescription required for one or more items.
                </p>
                <input
                  value={selectedPrescriptionId}
                  onChange={(event) => setSelectedPrescriptionId(event.target.value)}
                  placeholder="Prescription ID"
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    border: `1px solid ${theme.borderInput}`,
                    borderRadius: '8px',
                    padding: '8px',
                    background: theme.inputBackground,
                    color: theme.text,
                  }}
                />
                <a
                  href="/dashboard/medical-records?tab=prescriptions"
                  className="ml-button-secondary"
                  style={{
                    marginTop: '8px',
                    display: 'inline-block',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  Open Prescriptions
                </a>
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gap: '8px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                marginBottom: '10px',
              }}
            >
              <select
                value={cartPaymentMethod}
                onChange={(event) => setCartPaymentMethod(event.target.value)}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '8px',
                  padding: '8px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              >
                {methods.length ? null : <option value="intasend">IntaSend</option>}
                {methods.map((method) => (
                  <option key={method?.id || method?.name} value={method?.id || method?.name}>
                    {method?.label || method?.name || method?.id || 'Method'}
                  </option>
                ))}
              </select>
              <select
                value={cartCurrency}
                onChange={(event) => setCartCurrency(event.target.value)}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '8px',
                  padding: '8px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
              <input
                value={cartPhone}
                onChange={(event) => setCartPhone(event.target.value)}
                placeholder="Phone (optional)"
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '8px',
                  padding: '8px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              />
            </div>
            <textarea
              rows={2}
              value={cartNotes}
              onChange={(event) => setCartNotes(event.target.value)}
              placeholder="Notes (optional)"
              style={{
                width: '100%',
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '8px',
                padding: '8px',
                background: theme.inputBackground,
                color: theme.text,
                marginBottom: '10px',
              }}
            />
            <p style={{ margin: '0 0 10px', color: theme.textSecondary }}>
              Total: <strong style={{ color: theme.text }}>{cartCurrency} {Number(totalAmount || 0).toLocaleString()}</strong>
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ml-button-primary"
                onClick={checkoutPatientCart}
                disabled={submitting}
                style={{
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                }}
              >
                {submitting ? 'Processing...' : 'Checkout with IntaSend'}
              </button>
              <button
                type="button"
                className="ml-button-secondary"
                onClick={clearPatientCart}
                style={{ borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </SectionCard>
    );
  }

  if (slug === 'payment-methods') {
    const methods = toArray(sectionData?.methods);
    return (
      <SectionCard title="Payment Methods" subtitle="All payments are processed through IntaSend" theme={theme}>
        <p style={{ margin: '0 0 10px', color: theme.textSecondary }}>
          Make secure payments to medics, hospitals, and pharmacies.
        </p>
        <a
          href="/dashboard/cart"
          className="ml-button-primary"
          style={{
            borderRadius: '10px',
            textDecoration: 'none',
            padding: '8px 12px',
            display: 'inline-block',
            color: '#fff',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          Open Cart Checkout
        </a>
        <ListRows
          items={methods.length ? methods : [{ id: 'intasend', label: 'IntaSend', description: 'Secure checkout gateway' }]}
          theme={theme}
          emptyLabel="No payment methods available."
          renderItem={(method) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{method?.label || method?.name || method?.id || 'Method'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {method?.description || 'Secure checkout gateway'}
              </p>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'payments') {
    const history = toArray(sectionData?.history || sectionData);
    const wallet = sectionData?.wallet || null;
    return (
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <SectionCard title="Wallet" subtitle="Current balances" theme={theme}>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Available: <strong style={{ color: theme.text }}>{money(wallet?.availableBalance)}</strong>
          </p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Pending: <strong style={{ color: theme.text }}>{money(wallet?.pendingBalance)}</strong>
          </p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>
            Total paid transactions: <strong style={{ color: theme.text }}>{wallet?.paidTransactions || 0}</strong>
          </p>
        </SectionCard>

        <SectionCard title="Payment History" subtitle={`Transactions: ${history.length}`} theme={theme}>
          <ListRows
            items={history.slice(0, 20)}
            theme={theme}
            emptyLabel="No payment history."
            renderItem={(payment) => (
              <div style={{ padding: '8px', borderRadius: '9px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{money(payment?.amount)}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {payment?.status || 'PENDING'} • {payment?.type || '-'} • {formatDate(payment?.createdAt)}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'chat') {
    const conversations = toArray(sectionData);
    return (
      <SectionCard title="Conversations" subtitle="Recent chat threads" theme={theme}>
        <ListRows
          items={conversations}
          theme={theme}
          emptyLabel="No conversations yet."
          renderItem={(conversation) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{conversation?.user?.fullName || conversation?.user?.email || 'User'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {conversation?.lastMessage?.text || 'No messages'}
              </p>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'video-call') {
    const history = toArray(sectionData);
    return (
      <SectionCard title="Video Call History" subtitle="Previous call sessions" theme={theme}>
        <ListRows
          items={history}
          theme={theme}
          emptyLabel="No call history found."
          renderItem={(call) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{call?.callType || 'Call'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Status: {call?.status || '-'} • {formatDate(call?.createdAt)}
              </p>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'notifications') {
    const notifications = toArray(sectionData);
    return (
      <SectionCard title="Notifications" subtitle="Latest app notifications" theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        <ListRows
          items={notifications}
          theme={theme}
          emptyLabel="No notifications yet."
          renderItem={(item) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item?.title || 'Notification'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>{item?.message || '-'}</p>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <small style={{ color: theme.textTertiary }}>{formatDate(item?.createdAt)}</small>
                {!item?.isRead ? (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(item.id)}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    Mark Read
                  </button>
                ) : null}
              </div>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'settings') {
    const rolePermissions = sectionData?.rolePermissions || {};
    const featureFlags = sectionData?.featureFlags || {};
    const roleEntries = Object.entries(rolePermissions);
    const flagEntries = Object.entries(featureFlags?.flags || featureFlags || {});

    return (
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <SectionCard title="Role Permissions" subtitle="Access policy by role" theme={theme}>
          {roleEntries.length ? (
            <ListRows
              items={roleEntries}
              theme={theme}
              emptyLabel="No role permissions configured."
              renderItem={(entry) => {
                const [roleName, permissions] = entry;
                const permissionList = Array.isArray(permissions)
                  ? permissions
                  : permissions && typeof permissions === 'object'
                    ? Object.entries(permissions)
                        .filter(([, allowed]) => Boolean(allowed))
                        .map(([perm]) => perm)
                    : [];
                return (
                  <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{roleName}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                      {(permissionList.length && permissionList.join(', ')) || 'No permissions listed'}
                    </p>
                  </div>
                );
              }}
            />
          ) : (
            <p style={{ margin: 0, color: theme.textSecondary }}>No role permissions data returned.</p>
          )}
        </SectionCard>

        <SectionCard title="Feature Flags" subtitle="Platform feature toggles" theme={theme}>
          {flagEntries.length ? (
            <div style={{ display: 'grid', gap: '8px' }}>
              {flagEntries.map(([flag, enabled]) => (
                <div
                  key={flag}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: theme.surface,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{flag}</span>
                  <span style={{ color: enabled ? theme.success : theme.error, fontSize: '12px', fontWeight: 700 }}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: theme.textSecondary }}>No feature flags data returned.</p>
          )}
        </SectionCard>
      </div>
    );
  }

  if (slug === 'medical-info') {
    return (
      <SectionCard title="Medical Information" subtitle="Allergies, blood group, chronic conditions, insurance" theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <form onSubmit={saveMedicalInfo} style={{ display: 'grid', gap: '8px' }}>
          <input
            value={medicalInfoDraft.allergies}
            onChange={(event) => setMedicalInfoDraft((prev) => ({ ...prev, allergies: event.target.value }))}
            placeholder="Allergies (e.g. penicillin, peanuts)"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <input
            value={medicalInfoDraft.bloodGroup}
            onChange={(event) => setMedicalInfoDraft((prev) => ({ ...prev, bloodGroup: event.target.value }))}
            placeholder="Blood group (e.g. O+)"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <input
            value={medicalInfoDraft.chronicConditions}
            onChange={(event) =>
              setMedicalInfoDraft((prev) => ({ ...prev, chronicConditions: event.target.value }))
            }
            placeholder="Chronic conditions (e.g. diabetes)"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <input
            value={medicalInfoDraft.insuranceProvider}
            onChange={(event) =>
              setMedicalInfoDraft((prev) => ({ ...prev, insuranceProvider: event.target.value }))
            }
            placeholder="Insurance provider"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <input
            value={medicalInfoDraft.insuranceNumber}
            onChange={(event) =>
              setMedicalInfoDraft((prev) => ({ ...prev, insuranceNumber: event.target.value }))
            }
            placeholder="Insurance number"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="ml-button-primary"
            style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            {submitting ? 'Saving...' : 'Save Medical Information'}
          </button>
        </form>
      </SectionCard>
    );
  }

  if (slug === 'profile' || slug === 'edit-profile' || slug === 'location' || slug === 'settings') {
    const profile = sectionData?.userProfile?.user || sectionData?.user || {};
    const location = sectionData?.location || {};
    return (
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <SectionCard title="Profile Details" theme={theme}>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Name: <strong style={{ color: theme.text }}>{profile?.fullName || '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Email: <strong style={{ color: theme.text }}>{profile?.email || '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Phone: <strong style={{ color: theme.text }}>{profile?.phone || '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Role: <strong style={{ color: theme.text }}>{profile?.role || '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Password interval: <strong style={{ color: theme.text }}>{profile?.passwordUpdateIntervalDays || 'Default'} days</strong></p>
        </SectionCard>

        <SectionCard title="Location" theme={theme}>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Address: <strong style={{ color: theme.text }}>{location?.address || profile?.locationAddress || '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Latitude: <strong style={{ color: theme.text }}>{location?.lat ?? '-'}</strong></p>
          <p style={{ margin: '4px 0', color: theme.textSecondary }}>Longitude: <strong style={{ color: theme.text }}>{location?.lng ?? '-'}</strong></p>
        </SectionCard>

        {(slug === 'edit-profile' || slug === 'settings' || slug === 'location') ? (
          <SectionCard title="Update Profile" subtitle="Edit profile and location details" theme={theme}>
            {actionError ? (
              <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
            ) : null}
            {success ? (
              <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
            ) : null}
            <form onSubmit={saveProfile} style={{ display: 'grid', gap: '8px' }}>
              <input
                value={profileDraft.fullName}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Full name"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
              />
              <input
                value={profileDraft.phone}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
              />
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <input
                  value={profileDraft.emergencyContactName}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, emergencyContactName: event.target.value }))
                  }
                  placeholder="Emergency contact name"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
                />
                <input
                  value={profileDraft.emergencyContactPhone}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, emergencyContactPhone: event.target.value }))
                  }
                  placeholder="Emergency contact phone"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
                />
              </div>
              <input
                value={profileDraft.locationAddress}
                onChange={(event) =>
                  setProfileDraft((prev) => ({ ...prev, locationAddress: event.target.value }))
                }
                placeholder="Location address"
                style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
              />
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <input
                  value={profileDraft.lat}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, lat: event.target.value }))}
                  placeholder="Latitude"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
                />
                <input
                  value={profileDraft.lng}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, lng: event.target.value }))}
                  placeholder="Longitude"
                  style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="ml-button-primary"
                style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
              >
                Save Profile
              </button>
            </form>
          </SectionCard>
        ) : null}
      </div>
    );
  }

  if (slug === 'emergency') {
    const profile = sectionData?.profile?.user || sectionData?.profile || {};
    const myLocation = normalizeLocation(sectionData?.myLocation?.location || sectionData?.myLocation);
    const nearestMedic = toArray(sectionData?.medics)
      .map((medic) => {
        const location = normalizeLocation(medic?.location || medic);
        const distanceKm = getDistanceKm(myLocation, location);
        return {
          id: medic?.id || medic?.medicId,
          title: 'Nearest Medic',
          name: medic?.name || medic?.fullName || 'Medic',
          subtitle: [
            medic?.specialization || '',
            Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : '',
            location?.address || '',
          ]
            .filter(Boolean)
            .join(' • '),
          phone: toDialablePhone(medic?.phone || medic?.contactPhone || ''),
          distanceKm,
        };
      })
      .filter((entry) => entry.phone)
      .sort((a, b) => {
        const aDist = Number.isFinite(a?.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
        const bDist = Number.isFinite(b?.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
        return aDist - bDist;
      })[0];
    const nearestHospital = toArray(sectionData?.linkedLocations)
      .filter((item) => String(item?.role || '').toUpperCase() === 'HOSPITAL_ADMIN')
      .map((hospital) => {
        const location = normalizeLocation(hospital?.location || hospital);
        const distanceKm = getDistanceKm(myLocation, location);
        return {
          id: hospital?.id,
          title: 'Nearest Hospital',
          name: hospital?.name || 'Hospital',
          subtitle: [
            Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : '',
            location?.address || hospital?.address || '',
          ]
            .filter(Boolean)
            .join(' • '),
          phone: toDialablePhone(hospital?.phone || hospital?.contactPhone || ''),
          distanceKm,
        };
      })
      .filter((entry) => entry.phone)
      .sort((a, b) => {
        const aDist = Number.isFinite(a?.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
        const bDist = Number.isFinite(b?.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
        return aDist - bDist;
      })[0];
    const emergencyContacts = [];
    const seenPhones = new Set();
    const pushUniqueContact = (entry) => {
      const phone = toDialablePhone(entry?.phone);
      if (!phone || seenPhones.has(phone)) return;
      seenPhones.add(phone);
      emergencyContacts.push({ ...entry, phone });
    };
    if (nearestMedic) pushUniqueContact(nearestMedic);
    if (nearestHospital) pushUniqueContact(nearestHospital);
    pushUniqueContact({
      id: 'saved-contact',
      title: 'Saved Emergency Contact',
      name: profile?.emergencyContactName || 'Saved contact',
      subtitle: profile?.emergencyContactName || 'Your saved emergency contact',
      phone: profile?.emergencyContactPhone || '',
    });
    pushUniqueContact({
      id: 'national-112',
      title: 'National Emergency',
      name: 'Kenya emergency line',
      subtitle: 'National emergency line',
      phone: '112',
    });
    pushUniqueContact({
      id: 'national-999',
      title: 'Police / Ambulance',
      name: 'Kenya emergency line',
      subtitle: 'Police and ambulance line',
      phone: '999',
    });

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <SectionCard title="Emergency" subtitle="Choose nearest medic, hospital, or saved emergency number" theme={theme}>
          <p style={{ margin: 0, color: theme.textSecondary }}>
            Support admin: <strong style={{ color: theme.text }}>{sectionData?.supportAdmin?.fullName || 'Not found'}</strong>
          </p>
          <p style={{ margin: '6px 0 0', color: theme.textSecondary }}>
            Email: <strong style={{ color: theme.text }}>{sectionData?.supportAdmin?.email || '-'}</strong>
          </p>
          <button
            type="button"
            className="ml-button-primary"
            onClick={() => setShowEmergencyContacts((prev) => !prev)}
            style={{
              marginTop: '10px',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 12px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {showEmergencyContacts ? 'Hide Emergency Contacts' : 'Start Emergency Call'}
          </button>
          <a
            href="/dashboard/video-call"
            className="ml-button-secondary"
            style={{
              marginTop: '8px',
              display: 'inline-block',
              borderRadius: '10px',
              padding: '8px 12px',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            In-app Audio/Video Emergency
          </a>
        </SectionCard>
        {showEmergencyContacts ? (
          <SectionCard title="Tap a Number to Open Dialer" subtitle="Nearest contacts are prioritized first" theme={theme}>
            <ListRows
              items={emergencyContacts}
              theme={theme}
              emptyLabel="No emergency contacts available yet."
              renderItem={(contact) => (
                <a
                  href={`tel:${contact.phone}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    background: theme.surface,
                  }}
                >
                  <span>
                    <span style={{ display: 'block', color: theme.text, fontWeight: 700 }}>
                      {contact.title}
                    </span>
                    <span style={{ display: 'block', marginTop: '2px', color: theme.textSecondary, fontSize: '12px' }}>
                      {[contact.name, contact.subtitle].filter(Boolean).join(' • ')}
                    </span>
                  </span>
                  <span
                    style={{
                      borderRadius: '999px',
                      background: `${theme.primary}20`,
                      color: theme.primary,
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '6px 10px',
                    }}
                  >
                    {contact.phone}
                  </span>
                </a>
              )}
            />
          </SectionCard>
        ) : null}
      </div>
    );
  }

  if (slug === 'analytics') {
    const totals = sectionData?.totals || {};
    const entries = Object.entries(totals);
    return (
      <SectionCard title="Analytics" subtitle="Role analytics synced with mobile endpoints" theme={theme}>
        {entries.length ? (
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {entries.map(([key, value]) => (
              <div key={key} style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>{key}</p>
                <p style={{ margin: '4px 0 0', fontWeight: 800 }}>{typeof value === 'number' ? value.toLocaleString() : String(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: theme.textSecondary }}>No analytics values available.</p>
        )}
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'users') {
    const users = toArray(sectionData?.items || sectionData?.users || sectionData);
    return (
      <SectionCard title="User Management" subtitle={`Total shown: ${users.length}`} theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <ListRows
          items={users}
          theme={theme}
          emptyLabel="No users available."
          renderItem={(item) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item?.fullName || `${item?.firstName || ''} ${item?.lastName || ''}`.trim() || item?.email || 'User'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {item?.email || '-'} • {item?.role || '-'} • {item?.status || '-'}
              </p>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => verifyAdminUser(item.id, true)}
                  className="ml-button-secondary"
                  style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                >
                  Verify
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => blockAdminUser(item.id, String(item?.status || '').toLowerCase() !== 'suspended')}
                  className="ml-button-secondary"
                  style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                >
                  {String(item?.status || '').toLowerCase() === 'suspended' ? 'Unblock' : 'Block'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => deleteAdminUser(item.id)}
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    background: theme.error,
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'subscriptions') {
    const subscriptions = toArray(sectionData);
    const statusActions = ['ACTIVE', 'PAUSED', 'CANCELED'];
    return (
      <SectionCard title="Subscriptions" subtitle={`Total subscriptions: ${subscriptions.length}`} theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <ListRows
          items={subscriptions}
          theme={theme}
          emptyLabel="No subscriptions found."
          renderItem={(sub) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {sub?.role || 'User'} • {sub?.plan || 'plan'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {money(sub?.amount)} • Status: {sub?.status || 'ACTIVE'}
              </p>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {statusActions.map((status) => (
                  <button
                    key={`${sub?.id}-${status}`}
                    type="button"
                    disabled={submitting || String(sub?.status || '').toUpperCase() === status}
                    onClick={() => updateSubscriptionStatus(sub.id, status)}
                    className="ml-button-secondary"
                    style={{ borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'complaints') {
    const complaints = toArray(sectionData);
    return (
      <SectionCard title="Complaints" subtitle={`Open complaints: ${complaints.length}`} theme={theme}>
        {actionError ? (
          <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
        ) : null}
        {success ? (
          <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
        ) : null}
        <ListRows
          items={complaints}
          theme={theme}
          emptyLabel="No complaints found."
          renderItem={(item) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item?.category || 'General complaint'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>{item?.message || '-'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>Status: {item?.status || 'OPEN'}</p>
              {String(item?.status || '').toUpperCase() !== 'RESOLVED' ? (
                <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                  <input
                    value={complaintResolutionMap[item.id] || ''}
                    onChange={(event) =>
                      setComplaintResolutionMap((prev) => ({
                        ...prev,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Resolution note"
                    style={{
                      border: `1px solid ${theme.borderInput}`,
                      borderRadius: '8px',
                      padding: '8px',
                      background: theme.inputBackground,
                      color: theme.text,
                    }}
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => resolveComplaint(item.id)}
                    className="ml-button-primary"
                    style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
                  >
                    Resolve
                  </button>
                </div>
              ) : null}
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'control-center') {
    const control = sectionData || {};
    const featureFlags = control?.featureFlags?.flags || {};
    const topActions = toArray(control?.auditTrail?.topActions);
    const kycQueue = toArray(control?.kyc?.queue);
    const openFraud = toArray(control?.fraud?.cases).filter(
      (entry) => String(entry?.status || '').toUpperCase() === 'OPEN',
    );
    const supportOpen = toArray(control?.support?.supportTickets).filter(
      (entry) => String(entry?.status || '').toUpperCase() === 'OPEN',
    );
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <SectionCard title="Control Center Summary" theme={theme}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Audit Events</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>
                {Number(control?.auditTrail?.totalEvents || 0).toLocaleString()}
              </p>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>KYC Queue</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>{kycQueue.length}</p>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Open Fraud Cases</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>{openFraud.length}</p>
            </div>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Open Support Tickets</p>
              <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800 }}>{supportOpen.length}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Feature Flags" subtitle="Platform toggles" theme={theme}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {Object.entries(featureFlags).map(([flag, enabled]) => (
              <div key={flag} style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{flag}</p>
                <p style={{ margin: '4px 0 0', color: enabled ? theme.success : theme.error, fontSize: '12px' }}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top Audit Actions" theme={theme}>
          <ListRows
            items={topActions}
            theme={theme}
            emptyLabel="No audit action stats."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.action || 'ACTION'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Count: {Number(item?.count || 0).toLocaleString()}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'audit-logs') {
    const logs = toArray(sectionData);
    return (
      <SectionCard title="Audit Logs" subtitle={`Entries: ${logs.length}`} theme={theme}>
        <ListRows
          items={logs.slice(0, 120)}
          theme={theme}
          emptyLabel="No audit logs found."
          renderItem={(row) => (
            <div style={{ padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{row?.action || 'ACTION'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Target: {row?.targetId || '-'} • By: {row?.by || row?.userId || '-'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {formatDate(row?.createdAt)}
              </p>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN' && slug === 'email-center') {
    const adminNotifications = toArray(sectionData?.adminNotifications || sectionData);
    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        <SectionCard title="Broadcast Message" subtitle="Send notifications/email to role audience" theme={theme}>
          {actionError ? (
            <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
          ) : null}
          {success ? (
            <p style={{ margin: '0 0 10px', color: theme.success, fontWeight: 700 }}>{success}</p>
          ) : null}
          <form onSubmit={sendAdminNotification} style={{ display: 'grid', gap: '8px' }}>
            <input
              value={emailDraft.title}
              onChange={(event) => setEmailDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Title"
              required
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '8px',
                padding: '8px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
            <textarea
              rows={4}
              value={emailDraft.message}
              onChange={(event) => setEmailDraft((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Message"
              required
              style={{
                border: `1px solid ${theme.borderInput}`,
                borderRadius: '8px',
                padding: '8px',
                background: theme.inputBackground,
                color: theme.text,
              }}
            />
            <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <select
                value={emailDraft.audience}
                onChange={(event) => setEmailDraft((prev) => ({ ...prev, audience: event.target.value }))}
                style={{
                  border: `1px solid ${theme.borderInput}`,
                  borderRadius: '8px',
                  padding: '8px',
                  background: theme.inputBackground,
                  color: theme.text,
                }}
              >
                <option value="ALL">ALL</option>
                <option value="PATIENTS">PATIENTS</option>
                <option value="MEDICS">MEDICS</option>
                <option value="HOSPITALS">HOSPITALS</option>
                <option value="PHARMACIES">PHARMACIES</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.textSecondary }}>
                <input
                  type="checkbox"
                  checked={Boolean(emailDraft.sendEmail)}
                  onChange={(event) => setEmailDraft((prev) => ({ ...prev, sendEmail: event.target.checked }))}
                />
                Send email
              </label>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="ml-button-primary"
              style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
            >
              Send Broadcast
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Recent Broadcasts" theme={theme}>
          <ListRows
            items={adminNotifications}
            theme={theme}
            emptyLabel="No broadcasts yet."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{item?.title || 'Announcement'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>{item?.message || '-'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Audience: {item?.audience || 'ALL'} • {formatDate(item?.createdAt)}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (normalizedRole === 'SUPER_ADMIN') {
    const items = toArray(sectionData?.items || sectionData?.users || sectionData?.complaints || sectionData?.logs || sectionData);
    return (
      <SectionCard title="Admin Data" subtitle="Live admin endpoint results" theme={theme}>
        <ListRows
          items={items}
          theme={theme}
          emptyLabel="No admin data found."
          renderItem={(item) => (
            <div style={{ padding: '8px', borderRadius: '9px', background: theme.surface }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item?.fullName || item?.email || item?.title || item?.id || 'Record'}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                {item?.role || item?.status || item?.message || formatDate(item?.createdAt)}
              </p>
            </div>
          )}
        />
      </SectionCard>
    );
  }

  if (slug === 'ai-assistant') {
    const settings = sectionData?.settings || {};
    const history = toArray(sectionData?.history);
    const canUse = Boolean(settings?.canUse ?? true);
    const isPremium = Boolean(settings?.isPremium ?? true);
    const aiEnabled = Boolean(settings?.aiEnabled ?? settings?.enabled ?? false);
    const provider = String(settings?.provider || 'gemini').toUpperCase();
    const blockedReason = String(settings?.blockedReason || '').trim();

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {actionError ? <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p> : null}
        {success ? <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p> : null}
        <SectionCard title="AI Assistant Status" subtitle={`Provider: ${provider}`} theme={theme}>
          <p style={{ margin: 0, color: isPremium ? theme.success : theme.warning, fontWeight: 700 }}>
            {isPremium ? 'Premium active' : 'Premium required'}
          </p>
          <p style={{ margin: '4px 0 0', color: theme.textSecondary, fontSize: '12px' }}>
            {blockedReason || (aiEnabled ? 'AI is enabled for your account.' : 'Enable AI to use assistant tools.')}
          </p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ml-button-primary"
              onClick={() => updateAiAssistantSettings(true)}
              disabled={submitting || aiEnabled || !isPremium}
              style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
            >
              Enable AI
            </button>
            <button
              type="button"
              className="ml-button-secondary"
              onClick={() => updateAiAssistantSettings(false)}
              disabled={submitting || !aiEnabled}
              style={{ borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
            >
              Disable AI
            </button>
            <a
              href="/dashboard/voice-ai"
              className="ml-button-secondary"
              style={{ borderRadius: '8px', textDecoration: 'none', padding: '8px 10px', fontWeight: 700 }}
            >
              Open Voice AI
            </a>
          </div>
        </SectionCard>
        <SectionCard title="AI Search" subtitle="Search medics, hospitals, and pharmacies" theme={theme}>
          <input
            value={aiAssistantSearchQuery}
            onChange={(event) => setAiAssistantSearchQuery(event.target.value)}
            placeholder="e.g Cardiologist Nairobi under 3000"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <button
            type="button"
            className="ml-button-primary"
            onClick={runAiAssistantSearch}
            disabled={submitting || !canUse}
            style={{ marginTop: '8px', border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            Search with AI
          </button>
          <ListRows
            items={aiAssistantSearchResults}
            theme={theme}
            emptyLabel="No search results yet."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {item?.title || item?.name || item?.fullName || item?.email || 'Result'}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {item?.description || item?.type || item?.location || '-'}
                </p>
              </div>
            )}
          />
        </SectionCard>
        <SectionCard title="Assistant Q&A" subtitle="Ask direct health or app questions" theme={theme}>
          <textarea
            rows={3}
            value={aiAssistantQuery}
            onChange={(event) => setAiAssistantQuery(event.target.value)}
            placeholder="Ask AI assistant..."
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <button
            type="button"
            className="ml-button-primary"
            onClick={runAiAssistantQuery}
            disabled={submitting || !canUse}
            style={{ marginTop: '8px', border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            Ask AI
          </button>
          {aiAssistantAnswer ? (
            <pre
              style={{
                margin: '8px 0 0',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                color: theme.text,
                padding: '8px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {aiAssistantAnswer}
            </pre>
          ) : null}
        </SectionCard>
        <SectionCard title="AI Summary" subtitle="Summarize your health records" theme={theme}>
          <button
            type="button"
            className="ml-button-primary"
            onClick={generateAiHealthSummary}
            disabled={submitting || !canUse}
            style={{ border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            Generate Summary
          </button>
          {aiSummary?.summary ? (
            <pre
              style={{
                margin: '8px 0 0',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                color: theme.text,
                padding: '8px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(aiSummary.summary)}
            </pre>
          ) : null}
        </SectionCard>
        <SectionCard title="Recent AI Sessions" theme={theme}>
          <ListRows
            items={history}
            theme={theme}
            emptyLabel="No recent AI sessions."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {String(item?.mode || 'general').toUpperCase()} • {item?.status || '-'}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  {formatDate(item?.createdAt || item?.startedAt)}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  if (slug === 'voice-ai') {
    const settings = sectionData?.settings || {};
    const history = toArray(sectionData?.history);
    const canUse = Boolean(settings?.canUse ?? true);
    const blockedReason = String(settings?.blockedReason || '').trim();
    const modeTools =
      voiceMode === 'search'
        ? ['search_medics', 'search_hospitals', 'search_pharmacy_products']
        : voiceMode === 'records'
          ? ['summarize_health_record', 'search_pharmacy_products']
          : voiceMode === 'support'
            ? ['request_support_chat']
            : voiceMode === 'emergency'
              ? ['get_emergency_contacts', 'search_medics', 'search_hospitals']
              : [
                  'search_medics',
                  'search_hospitals',
                  'search_pharmacy_products',
                  'summarize_health_record',
                  'get_emergency_contacts',
                  'request_support_chat',
                ];

    return (
      <div style={{ display: 'grid', gap: '12px' }}>
        {actionError ? <p style={{ margin: 0, color: theme.error, fontWeight: 700 }}>{actionError}</p> : null}
        {success ? <p style={{ margin: 0, color: theme.success, fontWeight: 700 }}>{success}</p> : null}

        <SectionCard title="Access Status" subtitle="Powered by Vapi + MediLink tools" theme={theme}>
          <p style={{ margin: 0, color: canUse ? theme.success : theme.warning, fontWeight: 700 }}>
            {canUse ? 'Voice AI is enabled.' : blockedReason || 'Voice AI is unavailable.'}
          </p>
        </SectionCard>

        <SectionCard title="Voice Session" subtitle="Start live voice assistant mode" theme={theme}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {[
              { id: 'general', title: 'General' },
              { id: 'search', title: 'Search' },
              { id: 'records', title: 'Records' },
              { id: 'support', title: 'Support' },
              { id: 'emergency', title: 'Emergency' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setVoiceMode(mode.id)}
                style={{
                  borderRadius: '999px',
                  border: `1px solid ${voiceMode === mode.id ? theme.primary : theme.border}`,
                  background: voiceMode === mode.id ? `${theme.primary}1A` : theme.surface,
                  color: voiceMode === mode.id ? theme.primary : theme.textSecondary,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {mode.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!canUse || submitting}
            onClick={createVoiceSession}
            className="ml-button-primary"
            style={{ border: 'none', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}
          >
            {submitting ? 'Starting...' : 'Start Voice Session'}
          </button>
          {voiceSessionInfo ? (
            <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.surface }}>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>
                Session: {voiceSessionInfo?.sessionId || '-'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                Vapi configured: {voiceSessionInfo?.vapi?.configured ? 'Yes' : 'No'}
              </p>
              {voiceSessionInfo?.warning ? (
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.warning }}>
                  {voiceSessionInfo.warning}
                </p>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Guided Voice Tools" subtitle="Run contextual assistant tools" theme={theme}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {modeTools.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setVoiceToolName(name)}
                style={{
                  borderRadius: '999px',
                  border: `1px solid ${voiceToolName === name ? theme.primary : theme.border}`,
                  background: voiceToolName === name ? `${theme.primary}1A` : theme.surface,
                  color: voiceToolName === name ? theme.primary : theme.textSecondary,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <input
            value={voiceQuery}
            onChange={(event) => setVoiceQuery(event.target.value)}
            placeholder="Optional query (name, specialization, location, product...)"
            style={{ border: `1px solid ${theme.borderInput}`, borderRadius: '8px', padding: '8px', background: theme.inputBackground, color: theme.text }}
          />
          <button
            type="button"
            disabled={!canUse || submitting}
            onClick={runVoiceTool}
            className="ml-button-primary"
            style={{ marginTop: '8px', border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 }}
          >
            {submitting ? 'Running...' : 'Run Tool'}
          </button>
          {voiceToolResult ? (
            <pre
              style={{
                margin: '8px 0 0',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                color: theme.text,
                padding: '8px',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(voiceToolResult, null, 2)}
            </pre>
          ) : null}
        </SectionCard>

        <SectionCard title="Recent Voice Sessions" theme={theme}>
          <ListRows
            items={history}
            theme={theme}
            emptyLabel="No voice sessions yet."
            renderItem={(item) => (
              <div style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: theme.surface }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  {String(item?.mode || 'general').toUpperCase()} • {item?.status || '-'}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Started: {formatDate(item?.startedAt || item?.createdAt)}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: theme.textSecondary }}>
                  Tools used: {toArray(item?.toolAudits).length}
                </p>
              </div>
            )}
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <SectionCard title="Screen Ready" subtitle="Route is now wired with a live page" theme={theme}>
      {actionError ? (
        <p style={{ margin: '0 0 10px', color: theme.error, fontWeight: 700 }}>{actionError}</p>
      ) : null}
      <pre
        style={{
          margin: 0,
          borderRadius: '10px',
          padding: '10px',
          background: '#0f172a',
          color: '#e2e8f0',
          fontSize: '12px',
          overflow: 'auto',
          maxHeight: '340px',
        }}
      >
        {JSON.stringify(sectionData || {}, null, 2)}
      </pre>
    </SectionCard>
  );
}

export default function DashboardSectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const section = String(params?.section || '').toLowerCase();
  const { theme, isDark } = useWebTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [overview, setOverview] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isWide, setIsWide] = useState(false);

  const [sectionLoading, setSectionLoading] = useState(true);
  const [sectionError, setSectionError] = useState('');
  const [sectionData, setSectionData] = useState(null);

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

  const loadBase = useCallback(async () => {
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
        fetchRoleOverview(role, token, profilePayload).catch(() => null),
        fetchNotifications(token).catch(() => []),
      ]);

      setProfile(profilePayload);
      setOverview(overviewPayload);
      setNotifications(Array.isArray(notificationsPayload) ? notificationsPayload : []);
    } catch (requestError) {
      const message = requestError?.message || 'Failed to load dashboard context.';
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
    loadBase();
  }, [loadBase]);

  const role = normalizeRole(profile?.user?.role);

  const loadCurrentSection = useCallback(async () => {
    const session = loadSession();
    const token = session?.accessToken;
    if (!token || !role) return;

    setSectionLoading(true);
    setSectionError('');
    try {
      const payload = await loadSectionData({
        section,
        role,
        token,
        profile,
        overview,
        searchQuery: location.search,
      });
      setSectionData(payload);
    } catch (requestError) {
      setSectionError(requestError?.message || 'Failed to load this section.');
      setSectionData(null);
    } finally {
      setSectionLoading(false);
    }
  }, [section, role, profile, overview, location.search]);

  useEffect(() => {
    if (!profile?.user) return;
    loadCurrentSection();
  }, [profile, loadCurrentSection]);

  const user = profile?.user || {};
  const unreadCount = notifications.filter((item) => !item?.isRead).length;
  const greeting = getTimeGreeting();
  const firstName = getFirstName(user);

  const menu = getRoleMenu(role);
  const sectionMeta = getSectionMeta(role, section);
  const isValidRoute = menu.some((item) => item.route === sectionMeta.route);

  useEffect(() => {
    if (!loading && role && section && !isValidRoute) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, role, section, isValidRoute, navigate]);

  const handleMenuClick = (menuItem) => {
    const route = menuItem?.route || '/dashboard';
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
              <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 800 }}>{sectionMeta.title}</h1>
              <p style={{ margin: '2px 0 0', color: theme.textSecondary, fontSize: '13px' }}>
                {greeting}, {firstName} ({role || 'UNKNOWN'})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ThemeModeSwitch />
            <button
              type="button"
              onClick={loadCurrentSection}
              className="ml-button-secondary"
              style={{ borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}
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
          {loading ? <p style={{ color: theme.textSecondary }}>Loading dashboard context...</p> : null}
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
            <div style={{ display: 'grid', gap: '12px' }}>
              <SectionRenderer
                role={role}
                userId={user?.id}
                section={section}
                searchQuery={location.search}
                sectionData={sectionData}
                sectionLoading={sectionLoading}
                sectionError={sectionError}
                theme={theme}
                token={loadSession()?.accessToken}
                onReload={loadCurrentSection}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
