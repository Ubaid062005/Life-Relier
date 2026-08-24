import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../utils/constants';
import {
  getAllDoctorSchedules,
  DoctorScheduleRecord,
} from '../../services/doctorScheduleService';

/** Convert ISO date string → "DD-MM-YYYY" for display — regex avoids timezone shifts */
function fmtDate(iso: string): string {
  if (!iso) return '—';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return iso;
}

/** Convert "HH:MM:SS" → "HH:MM AM/PM" */
function fmtTime(t: string | null): string {
  if (!t) return '—';
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${String(h % 12 || 12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
  } catch { return t; }
}

export default function DoctorAppointmentScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [schedules, setSchedules] = useState<DoctorScheduleRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from all branches — website saves BranchId 1, app saves BranchId 4
      const [b1, b4] = await Promise.all([
        getAllDoctorSchedules(1).catch(() => [] as DoctorScheduleRecord[]),
        getAllDoctorSchedules(4).catch(() => [] as DoctorScheduleRecord[]),
      ]);
      // Deduplicate by ScheduleId
      const seen = new Set<number>();
      const merged = [...b1, ...b4].filter(sc => {
        const id = sc.ScheduleId ?? (sc as any).scheduleId;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setSchedules(merged);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load schedules.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever this screen comes into focus (e.g. after saving a new schedule)
  useFocusEffect(
    useCallback(() => { fetchSchedules(); }, [fetchSchedules]),
  );

  // ── Search filter ─────────────────────────────────────────────────────────
  const filtered = schedules.filter(s => {
    const q = search.toLowerCase();
    return (
      String(s.DoctorName ?? s.DrId ?? '').toLowerCase().includes(q) ||
      String(s.StartDate  ?? '').toLowerCase().includes(q)
    );
  });

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: DoctorScheduleRecord }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowAvatar}>
          <MaterialCommunityIcons name="doctor" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowDoctor}>
            {item.DoctorName ?? `Doctor ID: ${item.DrId}`}
          </Text>
          <Text style={styles.rowTime}>
            {fmtTime(item.StartTime)}  –  {fmtTime(item.EndTime)}
          </Text>
          <Text style={styles.rowDate}>
            {fmtDate(item.StartDate)}  →  {fmtDate(item.EndDate)}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={[
          styles.statusPill,
          { backgroundColor: item.IsActive ? '#F0FDFA' : '#F1F5F9' },
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: item.IsActive ? '#10B981' : '#94A3B8' },
          ]} />
          <Text style={[
            styles.statusText,
            { color: item.IsActive ? '#10B981' : '#94A3B8' },
          ]}>
            {item.IsActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.editBtnMini}
          onPress={() => navigation.navigate('AddDoctorSchedule', { schedule: item })}
        >
          <Feather name="edit-2" size={10} color={COLORS.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 10) }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Schedule</Text>
        <TouchableOpacity>
          <Feather name="filter" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Feather name="home" size={13} color={COLORS.primary} />
        <Text style={styles.bcText}> Master</Text>
        <Feather name="chevron-right" size={13} color="#94A3B8" style={{ marginHorizontal: 2 }} />
        <Text style={[styles.bcText, { color: COLORS.primary, fontWeight: '700' }]}>Doctor Schedule</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="calendar-month" size={20} color="#FFF" />
            <Text style={styles.cardTitle}> Doctor Schedule Records</Text>
            <View style={styles.recordBadge}>
              <Text style={styles.recordBadgeText}>{schedules.length} records</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.refreshBtn, loading && { opacity: 0.6 }]}
              onPress={fetchSchedules}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size={12} color="#FFF" />
                : <Feather name="refresh-cw" size={14} color="#FFF" />}
              <Text style={styles.btnText}> Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddDoctorSchedule')}
            >
              <Feather name="plus" size={14} color="#FFF" />
              <Text style={styles.btnText}> Add Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor or date..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Body states ── */}
        {loading && schedules.length === 0 ? (
          <View style={styles.centreBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.centreText}>Loading schedules…</Text>
          </View>

        ) : error && schedules.length === 0 ? (
          <View style={styles.centreBox}>
            <MaterialCommunityIcons name="cloud-off-outline" size={62} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Could not load data</Text>
            <Text style={styles.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchSchedules}>
              <Feather name="refresh-cw" size={14} color={COLORS.primary} />
              <Text style={styles.retryText}> Retry</Text>
            </TouchableOpacity>
          </View>

        ) : filtered.length === 0 ? (
          <View style={styles.centreBox}>
            <MaterialCommunityIcons name="calendar-blank" size={70} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No data available</Text>
            <Text style={styles.emptySubtitle}>
              {search.length > 0
                ? 'No schedules match your search.'
                : 'There are no doctor schedules to display.'}
            </Text>
          </View>

        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => `doc-appt-${item.ScheduleId || ''}-${idx}`}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },

  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5F4', paddingHorizontal: 16, paddingVertical: 8,
  },
  bcText: { fontSize: 12, color: COLORS.textSecondary },

  card: {
    margin: 16, backgroundColor: COLORS.card,
    borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    flex: 1,
  },
  cardHeader: { backgroundColor: COLORS.primary, padding: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginRight: 8 },
  recordBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  recordBadgeText: { fontSize: 11, color: '#FFF', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#15803D',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 14, backgroundColor: COLORS.background,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  centreBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  centreText: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  rowAvatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F0FDFA',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowDoctor: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  rowTime:   { fontSize: 11, color: COLORS.textSecondary },
  rowDate:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: '700' },

  editBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },

  scanFab: {
    position: 'absolute', bottom: 50, right: 20,
    backgroundColor: COLORS.primary, width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  scanLabel: { fontSize: 9, color: '#FFF', fontWeight: '700', marginTop: 2 },

  footer: { backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#FFF', fontWeight: '500' },
});
