import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL, COLORS } from '../../utils/constants';

const THEME = {
  primary: '#0F766E',
  bg: '#FFFFFF',
  screenBg: '#FAFAFA',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  orange: '#EA580C',
  orangeBg: '#FFF7ED',
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
};

// Filter types for clickable summary cards in Pending Reports
type FilterType = 'All' | 'Registered' | 'Processing' | 'Urgent';

interface ReportRow {
  PID: number;
  PatRegID: number;
  PatientName: string;
  BarcodeID: string;
  Status: string;
  Patphoneno: string;
  Patregdate: string;
  TestCharges: number;
  PaidAmount: number;
  Drname: string;
  Isemergency: boolean;
  tests: string[];
}

function statusMeta(status: string) {
  switch (status) {
    case 'Processing':
      return { color: THEME.orange, bg: THEME.orangeBg, label: 'Processing' };
    case 'Sample Collected':
      return { color: '#3B82F6', bg: '#EFF6FF', label: 'Sample Collected' };
    case 'Registered':
    default:
      return { color: THEME.warning, bg: THEME.warningBg, label: 'Registered' };
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

async function fetchPendingReports(): Promise<ReportRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      BranchId: 1,
      FromDate: '2024-01-01',
      ToDate: today,
      PatRegID: '',
      PatientName: '',
      DoctorName: '',
      TestName: '',
      MobileNo: '',
      Barcode: '',
      CenterCode: '',
      SubDepartment: '',
      Status: 'All',
    }),
  });

  const data = await res.json();
  const rows: any[] = Array.isArray(data) ? data : (data?.value ?? []);

  // Filter ONLY Pending records (e.g. Registered or Processing)
  // Exclude Authorized and Report Ready records!
  const map = new Map<number, ReportRow>();
  for (const r of rows) {
    const isAuthorizedOrReady =
      r.Status === 'Authorized' ||
      r.Status === 'Report Ready' ||
      r.Status === 'Completed';

    if (isAuthorizedOrReady) continue;

    if (map.has(r.PID)) {
      map.get(r.PID)!.tests.push(r.MainTestName);
    } else {
      map.set(r.PID, {
        ...r,
        Drname: (r.Drname || r.RefDoctor || r.RefDr || r.DoctorName || r.OtherRefDoctor || 'Self').trim(),
        tests: [r.MainTestName],
      });
    }
  }

  return Array.from(map.values());
}

export default function PendingReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [allRecords, setAllRecords] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const pendingData = await fetchPendingReports();
      setAllRecords(pendingData);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load pending reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Filter records based on active filter and search
  const filtered = allRecords.filter(r => {
    if (activeFilter === 'Registered' && r.Status !== 'Registered') return false;
    if (activeFilter === 'Processing' && r.Status !== 'Processing') return false;
    if (activeFilter === 'Urgent' && !r.Isemergency) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.PatientName.toLowerCase().includes(q) ||
      String(r.PatRegID).includes(q) ||
      String(r.PID).includes(q) ||
      (r.BarcodeID && r.BarcodeID.toLowerCase().includes(q)) ||
      (r.Drname && r.Drname.toLowerCase().includes(q)) ||
      r.tests.some(t => t.toLowerCase().includes(q))
    );
  });

  const registeredCount = allRecords.filter(r => r.Status === 'Registered').length;
  const processingCount = allRecords.filter(r => r.Status === 'Processing').length;
  const urgentCount = allRecords.filter(r => r.Isemergency).length;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Pending Reports</Text>
          <Text style={styles.headerSubtitle}>Awaiting Result Entry & Authorization</Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={20} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={THEME.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pending by Name, Barcode or ID"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={THEME.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="clock-outline"
          label="All Pending"
          value={allRecords.length}
          color={THEME.primary}
          bg="#F0FDFA"
          isActive={activeFilter === 'All'}
          onPress={() => setActiveFilter('All')}
        />
        <SummaryCard
          icon="clipboard-text-outline"
          label="Registered"
          value={registeredCount}
          color={THEME.warning}
          bg={THEME.warningBg}
          isActive={activeFilter === 'Registered'}
          onPress={() => setActiveFilter('Registered')}
        />
        <SummaryCard
          icon="progress-clock"
          label="Processing"
          value={processingCount}
          color={THEME.orange}
          bg={THEME.orangeBg}
          isActive={activeFilter === 'Processing'}
          onPress={() => setActiveFilter('Processing')}
        />
        <SummaryCard
          icon="alert-circle-outline"
          label="Urgent"
          value={urgentCount}
          color={THEME.danger}
          bg={THEME.dangerBg}
          isActive={activeFilter === 'Urgent'}
          onPress={() => setActiveFilter('Urgent')}
        />
      </View>

      {/* Notice Banner to navigate to Report Approval for ready reports */}
      <TouchableOpacity
        style={styles.infoBanner}
        onPress={() => navigation.navigate('ReportApproval')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#0D9488" />
        <Text style={styles.infoBannerText}>
          Looking for authorized reports? Go to <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>Report Approval</Text>
        </Text>
        <Feather name="chevron-right" size={16} color="#0D9488" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.centreText}>Loading pending reports…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[THEME.primary]} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.centre}>
              <MaterialCommunityIcons name="file-document-outline" size={48} color="#CBD5E1" />
              <Text style={styles.centreText}>No pending reports found</Text>
              <Text style={styles.centreSubText}>All patient reports have been authorized or approved.</Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const sm = statusMeta(item.Status);
              return (
                <View key={`${item.PID}-${idx}`} style={styles.card}>
                  {/* Card header */}
                  <View style={styles.cardTop}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{item.PatientName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.name}>{item.PatientName}</Text>
                        {item.Isemergency && <BlinkingEmergencyBulb size={18} />}
                      </View>
                      <Text style={styles.pid}>
                        PT{String(item.PatRegID).padStart(6, '0')} • PID: {item.PID} • {fmtDate(item.Patregdate)}
                      </Text>
                      {item.BarcodeID ? (
                        <Text style={styles.pid}>Barcode: {item.BarcodeID}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sm.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: sm.color }]} />
                      <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
                    </View>
                  </View>

                  {/* Tests */}
                  <View style={styles.testsRow}>
                    <MaterialCommunityIcons name="flask-outline" size={13} color={THEME.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.testsText} numberOfLines={2}>{item.tests.join(' · ')}</Text>
                  </View>

                  {/* Billing & Doctor */}
                  <View style={styles.billingRow}>
                    <View style={styles.billingItem}>
                      <Text style={styles.billingLabel}>Charges</Text>
                      <Text style={styles.billingValue}>₹{(item.TestCharges ?? 0).toFixed(0)}</Text>
                    </View>
                    <View style={styles.billingItem}>
                      <Text style={styles.billingLabel}>Paid</Text>
                      <Text style={[styles.billingValue, { color: THEME.success }]}>₹{(item.PaidAmount ?? 0).toFixed(0)}</Text>
                    </View>
                    <View style={styles.billingItem}>
                      <Text style={styles.billingLabel}>Doctor</Text>
                      <Text style={styles.billingValue} numberOfLines={1}>
                        {(item.Drname && item.Drname !== '—' ? item.Drname : 'Self').trim()}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() =>
                      navigation.navigate('AddResultWithTestParam', {
                        patient: {
                          pid: item.PID,
                          PID: item.PID,
                          regNo: item.PatRegID,
                          PatRegID: item.PatRegID,
                          fullName: item.PatientName,
                          PatientName: item.PatientName,
                          refDr: item.Drname || 'Self',
                          gender: (item as any).Gender || (item as any).gender || '—',
                          age: (item as any).Age || (item as any).age || '—',
                          barcode: item.BarcodeID,
                        },
                      })
                    }
                  >
                    <Text style={styles.reviewBtnText}>Enter / Review Results</Text>
                    <Feather name="chevron-right" size={16} color="#FFF" style={{ position: 'absolute', right: 16 }} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({ icon, label, value, color, bg, isActive, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.summaryCard,
        { backgroundColor: bg },
        isActive && styles.summaryCardActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary },
  headerSubtitle: { fontSize: 11, color: THEME.textSecondary, marginTop: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.bg,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.textPrimary },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  infoBannerText: { flex: 1, fontSize: 11, color: '#0F766E' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  summaryGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  summaryCardActive: { borderColor: THEME.primary, transform: [{ scale: 1.02 }] },
  summaryValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  summaryLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  centre: { alignItems: 'center', paddingVertical: 40 },
  centreText: { fontSize: 14, color: THEME.textSecondary, marginTop: 10 },
  centreSubText: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: THEME.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 14,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: THEME.warning },
  name: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary, marginBottom: 2 },
  pid: { fontSize: 11, color: THEME.textSecondary, marginBottom: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 9, fontWeight: '700' },
  testsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  testsText: { flex: 1, fontSize: 12, color: THEME.textSecondary },
  billingRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 16,
  },
  billingItem: { flex: 1 },
  billingLabel: { fontSize: 10, color: THEME.textSecondary, fontWeight: '500', marginBottom: 2 },
  billingValue: { fontSize: 13, color: THEME.textPrimary, fontWeight: '700' },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    margin: 12,
    borderRadius: 10,
    paddingVertical: 12,
  },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
