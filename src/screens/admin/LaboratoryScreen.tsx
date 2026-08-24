import React, { useState, useCallback } from 'react';
import { COLORS } from '../../utils/constants';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../utils/constants';

// Workflow cards — stat values injected at runtime
const WORKFLOW_META = [
  {
    title:  'Sample Collection',
    sub:    'Collect patient samples in the lab or at home',
    icon:   'eyedropper-variant',
    color:  '#0369A1',
    bg:     '#F0F9FF',
    border: '#BAE6FD',
    screen: 'SampleCollection',
    statLabel: 'Pending',
    statKey:   'samplePending',
  },
  {
    title:  'Result Entry',
    sub:    'Enter test results for collected samples',
    icon:   'clipboard-edit-outline',
    color:  '#C2410C',
    bg:     '#FFF7ED',
    border: '#FED7AA',
    screen: 'ResultEntry',
    statLabel: 'Pending',
    statKey:   'processing',
  },
  {
    title:  'Pending Reports',
    sub:    'Review entered results before approval',
    icon:   'file-clock-outline',
    color:  '#DC2626',
    bg:     '#FEF2F2',
    border: '#FEE2E2',
    screen: 'PendingReports',
    statLabel: 'Pending',
    statKey:   'pendingReports',
  },
  {
    title:  'Report Approval',
    sub:    'Pathologist approval before releasing reports',
    icon:   'check-decagram-outline',
    color:  '#0F766E',
    bg:     '#F0FDFA',
    border: '#CCFBF1',
    screen: 'ReportApproval',
    statLabel: 'To Review',
    statKey:   'reportReady',
  },
];

interface LabStats {
  samplesToday:    number;
  critical:        number;
  samplePending:   number;  // IspheboAccept === 0 (not yet collected)
  sampleCollected: number;  // IspheboAccept === 1 (collected, awaiting accession)
  processing:      number;  // Status === 'Processing'
  pendingReports:  number;  // Status === 'Registered' (all time)
  reportReady:     number;  // Status === 'Report Ready'
}

export default function LaboratoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const T = { primary: COLORS.primary, bg: COLORS.background, card: COLORS.card, text: COLORS.textPrimary, sub: COLORS.textSecondary, muted: COLORS.textMuted, border: COLORS.cardBorder };

  const [stats,   setStats]   = useState<LabStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // ── Today's samples (all statuses) — same as SamplesScreen ──────────
      const todayRes = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BranchId: 1, FromDate: today, ToDate: today,
          PatRegID: '', PatientName: '', DoctorName: '', TestName: '',
          MobileNo: '', Barcode: '', CenterCode: '', SubDepartment: '', Status: 'All',
        }),
      });
      const todayData = await todayRes.json();
      const todayRows: any[] = Array.isArray(todayData) ? todayData : (todayData?.value ?? []);

      // Group by PID — same as SamplesScreen
      const pidMap = new Map<number, any>();
      for (const r of todayRows) { if (!pidMap.has(r.PID)) pidMap.set(r.PID, r); }
      const uniqueToday = Array.from(pidMap.values());

      const samplesToday    = uniqueToday.length;
      const critical        = uniqueToday.filter(r => r.Isemergency).length;
      const samplePending   = uniqueToday.filter(r => r.IspheboAccept === 0).length;
      const sampleCollected = uniqueToday.filter(r => r.IspheboAccept === 1).length;
      const processing      = uniqueToday.filter(r => r.Status === 'Processing').length;
      const reportReady     = uniqueToday.filter(r => r.Status === 'Report Ready' || r.Status === 'Authorized').length;

      // ── Pending reports (all time) — same as PendingReportsScreen ────────
      const prRes = await fetch(`${API_BASE_URL}/api/TestStatus/GetPatientTestStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BranchId: 1, FromDate: '2024-01-01', ToDate: today,
          PatRegID: '', PatientName: '', DoctorName: '', TestName: '',
          MobileNo: '', Barcode: '', CenterCode: '', SubDepartment: '', Status: 'Registered',
        }),
      });
      const prData = await prRes.json();
      const prRows: any[] = Array.isArray(prData) ? prData : (prData?.value ?? []);
      const prMap = new Map<number, any>();
      for (const r of prRows) { if (!prMap.has(r.PID)) prMap.set(r.PID, r); }
      const pendingReports = Array.from(prMap.values()).filter(r => r.Status === 'Registered').length;

      setStats({ samplesToday, critical, samplePending, sampleCollected, processing, pendingReports, reportReady });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));

  const statVal = (key: keyof LabStats) =>
    loading ? '…' : stats ? String(stats[key]) : '—';

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 0) }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Laboratory</Text>
          <Text style={styles.headerSub}>Sample-to-report workflow</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => fetchStats()}>
          <Feather name="refresh-cw" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Summary Strip ── */}
      <View style={styles.summaryStrip}>
        <SummaryPill
          value={loading ? '…' : stats ? String(stats.samplesToday) : '—'}
          label="Samples Today" color="#0369A1" bg="#EFF6FF"
        />
        <SummaryPill
          value={loading ? '…' : stats ? String(stats.processing) : '—'}
          label="Pending Results" color="#C2410C" bg="#FFF7ED"
        />
        <SummaryPill
          value={loading ? '…' : stats ? String(stats.critical) : '—'}
          label="Critical" color="#DC2626" bg="#FEF2F2"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Workflow label ── */}
        <Text style={styles.workflowLabel}>Lab Workflow</Text>

        {WORKFLOW_META.map((w) => (
          <TouchableOpacity
            key={w.title}
            style={[styles.workCard, { borderColor: w.border, borderLeftColor: w.color }]}
            onPress={() => navigation.navigate(w.screen)}
            activeOpacity={0.75}
          >
            {/* Icon */}
            <View style={[styles.workIconBox, { backgroundColor: w.bg }]}>
              <MaterialCommunityIcons name={w.icon as any} size={26} color={w.color} />
            </View>

            {/* Text */}
            <View style={styles.workText}>
              <Text style={styles.workTitle}>{w.title}</Text>
              <Text style={styles.workSub}>{w.sub}</Text>
            </View>

            {/* Stat chip */}
            <View style={styles.workRight}>
              <View style={[styles.statChip, { backgroundColor: w.bg }]}>
                {loading
                  ? <ActivityIndicator size="small" color={w.color} />
                  : <Text style={[styles.statChipValue, { color: w.color }]}>
                      {stats ? String(stats[w.statKey as keyof LabStats]) : '—'}
                    </Text>
                }
                <Text style={[styles.statChipLabel, { color: w.color }]}>{w.statLabel}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textMuted} style={{ marginTop: 6 }} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

function SummaryPill({ value, label, color, bg }: any) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  notifBtn: { position: 'relative', padding: 6 },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: COLORS.card },
  summaryStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  pill: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  pillValue: { fontSize: 20, fontWeight: '900' },
  pillLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  scroll: { padding: 16 },
  workflowLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  workCard: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12, elevation: 1, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, position: 'relative', overflow: 'visible' },
  workIconBox: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  workText: { flex: 1 },
  workTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  workSub:   { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  workRight: { alignItems: 'flex-end', marginLeft: 8 },
  statChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 52 },
  statChipValue: { fontSize: 18, fontWeight: '900' },
  statChipLabel: { fontSize: 9, fontWeight: '700', marginTop: 1 },
});
