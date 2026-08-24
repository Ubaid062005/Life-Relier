import React, { useState, useEffect, useCallback } from 'react';
import { COLORS } from '../../utils/constants';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { getPackages } from '../../services/testChargesService';
import { Package } from '../../utils/types';

const T = {
  primary:   '#0D9488',
  bg:        '#F8FAFC',
  card:      '#FFFFFF',
  text:      '#0F172A',
  sub:       '#64748B',
  muted:     '#94A3B8',
  border:    '#E2E8F0',
  tealBg:    '#F0FDFA',
  tealBorder:'#CCFBF1',
};

export default function PackagesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [packages, setPackages]   = useState<Package[]>([]);
  const [filtered, setFiltered]   = useState<Package[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchPackages = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getPackages(1);
      const list = Array.isArray(data) ? data : [];
      setPackages(list);
      setFiltered(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load packages. Please try again.');
      setPackages([]);
      setFiltered([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Live search filter
  useEffect(() => {
    const list = Array.isArray(packages) ? packages : [];
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(list);
    } else {
      setFiltered(
        list.filter(
          p =>
            p?.PackageName?.toLowerCase().includes(q) ||
            String(p?.PackageId || '').includes(q)
        )
      );
    }
  }, [search, packages]);

  // ── Render each package row ──────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: Package; index: number }) => (
    <View style={styles.row}>
      {/* ID badge */}
      <View style={styles.idBadge}>
        <Text style={styles.idText}>{item.PackageId}</Text>
      </View>

      {/* Name */}
      <View style={styles.rowContent}>
        <Text style={styles.packageName}>{item.PackageName}</Text>
        <Text style={styles.packageSub}>Package ID: {item.PackageId}</Text>
      </View>

      {/* Icon */}
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name="package-variant-closed" size={20} color={COLORS.primary} />
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 0) }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Packages</Text>
          <Text style={styles.headerSub}>
            {packages.length > 0 ? `${packages.length} packages loaded` : 'Health test packages'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchPackages(true)}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or ID..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Feather name="x" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Loading ── */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={52} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPackages()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ── */}
      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.PackageId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPackages(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="package-variant-closed-remove" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                {search ? 'No packages match your search.' : 'No packages found.'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
    gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn:  { padding: 6 },

  // Search
  searchWrapper: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 12, height: 44, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  // States
  centerBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  errorText:   { fontSize: 14, color: '#EF4444', textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // List
  list: { padding: 16, paddingBottom: 100 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.primaryLight,
    padding: 14, gap: 14,
  },
  idBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  idText:      { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  rowContent:  { flex: 1 },
  packageName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  packageSub:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowIcon:     { padding: 4 },

  separator: { height: 10 },

  // Empty
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
