import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL , COLORS} from '../../utils/constants';

const THEME = {
  primary: '#0F766E', bg: '#FFFFFF', screenBg: '#FAFAFA',
  textPrimary: '#0F172A', textSecondary: '#64748B', border: '#E2E8F0',
  warning: '#F59E0B', warningBg: '#FFFBEB',
};

const TABS = ['All', 'Registered', 'Sample Collected', 'Processing', 'Report Ready'];

interface TestRow {
  PID: number; PatRegID: number; PatientName: string;
  BarcodeID: string; MainTestName: string; Status: string;
  Patphoneno: string; Patregdate: string; Drname: string;
  TestCharges: number; PaidAmount: number; Isemergency: boolean;
  tests: string[];
}

async function fetchTestStatus(status: string): Promise<TestRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      BranchId: 1, FromDate: '2024-01-01', ToDate: today,
      PatRegID: '', PatientName: '', DoctorName: '', TestName: '',
      MobileNo: '', Barcode: '', CenterCode: '', SubDepartment: '',
      Status: status === 'All' ? 'All' : status,
    }),
  });
  const data = await res.json();
  const rows: any[] = Array.isArray(data) ? data : (data?.value ?? []);
  const map = new Map<number, TestRow>();
  for (const r of rows) {
    if (map.has(r.PID)) {
      map.get(r.PID)!.tests.push(r.MainTestName);
    } else {
      map.set(r.PID, { ...r, Drname: (r.Drname || r.RefDoctor || r.RefDr || r.DoctorName || r.OtherRefDoctor || 'Self').trim(), tests: [r.MainTestName] });
    }
  }
  return Array.from(map.values());
}

export default function ReportsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('All');
  const [records,   setRecords]   = useState<TestRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search,    setSearch]    = useState('');

  const load = useCallback(async (tab = activeTab, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try { setRecords(await fetchTestStatus(tab)); }
    catch (e: any) { Alert.alert('Error', e.message || 'Failed to load.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return r.PatientName.toLowerCase().includes(q) ||
           String(r.PatRegID).includes(q) ||
           r.BarcodeID.includes(q);
  });

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Result Entry</Text>
        <TouchableOpacity onPress={() => load(activeTab, true)}>
          <Feather name="refresh-cw" size={20} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={THEME.textSecondary} style={styles.searchIcon} />
        <TextInput style={styles.searchInput} placeholder="Search by Patient, Barcode or ID"
          value={search} onChangeText={setSearch} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={16} color={THEME.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center', flexGrow: 1 }}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => { setActiveTab(tab); load(tab); }}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.centreText}>Loading…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(activeTab, true)} colors={[THEME.primary]} />}>

          {/* Summary */}
          <View style={styles.summaryGrid}>
            <SummaryCard label="Total" value={records.length} color={THEME.primary} bg="#F0FDFA" />
            <SummaryCard label="Urgent" value={records.filter(r => r.Isemergency).length} color="#EF4444" bg="#FEF2F2" />
            <SummaryCard label="Report Ready" value={records.filter(r => r.Status === 'Report Ready').length} color="#10B981" bg="#ECFDF5" />
          </View>

          {filtered.length === 0 ? (
            <View style={styles.centre}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#CBD5E1" />
              <Text style={styles.centreText}>No records found</Text>
            </View>
          ) : (
            filtered.map((item, idx) => (
              <View key={`${item.PID}-${idx}`} style={styles.patientCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>{item.PatientName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.patientName}>{item.PatientName}</Text>
                      {item.Isemergency && <BlinkingEmergencyBulb size={18} />}
                    </View>
                    <Text style={styles.patientId}>
                      PT{String(item.PatRegID).padStart(6,'0')}  •  Barcode: {item.BarcodeID}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: item.Status === 'Report Ready' ? '#ECFDF5' : THEME.warningBg }]}>
                    <View style={[styles.statusDot, { backgroundColor: item.Status === 'Report Ready' ? '#10B981' : THEME.warning }]} />
                    <Text style={[styles.statusText, { color: item.Status === 'Report Ready' ? '#10B981' : THEME.warning }]}>
                      {item.Status}
                    </Text>
                  </View>
                </View>
                <View style={styles.testsRow}>
                  <Text style={styles.testsLabel}>Tests: </Text>
                  <Text style={styles.testsValue} numberOfLines={1}>{item.tests.join(' · ')}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="user-check" size={12} color={THEME.textSecondary} />
                    <Text style={styles.metaText}>{item.Drname && item.Drname !== '—' ? item.Drname.trim() : 'Self'}</Text>
                    <Text style={[styles.metaText, { marginLeft: 10, color: THEME.primary, fontWeight: '700' }]}>
                      ₹{(item.PaidAmount ?? 0).toFixed(0)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.enterBtn}
                    onPress={() => {
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
                      });
                    }}
                  >
                    <Text style={styles.enterBtnText}>Enter Results</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({ label, value, color, bg }: any) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bg }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: THEME.screenBg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  backBtn:     { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: THEME.textPrimary },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.bg, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: THEME.border, marginBottom: 8 },
  searchIcon:  { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.textPrimary },
  tabsScroll:  { marginBottom: 0 },
  tabBtn:      { height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: THEME.border, marginRight: 10, backgroundColor: THEME.bg, justifyContent: 'center' },
  tabBtnActive:{ backgroundColor: THEME.primary, borderColor: THEME.primary },
  tabText:     { fontSize: 13, color: THEME.textSecondary, fontWeight: '500' },
  tabTextActive:{ color: '#FFF', fontWeight: '600' },
  scrollContent:{ paddingHorizontal: 20, paddingTop: 8 },
  summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  summaryValue:{ fontSize: 20, fontWeight: '800' },
  summaryLabel:{ fontSize: 10, fontWeight: '600', marginTop: 2 },
  centre:      { alignItems: 'center', paddingVertical: 40 },
  centreText:  { fontSize: 14, color: THEME.textSecondary, marginTop: 10 },
  patientCard: { backgroundColor: THEME.bg, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, marginBottom: 14, padding: 14, elevation: 1, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarBox:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText:  { fontSize: 16, fontWeight: '700', color: THEME.primary },
  patientName: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary, marginBottom: 2 },
  patientId:   { fontSize: 11, color: THEME.textSecondary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusDot:   { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText:  { fontSize: 9, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  urgentText:  { fontSize: 9, fontWeight: '800', color: '#EF4444' },
  testsRow:    { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginBottom: 10 },
  testsLabel:  { fontSize: 12, color: THEME.textSecondary, fontWeight: '500' },
  testsValue:  { flex: 1, fontSize: 12, color: THEME.textSecondary },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText:    { fontSize: 11, color: THEME.textSecondary, marginLeft: 4 },
  enterBtn:    { backgroundColor: THEME.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  enterBtnText:{ color: '#FFF', fontSize: 12, fontWeight: '600' },
});
