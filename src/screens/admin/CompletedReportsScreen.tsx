import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL, COLORS } from '../../utils/constants';
import {
  generateAndShareReportPdf,
  generateAndViewReportPdf,
  generateAndPrintReportPdf,
} from '../../services/reportPdfService';

const T = {
  primary:  '#0D9488',
  bg:       '#F8FAFC',
  card:     '#FFFFFF',
  text:     '#0F172A',
  sub:      '#64748B',
  muted:    '#94A3B8',
  border:   '#E2E8F0',
  success:  '#10B981',
  danger:   '#EF4444',
};

const FILTERS = ['Today', 'This Week', 'This Month', 'All'];

interface PatientRow {
  PID:          number;
  PatRegID:     number;
  PatientName:  string;
  MainTestName: string;
  Patregdate:   string;
  Status:       string;
  BarcodeID:    string;
  TestCharges:  number;
  PaidAmount:   number;
  Isemergency?: boolean;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  } catch { return iso; }
}

function getFromDate(filter: string): string {
  const d = new Date();
  if (filter === 'Today')     { return d.toISOString().split('T')[0]; }
  if (filter === 'This Week') { d.setDate(d.getDate() - 7);  return d.toISOString().split('T')[0]; }
  if (filter === 'This Month'){ d.setDate(1); return d.toISOString().split('T')[0]; }
  return '2024-01-01';
}

export default function CompletedReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('Today');
  const [records,    setRecords]    = useState<PatientRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PDF modal and action states
  const [selectedReport, setSelectedReport] = useState<PatientRow | null>(null);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [modalAction, setModalAction] = useState<'send' | 'print'>('send');
  const [generatingPid, setGeneratingPid] = useState<number | null>(null);

  const fetchReports = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BranchId: 1, FromDate: getFromDate(filter), ToDate: today,
          PatRegID: '', PatientName: '', DoctorName: '', TestName: '',
          MobileNo: '', Barcode: '', CenterCode: '', SubDepartment: '',
          Status: 'All',
        }),
      });
      const data = await res.json();
      const rows: PatientRow[] = Array.isArray(data) ? data
        : Array.isArray(data?.value) ? data.value : [];
      setRecords(rows);
    } catch { setRecords([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return r.PatientName.toLowerCase().includes(q) ||
           String(r.PatRegID).includes(q) ||
           r.BarcodeID.includes(q) ||
           r.MainTestName.toLowerCase().includes(q);
  });

  // Deduplicate by PatRegID for summary counts
  const uniquePIDs = new Set(records.map(r => r.PID));

  // Handler for View (opens system PDF app chooser / viewer popup directly - Image 2)
  const handleViewReport = async (item: PatientRow) => {
    setGeneratingPid(item.PID);
    try {
      await generateAndViewReportPdf({
        PatRegID: item.PatRegID,
        PID: item.PID,
        BranchId: 1,
        CompanyId: 1,
        TimeZoneId: 1,
        PrintMode: 'WITHOUT_LETTERHEAD',
      });
    } catch (e: any) {
      Alert.alert('View Error', e.message || 'Failed to open PDF report');
    } finally {
      setGeneratingPid(null);
    }
  };

  // Handler for opening Send layout modal
  const handleOpenSendModal = (item: PatientRow) => {
    setSelectedReport(item);
    setModalAction('send');
    setShowLayoutModal(true);
  };

  // Handler for opening Print layout modal
  const handleOpenPrintModal = (item: PatientRow) => {
    setSelectedReport(item);
    setModalAction('print');
    setShowLayoutModal(true);
  };

  // Execute selected layout action (Send via share sheet - Image 1 or Print)
  const handleExecuteAction = async (printMode: 'WITHOUT_LETTERHEAD' | 'WITH_LETTERHEAD') => {
    if (!selectedReport) return;
    const item = selectedReport;
    setShowLayoutModal(false);
    setGeneratingPid(item.PID);

    try {
      if (modalAction === 'send') {
        await generateAndShareReportPdf({
          PatRegID: item.PatRegID,
          PID: item.PID,
          BranchId: 1,
          CompanyId: 1,
          TimeZoneId: 1,
          PrintMode: printMode,
        });
      } else {
        await generateAndPrintReportPdf({
          PatRegID: item.PatRegID,
          PID: item.PID,
          BranchId: 1,
          CompanyId: 1,
          TimeZoneId: 1,
          PrintMode: printMode,
        });
      }
    } catch (e: any) {
      Alert.alert('Action Error', e.message || 'Failed to process report');
    } finally {
      setGeneratingPid(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 0) }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSub}>Patient test records</Text>
        </View>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => fetchReports(true)}>
          <Feather name="refresh-cw" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient, barcode, test..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <SummaryMini value={String(uniquePIDs.size)}  label="Patients"  color={COLORS.primary}  bg="#F0FDFA" />
        <SummaryMini value={String(records.length)}   label="Tests"     color="#0369A1"    bg="#F0F9FF" />
        <SummaryMini
          value={`₹${records.reduce((s, r) => s + (r.PaidAmount ?? 0), 0).toLocaleString('en-IN')}`}
          label="Collected"
          color="#15803D"
          bg="#F0FDF4"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centreTxt}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchReports(true)} colors={[COLORS.primary]} />
          }
        >
          <Text style={styles.resultCount}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</Text>

          {filtered.length === 0 ? (
            <View style={styles.centre}>
              <MaterialCommunityIcons name="file-document-outline" size={52} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No records found</Text>
            </View>
          ) : (
            filtered.map((r, idx) => {
              const isBusy = generatingPid === r.PID;
              return (
                <View key={`${r.PatRegID}-${r.BarcodeID}-${idx}`} style={styles.reportCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>{r.PatientName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.patientName}>{r.PatientName}</Text>
                        {r.Isemergency && <BlinkingEmergencyBulb size={18} />}
                      </View>
                      <Text style={styles.patientId}>
                        PT{String(r.PatRegID).padStart(6,'0')}  •  {formatDate(r.Patregdate)}
                      </Text>
                      <View style={styles.cardMeta}>
                        <Feather name="activity" size={11} color={COLORS.textMuted} />
                        <Text style={styles.cardMetaText}> {r.MainTestName}</Text>
                        <Feather name="hash" size={11} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                        <Text style={styles.cardMetaText}> {r.BarcodeID}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#F0FDF4' }]}>
                      <Text style={[styles.statusText, { color: T.success }]}>₹{(r.PaidAmount ?? 0).toFixed(0)}</Text>
                    </View>
                  </View>

                  {/* 3 Action Buttons: View, Print, Send */}
                  <View style={styles.cardActions}>
                    <ActionBtn
                      icon="eye"
                      label="View"
                      loading={isBusy}
                      onPress={() => handleViewReport(r)}
                    />
                    <ActionBtn
                      icon="printer"
                      label="Print"
                      disabled={isBusy}
                      onPress={() => handleOpenPrintModal(r)}
                    />
                    <ActionBtn
                      icon="send"
                      label="Send"
                      disabled={isBusy}
                      onPress={() => handleOpenSendModal(r)}
                      isLast
                    />
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* Print / Send Layout Selection Modal */}
      <Modal visible={showLayoutModal} transparent animationType="fade" onRequestClose={() => setShowLayoutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name={modalAction === 'send' ? 'share-variant' : 'printer'} size={26} color={COLORS.primary} />
              <Text style={styles.modalTitle}>
                {modalAction === 'send' ? 'Send Report' : 'Print Report'}
              </Text>
            </View>
            <Text style={styles.modalSub}>
              Select layout for {selectedReport?.PatientName} (PID: {selectedReport?.PID})
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleExecuteAction('WITHOUT_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="file-document-outline" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>Without Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Standard clean report layout</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleExecuteAction('WITH_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="printer" size={22} color="#8B5CF6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>With Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Includes clinic header branding & logo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLayoutModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryMini({ value, label, color, bg }: any) {
  return (
    <View style={[styles.summaryMini, { backgroundColor: bg }]}>
      <Text style={[styles.summaryMiniVal, { color }]}>{value}</Text>
      <Text style={[styles.summaryMiniLabel, { color }]}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, isLast, loading, disabled }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, isLast && { borderRightWidth: 0 }, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <>
          <Feather name={icon} size={14} color={COLORS.primary} />
          <Text style={styles.actionBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  filterIconBtn: { padding: 6 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card },
  searchBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, height: 44 },
  searchInput:{ flex: 1, fontSize: 14, color: COLORS.textPrimary },
  filterRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.background },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  summaryMini: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  summaryMiniVal:   { fontSize: 18, fontWeight: '900' },
  summaryMiniLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  scroll:      { padding: 16 },
  resultCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', marginBottom: 14 },
  centre:      { alignItems: 'center', paddingVertical: 48 },
  centreTxt:   { marginTop: 10, fontSize: 14, color: COLORS.textSecondary },
  emptyTitle:  { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  reportCard:  { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 14, overflow: 'hidden', elevation: 1, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  avatarBox:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:  { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  patientName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  patientId:   { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center' },
  cardMetaText:{ fontSize: 10, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusText:  { fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 5, borderRightWidth: 1, borderRightColor: COLORS.cardBorder },
  actionBtnText:{ fontSize: 12, fontWeight: '600', color: COLORS.primary },
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
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  modalOptionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  modalOptionDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});
