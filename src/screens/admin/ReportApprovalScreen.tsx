import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL, COLORS } from '../../utils/constants';
import { generateAndShareReportPdf } from '../../services/reportPdfService';

const THEME = {
  primary: '#0D9488',
  bg: '#FFFFFF',
  screenBg: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  success: '#10B981',
  successBg: '#ECFDF5',
  purple: '#8B5CF6',
  purpleBg: '#F5F3FF',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
};

type FilterType = 'All' | 'Authorized' | 'Report Ready' | 'Urgent';

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

async function fetchApprovedReports(): Promise<ReportRow[]> {
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

  // Group by PID and ONLY include Approved/Ready records (Authorized or Report Ready)
  const map = new Map<number, ReportRow>();
  for (const r of rows) {
    const isApprovedOrReady =
      r.Status === 'Authorized' ||
      r.Status === 'Report Ready' ||
      r.Status === 'Completed' ||
      r.Patrepstatus === true;

    if (!isApprovedOrReady) continue;

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

export default function ReportApprovalScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [generatingPdfPid, setGeneratingPdfPid] = useState<number | null>(null);

  // PDF modal state
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await fetchApprovedReports();
      setRecords(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load report approvals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = records.filter(r => {
    if (activeFilter === 'Authorized' && r.Status !== 'Authorized') return false;
    if (activeFilter === 'Report Ready' && r.Status !== 'Report Ready') return false;
    if (activeFilter === 'Urgent' && !r.Isemergency) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.PatientName?.toLowerCase().includes(q) ||
      String(r.PatRegID).includes(q) ||
      String(r.PID).includes(q) ||
      (r.BarcodeID && r.BarcodeID.toLowerCase().includes(q)) ||
      (r.Drname && r.Drname.toLowerCase().includes(q)) ||
      r.tests.some(t => t.toLowerCase().includes(q))
    );
  });

  const handleOpenPdfOptions = (item: ReportRow) => {
    setSelectedReport(item);
    setShowPdfModal(true);
  };

  const handleGeneratePdf = async (printMode: 'WITHOUT_LETTERHEAD' | 'WITH_LETTERHEAD') => {
    if (!selectedReport) return;
    setShowPdfModal(false);
    setGeneratingPdfPid(selectedReport.PID);
    try {
      await generateAndShareReportPdf({
        PatRegID: selectedReport.PatRegID,
        PID: selectedReport.PID,
        BranchId: 1,
        CompanyId: 1,
        TimeZoneId: 1,
        PrintMode: printMode,
      });
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF report');
    } finally {
      setGeneratingPdfPid(null);
    }
  };

  const authorizedCount = records.filter(r => r.Status === 'Authorized').length;
  const readyCount = records.filter(r => r.Status === 'Report Ready').length;
  const urgentCount = records.filter(r => r.Isemergency).length;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Report Approval</Text>
          <Text style={styles.headerSubtitle}>Authorized & Approved Reports</Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} style={styles.iconBtn}>
          <Feather name="refresh-cw" size={20} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={THEME.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Patient, Reg ID, Dr, Barcode..."
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={THEME.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs / Summary Cards */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, activeFilter === 'All' && styles.summaryCardActive]}
          onPress={() => setActiveFilter('All')}
        >
          <Text style={[styles.summaryValue, { color: THEME.primary }]}>{records.length}</Text>
          <Text style={styles.summaryLabel}>All Ready</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, activeFilter === 'Authorized' && styles.summaryCardActive]}
          onPress={() => setActiveFilter('Authorized')}
        >
          <Text style={[styles.summaryValue, { color: THEME.purple }]}>{authorizedCount}</Text>
          <Text style={styles.summaryLabel}>Authorized</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, activeFilter === 'Report Ready' && styles.summaryCardActive]}
          onPress={() => setActiveFilter('Report Ready')}
        >
          <Text style={[styles.summaryValue, { color: THEME.success }]}>{readyCount}</Text>
          <Text style={styles.summaryLabel}>Report Ready</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.summaryCard, activeFilter === 'Urgent' && styles.summaryCardActive]}
          onPress={() => setActiveFilter('Urgent')}
        >
          <Text style={[styles.summaryValue, { color: THEME.danger }]}>{urgentCount}</Text>
          <Text style={styles.summaryLabel}>Urgent</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.centreText}>Loading approved reports…</Text>
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
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-check-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Approved Reports Found</Text>
              <Text style={styles.emptySub}>
                Authorized and report-ready patients will appear here for PDF download & distribution.
              </Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const isAuth = item.Status === 'Authorized';
              const badgeBg = isAuth ? THEME.purpleBg : THEME.successBg;
              const badgeColor = isAuth ? THEME.purple : THEME.success;
              const isBusy = generatingPdfPid === item.PID;

              return (
                <View key={`${item.PID}-${idx}`} style={styles.card}>
                  {/* Card Top */}
                  <View style={styles.cardTop}>
                    <View style={[styles.avatarBox, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.avatarText, { color: badgeColor }]}>
                        {item.PatientName.charAt(0).toUpperCase()}
                      </Text>
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
                        <Text style={styles.barcodeText}>Barcode: {item.BarcodeID}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                      <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
                      <Text style={[styles.statusText, { color: badgeColor }]}>{item.Status}</Text>
                    </View>
                  </View>

                  {/* Tests List */}
                  <View style={styles.testsRow}>
                    <MaterialCommunityIcons name="flask-outline" size={14} color={THEME.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.testsText} numberOfLines={2}>{item.tests.join(' • ')}</Text>
                  </View>

                  {/* Billing & Doctor Meta */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Doctor</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {item.Drname && item.Drname !== '—' ? item.Drname : 'Self'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Paid / Total</Text>
                      <Text style={[styles.metaValue, { color: THEME.success }]}>
                        ₹{(item.PaidAmount ?? 0).toFixed(0)} / ₹{(item.TestCharges ?? 0).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.pdfBtn, isBusy && { opacity: 0.6 }]}
                      onPress={() => handleOpenPdfOptions(item)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="file-pdf-box" size={18} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.pdfBtnText}>Generate PDF Report</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* PDF Mode Selection Modal */}
      <Modal visible={showPdfModal} transparent animationType="fade" onRequestClose={() => setShowPdfModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="file-pdf-box" size={28} color={THEME.primary} />
              <Text style={styles.modalTitle}>Generate Report PDF</Text>
            </View>
            <Text style={styles.modalSub}>
              Select print layout for {selectedReport?.PatientName} (PID: {selectedReport?.PID})
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITHOUT_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="file-document-outline" size={22} color={THEME.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>Without Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Standard clean report layout (default)</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITH_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="printer" size={22} color={THEME.purple} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>With Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Includes clinic branding & header logo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPdfModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: THEME.bg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  backBtn: { padding: 4 },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary },
  headerSubtitle: { fontSize: 12, color: THEME.textSecondary, marginTop: 1 },
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
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.textPrimary },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: THEME.bg,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.border,
  },
  summaryCardActive: {
    borderColor: THEME.primary,
    backgroundColor: '#F0FDFA',
  },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 9, fontWeight: '600', color: THEME.textSecondary, marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  centre: { alignItems: 'center', paddingVertical: 40 },
  centreText: { fontSize: 13, color: THEME.textSecondary, marginTop: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 13, color: THEME.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: THEME.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary },
  pid: { fontSize: 11, color: THEME.textSecondary, marginTop: 1 },
  barcodeText: { fontSize: 10, color: THEME.textSecondary, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  testsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  testsText: { flex: 1, fontSize: 11, color: '#6B21A8', fontWeight: '500' },
  metaRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 10, color: THEME.textSecondary },
  metaValue: { fontSize: 12, fontWeight: '700', color: THEME.textPrimary, marginTop: 1 },
  actionsRow: {
    padding: 10,
    flexDirection: 'row',
    gap: 8,
  },
  pdfBtn: {
    flex: 1,
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  pdfBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: THEME.textPrimary },
  modalSub: { fontSize: 12, color: THEME.textSecondary, marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
  },
  modalOptionTitle: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary },
  modalOptionDesc: { fontSize: 11, color: THEME.textSecondary, marginTop: 1 },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: THEME.textSecondary },
});
