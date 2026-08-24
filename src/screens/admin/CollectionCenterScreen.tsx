import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../utils/constants';
import { getCenters, CenterItem } from '../../services/testChargesService';

export default function CollectionCenterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const [centers, setCenters]     = useState<CenterItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [error, setError]         = useState<string | null>(null);

  const fetchCenters = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getCenters(1);
      setCenters(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load collection centers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCenters(); }, [fetchCenters]));

  const filtered = centers.filter(c =>
    c.CenterName.toLowerCase().includes(search.toLowerCase()) ||
    String(c.CenterCode).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[st.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Collection Centers</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Breadcrumb */}
      <View style={st.breadcrumb}>
        <MaterialCommunityIcons name="map-marker-outline" size={13} color={COLORS.primary} />
        <Text style={st.bcText}> Laboratory</Text>
        <Feather name="chevron-right" size={12} color="#94A3B8" style={{ marginHorizontal: 2 }} />
        <Text style={[st.bcText, { color: COLORS.primary, fontWeight: '700' }]}>Collection Centers</Text>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={st.searchInput}
          placeholder="Search by name or code..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={15} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={st.centre}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={st.centreText}>Loading centers…</Text>
        </View>
      )}

      {/* Error */}
      {!loading && error && (
        <View style={st.centre}>
          <MaterialCommunityIcons name="cloud-off-outline" size={52} color="#CBD5E1" />
          <Text style={st.emptyTitle}>Could not load data</Text>
          <Text style={st.emptySub}>{error}</Text>
          <TouchableOpacity style={st.retryBtn} onPress={() => fetchCenters()}>
            <Feather name="refresh-cw" size={14} color={COLORS.primary} />
            <Text style={st.retryText}> Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {!loading && !error && (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCenters(true)}
              colors={[COLORS.primary]}
            />
          }
        >
          {/* Summary badge */}
          <View style={st.badgeRow}>
            <View style={st.badge}>
              <Text style={st.badgeTxt}>{centers.length} center{centers.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {filtered.length === 0 ? (
            <View style={st.centre}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={52} color="#CBD5E1" />
              <Text style={st.emptyTitle}>
                {search ? 'No matches found' : 'No collection centers available'}
              </Text>
            </View>
          ) : (
            filtered.map((item, idx) => (
              <View key={`center-${item.CenterCode || ''}-${idx}`} style={st.card}>
                <View style={st.cardIcon}>
                  <MaterialCommunityIcons name="map-marker" size={22} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.centerName}>{item.CenterName}</Text>
                  <Text style={st.centerCode}>Code: {item.CenterCode}</Text>
                </View>
                <View style={st.activeBadge}>
                  <View style={st.activeDot} />
                  <Text style={st.activeText}>Active</Text>
                </View>
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={st.footer}>
        <Text style={st.footerTxt}>© 2026 - Life Relier Infosoft Pvt Ltd</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.surfaceVariant },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  breadcrumb:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F4', paddingHorizontal: 16, paddingVertical: 8 },
  bcText:      { fontSize: 12, color: COLORS.textSecondary },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  centre:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  centreText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:   { flexDirection: 'row', alignItems: 'center', marginTop: 16, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  retryText:  { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  scroll:    { paddingHorizontal: 16 },
  badgeRow:  { marginBottom: 12 },
  badge:     { backgroundColor: '#F0FDFA', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTxt:  { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 10, elevation: 1, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardIcon:   { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  centerName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  centerCode: { fontSize: 12, color: COLORS.textSecondary },
  activeBadge:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  activeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
  activeText: { fontSize: 11, fontWeight: '600', color: '#10B981' },

  footer:    { backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' },
  footerTxt: { fontSize: 12, color: '#FFF', fontWeight: '500' },
});
