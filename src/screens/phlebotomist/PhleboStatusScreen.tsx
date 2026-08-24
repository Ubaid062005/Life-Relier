import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, API_BASE_URL } from '../../utils/constants';

const T = {
  primary: '#0D9488', bg: '#FFFFFF', screenBg: '#F8FAFC',
  text: '#0F172A', sub: '#64748B', border: '#E2E8F0',
};

export default function PhleboStatusScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const phleboPromise = fetch(`${API_BASE_URL}/api/Phlebotomist/GetPhlebotomistList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ BranchId: 1, FromDate: today, ToDate: today }),
      }).then(r => r.json()).catch(() => []);

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

      const map = new Map<number, any>();

      // 1. First populate from GetPhlebotomistStatus (has accurate PhlebotomistBy, EnteredBy, DiffTimeMin)
      for (const r of pList) {
        const pid = Number(r.PID || r.PPID || r.RegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const item = map.get(pid)!;
          if (r.TestName && !item.test.includes(r.TestName)) {
            item.test += `, ${r.TestName}`;
          }
          if (r.EnteredBy && (!item.enterBy || item.enterBy === 'Front Desk')) {
            item.enterBy = r.EnteredBy;
          }
          if (r.PhlebotomistBy && (!item.phleboBy || item.phleboBy === 'Pending')) {
            item.phleboBy = r.PhlebotomistBy;
          }
          if (r.SampleAcceptDate) {
            item.phleboTime = new Date(r.SampleAcceptDate).toLocaleTimeString('en-IN');
          }
          if (r.DiffTimeMin != null) {
            item.diff = String(r.DiffTimeMin);
          }
        } else {
          map.set(pid, {
            id: r.RegID?.toString() || pid.toString(),
            name: r.PatientName ?? '—',
            doc: (r.RefDoctor || 'Self').trim(),
            test: r.TestName ?? '',
            enterBy: r.EnteredBy || 'Front Desk',
            regDate: r.PatRegDate ? new Date(r.PatRegDate).toLocaleString('en-IN') : '—',
            phleboBy: r.PhlebotomistBy || 'Pending',
            phleboTime: r.SampleAcceptDate ? new Date(r.SampleAcceptDate).toLocaleTimeString('en-IN') : '—',
            diff: r.DiffTimeMin != null ? String(r.DiffTimeMin) : '0',
            isEmergency: false,
          });
        }
      }

      // 2. Merge any additional patients from TestStatus
      for (const r of sList) {
        const pid = Number(r.PID || r.PatRegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const existing = map.get(pid)!;
          if (r.MainTestName && !existing.test.includes(r.MainTestName)) {
            existing.test += `, ${r.MainTestName}`;
          }
          if (r.Isemergency) existing.isEmergency = true;
          if (r.Drname && existing.doc === 'Self') existing.doc = (r.Drname || 'Self').trim();
        } else {
          map.set(pid, {
            id: r.PatRegID?.toString() || pid.toString(),
            name: r.PatientName ?? r.Patname ?? '—',
            doc: (r.Drname || r.RefDoctor || r.RefDr || r.DoctorName || r.OtherRefDoctor || 'Self').trim(),
            test: r.MainTestName ?? '',
            enterBy: r.UserId ? `User #${r.UserId}` : 'Front Desk',
            regDate: r.Patregdate ? new Date(r.Patregdate).toLocaleString('en-IN') : '—',
            phleboBy: 'Pending',
            phleboTime: r.SampleAcceptDate ? new Date(r.SampleAcceptDate).toLocaleTimeString('en-IN') : '—',
            diff: '0',
            isEmergency: r.Isemergency ?? false,
          });
        }
      }

      const list = Array.from(map.values());
      setData(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load statuses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); return () => { }; }, [load]));

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.regNo}>Reg: {item.id}</Text>
        <Text style={s.diffBadge}>{item.diff} mins</Text>
      </View>

      <View style={s.row}>
        <View style={s.avatar}><Text style={s.avatarText}>{item.name.charAt(0)}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.name}>{item.name}</Text>
            {item.isEmergency && <BlinkingEmergencyBulb size={16} />}
          </View>
          <Text style={s.subInfo}>Dr. {item.doc}</Text>
        </View>
      </View>

      <Text style={s.testName}><Text style={{ fontWeight: '700' }}>Test:</Text> {item.test}</Text>

      <View style={s.gridRow}>
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Enter By</Text>
          <Text style={s.gridValue}>{item.enterBy}</Text>
        </View>
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Reg. Date</Text>
          <Text style={s.gridValue}>{item.regDate}</Text>
        </View>
      </View>

      <View style={[s.gridRow, { borderBottomWidth: 0 }]}>
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Phlebotomist By</Text>
          <Text style={s.gridValue}>{item.phleboBy}</Text>
        </View>
        <View style={s.gridItem}>
          <Text style={s.gridLabel}>Phlebo Time</Text>
          <Text style={s.gridValue}>{item.phleboTime}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[s.root, { paddingTop: Math.max(insets.top, 0) }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 16 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.title}>Patient Status</Text>
      </View>

      <View style={s.searchContainer}>
        <Feather name="search" size={18} color={T.sub} />
        <TextInput
          style={s.searchInput}
          placeholder="Search table..."
          value={search}
          onChangeText={setSearch}
        />
        <Text style={s.recordCount}>{data.length} records</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.id.includes(search))}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.screenBg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.primary, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', margin: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: T.border, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: T.text },
  recordCount: { fontSize: 12, color: T.sub },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.border, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  regNo: { fontSize: 13, fontWeight: '700', color: T.primary },
  diffBadge: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#0369A1' },
  name: { fontSize: 16, fontWeight: '700', color: T.text },
  subInfo: { fontSize: 13, color: T.sub, marginTop: 2 },
  testName: { fontSize: 14, color: T.text, marginBottom: 12 },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.border, paddingVertical: 8 },
  gridItem: { flex: 1 },
  gridLabel: { fontSize: 11, color: T.sub, marginBottom: 2 },
  gridValue: { fontSize: 13, color: T.text, fontWeight: '500' },
});
