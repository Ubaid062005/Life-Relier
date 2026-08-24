import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import {
  getAllReferringDoctors,
  saveReferringDoctor,
  updateReferringDoctor,
  deleteReferringDoctor,
  ReferringDoctorRecord,
  SaveReferringDoctorPayload,
  UpdateReferringDoctorPayload,
} from '../../services/referringDoctorService';
const DR_TYPES = ['DR', 'MR', 'TPA', 'OTHER'];

function Field({ label, required, children }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={st.label}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text>
      {children}
    </View>
  );
}

export default function ReferralDoctorScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [records,    setRecords]    = useState<ReferringDoctorRecord[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<ReferringDoctorRecord | null>(null);
  const [saving,     setSaving]     = useState(false);

  // form fields — exact Bruno field names
  const [doctorCode,    setDoctorCode]    = useState('');
  const [doctorName,    setDoctorName]    = useState('');
  const [doctorPhoneno, setDoctorPhoneno] = useState('');
  const [doctoremail,   setDoctoremail]   = useState('');
  const [address1,      setAddress1]      = useState('');
  const [city,          setCity]          = useState('');
  const [drType,        setDrType]        = useState('DR');
  const [drTypeOpen,    setDrTypeOpen]    = useState(false);
  const [contactperson, setContactperson] = useState('');
  const [ratetypeid,    setRatetypeid]    = useState('');
  const [pro,           setPro]           = useState('');

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRecords(await getAllReferringDoctors(1)); }
    catch (err: any) { setError(err?.message ?? 'Failed to load referring doctors.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchRecords(); }, [fetchRecords]));

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (r.DoctorName ?? '').toLowerCase().includes(q) ||
           (r.DoctorCode ?? '').toString().toLowerCase().includes(q) ||
           (r.city ?? '').toLowerCase().includes(q);
  });

  // ── open add / edit ───────────────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null);
    setDoctorCode(''); setDoctorName(''); setDoctorPhoneno('');
    setDoctoremail(''); setAddress1(''); setCity('');
    setDrType('DR'); setContactperson(''); setRatetypeid(''); setPro('');
    setShowModal(true);
  };

  const openEdit = (item: ReferringDoctorRecord) => {
    setEditItem(item);
    setDoctorCode(String(item.DoctorCode ?? ''));
    setDoctorName(item.DoctorName ?? '');
    setDoctorPhoneno(item.DoctorPhoneno ?? '');
    setDoctoremail(item.Doctoremail ?? '');
    setAddress1(item.address1 ?? '');
    setCity(item.city ?? '');
    setDrType(item.DrType ?? 'DR');
    setContactperson(String(item.contactperson ?? ''));
    setRatetypeid(String(item.ratetypeid ?? ''));
    setPro(String(item.PRO ?? ''));
    setShowModal(true);
  };

  // ── save / update ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!doctorName.trim()) { Alert.alert('Validation', 'Doctor name is required.'); return; }
    const now = new Date().toISOString();
    setSaving(true);
    try {
      if (editItem) {
        const payload: UpdateReferringDoctorPayload = {
          dr_codeid:     editItem.dr_codeid ?? 0,
          DoctorCode:    parseInt(doctorCode) || doctorCode.trim(),
          DoctorName:    doctorName.trim(),
          DoctorPhoneno: doctorPhoneno.trim() || undefined,
          Doctoremail:   doctoremail.trim()   || undefined,
          address1:      address1.trim()      || undefined,
          city:          city.trim()          || undefined,
          DrType:        drType,
          contactperson: contactperson.trim() || undefined,
          ratetypeid:    parseInt(ratetypeid) || 1,
          PRO:           parseInt(pro)        || 0,
          Branchid:      1,
          Updatedby:     user?.name ?? 'admin',
          Updatedon:     now,
        };
        await updateReferringDoctor(payload);
        Alert.alert('Success', 'Updated successfully.');
      } else {
        const payload: SaveReferringDoctorPayload = {
          DoctorCode:    doctorCode.trim(),
          DoctorName:    doctorName.trim(),
          DoctorPhoneno: doctorPhoneno.trim() || undefined,
          Doctoremail:   doctoremail.trim()   || undefined,
          address1:      address1.trim()      || undefined,
          city:          city.trim()          || undefined,
          DrType:        drType,
          contactperson: contactperson.trim() || undefined,
          ratetypeid:    parseInt(ratetypeid) || 1,
          PRO:           parseInt(pro)        || 0,
          Branchid:      1,
          Createdon:     now,
        };
        await saveReferringDoctor(payload);
        Alert.alert('Success', 'Saved successfully.');
      }
      setShowModal(false);
      fetchRecords();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save.');
    } finally { setSaving(false); }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item: ReferringDoctorRecord) => {
    Alert.alert('Delete', `Delete "${item.DoctorName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteReferringDoctor(item.dr_codeid ?? 0, 1);
          setRecords(p => p.filter(r => r.dr_codeid !== item.dr_codeid));
        } catch (err: any) { Alert.alert('Error', err?.message ?? 'Could not delete.'); }
      }},
    ]);
  };

  return (
    <View style={[st.root, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Referral Doctors</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Breadcrumb */}
      <View style={st.breadcrumb}>
        <MaterialCommunityIcons name="account-heart-outline" size={13} color={COLORS.primary} />
        <Text style={st.bcText}> Master</Text>
        <Feather name="chevron-right" size={12} color="#94A3B8" style={{ marginHorizontal: 2 }} />
        <Text style={[st.bcText, { color: COLORS.primary, fontWeight: '700' }]}>Referral Doctors</Text>
      </View>

      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={st.card}>
          {/* Card header */}
          <View style={st.cardHeader}>
            <View style={st.cardTitleRow}>
              <MaterialCommunityIcons name="account-heart-outline" size={20} color="#FFF" />
              <Text style={st.cardTitle}> Referral Doctors</Text>
              <View style={st.badge}><Text style={st.badgeTxt}>{records.length} records</Text></View>
            </View>
            <View style={st.tabRow}>
              <TouchableOpacity style={st.tabBtn} onPress={fetchRecords} disabled={loading}>
                {loading ? <ActivityIndicator size={12} color="#FFF" /> : <Feather name="refresh-cw" size={13} color="#CBD5E1" />}
                <Text style={st.tabTxt}> Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.tabBtn, { backgroundColor: '#15803D' }]} onPress={openAdd}>
                <Feather name="plus" size={14} color="#FFF" />
                <Text style={[st.tabTxt, { color: '#FFF' }]}> Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={st.body}>
            {/* Search */}
            <View style={st.searchBar}>
              <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={st.searchInput} placeholder="Search by name, code, city..."
                placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
            </View>

            {/* States */}
            {loading && records.length === 0 ? (
              <View style={st.centre}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={st.centreTxt}>Loading…</Text></View>
            ) : error ? (
              <View style={st.centre}>
                <MaterialCommunityIcons name="cloud-off-outline" size={44} color="#CBD5E1" />
                <Text style={st.emptyTitle}>Could not load data</Text>
                <Text style={st.emptySub}>{error}</Text>
                <TouchableOpacity style={st.retryBtn} onPress={fetchRecords}>
                  <Feather name="refresh-cw" size={14} color={COLORS.primary} /><Text style={st.retryTxt}> Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={st.centre}>
                <MaterialCommunityIcons name="account-heart-outline" size={44} color="#CBD5E1" />
                <Text style={st.emptyTitle}>No referring doctors found</Text>
                <Text style={st.emptySub}>Tap "+ Add" to create one.</Text>
              </View>
            ) : (
              filtered.map((item, idx) => (
                <View key={`doc-${item.dr_codeid || item.DoctorCode || ''}-${idx}`} style={st.row}>
                  <View style={st.rowIcon}>
                    <MaterialCommunityIcons name="doctor" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowName}>{item.DoctorName}</Text>
                    <Text style={st.rowSub}>🏷 {item.DoctorCode}  •  {item.DrType ?? '—'}</Text>
                    {item.city         ? <Text style={st.rowSub}>📍 {item.city}</Text>         : null}
                    {item.DoctorPhoneno ? <Text style={st.rowSub}>📱 {item.DoctorPhoneno}</Text> : null}
                  </View>
                  <View style={st.rowActions}>
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
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={st.footer}><Text style={st.footerTxt}>© 2026 - Life Relier Infosoft Pvt Ltd</Text></View>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <MaterialCommunityIcons name="account-heart-outline" size={16} color="#FFF" />
              <Text style={st.modalTitle}>{editItem ? ' Edit Referring Doctor' : ' Add Referring Doctor'}</Text>
            </View>
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size={14} color="#FFF" /> : <Feather name="save" size={14} color="#FFF" />}
                <Text style={st.btnTxt}>{saving ? ' Saving…' : ' Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                <Feather name="x" size={14} color="#FFF" /><Text style={st.btnTxt}> Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={st.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Field label="Doctor Code">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. 1755" placeholderTextColor={COLORS.textMuted}
                    value={doctorCode} onChangeText={setDoctorCode} autoCapitalize="characters" />
                </View>
              </Field>

              <Field label="Doctor Name" required>
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. Aditya Manmdale" placeholderTextColor={COLORS.textMuted}
                    value={doctorName} onChangeText={setDoctorName} />
                </View>
              </Field>

              <Field label="Phone No.">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. 9876553210" placeholderTextColor={COLORS.textMuted}
                    value={doctorPhoneno} onChangeText={setDoctorPhoneno} keyboardType="phone-pad" />
                </View>
              </Field>

              <Field label="Email">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. doctor@gmail.com" placeholderTextColor={COLORS.textMuted}
                    value={doctoremail} onChangeText={setDoctoremail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </Field>

              <Field label="Address">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. Pune" placeholderTextColor={COLORS.textMuted}
                    value={address1} onChangeText={setAddress1} />
                </View>
              </Field>

              <Field label="City">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. Pune" placeholderTextColor={COLORS.textMuted}
                    value={city} onChangeText={setCity} />
                </View>
              </Field>

              <Field label="Dr Type" required>
                <TouchableOpacity style={st.dd} onPress={() => setDrTypeOpen(!drTypeOpen)}>
                  <Text style={st.ddText}>{drType}</Text>
                  <Feather name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
                {drTypeOpen && (
                  <View style={st.ddMenu}>
                    {DR_TYPES.map(t => (
                      <TouchableOpacity key={t} style={st.ddItem}
                        onPress={() => { setDrType(t); setDrTypeOpen(false); }}>
                        <Text style={st.ddItemText}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Field>

              <Field label="Contact Person">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. 1" placeholderTextColor={COLORS.textMuted}
                    value={contactperson} onChangeText={setContactperson} keyboardType="numeric" />
                </View>
              </Field>

              <Field label="Rate Type ID">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. 2" placeholderTextColor={COLORS.textMuted}
                    value={ratetypeid} onChangeText={setRatetypeid} keyboardType="numeric" />
                </View>
              </Field>

              <Field label="PRO">
                <View style={st.inputWrap}>
                  <TextInput style={st.input} placeholder="e.g. 5" placeholderTextColor={COLORS.textMuted}
                    value={pro} onChangeText={setPro} keyboardType="numeric" />
                </View>
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
  root:        { flex: 1, backgroundColor: COLORS.surfaceVariant },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  breadcrumb:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F4', paddingHorizontal: 16, paddingVertical: 8 },
  bcText:      { fontSize: 12, color: COLORS.textSecondary },
  scroll:      { padding: 16, paddingBottom: 20 },
  footer:      { backgroundColor: COLORS.primary, paddingVertical: 12, alignItems: 'center' },
  footerTxt:   { fontSize: 12, color: '#FFF', fontWeight: '500' },
  card:        { backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden', elevation: 2, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardHeader:  { backgroundColor: COLORS.primary, padding: 14 },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#FFF', marginRight: 8 },
  badge:       { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:    { fontSize: 11, color: '#FFF', fontWeight: '600' },
  tabRow:      { flexDirection: 'row', gap: 10 },
  tabBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: '#CBD5E1' },
  body:        { padding: 16 },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  centre:      { alignItems: 'center', paddingVertical: 36 },
  centreTxt:   { marginTop: 10, fontSize: 13, color: COLORS.textSecondary },
  emptyTitle:  { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptySub:    { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', marginTop: 14, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  retryTxt:    { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowIcon:     { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowName:     { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  rowSub:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  rowActions:  { gap: 6 },
  editBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  delBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  label:       { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 48 },
  input:       { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  dd:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.background, paddingHorizontal: 14, height: 48 },
  ddText:      { fontSize: 14, color: COLORS.textPrimary },
  ddMenu:      { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, backgroundColor: COLORS.card, marginTop: 4, overflow: 'hidden', elevation: 4, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  ddItem:      { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  ddItemText:  { fontSize: 14, color: COLORS.textPrimary },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle:  { fontSize: 15, fontWeight: '700', color: '#FFF' },
  modalActions:{ flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  modalScroll: { padding: 16 },
  saveBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#15803D', borderRadius: 10, paddingVertical: 11 },
  cancelBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.textSecondary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  btnTxt:      { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
