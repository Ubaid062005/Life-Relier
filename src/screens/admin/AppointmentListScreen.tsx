import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, API_BASE_URL } from '../../utils/constants';
import {
  getDoctorDropdown,
  getAllAppointments,
  deleteAppointment,
  DoctorDropdownItem,
  AppointmentRecord,
} from '../../services/doctorScheduleService';

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

/** Convert "HH:MM" 24h or "HH:MM AM/PM" → "HH:MM AM/PM" display */
function formatSlot(slot: string): string {
  if (!slot) return '—';
  if (/AM|PM/i.test(slot)) return slot;
  const [hStr, mStr] = slot.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return slot;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
}

export default function AppointmentListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isPhlebo = user?.role === 'phlebotomist';

  const [date, setDate]               = useState<Date | null>(new Date()); // defaults to current date
  const [showPicker, setShowPicker]   = useState(false);
  const [doctors, setDoctors]         = useState<DoctorDropdownItem[]>([]);
  const [selectedDrId, setSelectedDrId]   = useState<number | null>(null);
  const [selectedDrName, setSelectedDrName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch]           = useState('');
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [testStatusMap, setTestStatusMap] = useState<Record<string, { state: 'loading' | 'hasTests' | 'noTests'; isCompleted: boolean }>>({});

  useEffect(() => {
    getDoctorDropdown(1).then(setDoctors).catch(() => {});
    if (isPhlebo && user?.id) {
      setSelectedDrId(Number(user.id));
      setSelectedDrName(user.name ?? '');
    }
  }, [isPhlebo, user]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from both branches — website uses BranchId 1, app uses BranchId 4
      const [b1, b4] = await Promise.all([
        getAllAppointments(1).catch(() => []),
        getAllAppointments(4).catch(() => []),
      ]);
      // Deduplicate by AppointmentId
      const seen = new Set<number>();
      const merged = [...b1, ...b4].filter(a => {
        const id = a.AppointmentId;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setAppointments(merged);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAppointments(); return () => {}; }, [fetchAppointments]));

  // Sort appointments by date descending (most recent first)
  const sorted = [...appointments].sort((a, b) => {
    const da = a.AppointmentDate ? new Date(a.AppointmentDate).getTime() : 0;
    const db = b.AppointmentDate ? new Date(b.AppointmentDate).getTime() : 0;
    return db - da;
  });

  const filtered = sorted.filter(a => {
    const q = search.toLowerCase();
    const matchesSearch =
      String(a.DoctorName    ?? '').toLowerCase().includes(q) ||
      String(a.Mobile        ?? '').toLowerCase().includes(q) ||
      String(a.AppointmentId ?? '').toString().includes(q)    ||
      String(a.Status        ?? '').toLowerCase().includes(q) ||
      String(a.Name          ?? '').toLowerCase().includes(q);
    const matchesDoctor = selectedDrId == null || a.DrId === selectedDrId;
    // Date filter — compare "YYYY-MM-DD" strings
    const matchesDate = date == null || (() => {
      const selected = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const apptDate = String(a.AppointmentDate ?? '').substring(0, 10);
      return apptDate === selected;
    })();
    return matchesSearch && matchesDoctor && matchesDate;
  });

  useEffect(() => {
    const newMobiles = [...new Set(filtered.map(a => a.Mobile).filter(m => m && !testStatusMap[m]))];
    if (newMobiles.length === 0) return;

    setTestStatusMap(prev => {
      const next = { ...prev };
      newMobiles.forEach(m => { next[m] = { state: 'loading', isCompleted: false }; });
      return next;
    });

    const fetchTests = async () => {
      const results = await Promise.all(newMobiles.map(async m => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              BranchId: 1, FromDate: '2020-01-01', ToDate: '2030-01-01',
              PatRegID: '', PatientName: '',
              DoctorName: '', TestName: '', MobileNo: m,
              Barcode: '', CenterCode: '', SubDepartment: '', Status: 'All',
            }),
          });
          const data = await res.json();
          const rows = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : [];
          const hasTests = rows.length > 0;
          const isCompleted = rows.some((r: any) => {
            const st = String(r.Status || '').trim().toLowerCase();
            return st === 'report ready' || st === 'completed' || st === 'done' || st === 'delivered';
          });
          return {
            mobile: m,
            state: (hasTests ? 'hasTests' : 'noTests') as 'hasTests' | 'noTests',
            isCompleted,
          };
        } catch {
          return { mobile: m, state: 'noTests' as const, isCompleted: false };
        }
      }));

      setTestStatusMap(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.mobile] = { state: r.state, isCompleted: r.isCompleted }; });
        return next;
      });
    };
    fetchTests();
  }, [filtered]);

  /** Robust date formatter — parses "YYYY-MM-DDT..." or "YYYY-MM-DD" without timezone shift */
  function fmtDate(iso: string): string {
    if (!iso) return '—';
    try {
      const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
      return iso;
    } catch { return iso; }
  }

  const handleDelete = (item: AppointmentRecord) => {
    Alert.alert(
      'Delete Appointment',
      `Delete appointment #${item.AppointmentId} for ${item.Mobile}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteAppointment(item.AppointmentId, item.BranchId);
              setAppointments(prev => prev.filter(a => a.AppointmentId !== item.AppointmentId));
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not delete.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Show Appointment</Text>
        <TouchableOpacity onPress={() => Alert.alert('Filter', 'Filter options coming soon.')}>
          <Feather name="filter" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Feather name="home" size={13} color={COLORS.primary} />
        <Text style={styles.bcText}> Dr Appointment</Text>
        <Feather name="chevron-right" size={13} color="#94A3B8" style={{ marginHorizontal: 2 }} />
        <Text style={[styles.bcText, { color: COLORS.primary, fontWeight: '700' }]}>Show Appointment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="calendar-check" size={20} color="#FFF" />
              <Text style={styles.cardTitle}> Appointment List</Text>
              <View style={styles.recordBadge}>
                <Text style={styles.recordBadgeText}>{appointments.length} records</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.refreshBtn, loading && { opacity: 0.6 }]}
              onPress={fetchAppointments}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size={12} color="#FFF" />
                : <Feather name="refresh-cw" size={14} color="#FFF" />}
              <Text style={styles.btnText}> Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.formBody}>
            {/* Date */}
            <Text style={styles.label}>Appointment Date</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.dateRow, { flex: 1 }]} onPress={() => setShowPicker(true)}>
                <MaterialCommunityIcons name="calendar" size={18} color="#64748B" style={{ marginRight: 10 }} />
                <Text style={styles.dateText}>{date ? formatDate(date) : 'All Dates'}</Text>
                <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#64748B" />
              </TouchableOpacity>
              {date && (
                <TouchableOpacity
                  style={{ width: 44, height: 50, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setDate(null)}
                >
                  <Feather name="x" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
            {showPicker && (
              <DateTimePicker value={date ?? new Date()} mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, s) => { setShowPicker(false); if (s) setDate(s); }} />
            )}

            {/* Doctor dropdown (Hidden for phlebotomists) */}
            {!isPhlebo && (
              <>
                <Text style={[styles.label, { marginTop: 16 }]}>Collection Person</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowDropdown(!showDropdown)}>
                  <Text style={[styles.dropdownText, !selectedDrName && { color: COLORS.textMuted }]}>
                    {selectedDrName || 'Select...'}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>
                {showDropdown && (
                  <View style={styles.dropdownMenu}>
                    <TouchableOpacity style={styles.dropdownItem}
                      onPress={() => { setSelectedDrId(null); setSelectedDrName(''); setShowDropdown(false); }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>All Doctors</Text>
                    </TouchableOpacity>
                    {doctors.map(d => (
                      <TouchableOpacity key={d.Id} style={styles.dropdownItem}
                        onPress={() => { setSelectedDrId(d.Id); setSelectedDrName(d.FullName); setShowDropdown(false); }}>
                        <Text style={styles.dropdownItemText}>{d.FullName}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Search */}
            <View style={[styles.searchBar, { marginTop: 16 }]}>
              <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} placeholder="Search table..."
                placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
            </View>

            {/* Body */}
            {loading && appointments.length === 0 ? (
              <View style={styles.centreBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.centreText}>Loading appointments…</Text>
              </View>
            ) : error && appointments.length === 0 ? (
              <View style={styles.centreBox}>
                <MaterialCommunityIcons name="cloud-off-outline" size={52} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Could not load data</Text>
                <Text style={styles.emptySubtitle}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchAppointments}>
                  <Feather name="refresh-cw" size={14} color={COLORS.primary} />
                  <Text style={styles.retryText}> Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={52} color="#CBD5E1" />
                <Text style={styles.emptyText}>No data available</Text>
              </View>
            ) : (
              filtered.map((item, idx) => {
                const patientName = item.Name
                  || (item.FirstName ? `${item.FirstName} ${item.LastName ?? ''}`.trim() : '')
                  || '—';
                const tInfo = testStatusMap[item.Mobile];
                const isUnregistered = tInfo?.state === 'noTests';
                const apptStatus = String(item.Status || '').trim().toLowerCase();
                const isTestCompleted = Boolean(
                  tInfo?.isCompleted ||
                  apptStatus === 'completed' ||
                  apptStatus === 'done' ||
                  apptStatus === 'report ready' ||
                  apptStatus === 'test completed'
                );

                return (
                <TouchableOpacity 
                  key={`appt-${item.AppointmentId || ''}-${idx}`} 
                  style={[
                    styles.apptRow,
                    isUnregistered && { backgroundColor: '#FFF7ED', borderColor: '#F97316', borderWidth: 1, borderRadius: 10, marginVertical: 4, paddingHorizontal: 10 }
                  ]}
                  onPress={() => {
                    if (isUnregistered) {
                      navigation.navigate('NewRegistration', { mobile: item.Mobile, name: patientName });
                    }
                  }}
                  activeOpacity={isUnregistered ? 0.7 : 1}
                >
                  <View style={styles.apptIcon}>
                    <MaterialCommunityIcons name="calendar-account" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.apptName}>
                      {item.DoctorName ?? `Dr ID: ${item.DrId}`}
                    </Text>
                    <Text style={styles.apptSub}>
                      👤 {patientName}
                    </Text>
                    <Text style={styles.apptSub}>
                      📱 {item.Mobile}  •  {fmtDate(item.AppointmentDate)}
                    </Text>
                    <Text style={styles.apptTime}>
                      🕐 {formatSlot(item.Slot)}  •  {item.Status}
                    </Text>
                  </View>
                  {/* Status badge */}
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.statusPill, {
                      backgroundColor: item.Status === 'Cancelled' ? '#FEF2F2'
                        : item.Status === 'Pending' ? '#FFFBEB'
                        : item.IsActive ? '#F0FDFA' : '#F1F5F9',
                    }]}>
                      <View style={[styles.statusDot, {
                        backgroundColor: item.Status === 'Cancelled' ? '#EF4444'
                          : item.Status === 'Pending' ? '#F59E0B'
                          : item.IsActive ? '#10B981' : '#94A3B8',
                      }]} />
                      <Text style={[styles.statusText, {
                        color: item.Status === 'Cancelled' ? '#EF4444'
                          : item.Status === 'Pending' ? '#F59E0B'
                          : item.IsActive ? '#10B981' : '#94A3B8',
                      }]}>
                        {item.Status ?? (item.IsActive ? 'Active' : 'Done')}
                      </Text>
                    </View>
                    {!isTestCompleted && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item)}
                      >
                        <Feather name="trash-2" size={12} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ); })
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* SCAN FAB */}
      <TouchableOpacity style={styles.scanFab}>
        <MaterialCommunityIcons name="barcode-scan" size={28} color="#FFF" />
        <Text style={styles.scanLabel}>SCAN</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 - Life Relier Infosoft Pvt Ltd</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surfaceVariant },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F4', paddingHorizontal: 16, paddingVertical: 8 },
  bcText: { fontSize: 12, color: COLORS.textSecondary },
  scroll: { padding: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardHeader: { backgroundColor: COLORS.primary, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginRight: 8 },
  recordBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  recordBadgeText: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  formBody: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 50 },
  dateText: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 50 },
  dropdownText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  dropdownMenu: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.card, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  dropdownItemText: { fontSize: 14, color: COLORS.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  centreBox: { alignItems: 'center', paddingVertical: 40 },
  centreText: { marginTop: 10, fontSize: 13, color: COLORS.textSecondary },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  retryText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500', marginTop: 10 },
  apptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  apptIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  apptName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  apptSub: { fontSize: 11, color: COLORS.textSecondary },
  apptTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  scanFab: { position: 'absolute', bottom: 50, right: 20, backgroundColor: COLORS.primary, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  scanLabel: { fontSize: 9, color: '#FFF', fontWeight: '700', marginTop: 2 },
  footer: { backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#FFF', fontWeight: '500' },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
});
