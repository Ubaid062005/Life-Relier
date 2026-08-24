import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, API_BASE_URL } from '../../utils/constants';

const T = {
  primary: '#0D9488', bg: '#FFFFFF', screenBg: '#F8FAFC',
  text: '#0F172A', sub: '#64748B', border: '#E2E8F0',
  success: '#10B981', danger: '#EF4444'
};

export default function PhleboSampleCollectionScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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

      for (const r of pList) {
        const pid = Number(r.PID || r.PPID || r.RegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const existing = map.get(pid)!;
          if (r.TestName && !existing.test.includes(r.TestName)) {
            existing.test += `, ${r.TestName}`;
          }
          if (r.Patmstid && !existing.patmstids.includes(Number(r.Patmstid))) {
            existing.patmstids.push(Number(r.Patmstid));
          }
          if (r.IspheboAccept > 0) existing.isPhleboAccept = r.IspheboAccept;
        } else {
          map.set(pid, {
            PID: pid,
            id: r.RegID?.toString() || r.PPID?.toString() || pid.toString(),
            name: r.PatientName ?? '—',
            gender: r.Gender ?? 'Unknown',
            age: r.Age ?? '—',
            center: r.Center ?? '—',
            doc: (r.RefDoctor || r.DoctorName || 'Self').trim(),
            test: r.TestName ?? '',
            type: r.SampleType || 'Whole Blood',
            barcode: r.Barcode ?? '',
            isPhleboAccept: r.IspheboAccept ?? 0,
            isEmergency: false,
            patmstids: r.Patmstid ? [Number(r.Patmstid)] : [],
          });
        }
      }

      for (const r of sList) {
        const pid = Number(r.PID || r.PatRegID);
        if (!pid) continue;

        if (map.has(pid)) {
          const existing = map.get(pid)!;
          if (r.Isemergency) existing.isEmergency = true;
          if (r.IspheboAccept > 0) existing.isPhleboAccept = r.IspheboAccept;
        }
      }

      // Filter for those waiting for sample collection (e.g. isPhleboAccept === 0)
      const list = Array.from(map.values()).filter(x => x.isPhleboAccept === 0);
      setData(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load samples.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); return () => { }; }, [load]));

  const handleAccept = async (item: any) => {
    const collectorName = (user?.name || (user as any)?.username || (user as any)?.FullName || 'Phlebotomist').trim();
    try {
      setLoading(true);
      const patmstidsToAccept = item.patmstids && item.patmstids.length > 0
        ? item.patmstids
        : [item.PID || item.id];

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
      Alert.alert('Success', `Sample accepted by ${collectorName}`);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to accept sample');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.regNo}>Reg: {item.id}</Text>
        <Text style={s.center}>{item.center}</Text>
      </View>
      <View style={s.row}>
        <View style={s.avatar}><Text style={s.avatarText}>{item.name.charAt(0)}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.name}>{item.name}</Text>
            {item.isEmergency && <BlinkingEmergencyBulb size={16} />}
          </View>
          <Text style={s.subInfo}>{item.gender}, {item.age} • Dr. {item.doc}</Text>
        </View>
      </View>
      <Text style={s.testName}><Text style={{ fontWeight: '700' }}>Test:</Text> {item.test}</Text>
      <Text style={s.sampleType}><Text style={{ fontWeight: '700' }}>Sample:</Text> {item.type || 'N/A'}</Text>

      <View style={s.actionRow}>
        <View style={s.barcodeBox}>
          <Text style={s.barcodeText}>{item.barcode || 'Enter Barcode'}</Text>
        </View>
        <TouchableOpacity style={s.saveBtn}><Feather name="save" size={16} color="#FFF" /></TouchableOpacity>
      </View>

      <View style={s.footerActions}>
        <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(item)}>
          <Feather name="check" size={16} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={s.acceptText}>Accept</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.printBtn}><Feather name="printer" size={16} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity style={s.printAllBtn}><Feather name="printer" size={16} color="#FFF" /></TouchableOpacity>
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
        <Text style={s.title}>Phlebotomist List</Text>
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
          data={data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.barcode.includes(search))}
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
  center: { fontSize: 12, color: T.sub, backgroundColor: T.screenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#0369A1' },
  name: { fontSize: 16, fontWeight: '700', color: T.text },
  subInfo: { fontSize: 13, color: T.sub, marginTop: 2 },
  testName: { fontSize: 14, color: T.text, marginBottom: 4 },
  sampleType: { fontSize: 14, color: T.text, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  barcodeBox: { flex: 1, height: 40, borderWidth: 1, borderColor: T.border, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#F8FAFC' },
  barcodeText: { fontSize: 14, color: T.sub },
  saveBtn: { width: 40, height: 40, backgroundColor: '#15803D', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  footerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 16, height: 36, borderRadius: 18 },
  acceptText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  printBtn: { width: 36, height: 36, backgroundColor: '#64748B', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  printAllBtn: { width: 36, height: 36, backgroundColor: '#EF4444', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
