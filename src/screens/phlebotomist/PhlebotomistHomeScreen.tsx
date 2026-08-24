import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../utils/constants';

const T = {
  primary: '#0D9488',
  tealDark: '#0F766E',
  tealBg: '#F0FDFA',
  tealBorder: '#CCFBF1',
  bg: '#FFFFFF',
  screenBg: '#F8FAFC',
  text: '#0F172A',
  sub: '#64748B',
  muted: '#94A3B8',
  border: '#E2E8F0',
  green: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning 🌅';
  if (h >= 12 && h < 17) return 'Good Afternoon ☀️';
  if (h >= 17 && h < 21) return 'Good Evening 🌆';
  return 'Good Night 🌙';
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

interface SampleRow {
  PID: number; PatRegID: number; PatientName: string;
  Patphoneno: string; Status: string; Patregdate: string;
  BarcodeID: string; Drname: string; CenterName: string;
  IspheboAccept: number; Isemergency: boolean;
  TestCharges: number; tests: string[];
  patmstids: number[];
}

const TABS = ['Pending', 'Collected', 'All'];

export default function PhlebotomistHomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Pending');
  const [selected, setSelected] = useState<SampleRow | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch from PhlebotomistList (has Patmstid and IspheboAccept)
      const phleboPromise = fetch(`${API_BASE_URL}/api/Phlebotomist/GetPhlebotomistList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ BranchId: 1, FromDate: today, ToDate: today }),
      }).then(r => r.json()).catch(() => []);

      // 2. Fetch from TestStatus
      const statusPromise = fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BranchId: 1, FromDate: today, ToDate: today,
          PatRegID: '', PatientName: '', DoctorName: '',
          TestName: '', MobileNo: '', Barcode: '', CenterCode: '',
          SubDepartment: '', Status: 'All',
        }),
      }).then(r => r.json()).catch(() => []);

      const [phleboData, statusData] = await Promise.all([phleboPromise, statusPromise]);

      const pList: any[] = Array.isArray(phleboData) ? phleboData : (phleboData?.value ?? []);
      const sList: any[] = Array.isArray(statusData) ? statusData : (statusData?.value ?? []);

      const map = new Map<number, SampleRow>();

      // Populate from PhlebotomistList first
      for (const r of pList) {
        const pid = Number(r.PID || r.PPID || r.RegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const existing = map.get(pid)!;
          if (r.TestName && !existing.tests.includes(r.TestName)) {
            existing.tests.push(r.TestName);
          }
          if (r.Patmstid && !existing.patmstids.includes(Number(r.Patmstid))) {
            existing.patmstids.push(Number(r.Patmstid));
          }
          if (r.IspheboAccept > 0) {
            existing.IspheboAccept = r.IspheboAccept;
          }
        } else {
          map.set(pid, {
            PID: pid,
            PatRegID: Number(r.RegID || r.PPID || pid),
            PatientName: r.PatientName ?? '—',
            Patphoneno: r.PatPhoneNo ?? '—',
            Status: r.IspheboAccept > 0 ? 'Sample Collected' : 'Registered',
            Patregdate: r.PatRegDate ?? '',
            BarcodeID: r.Barcode ?? '—',
            Drname: (r.RefDoctor || r.DoctorName || 'Self').trim(),
            CenterName: r.Center ?? '—',
            IspheboAccept: r.IspheboAccept ?? 0,
            Isemergency: false,
            TestCharges: 0,
            tests: r.TestName ? [r.TestName] : [],
            patmstids: r.Patmstid ? [Number(r.Patmstid)] : [],
          });
        }
      }

      // Merge from TestStatus
      for (const r of sList) {
        const pid = Number(r.PID || r.PatRegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const existing = map.get(pid)!;
          if (r.MainTestName && !existing.tests.includes(r.MainTestName)) {
            existing.tests.push(r.MainTestName);
          }
          if (r.Isemergency) existing.Isemergency = true;
          if (r.TestCharges) existing.TestCharges = r.TestCharges;
          if (r.IspheboAccept > 0) existing.IspheboAccept = r.IspheboAccept;
          if (r.BarcodeID && existing.BarcodeID === '—') existing.BarcodeID = r.BarcodeID;
          if (r.Drname && existing.Drname === 'Self') existing.Drname = (r.Drname || 'Self').trim();
        } else {
          map.set(pid, {
            PID: pid,
            PatRegID: Number(r.PatRegID || pid),
            PatientName: r.PatientName ?? r.Patname ?? '—',
            Patphoneno: r.Patphoneno ?? '—',
            Status: r.Status ?? 'Registered',
            Patregdate: r.Patregdate ?? '',
            BarcodeID: r.BarcodeID ?? '—',
            Drname: (r.Drname || r.RefDoctor || r.RefDr || r.DoctorName || r.OtherRefDoctor || 'Self').trim(),
            CenterName: r.CenterName ?? '—',
            IspheboAccept: r.IspheboAccept ?? 0,
            Isemergency: r.Isemergency ?? false,
            TestCharges: r.TestCharges ?? 0,
            tests: r.MainTestName ? [r.MainTestName] : [],
            patmstids: [],
          });
        }
      }

      setSamples(Array.from(map.values()));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load samples.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); return () => { }; }, [load]));

  // Collect / Accept sample handler
  const handleCollectSample = async (item: SampleRow) => {
    const collectorName = (user?.name || (user as any)?.username || (user as any)?.FullName || 'Phlebotomist').trim();

    Alert.alert(
      'Collect Sample',
      `Mark sample for ${item.PatientName} as collected by ${collectorName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Collect',
          onPress: async () => {
            try {
              setLoading(true);
              const patmstidsToAccept = item.patmstids && item.patmstids.length > 0
                ? item.patmstids
                : [item.PID];

              // Call AcceptSample for each Patmstid
              for (const patmstid of patmstidsToAccept) {
                await fetch(`${API_BASE_URL}/api/Phlebotomist/AcceptSample`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify({
                    Patmstid: Number(patmstid),
                    BranchId: 1,
                    UserName: collectorName,
                    PhleboName: collectorName,
                    PhlebotomistName: collectorName,
                    PhlebotomistBy: collectorName,
                  }),
                });
              }

              Alert.alert('Success', `Sample collected successfully by ${collectorName}.`);
              load(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to collect sample');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const displayed = samples.filter(s => {
    const q = search.toLowerCase();
    const searchOk = s.PatientName.toLowerCase().includes(q) ||
      s.Patphoneno.includes(q) || s.BarcodeID.includes(q);
    const isCollected = s.IspheboAccept > 0;
    const tabOk = activeTab === 'All' ? true
      : activeTab === 'Pending' ? !isCollected
        : activeTab === 'Collected' ? isCollected
          : true;
    return searchOk && tabOk;
  });

  const pending = samples.filter(s => s.IspheboAccept === 0).length;
  const collected = samples.filter(s => s.IspheboAccept > 0).length;
  const urgent = samples.filter(s => s.Isemergency).length;

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 0) }]}>

      {/* Header band */}
      <View style={s.headerBand}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.userName}>{user?.name || 'Phlebotomist'}</Text>
          <View style={s.labRow}>
            <MaterialCommunityIcons name="check-decagram" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={s.labName}>  Sample Collection — Today</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn} onPress={() => load(true)}>
            <Feather name="refresh-cw" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { marginLeft: 8 }]} onPress={() => logout()}>
            <Feather name="log-out" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsGrid}>
        <View style={[s.statCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
          <View style={[s.statIconBox, { backgroundColor: '#FFF' }]}>
            <MaterialCommunityIcons name="flask-outline" size={22} color="#D97706" />
          </View>
          <Text style={[s.statValue, { color: '#D97706' }]}>{pending}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
          <View style={[s.statIconBox, { backgroundColor: '#FFF' }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={T.green} />
          </View>
          <Text style={[s.statValue, { color: T.green }]}>{collected}</Text>
          <Text style={s.statLabel}>Collected</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
          <View style={[s.statIconBox, { backgroundColor: '#FFF' }]}>
            <MaterialCommunityIcons name="alarm-light-outline" size={22} color={T.danger} />
          </View>
          <Text style={[s.statValue, { color: T.danger }]}>{urgent}</Text>
          <Text style={s.statLabel}>Urgent</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Feather name="search" size={15} color={T.muted} style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="Search name, barcode, mobile..."
          placeholderTextColor={T.muted} value={search} onChangeText={setSearch} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={14} color={T.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabsWrap}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.centre}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={s.centreText}>Loading samples…</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item, i) => `${item.PID}-${i}`}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[T.primary]} />}
          ListEmptyComponent={
            <View style={s.centre}>
              <MaterialCommunityIcons name="flask-empty-outline" size={52} color={T.muted} />
              <Text style={s.centreText}>No samples found for today</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          renderItem={({ item }) => {
            const isCollected = item.IspheboAccept > 0;
            return (
              <TouchableOpacity style={s.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
                {/* Top */}
                <View style={s.cardTop}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{item.PatientName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.name}>{item.PatientName}</Text>
                      {item.Isemergency && <BlinkingEmergencyBulb size={18} />}
                    </View>
                    <Text style={s.pid}>
                      PT{String(item.PatRegID).padStart(6, '0')}  •  Barcode: {item.BarcodeID}
                    </Text>
                    <View style={s.metaRow}>
                      <Feather name="phone" size={11} color={T.muted} />
                      <Text style={s.metaText}>{item.Patphoneno}</Text>
                      <Feather name="map-pin" size={11} color={T.muted} style={{ marginLeft: 8 }} />
                      <Text style={s.metaText}>{item.CenterName}</Text>
                    </View>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: isCollected ? '#ECFDF5' : '#FFFBEB' }]}>
                    <View style={[s.statusDot, { backgroundColor: isCollected ? T.green : T.warning }]} />
                    <Text style={[s.statusText, { color: isCollected ? T.green : T.warning }]}>
                      {isCollected ? 'Collected' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Tests */}
                <View style={s.testsRow}>
                  <Feather name="activity" size={12} color={T.sub} style={{ marginRight: 6 }} />
                  <Text style={s.testsText} numberOfLines={1}>{item.tests.join(' · ')}</Text>
                </View>

                {/* Actions */}
                <View style={s.actionsRow}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => setSelected(item)}>
                    <Feather name="file-text" size={14} color={T.primary} />
                    <Text style={s.actionText}>View Details</Text>
                  </TouchableOpacity>
                  <View style={s.actionDivider} />
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => {
                      if (isCollected) {
                        Alert.alert('Already Collected', `Sample for ${item.PatientName} has already been collected.`);
                      } else {
                        handleCollectSample(item);
                      }
                    }}>
                    <Feather name={isCollected ? 'check-circle' : 'droplet'} size={14} color={isCollected ? T.green : T.primary} />
                    <Text style={[s.actionText, isCollected && { color: T.green }]}>
                      {isCollected ? 'Collected' : 'Collect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail Sheet */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={s.drag} />
            <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
              <Feather name="x" size={22} color={T.sub} />
            </TouchableOpacity>
            {selected && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={[s.avatar, { width: 50, height: 50, borderRadius: 25 }]}>
                    <Text style={[s.avatarText, { fontSize: 20 }]}>{selected.PatientName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: T.text }}>{selected.PatientName}</Text>
                      {selected.Isemergency && <BlinkingEmergencyBulb size={18} />}
                    </View>
                    <Text style={{ fontSize: 12, color: T.primary, fontWeight: '600', marginTop: 2 }}>
                      PT{String(selected.PatRegID).padStart(6, '0')}
                    </Text>
                  </View>
                </View>
                {[
                  ['Barcode', selected.BarcodeID],
                  ['Doctor', ((selected.Drname && selected.Drname !== '—' ? selected.Drname : 'Self') ?? 'Self').trim()],
                  ['Center', selected.CenterName],
                  ['Mobile', selected.Patphoneno],
                  ['Reg Date', fmtDate(selected.Patregdate)],
                  ['Tests', selected.tests.join(', ')],
                  ['Charges', `₹${(selected.TestCharges ?? 0).toFixed(0)}`],
                ].map(([label, value]) => (
                  <View key={label} style={s.detailRow}>
                    <Text style={s.detailLabel}>{label}</Text>
                    <Text style={s.detailValue}>{value}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={[s.collectBtn, selected.IspheboAccept === 2 && { backgroundColor: '#64748B' }]}
                  onPress={() => {
                    Alert.alert(
                      selected.IspheboAccept === 2 ? 'Already Collected' : 'Mark as Collected',
                      selected.IspheboAccept === 2 ? 'Already marked.' : `Mark for ${selected.PatientName}?`,
                      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => setSelected(null) }]
                    );
                  }}
                >
                  <Feather name={selected.IspheboAccept === 2 ? 'check-circle' : 'droplet'} size={16} color="#FFF" />
                  <Text style={s.collectBtnText}>
                    {selected.IspheboAccept === 2 ? 'Already Collected' : 'Mark Collected'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.screenBg },

  // Header
  headerBand: { backgroundColor: T.primary, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  greeting: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  userName: { fontSize: 20, fontWeight: '800', color: '#FFF', marginTop: 2 },
  labRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  labName: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  statIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: T.sub, fontWeight: '500', marginTop: 2 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 13, color: T.text },

  // Tabs
  tabsWrap: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg },
  tabBtnActive: { backgroundColor: T.primary, borderColor: T.primary },
  tabText: { fontSize: 13, color: T.sub, fontWeight: '500' },
  tabTextActive: { color: '#FFF', fontWeight: '700' },

  // List
  list: { paddingHorizontal: 16 },
  centre: { alignItems: 'center', paddingTop: 60 },
  centreText: { fontSize: 14, color: T.sub, marginTop: 10 },

  // Card
  card: { backgroundColor: T.bg, borderRadius: 14, borderWidth: 1, borderColor: T.border, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.tealBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '800', color: T.tealDark },
  name: { fontSize: 14, fontWeight: '700', color: T.text, marginBottom: 2 },
  pid: { fontSize: 11.5, color: T.sub, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, color: T.muted, marginLeft: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  urgentBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  urgentText: { fontSize: 9, fontWeight: '800', color: T.danger },
  testsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  testsText: { flex: 1, fontSize: 12, color: T.sub },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  actionText: { fontSize: 12, fontWeight: '600', color: T.primary },
  actionDivider: { width: 1, height: 18, backgroundColor: T.border },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '88%' },
  drag: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  closeBtn: { position: 'absolute', top: 18, right: 18, zIndex: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  detailLabel: { width: 76, fontSize: 12, color: T.sub, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 13, color: T.text, fontWeight: '600' },
  collectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, marginTop: 18, gap: 8 },
  collectBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
