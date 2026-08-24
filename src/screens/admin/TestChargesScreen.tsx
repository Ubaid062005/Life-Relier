import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../utils/constants';
import {
  getAllTestCharges, saveTestCharge, updateTestCharge, deleteTestCharge,
  getAllSubDepts, getAllRateTypes, getPackages, getTestNames,
  TestChargeRecord, SaveTestChargePayload, UpdateTestChargePayload,
  SubDeptItem, RateTypeItem, PackageItem, TestNameItem,
} from '../../services/testChargesService';
import { useAuth } from '../../context/AuthContext';
const TEST_TYPES = [{ id: 'T', label: 'Test' }, { id: 'P', label: 'Profile' }];

// ─── Inline dropdown ──────────────────────────────────────────────────────────
function DD({ label, required, value, options, onSelect, placeholder = 'Select...' }: any) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={st.label}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text> : null}
      <TouchableOpacity style={st.dd} onPress={() => setOpen(!open)}>
        <Text style={[st.ddText, !value && { color: COLORS.textMuted }]}>{value || placeholder}</Text>
        <Feather name="chevron-down" size={16} color="#64748B" />
      </TouchableOpacity>
      {open && (
        <View style={st.ddMenu}>
          {options.map((o: any, idx: number) => (
            <TouchableOpacity key={`opt-${o.id ?? ''}-${o.label ?? ''}-${idx}`} style={st.ddItem} onPress={() => { onSelect(o); setOpen(false); }}>
              <Text style={st.ddItemText}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, required, children }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={st.label}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text>
      {children}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TestChargesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── Dropdown data ──
  const [rateTypes, setRateTypes]   = useState<RateTypeItem[]>([]);
  const [subDepts, setSubDepts]     = useState<SubDeptItem[]>([]);
  const [packages, setPackages]     = useState<PackageItem[]>([]);
  const [testNames, setTestNames]   = useState<TestNameItem[]>([]);

  // ── Filter state (mirrors website) ──
  const [filterRateTypeId, setFilterRateTypeId]     = useState<number | null>(1);
  const [filterRateTypeName, setFilterRateTypeName] = useState('MRP1');
  const [filterSubDeptId, setFilterSubDeptId]       = useState<number | null>(null);
  const [filterSubDeptName, setFilterSubDeptName]   = useState('');
  const [filterMainTestId, setFilterMainTestId]     = useState<number | null>(null);
  const [filterMainTestName, setFilterMainTestName] = useState('');

  // ── List state ──
  const [records, setRecords]   = useState<TestChargeRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  // ── Modal state ──
  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState<TestChargeRecord | null>(null);
  const [saving, setSaving]         = useState(false);

  // ── Form fields ──
  const [testType, setTestType]           = useState('T');
  const [testTypeLabel, setTestTypeLabel] = useState('Test');
  const [subDeptId, setSubDeptId]         = useState<number | null>(null);
  const [subDeptName, setSubDeptName]     = useState('');
  const [mainTestId, setMainTestId]       = useState('');
  const [mtCode, setMtCode]               = useState('');
  const [testName, setTestName]           = useState('');
  const [testNameSearch, setTestNameSearch] = useState('');
  const [testNameOpen, setTestNameOpen]   = useState(false);
  const [rateTypeId, setRateTypeId]       = useState<number | null>(null);
  const [rateTypeName, setRateTypeName]   = useState('');
  const [packageId, setPackageId]         = useState<number | null>(null);
  const [packageName, setPackageName]     = useState('');
  const [amount, setAmount]               = useState('');
  const [percentage, setPercentage]       = useState('');
  const [emergency, setEmergency]         = useState('');

  // ── Load dropdowns once ──
  useEffect(() => {
    Promise.all([getAllRateTypes(), getAllSubDepts(), getPackages(1), getTestNames(1)])
      .then(([rt, sd, pkg, tn]) => {
        setRateTypes(Array.isArray(rt) ? rt.map(r => ({ id: r.RateTypeId, label: r.RateTypeName, ...r } as any)) : []);
        setSubDepts(Array.isArray(sd) ? sd.map(s => ({ id: s.SubDeptId, label: s.SubDeptName, ...s } as any)) : []);
        setPackages(Array.isArray(pkg) ? pkg : []);
        setTestNames(Array.isArray(tn) ? tn : []);
      })
      .catch(() => {
        setPackages([]);
      });
  }, []);

  // ── Search with Rate Type, Sub Department & Main Test filters ──
  const handleSearch = async (
    rateId?: number | null,
    subId?: number | null,
    mainId?: number | null,
  ) => {
    setLoading(true); setError(null);
    try {
      const rId = rateId !== undefined ? rateId : filterRateTypeId;
      const sId = subId  !== undefined ? subId  : filterSubDeptId;
      const mId = mainId !== undefined ? mainId : filterMainTestId;

      const data = await getAllTestCharges({
        RateTypeId: rId ?? 1,
        SubDeptId:  sId ?? 0,
        MainTestId: mId ?? 0,
      });
      setRecords(data);
      setSearched(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load test charges.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { handleSearch(); }, []));

  const handleClear = () => {
    setFilterRateTypeId(1); setFilterRateTypeName('MRP1');
    setFilterSubDeptId(null);  setFilterSubDeptName('');
    setFilterMainTestId(null); setFilterMainTestName('');
    setSearch('');
    handleSearch(1, 0, 0);
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (
      String(r.TestName ?? '').toLowerCase().includes(q) ||
      String(r.MTCODE   ?? '').toLowerCase().includes(q)
    );
  });

  // ── Open Add modal ──
  const openAdd = () => {
    setEditItem(null);
    setTestType('T'); setTestTypeLabel('Test');
    setSubDeptId(filterSubDeptId); setSubDeptName(filterSubDeptName);
    setMainTestId(''); setMtCode(''); setTestName('');
    setTestNameSearch(''); setTestNameOpen(false);
    setRateTypeId(filterRateTypeId); setRateTypeName(filterRateTypeName);
    setPackageId(null); setPackageName('');
    setAmount(''); setPercentage(''); setEmergency('');
    setShowModal(true);
  };

  // ── Open Edit modal ──
  const openEdit = (item: TestChargeRecord) => {
    setEditItem(item);
    setTestType(item.TestType);
    setTestTypeLabel(item.TestType === 'T' ? 'Test' : 'Profile');
    setSubDeptId(item.SubDeptId);
    setSubDeptName((subDepts as any[]).find(s => s.SubDeptId === item.SubDeptId)?.SubDeptName ?? String(item.SubDeptId));
    setMainTestId(String(item.MainTestId));
    setMtCode(item.MTCODE);
    setTestName(item.TestName);
    setTestNameSearch(item.TestName);
    setTestNameOpen(false);
    setRateTypeId(item.RateTypeId);
    setRateTypeName(item.RateTypeName);
    setPackageId(item.PackageId);
    setPackageName(item.PackageName ?? '');
    setAmount(String(item.Amount));
    setPercentage(String(item.Percentage));
    setEmergency(String(item.Emergency));
    setShowModal(true);
  };

  // ── Save / Update ──
  const handleSave = async () => {
    if (!testName.trim()) { Alert.alert('Validation', 'Test Name is required.'); return; }
    if (!mtCode.trim())   { Alert.alert('Validation', 'MT Code is required.');   return; }
    if (!rateTypeId)      { Alert.alert('Validation', 'Select a Rate Type.');     return; }
    if (!subDeptId)       { Alert.alert('Validation', 'Select a Sub Department.'); return; }
    if (!amount.trim() || isNaN(Number(amount))) { Alert.alert('Validation', 'Enter a valid Amount.'); return; }

    const base: SaveTestChargePayload = {
      TestType: testType, SubDeptId: subDeptId!, MainTestId: parseInt(mainTestId) || 1,
      PackageId: packageId, PackageName: packageName || null,
      RateTypeName: rateTypeName, RateTypeId: rateTypeId!,
      MTCode: mtCode.trim(), TestName: testName.trim(),
      Amount: parseFloat(amount), Percentage: parseFloat(percentage) || 0,
      Emergency: parseFloat(emergency) || 0, CreatedBy: user?.name || 'Admin',
    };

    setSaving(true);
    try {
      if (editItem) {
        const payload: UpdateTestChargePayload = { ...base, TestChargeId: editItem.TestChargeId, UpdatedBy: user?.name || 'Admin' };
        await updateTestCharge(payload);
        Alert.alert('Success', 'Test charge updated successfully.');
      } else {
        await saveTestCharge(base);
        Alert.alert('Success', 'Test charge saved successfully.');
      }
      setShowModal(false);
      if (filterRateTypeId && filterSubDeptId) handleSearch(filterRateTypeId);
      else handleSearch();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save test charge.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = (item: TestChargeRecord) => {
    Alert.alert('Delete', `Delete "${item.TestName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteTestCharge(item.TestChargeId);
          setRecords(prev => prev.filter(r => r.TestChargeId !== item.TestChargeId));
        } catch (err: any) { Alert.alert('Error', err?.message ?? 'Could not delete.'); }
      }},
    ]);
  };

  // ── Render ──
  return (
    <View style={[st.root, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Test Charges</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={st.breadcrumb}>
        <MaterialCommunityIcons name="currency-usd" size={13} color={COLORS.primary} />
        <Text style={st.bcText}> Test Management</Text>
        <Feather name="chevron-right" size={12} color="#94A3B8" style={{ marginHorizontal: 2 }} />
        <Text style={[st.bcText, { color: COLORS.primary, fontWeight: '700' }]}>Test Charges</Text>
      </View>

      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Filter card ── */}
        <View style={st.card}>
          <View style={st.cardHeader}>
            <MaterialCommunityIcons name="filter-outline" size={16} color="#FFF" />
            <Text style={st.cardTitle}> Test Charges</Text>
            <TouchableOpacity style={st.addBtn} onPress={openAdd}>
              <Feather name="plus" size={14} color="#FFF" />
              <Text style={st.addBtnTxt}> Add Charge</Text>
            </TouchableOpacity>
          </View>

          <View style={st.filterBody}>
            {/* Rate Type */}
            <DD label="Rate Type" required value={filterRateTypeName}
              options={(rateTypes as any[]).map(r => ({ id: r.RateTypeId ?? r.id, label: r.RateTypeName ?? r.label }))}
              onSelect={(o: any) => { setFilterRateTypeId(o.id); setFilterRateTypeName(o.label); }}
              placeholder="Select Rate Type" />

            {/* Sub Department */}
            <DD label="Sub Department" required value={filterSubDeptName}
              options={(subDepts as any[]).map(s => ({ id: s.SubDeptId ?? s.id, label: s.SubDeptName ?? s.label }))}
              onSelect={(o: any) => { setFilterSubDeptId(o.id); setFilterSubDeptName(o.label); }}
              placeholder="Select Sub Department" />

            {/* Main Test (Optional) */}
            <DD label="Main Test (Optional)" value={filterMainTestName || 'ALL TESTS (OPTIONAL)'}
              options={[
                { id: 0, label: 'ALL TESTS (OPTIONAL)' },
                ...(testNames || []).map(t => ({ id: t.MainTestId, label: t.MainTestName }))
              ]}
              onSelect={(o: any) => {
                if (o.id === 0) {
                  setFilterMainTestId(null);
                  setFilterMainTestName('');
                } else {
                  setFilterMainTestId(o.id);
                  setFilterMainTestName(o.label);
                }
              }}
              placeholder="ALL TESTS (OPTIONAL)" />

            {/* Search + Clear */}
            <View style={st.filterBtns}>
              <TouchableOpacity style={[st.searchBtn, loading && { opacity: 0.7 }]} onPress={() => handleSearch(filterRateTypeId, filterSubDeptId, filterMainTestId)} disabled={loading}>
                {loading ? <ActivityIndicator size={14} color="#FFF" /> : <Feather name="search" size={14} color="#FFF" />}
                <Text style={st.searchBtnTxt}>{loading ? ' Searching…' : ' Search'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.clearBtn} onPress={handleClear}>
                <MaterialCommunityIcons name="refresh" size={14} color="#FFF" />
                <Text style={st.clearBtnTxt}> Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Results card ── */}
        {searched && (
          <View style={[st.card, { marginTop: 14 }]}>
            <View style={st.resultsHeader}>
              <Text style={st.resultsTitle}>Test Charges — {filterSubDeptName ? filterSubDeptName : 'All Tests in Sub Department'}</Text>
              <View style={st.badge}><Text style={st.badgeTxt}>{filtered.length} records</Text></View>
            </View>

            <View style={st.listBody}>
              <View style={st.searchBar}>
                <Feather name="search" size={14} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput style={st.searchInput} placeholder="Search table..." placeholderTextColor={COLORS.textMuted}
                  value={search} onChangeText={setSearch} />
              </View>

              {error ? (
                <View style={st.centre}>
                  <MaterialCommunityIcons name="cloud-off-outline" size={44} color="#CBD5E1" />
                  <Text style={st.emptyTitle}>Could not load data</Text>
                  <Text style={st.emptySub}>{error}</Text>
                </View>
              ) : filtered.length === 0 ? (
                <View style={st.centre}>
                  <MaterialCommunityIcons name="currency-usd-off" size={44} color="#CBD5E1" />
                  <Text style={st.emptyTitle}>No data available</Text>
                  <Text style={st.emptySub}>Select Rate Type and Sub Department then click Search.</Text>
                </View>
              ) : (
                filtered.map((item, idx) => (
                  <View key={`tc-${item.TestChargeId ?? '0'}-${item.MainTestId ?? ''}-${item.MTCODE ?? ''}-${idx}`} style={st.row}>
                    <View style={st.rowIcon}>
                      <MaterialCommunityIcons name="flask-outline" size={18} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.rowName}>{item.TestName}</Text>
                      <Text style={st.rowSub}>🔬 {item.MTCODE}  •  {item.RateTypeName}</Text>
                      <Text style={st.rowSub}>💰 ₹{item.Amount}  •  {item.TestType === 'T' ? 'Test' : 'Profile'}</Text>
                    </View>
                    <View style={st.rowActions}>
                      <View style={st.rateTag}>
                        <Text style={st.rateTagTxt}>₹{item.Amount}</Text>
                      </View>
                      <TouchableOpacity style={st.editBtn} onPress={() => openEdit(item)}>
                        <Feather name="edit-2" size={13} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity style={st.delBtn} onPress={() => handleDelete(item)}>
                        <Feather name="trash-2" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={st.footer}>
        <Text style={st.footerTxt}>© 2026 - Life Relier Infosoft Pvt Ltd</Text>
      </View>

      {/* ── Add / Edit Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <MaterialCommunityIcons name="currency-usd" size={16} color="#FFF" />
              <Text style={st.modalTitle}>{editItem ? ' Edit Test Charge' : ' Add Test Charge'}</Text>
            </View>
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size={14} color="#FFF" /> : <Feather name="save" size={14} color="#FFF" />}
                <Text style={st.btnTxt}>{saving ? ' Saving…' : ' Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                <Feather name="x" size={14} color="#FFF" />
                <Text style={st.btnTxt}> Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={st.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <DD label="Test Type" required value={testTypeLabel}
                options={TEST_TYPES.map(t => ({ id: t.id, label: t.label }))}
                onSelect={(o: any) => { setTestType(o.id); setTestTypeLabel(o.label); }} />

              <DD label="Sub Department" required value={subDeptName}
                options={(subDepts as any[]).map(s => ({ id: s.SubDeptId ?? s.id, label: s.SubDeptName ?? s.label }))}
                onSelect={(o: any) => { setSubDeptId(o.id); setSubDeptName(o.label); }}
                placeholder="Select Sub Department" />

              <Field label="Main Test ID" required>
                <View style={st.inputWrap}><TextInput style={st.input} placeholder="e.g. 1001" placeholderTextColor={COLORS.textMuted}
                  value={mainTestId} onChangeText={setMainTestId} keyboardType="numeric" /></View>
              </Field>

              <Field label="MT Code" required>
                <View style={st.inputWrap}><TextInput style={st.input} placeholder="e.g. MT0001" placeholderTextColor={COLORS.textMuted}
                  value={mtCode} onChangeText={setMtCode} autoCapitalize="characters" /></View>
              </Field>

              <Field label="Test Name" required>
                <View style={{ marginBottom: 0 }}>
                  <View style={st.inputWrap}>
                    <TextInput
                      style={st.input}
                      placeholder="Search test name..."
                      placeholderTextColor={COLORS.textMuted}
                      value={testNameSearch}
                      onChangeText={v => { setTestNameSearch(v); setTestName(''); setTestNameOpen(true); }}
                      onFocus={() => setTestNameOpen(true)}
                    />
                    {testNameSearch.length > 0 && (
                      <TouchableOpacity onPress={() => { setTestName(''); setTestNameSearch(''); setTestNameOpen(false); }}>
                        <Feather name="x" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {testNameOpen && testNameSearch.length > 0 && (
                    <View style={st.ddMenu}>
                      {testNames
                        .filter(t => t.MainTestName.toLowerCase().includes(testNameSearch.toLowerCase()))
                        .slice(0, 8)
                        .map((t, i) => (
                          <TouchableOpacity
                            key={i}
                            style={st.ddItem}
                            onPress={() => { setTestName(t.MainTestName); setTestNameSearch(t.MainTestName); setTestNameOpen(false); }}
                          >
                            <Text style={st.ddItemText}>{t.MainTestName}</Text>
                          </TouchableOpacity>
                        ))}
                      {testNames.filter(t => t.MainTestName.toLowerCase().includes(testNameSearch.toLowerCase())).length === 0 && (
                        <View style={st.ddItem}>
                          <Text style={[st.ddItemText, { color: COLORS.textMuted }]}>No matches</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </Field>

              <DD label="Rate Type" required value={rateTypeName}
                options={(rateTypes as any[]).map(r => ({ id: r.RateTypeId ?? r.id, label: r.RateTypeName ?? r.label }))}
                onSelect={(o: any) => { setRateTypeId(o.id); setRateTypeName(o.label); }}
                placeholder="Select Rate Type" />

              <DD label="Package (Optional)" value={packageName}
                options={[{ id: 0, label: 'None' }, ...(Array.isArray(packages) ? packages : []).map(p => ({ id: p.PackageId, label: p.PackageName }))]}
                onSelect={(o: any) => { if (o.id === 0) { setPackageId(null); setPackageName(''); } else { setPackageId(o.id); setPackageName(o.label); } }}
                placeholder="Select Package" />

              <Field label="Amount (₹)" required>
                <View style={st.inputWrap}><TextInput style={st.input} placeholder="e.g. 500" placeholderTextColor={COLORS.textMuted}
                  value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /></View>
              </Field>

              <Field label="Percentage (%)">
                <View style={st.inputWrap}><TextInput style={st.input} placeholder="e.g. 10" placeholderTextColor={COLORS.textMuted}
                  value={percentage} onChangeText={setPercentage} keyboardType="decimal-pad" /></View>
              </Field>

              <Field label="Emergency Charge (₹)">
                <View style={st.inputWrap}><TextInput style={st.input} placeholder="e.g. 50" placeholderTextColor={COLORS.textMuted}
                  value={emergency} onChangeText={setEmergency} keyboardType="decimal-pad" /></View>
              </Field>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.surfaceVariant },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:      { padding: 4 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  breadcrumb:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F4', paddingHorizontal: 16, paddingVertical: 8 },
  bcText:       { fontSize: 12, color: COLORS.textSecondary },
  scroll:       { padding: 16, paddingBottom: 20 },
  footer:       { backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' },
  footerTxt:    { fontSize: 12, color: '#FFF', fontWeight: '500' },

  card:         { backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardHeader:   { backgroundColor: COLORS.primary, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFF' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15803D', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnTxt:    { fontSize: 13, fontWeight: '700', color: '#FFF' },
  filterBody:   { padding: 16 },
  filterBtns:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  searchBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 11 },
  searchBtnTxt: { fontSize: 14, fontWeight: '700', color: '#FFF', marginLeft: 6 },
  clearBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.textSecondary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  clearBtnTxt:  { fontSize: 14, fontWeight: '700', color: '#FFF', marginLeft: 4 },

  resultsHeader:{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 14 },
  resultsTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginRight: 8 },
  badge:        { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:     { fontSize: 11, color: '#FFF', fontWeight: '600' },
  listBody:     { padding: 16 },
  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput:  { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  centre:       { alignItems: 'center', paddingVertical: 32 },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptySub:     { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowIcon:      { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowName:      { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  rowSub:       { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  rowActions:   { alignItems: 'flex-end', gap: 5 },
  rateTag:      { backgroundColor: '#F0FDFA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  rateTagTxt:   { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  editBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  delBtn:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },

  label:        { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  dd:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 48 },
  ddText:       { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  ddMenu:       { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.card, marginTop: 4, overflow: 'hidden', elevation: 4, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  ddItem:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  ddItemText:   { fontSize: 14, color: COLORS.textPrimary },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 48 },
  input:        { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle:   { fontSize: 15, fontWeight: '700', color: '#FFF' },
  modalActions: { flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  modalScroll:  { padding: 16 },
  saveBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#15803D', borderRadius: 10, paddingVertical: 11 },
  cancelBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.textSecondary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  btnTxt:       { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
