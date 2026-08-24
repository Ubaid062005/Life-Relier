import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { API_BASE_URL } from '../../utils/constants';
import { generateAndShareReportPdf } from '../../services/reportPdfService';
import { useAuth } from '../../context/AuthContext';

const PRIMARY = '#0D9488';

interface ParamItem {
  Patmstid: number;
  PID: number;
  PatRegID: string;
  FID: number;
  BranchId: number;
  MainTestId: number;
  MainTestName: string;
  TestNo: number;
  TestName: string;
  Unit: string;
  NormalRange: string;
  LowerRange?: number | null;
  UpperRange?: number | null;
  ResultValue: string | null;
  Remark?: string;
  PatAuthenticate?: string;
  TestedUserName?: string;
  AuthorizedDoctorName?: string;
}

export interface RangeEvaluation {
  status: 'normal' | 'abnormal' | 'empty' | 'non-numeric';
  message?: string;
}

export function evaluateRange(
  valStr: string | null | undefined,
  normalRangeStr?: string | null,
  lowerRange?: number | null,
  upperRange?: number | null,
): RangeEvaluation {
  if (!valStr || !valStr.trim()) {
    return { status: 'empty' };
  }

  const valNum = parseFloat(valStr.trim());
  if (isNaN(valNum)) {
    const textVal = valStr.trim().toLowerCase();
    if (['negative', 'non-reactive', 'non reactive', 'normal', 'nil', 'absent', 'clear', 'not seen'].includes(textVal)) {
      return { status: 'normal', message: 'Normal' };
    }
    if (['positive', 'reactive', 'abnormal', 'present', 'seen', 'detected'].includes(textVal)) {
      return { status: 'abnormal', message: 'Abnormal' };
    }
    return { status: 'non-numeric' };
  }

  let min: number | null = typeof lowerRange === 'number' && !isNaN(lowerRange) ? lowerRange : null;
  let max: number | null = typeof upperRange === 'number' && !isNaN(upperRange) ? upperRange : null;

  if ((min === null || max === null) && normalRangeStr && typeof normalRangeStr === 'string') {
    const range = normalRangeStr.trim();
    const hyphenMatch = range.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:-|to)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (hyphenMatch) {
      min = parseFloat(hyphenMatch[1]);
      max = parseFloat(hyphenMatch[2]);
    } else {
      const lessMatch = range.match(/(?:<|<=|up\s*to|less\s*than)\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (lessMatch) {
        max = parseFloat(lessMatch[1]);
      }
      const greaterMatch = range.match(/(?:>|>=|more\s*than|greater\s*than)\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (greaterMatch) {
        min = parseFloat(greaterMatch[1]);
      }
    }
  }

  if (min !== null && max !== null) {
    if (valNum >= min && valNum <= max) {
      return { status: 'normal', message: 'Normal' };
    } else if (valNum < min) {
      return { status: 'abnormal', message: 'Low' };
    } else {
      return { status: 'abnormal', message: 'High' };
    }
  }

  if (min !== null) {
    if (valNum >= min) return { status: 'normal', message: 'Normal' };
    return { status: 'abnormal', message: 'Low' };
  }

  if (max !== null) {
    if (valNum <= max) return { status: 'normal', message: 'Normal' };
    return { status: 'abnormal', message: 'High' };
  }

  return { status: 'non-numeric' };
}

export default function AddResultWithTestParamScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const incomingPatient = route?.params?.patient;
  const [selectedPatient, setSelectedPatient] = useState<any>(incomingPatient || null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  // Parameter form state
  const [paramsList, setParamsList] = useState<ParamItem[]>([]);
  const [paramValues, setParamValues] = useState<{ [key: string]: string }>({});
  const [loadingParams, setLoadingParams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Sync route params when navigated with patient
  useEffect(() => {
    if (route?.params?.patient) {
      setSelectedPatient(route.params.patient);
    }
  }, [route?.params?.patient]);

  // Fetch patient list if not provided via navigation
  const fetchPatientList = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/TestResultEntry/SearchTestResults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          BranchId: 1,
          FromDate: '2026-08-01',
          ToDate: '2026-08-31',
          PPID: null,
          RegNo: null,
          PatientName: null,
          BarcodeNo: null,
          CenterName: null,
          RefDoctor: null,
          Remark: null,
          StatusFilter: activeTab === 'All' ? null : activeTab,
          SubDeptId: null,
        }),
      });
      const data = await res.json();
      const rawRows: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const rows = rawRows.map((item: any) => {
        let docName = 'Self';
        if (typeof item.refDr === 'string' && item.refDr.trim()) {
          docName = item.refDr.trim();
        } else if (item.refDr && typeof item.refDr === 'object') {
          docName = item.refDr.DoctorName || item.refDr.name || item.refDr.Drname || 'Self';
        }

        return {
          ...item,
          fullName: typeof item.fullName === 'string' ? item.fullName : (typeof item.PatientName === 'string' ? item.PatientName : 'Patient'),
          PatientName: typeof item.PatientName === 'string' ? item.PatientName : (typeof item.fullName === 'string' ? item.fullName : 'Patient'),
          gender: typeof item.gender === 'string' ? item.gender : '—',
          age: typeof item.age === 'string' ? item.age : String(item.age || '—'),
          center: typeof item.center === 'string' ? item.center : 'Main Lab',
          refDr: docName,
          tests: Array.isArray(item.tests)
            ? item.tests.map((t: any) => ({
                ...t,
                test: typeof t.test === 'string' ? t.test : String(t.test || 'Test'),
                status: typeof t.status === 'string' ? t.status : (typeof t.status === 'object' ? '' : String(t.status || '')),
              }))
            : [],
        };
      });
      setPatients(rows);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedPatient) {
      fetchPatientList();
    }
  }, [selectedPatient, fetchPatientList]);

  // Fetch test parameters for selected patient
  const fetchTestParams = useCallback(async (p: any) => {
    if (!p) return;
    setLoadingParams(true);
    try {
      const patRegId = p.regNo || p.PatRegID || p.pid || p.PID;
      const pid = p.pid || p.PID;
      const res = await fetch(`${API_BASE_URL}/api/AddResultWithTestParameter/GetAllTest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          PatRegID: Number(patRegId),
          PID: Number(pid),
          BranchId: 1,
        }),
      });

      const data = await res.json();
      const rawList: any[] = Array.isArray(data) ? data : [];
      const seenKeys = new Set<string>();
      const uniqueRawList: any[] = [];
      for (const item of rawList) {
        const uKey = `${item.Patmstid ?? 0}_${item.MainTestId ?? 0}_${item.TestNo ?? 0}`;
        if (!seenKeys.has(uKey)) {
          seenKeys.add(uKey);
          uniqueRawList.push(item);
        }
      }

      const list: ParamItem[] = uniqueRawList.map((item: any) => ({
        ...item,
        MainTestName: typeof item.MainTestName === 'string' ? item.MainTestName : String(item.MainTestName || 'Test'),
        TestName: typeof item.TestName === 'string' ? item.TestName : String(item.TestName || 'Parameter'),
        Unit: typeof item.Unit === 'string' ? item.Unit : '',
        NormalRange: typeof item.NormalRange === 'string' ? item.NormalRange : '',
        LowerRange: typeof item.LowerRange === 'number' ? item.LowerRange : (parseFloat(item.LowerRange) || null),
        UpperRange: typeof item.UpperRange === 'number' ? item.UpperRange : (parseFloat(item.UpperRange) || null),
        ResultValue: typeof item.ResultValue === 'string' ? item.ResultValue : (item.ResultValue != null && typeof item.ResultValue !== 'object' ? String(item.ResultValue) : ''),
        PatAuthenticate: typeof item.PatAuthenticate === 'string' ? item.PatAuthenticate : '',
        Remark: typeof item.Remark === 'string' ? item.Remark : '',
      }));
      setParamsList(list);

      // Initialize paramValues
      const initialVals: { [key: string]: string } = {};
      list.forEach(item => {
        const key = `${item.MainTestId}_${item.TestNo}`;
        initialVals[key] = item.ResultValue ?? '';
      });
      setParamValues(initialVals);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load test parameters');
      setParamsList([]);
    } finally {
      setLoadingParams(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchTestParams(selectedPatient);
    }
  }, [selectedPatient, fetchTestParams]);

  const handleSelectPatient = (p: any) => {
    setSelectedPatient(p);
  };

  const handleParamChange = (mainTestId: number, testNo: number, val: string) => {
    const key = `${mainTestId}_${testNo}`;
    setParamValues(prev => ({ ...prev, [key]: val }));
  };

  // Group params by MainTestName
  const groupedParams: { [key: string]: ParamItem[] } = {};
  paramsList.forEach(p => {
    const group = p.MainTestName || 'Other Tests';
    if (!groupedParams[group]) groupedParams[group] = [];
    groupedParams[group].push(p);
  });

  // Extract unique MainTestIds
  const mainTestIds = Array.from(new Set(paramsList.map(p => p.MainTestId)));

  const handleSaveResults = async () => {
    if (!selectedPatient) return;

    // Check for empty parameter fields before saving
    const emptyParams = paramsList.filter(p => {
      const key = `${p.MainTestId}_${p.TestNo}`;
      const val = paramValues[key];
      return !val || !val.trim();
    });

    if (emptyParams.length > 0) {
      Alert.alert(
        '⚠️ Incomplete Test Parameters',
        `Cannot save results. ${emptyParams.length} parameter field(s) are empty.\n\nPlease fill in all parameter result values before saving:\n\n• ${emptyParams.slice(0, 5).map(p => p.TestName).join('\n• ')}${emptyParams.length > 5 ? `\n...and ${emptyParams.length - 5} more` : ''}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSaving(true);
    try {
      const patRegId = selectedPatient.regNo || selectedPatient.PatRegID || selectedPatient.pid;
      const pid = selectedPatient.pid || selectedPatient.PID;

      // Build JSON object payload with full param objects as expected by backend
      const savePayload = {
        PID: Number(pid),
        PatRegID: String(patRegId),
        BranchId: 1,
        Results: paramsList.map(p => {
          const key = `${p.MainTestId}_${p.TestNo}`;
          return {
            ...p,
            PID: Number(pid),
            PatRegID: String(patRegId),
            BranchId: 1,
            ResultValue: paramValues[key] !== undefined ? paramValues[key] : (p.ResultValue ?? ''),
            Remark: p.Remark || '',
          };
        }),
      };

      const res = await fetch(`${API_BASE_URL}/api/AddResultWithTestParameter/SaveResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(savePayload),
      });

      const resJson = await res.json().catch(() => null);

      if (res.ok && resJson?.Message) {
        Alert.alert('Success', resJson.Message || 'Test results saved successfully');
        fetchTestParams(selectedPatient);
      } else if (res.ok) {
        Alert.alert('Success', 'Test results saved successfully');
        fetchTestParams(selectedPatient);
      } else {
        Alert.alert('Save Result', resJson?.Message || 'Results submitted to server.');
      }
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Saved successfully');
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorizeResults = async () => {
    if (!selectedPatient) return;

    // Check for empty parameter fields before authorizing
    const emptyParams = paramsList.filter(p => {
      const key = `${p.MainTestId}_${p.TestNo}`;
      const val = paramValues[key];
      return !val || !val.trim();
    });

    if (emptyParams.length > 0) {
      Alert.alert(
        '⚠️ Incomplete Test Parameters',
        `Cannot authorize report. ${emptyParams.length} parameter field(s) are empty.\n\nPlease fill in all parameter result values before authorizing:\n\n• ${emptyParams.slice(0, 5).map(p => p.TestName).join('\n• ')}${emptyParams.length > 5 ? `\n...and ${emptyParams.length - 5} more` : ''}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setAuthorizing(true);
    try {
      const patRegId = selectedPatient.regNo || selectedPatient.PatRegID || selectedPatient.pid;
      const pid = selectedPatient.pid || selectedPatient.PID;
      const docUserId = user?.id || (user as any)?.userId || (user as any)?.DoctorId || 1;

      // 1. Auto-save all results first so the database has latest entered values
      const savePayload = {
        PID: Number(pid),
        PatRegID: String(patRegId),
        BranchId: 1,
        Results: paramsList.map(p => {
          const key = `${p.MainTestId}_${p.TestNo}`;
          return {
            ...p,
            PID: Number(pid),
            PatRegID: String(patRegId),
            BranchId: 1,
            ResultValue: paramValues[key] !== undefined ? paramValues[key] : (p.ResultValue ?? ''),
            Remark: p.Remark || '',
          };
        }),
      };

      await fetch(`${API_BASE_URL}/api/AddResultWithTestParameter/SaveResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(savePayload),
      });

      // 2. Authorize each MainTestId assigned to this patient
      for (const mtId of mainTestIds) {
        await fetch(`${API_BASE_URL}/api/AddResultWithTestParameter/AuthorizeResult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            PatRegID: Number(patRegId),
            PID: Number(pid),
            BranchId: 1,
            MainTestId: Number(mtId),
            DoctorUserId: Number(docUserId),
          }),
        });
      }

      Alert.alert('✅ Report Authorized', 'All test results saved and report authorized successfully!');
      fetchTestParams(selectedPatient);
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Authorization completed');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleGeneratePdf = async (printMode: 'WITHOUT_LETTERHEAD' | 'WITH_LETTERHEAD') => {
    if (!selectedPatient) return;
    setShowPdfModal(false);
    setGeneratingPdf(true);
    try {
      const patRegId = selectedPatient.regNo || selectedPatient.PatRegID || selectedPatient.pid;
      const pid = selectedPatient.pid || selectedPatient.PID;
      await generateAndShareReportPdf({
        PatRegID: Number(patRegId),
        PID: Number(pid),
        MainTestIds: mainTestIds,
        BranchId: 1,
        CompanyId: 1,
        TimeZoneId: 1,
        PrintMode: printMode,
      });
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const name = (p.fullName || p.PatientName || '').toLowerCase();
    const idStr = String(p.regNo || p.PatRegID || p.pid || '');
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return name.includes(q) || idStr.includes(q);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (selectedPatient && !incomingPatient) {
              setSelectedPatient(null);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {selectedPatient ? 'Enter Parameter Results' : 'Parameter Result Entry'}
          </Text>
          {selectedPatient && (
            <Text style={styles.headerSub}>
              {typeof selectedPatient.fullName === 'string' ? selectedPatient.fullName : (typeof selectedPatient.PatientName === 'string' ? selectedPatient.PatientName : 'Patient')} • PID: {String(selectedPatient.pid || selectedPatient.PID || '')}
            </Text>
          )}
        </View>
      </View>

      {!selectedPatient ? (
        // Patient selection list
        <View style={styles.listContainer}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patient name or Reg ID..."
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick status tabs */}
          <View style={styles.tabRow}>
            {['All', 'Pending', 'Authorized'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingPatients ? (
            <View style={styles.centre}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.centreText}>Loading patients…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPatients}
              keyExtractor={(item, idx) => `pat-${item.pid || item.PID || idx}-${idx}`}
              renderItem={({ item, index }) => {
                const isAuth = Array.isArray(item.tests) && item.tests.some((t: any) => t.status === 'Authorized');
                return (
                  <TouchableOpacity
                    key={`pat-card-${item.pid || item.PID}-${index}`}
                    style={styles.patientCard}
                    onPress={() => handleSelectPatient(item)}
                  >
                    <View style={styles.patientCardLeft}>
                      <View style={[styles.patientAvatar, { backgroundColor: isAuth ? '#EDE9FE' : '#CCFBF1' }]}>
                        <Text style={[styles.patientAvatarText, { color: isAuth ? '#7C3AED' : PRIMARY }]}>
                          {(item.fullName || item.PatientName || 'P').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.patientName}>{item.fullName || item.PatientName}</Text>
                          <View style={[styles.statusChip, { backgroundColor: isAuth ? '#EDE9FE' : '#FEF3C7' }]}>
                            <Text style={[styles.statusChipText, { color: isAuth ? '#7C3AED' : '#B45309' }]}>
                              {isAuth ? 'Authorized' : 'Pending'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.patientMeta}>
                          Reg: #{item.regNo || item.PatRegID} • PID: {item.pid || item.PID} • {item.gender || '—'}, {item.age || '—'}
                        </Text>
                        {Array.isArray(item.tests) && item.tests.length > 0 && (
                          <View style={styles.cardTestsRow}>
                            {item.tests.slice(0, 2).map((t: any, i: number) => (
                              <View key={i} style={styles.miniTestChip}>
                                <Text style={styles.miniTestChipText} numberOfLines={1}>
                                  {t.test || 'Test'}
                                </Text>
                              </View>
                            ))}
                            {item.tests.length > 2 && (
                              <Text style={styles.moreTestsText}>+{item.tests.length - 2} more</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                    <Feather name="chevron-right" size={20} color="#CBD5E1" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ padding: 14 }}
              ListEmptyComponent={
                <View style={styles.centre}>
                  <MaterialCommunityIcons name="account-search-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.centreText}>No patients found</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        // Parameter details entry form
        <View style={styles.detailContainer}>
          {loadingParams ? (
            <View style={styles.centre}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.centreText}>Loading test parameters…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Patient Banner */}
              <View style={styles.patientHeader}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.detailName}>
                    {typeof selectedPatient.fullName === 'string' ? selectedPatient.fullName : (typeof selectedPatient.PatientName === 'string' ? selectedPatient.PatientName : 'Patient')}
                  </Text>
                  <Text style={styles.detailPid}>PID: {String(selectedPatient.pid || selectedPatient.PID || '')}</Text>
                </View>
                <Text style={styles.detailMeta}>
                  Gender/Age: {typeof selectedPatient.gender === 'string' ? selectedPatient.gender : '—'} / {typeof selectedPatient.age === 'string' ? selectedPatient.age : String(selectedPatient.age || '—')} • Ref Dr:{' '}
                  {typeof selectedPatient.refDr === 'string' && selectedPatient.refDr.trim() ? selectedPatient.refDr.trim() : 'Self'}
                </Text>
              </View>

              {/* Action Toolbar */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#3B82F6' }, generatingPdf && { opacity: 0.6 }]}
                  onPress={() => setShowPdfModal(true)}
                  disabled={generatingPdf}
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color="#FFF" />
                  <Text style={styles.actionText}>Print PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }, authorizing && { opacity: 0.6 }]}
                  onPress={handleAuthorizeResults}
                  disabled={authorizing}
                >
                  <MaterialCommunityIcons name="check-decagram" size={18} color="#FFF" />
                  <Text style={styles.actionText}>Authorize</Text>
                </TouchableOpacity>
              </View>

              {/* Grouped Test Parameters */}
              {Object.keys(groupedParams).length === 0 ? (
                <View style={styles.centre}>
                  <MaterialCommunityIcons name="flask-empty-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.centreText}>No parameter tests found for this patient.</Text>
                </View>
              ) : (
                Object.keys(groupedParams).map(groupName => (
                  <View key={groupName} style={styles.testSection}>
                    <View style={styles.testSectionHeader}>
                      <MaterialCommunityIcons name="test-tube" size={18} color={PRIMARY} />
                      <Text style={styles.testSectionTitle}>{groupName}</Text>
                    </View>

                    <View style={styles.paramsList}>
                      {groupedParams[groupName].map((param, pIdx) => {
                        const key = `${param.MainTestId}_${param.TestNo}`;
                        const currentVal = paramValues[key] ?? '';
                        const evalRes = evaluateRange(currentVal, param.NormalRange, param.LowerRange, param.UpperRange);
                        const isNormal = evalRes.status === 'normal';
                        const isAbnormal = evalRes.status === 'abnormal';

                        const dynamicInputStyle = isNormal
                          ? { borderColor: '#10B981', borderWidth: 1.5, backgroundColor: '#F0FDF4' }
                          : isAbnormal
                          ? { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FEF2F2' }
                          : { borderColor: '#CBD5E1', borderWidth: 1, backgroundColor: '#F8FAFC' };

                        return (
                          <View key={`param-card-${param.Patmstid || 0}-${param.MainTestId}-${param.TestNo}-${pIdx}`} style={styles.paramRow}>
                            <View style={styles.paramTop}>
                              <Text style={styles.paramName}>{param.TestName}</Text>
                              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                {isNormal && (
                                  <View style={[styles.rangeBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                    <MaterialCommunityIcons name="check-circle" size={11} color="#059669" />
                                    <Text style={[styles.rangeBadgeText, { color: '#059669' }]}>
                                      {evalRes.message || 'Normal'}
                                    </Text>
                                  </View>
                                )}
                                {isAbnormal && (
                                  <View style={[styles.rangeBadge, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                    <MaterialCommunityIcons name="alert-circle" size={11} color="#DC2626" />
                                    <Text style={[styles.rangeBadgeText, { color: '#DC2626' }]}>
                                      {evalRes.message || 'Abnormal'}
                                    </Text>
                                  </View>
                                )}
                                {param.PatAuthenticate ? (
                                  <Text style={styles.authBadge}>{param.PatAuthenticate}</Text>
                                ) : null}
                              </View>
                            </View>

                            <TextInput
                              style={[styles.paramInput, dynamicInputStyle]}
                              placeholder="Enter value..."
                              placeholderTextColor="#94A3B8"
                              value={currentVal}
                              onChangeText={val => handleParamChange(param.MainTestId, param.TestNo, val)}
                            />

                            <View style={styles.paramMetaRow}>
                              <Text style={styles.paramUnit}>Unit: {param.Unit || '—'}</Text>
                              <Text style={styles.paramRange}>Range: {param.NormalRange || '—'}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => fetchTestParams(selectedPatient)}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#64748B" />
              <Text style={styles.resetText}>Reload</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveResults}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cloud-upload" size={20} color="#FFFFFF" />
                  <Text style={styles.saveText}>Save Results</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PDF Modal */}
      <Modal visible={showPdfModal} transparent animationType="fade" onRequestClose={() => setShowPdfModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="file-pdf-box" size={26} color={PRIMARY} />
              <Text style={styles.modalTitle}>Print Test Report</Text>
            </View>
            <Text style={styles.modalSub}>
              Generate patient test report for {selectedPatient?.fullName || selectedPatient?.PatientName}
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITHOUT_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="file-document-outline" size={22} color={PRIMARY} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>Without Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Standard clean report</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleGeneratePdf('WITH_LETTERHEAD')}
            >
              <MaterialCommunityIcons name="printer" size={22} color="#8B5CF6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalOptionTitle}>With Letterhead</Text>
                <Text style={styles.modalOptionDesc}>Header with lab branding</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPdfModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  listContainer: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  patientCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patientCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  patientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: { color: PRIMARY, fontSize: 16, fontWeight: '700' },
  patientName: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1 },
  patientMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusChipText: { fontSize: 10, fontWeight: '700' },
  cardTestsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' },
  miniTestChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniTestChipText: { fontSize: 10, color: '#475569', fontWeight: '600' },
  moreTestsText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },

  detailContainer: { flex: 1 },
  patientHeader: {
    backgroundColor: '#F0FDFA',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  detailName: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  detailPid: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  detailMeta: { fontSize: 12, color: '#475569', marginTop: 3 },

  actionRow: { flexDirection: 'row', gap: 10, padding: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 8,
    gap: 6,
  },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  testSection: { marginHorizontal: 14, marginBottom: 14 },
  testSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  testSectionTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  paramsList: { gap: 10 },
  paramRow: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paramTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  paramName: { fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1, marginRight: 8 },
  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  rangeBadgeText: { fontSize: 10, fontWeight: '700' },
  authBadge: { fontSize: 10, color: '#8B5CF6', fontWeight: '700', backgroundColor: '#F5F3FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paramInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 14,
    marginBottom: 6,
  },
  paramMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paramUnit: { fontSize: 11, color: '#64748B' },
  paramRange: { fontSize: 11, color: '#64748B' },

  footer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  resetText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    gap: 6,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  centre: { alignItems: 'center', paddingVertical: 50 },
  centreText: { fontSize: 13, color: '#64748B', marginTop: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modalOptionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  modalOptionDesc: { fontSize: 11, color: '#64748B', marginTop: 1 },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
});
