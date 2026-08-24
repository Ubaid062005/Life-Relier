import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../utils/constants';
import { generateAndShareReportPdf } from '../../services/reportPdfService';

const PRIMARY = '#0D9488';

const STATUS_OPTIONS = [
  'All',
  'Authorized',
  'Pending',
  'Completed',
  'Tested',
  'Emergency',
  'IntRece',
  'IntNotRece',
  'Outsource',
  'Abnormal',
];

interface TestItem {
  patmstid: number;
  test: string;
  status: string;
  remark?: string;
  rerun?: boolean;
  pMail?: boolean;
  drMail?: boolean | null;
  outsource?: boolean;
  reportStatus?: boolean;
  panic?: any;
  barcodeNo?: string;
  sdCode?: string;
}

interface TestResultPatient {
  date: string;
  regNo: number;
  center: string;
  fullName: string;
  gender: string;
  age: string;
  refDr: string;
  ppid: number;
  balance: number;
  pid: number;
  viewPrescription?: any;
  tests: TestItem[];
}

function getDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const from = `${year}-${month}-01`;
  const to = `${year}-${month}-${day}`;
  return { from, to };
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TestResultEntryScreen({ navigation }: any) {
  const dates = getDefaultDates();
  const [showFilters, setShowFilters] = useState(false);
  const [activeStatus, setActiveStatus] = useState('All');

  // Filter Form State
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [ppid, setPpid] = useState('');
  const [regNo, setRegNo] = useState('');
  const [patientName, setPatientName] = useState('');
  const [barcodeNo, setBarcodeNo] = useState('');
  const [centerName, setCenterName] = useState('');
  const [refDoctor, setRefDoctor] = useState('');

  // Results State
  const [results, setResults] = useState<TestResultPatient[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdfPid, setGeneratingPdfPid] = useState<number | null>(null);

  // PDF modal state
  const [selectedPatient, setSelectedPatient] = useState<TestResultPatient | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const fetchResults = useCallback(async (isRefresh = false, overrideStatus = activeStatus) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const payload = {
        BranchId: 1,
        FromDate: fromDate || '2026-08-01',
        ToDate: toDate || '2026-08-31',
        PPID: ppid ? Number(ppid) : null,
        RegNo: regNo ? Number(regNo) : null,
        PatientName: patientName ? patientName.trim() : null,
        BarcodeNo: barcodeNo ? barcodeNo.trim() : null,
        CenterName: centerName ? centerName.trim() : null,
        RefDoctor: refDoctor ? refDoctor.trim() : null,
        Remark: null,
        StatusFilter: overrideStatus === 'All' ? null : overrideStatus,
        SubDeptId: null,
      };

      const res = await fetch(`${API_BASE_URL}/api/TestResultEntry/SearchTestResults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch test results (${res.status})`);
      }

      const json = await res.json();
      const rawList: any[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];

      const list: TestResultPatient[] = rawList.map((item: any) => {
        let docName = 'Self';
        if (typeof item.refDr === 'string' && item.refDr.trim()) {
          docName = item.refDr.trim();
        } else if (item.refDr && typeof item.refDr === 'object') {
          docName = item.refDr.DoctorName || item.refDr.name || item.refDr.Drname || 'Self';
        }

        const tests: TestItem[] = Array.isArray(item.tests)
          ? item.tests.map((t: any) => ({
              patmstid: typeof t.patmstid === 'number' ? t.patmstid : parseInt(t.patmstid, 10) || 0,
              test: typeof t.test === 'string' ? t.test : String(t.test || 'Test'),
              status: typeof t.status === 'string' ? t.status : (typeof t.status === 'object' ? '' : String(t.status || '')),
              remark: typeof t.remark === 'string' ? t.remark : '',
              rerun: !!t.rerun,
              pMail: !!t.pMail,
              drMail: t.drMail,
              outsource: !!t.outsource,
              reportStatus: !!t.reportStatus,
              panic: t.panic,
              barcodeNo: typeof t.barcodeNo === 'string' ? t.barcodeNo : '',
              sdCode: typeof t.sdCode === 'string' ? t.sdCode : '',
            }))
          : [];

        return {
          date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
          regNo: typeof item.regNo === 'number' ? item.regNo : parseInt(item.regNo, 10) || 0,
          center: typeof item.center === 'string' ? item.center : 'Main Lab',
          fullName: typeof item.fullName === 'string' ? item.fullName : String(item.fullName || 'Patient'),
          gender: typeof item.gender === 'string' ? item.gender : '—',
          age: typeof item.age === 'string' ? item.age : String(item.age || '—'),
          refDr: docName,
          ppid: typeof item.ppid === 'number' ? item.ppid : parseInt(item.ppid, 10) || 0,
          balance: typeof item.balance === 'number' ? item.balance : parseFloat(item.balance) || 0,
          pid: typeof item.pid === 'number' ? item.pid : parseInt(item.pid, 10) || 0,
          viewPrescription: item.viewPrescription,
          tests,
        };
      });

      setResults(list);
      setTotalCount(json?.totalCount ?? list.length);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to search test results');
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate, ppid, regNo, patientName, barcodeNo, centerName, refDoctor, activeStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchResults();
    }, [fetchResults])
  );

  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    fetchResults(false, status);
  };

  const handleResetFilters = () => {
    const d = getDefaultDates();
    setFromDate(d.from);
    setToDate(d.to);
    setPpid('');
    setRegNo('');
    setPatientName('');
    setBarcodeNo('');
    setCenterName('');
    setRefDoctor('');
    setActiveStatus('All');
  };

  const handleOpenPdf = (item: TestResultPatient) => {
    setSelectedPatient(item);
    setShowPdfModal(true);
  };

  const handleGeneratePdf = async (printMode: 'WITHOUT_LETTERHEAD' | 'WITH_LETTERHEAD') => {
    if (!selectedPatient) return;
    setShowPdfModal(false);
    setGeneratingPdfPid(selectedPatient.pid);
    try {
      await generateAndShareReportPdf({
        PatRegID: selectedPatient.regNo || selectedPatient.pid,
        PID: selectedPatient.pid,
        BranchId: 1,
        CompanyId: 1,
        TimeZoneId: 1,
        PrintMode: printMode,
      });
    } catch (e: any) {
      Alert.alert('PDF Generation Failed', e.message || 'Unable to generate PDF');
    } finally {
      setGeneratingPdfPid(null);
    }
  };

  const renderResultCard = ({ item }: { item: TestResultPatient }) => {
    const isAuth = item.tests?.some(t => t.status === 'Authorized');
    const isBusy = generatingPdfPid === item.pid;
    const testNames = item.tests?.map(t => t.test).join(', ') || 'No tests';

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{item.fullName || 'Patient'}</Text>
            <Text style={styles.patientDetails}>
              {item.gender || '—'} • {item.age || '—'} • Reg: #{item.regNo} • PPID: {item.ppid} • PID: {item.pid}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isAuth ? '#8B5CF6' : '#EF4444' },
            ]}
          >
            <Text style={styles.statusText}>{isAuth ? 'Authorized' : 'Pending'}</Text>
          </View>
        </View>

        {/* Meta details */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={13} color="#64748B" />
            <Text style={styles.metaText}>{fmtDate(item.date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="hospital-building" size={13} color="#64748B" />
            <Text style={styles.metaText}>{item.center || 'Main Lab'}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="doctor" size={13} color="#64748B" />
            <Text style={styles.metaText}>
              {typeof item.refDr === 'string' && item.refDr.trim() ? item.refDr.trim() : 'Self'}
            </Text>
          </View>
        </View>

        {/* Tests List & Badges */}
        <View style={styles.testListSection}>
          <Text style={styles.testSectionLabel}>Tests Assigned ({item.tests?.length || 0}):</Text>
          <View style={styles.testsGrid}>
            {item.tests?.map((t, idx) => {
              const authTest = t.status === 'Authorized';
              return (
                <View
                  key={`${t.patmstid}-${idx}`}
                  style={[
                    styles.testChip,
                    { backgroundColor: authTest ? '#F5F3FF' : '#FEF3C7', borderColor: authTest ? '#DDD6FE' : '#FDE68A' },
                  ]}
                >
                  <Text style={[styles.testChipText, { color: authTest ? '#6B21A8' : '#B45309' }]}>
                    {t.test} {t.sdCode ? `[${t.sdCode}]` : ''} • {t.status || 'Pending'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Bottom Actions Bar */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionButtonsRow}>
            {/* PDF Report Download/Share Button */}
            <TouchableOpacity
              style={[styles.pdfActionBtn, isBusy && { opacity: 0.6 }]}
              onPress={() => handleOpenPdf(item)}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color="#EF4444" />
                  <Text style={styles.pdfActionBtnText}>PDF Report</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Parameter Result Entry Button */}
            <TouchableOpacity
              style={styles.paramEditBtn}
              onPress={() => navigation.navigate('AddResultWithTestParam', { patient: item })}
            >
              <MaterialCommunityIcons name="clipboard-edit-outline" size={16} color="#0D9488" />
              <Text style={styles.paramEditBtnText}>Enter Params</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceText}>
            Bal: ₹{(item.balance ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>View Result / Report</Text>
          <Text style={styles.headerSubtitle}>Search, View & Download Patient Reports</Text>
        </View>
        <TouchableOpacity onPress={() => fetchResults(true)} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={18} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* Filter Header & Collapsible Form */}
      <View style={styles.filterSection}>
        <TouchableOpacity
          style={styles.filterHeader}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="filter-variant" size={20} color="#FFFFFF" />
            <Text style={styles.filterHeaderText}>Search Filters</Text>
          </View>
          <MaterialCommunityIcons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filterForm}>
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>From Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={fromDate}
                  onChangeText={setFromDate}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>To Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={toDate}
                  onChangeText={setToDate}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>PPID No</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2"
                  value={ppid}
                  onChangeText={setPpid}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>Reg No</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2"
                  value={regNo}
                  onChangeText={setRegNo}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>Patient Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name..."
                  value={patientName}
                  onChangeText={setPatientName}
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>Barcode No</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Barcode..."
                  value={barcodeNo}
                  onChangeText={setBarcodeNo}
                />
              </View>
            </View>

            <View style={styles.filterBtnRow}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                <MaterialCommunityIcons name="restore" size={18} color="#64748B" />
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchBtn} onPress={() => fetchResults(false)}>
                <MaterialCommunityIcons name="magnify" size={18} color="#FFFFFF" />
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Filter Chips */}
        <View style={styles.statusScrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusScroll}
          >
            {STATUS_OPTIONS.map(status => {
              const active = activeStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.statusChip, active && styles.statusChipActive]}
                  onPress={() => handleStatusChange(status)}
                >
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* List Header */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Test Results</Text>
        <Text style={styles.countText}>{totalCount} records found</Text>
      </View>

      {/* Results FlatList */}
      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Fetching test results…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => `${item.pid}-${item.regNo}`}
          renderItem={renderResultCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchResults(true)}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="flask-empty-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Test Results Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your date range or status filters to find patient records.
              </Text>
            </View>
          }
        />
      )}

      {/* PDF Layout Choice Modal */}
      <Modal visible={showPdfModal} transparent animationType="fade" onRequestClose={() => setShowPdfModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="file-pdf-box" size={26} color="#EF4444" />
              <Text style={styles.modalTitle}>Generate Report PDF</Text>
            </View>
            <Text style={styles.modalSub}>
              Select print mode for {selectedPatient?.fullName} (PID: {selectedPatient?.pid})
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITHOUT_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="file-document-outline" size={22} color={PRIMARY} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>Without Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Standard test report for clinical review</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITH_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="printer" size={22} color="#8B5CF6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>With Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Includes lab header, logo, and address</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPdfModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { marginRight: 12 },
  refreshBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },

  filterSection: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filterHeader: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterHeaderText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14, marginLeft: 8 },
  filterForm: { padding: 14, backgroundColor: '#F0FDFA', borderBottomWidth: 1, borderBottomColor: '#CCFBF1' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  inputCol: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#334155', marginBottom: 3 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 13,
  },
  filterBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resetBtn: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 38,
    gap: 6,
  },
  resetBtnText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  searchBtn: {
    flex: 2,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: 38,
    gap: 6,
  },
  searchBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  statusScrollWrapper: { paddingVertical: 10 },
  statusScroll: { paddingHorizontal: 14, gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  statusChipTextActive: { color: '#FFFFFF' },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E6FFFA',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  listTitle: { color: '#0F766E', fontWeight: '700', fontSize: 13 },
  countText: { color: '#0F766E', fontSize: 12, fontWeight: '500' },
  listContent: { padding: 14, paddingBottom: 40 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  patientDetails: { fontSize: 12, color: '#64748B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: '#475569' },

  testListSection: { marginBottom: 10 },
  testSectionLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  testsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  testChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  testChipText: { fontSize: 11, fontWeight: '600' },

  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButtonsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pdfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  pdfActionBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  paramEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  paramEditBtnText: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  balanceText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

  centre: { alignItems: 'center', paddingVertical: 50 },
  loadingText: { fontSize: 13, color: '#64748B', marginTop: 10 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, lineHeight: 18 },

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
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modalOptionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  modalOptionDesc: { fontSize: 11, color: '#64748B', marginTop: 1 },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
});
