import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import BlinkingEmergencyBulb from '../../components/BlinkingEmergencyBulb';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  registerPatient, updatePatientFiles,
  getInitials, searchPatient, searchPatientByMobile, searchTests, resolveSampleType,
  InitialItem, SearchPatientItem, TestResult,
} from '../../services/registrationService';
import { getTestNames, getAllTestCharges, TestNameItem, getCenters, CenterItem } from '../../services/testChargesService';
import { getAllReferringDoctors, ReferringDoctorRecord } from '../../services/referringDoctorService';
import { API_BASE_URL , COLORS} from '../../utils/constants';

const T = {
  primary:    '#0D9488',
  tealDark:   '#0F766E',
  tealBg:     '#F0FDFA',
  tealBorder: '#CCFBF1',
  bg:         '#FFFFFF',
  screenBg:   '#F8FAFC',
  text:       '#0F172A',
  sub:        '#64748B',
  muted:      '#94A3B8',
  border:     '#E2E8F0',
  danger:     '#EF4444',
  green:      '#15803D',
};

const INITIALS      = ['Mr','Mrs','Ms','Dr','Master','Miss'];
const GENDERS       = ['Male','Female','Other'];
const AGE_TYPES     = ['Year','Month','Day'];
const PAYMENT_TYPES = ['Cash','Cheque','Card','Online'];
const DISC_TYPES    = ['Amt','Per%'];

const STEPS = [
  { key: 1, label: 'Patient\nInfo',    icon: 'account-outline'    },
  { key: 2, label: 'Add\nTests',       icon: 'flask-outline'       },
  { key: 3, label: 'Payment\nDetails', icon: 'credit-card-outline' },
];

function SectionBar({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={s.sectionBar}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#FFF" />
      <Text style={s.sectionBarText}>{title}</Text>
    </View>
  );
}

function Field({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.fieldWrap, style]}>{children}</View>;
}

function InlineSelect({ value, options, onSelect, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = (options || []).filter((o: string) =>
    typeof o === 'string' && o.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpen = () => {
    setSearch('');
    setOpen(true);
  };

  return (
    <>
      <TouchableOpacity style={s.inlineSelect} onPress={handleOpen} activeOpacity={0.8}>
        <Text style={[s.inlineSelectText, !value && { color: COLORS.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{placeholder || 'Select Option'}</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={s.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {options && options.length > 5 && (
              <View style={s.modalSearchWrap}>
                <Feather name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={s.modalSearchInput}
                  placeholder={`Search ${placeholder || 'options'}...`}
                  placeholderTextColor={COLORS.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Feather name="x" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              style={s.modalList}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {filteredOptions.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.textMuted }}>No matching options</Text>
                </View>
              ) : (
                filteredOptions.map((o: string) => {
                  const isSelected = value === o;
                  return (
                    <TouchableOpacity
                      key={o}
                      style={[s.modalItem, isSelected && s.modalItemActive]}
                      onPress={() => {
                        onSelect(o);
                        setOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.modalItemText, isSelected && s.modalItemTextActive]}>
                        {o}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={18} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Checkbox({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) {
  return (
    <TouchableOpacity style={s.checkRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={[s.checkBox, value && s.checkBoxOn]}>
        {value && <Feather name="check" size={11} color="#FFF" />}
      </View>
      <Text style={s.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function DateField({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const [show, setShow] = useState(false);
  const display = value
    ? `${String(value.getDate()).padStart(2,'0')}-${String(value.getMonth()+1).padStart(2,'0')}-${value.getFullYear()}`
    : '';
  return (
    <>
      <TouchableOpacity style={s.datePicker} onPress={() => setShow(true)} activeOpacity={0.8}>
        <MaterialCommunityIcons name="calendar-month-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <Text style={[s.datePickerText, !value && { color: COLORS.textMuted }]}>{display || 'dd-mm-yyyy'}</Text>
        <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, selected) => {
            setShow(Platform.OS === 'ios');
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={s.stepBar}>
      {STEPS.map((step, idx) => {
        const done = current > step.key;
        const active = current === step.key;
        return (
          <React.Fragment key={step.key}>
            <View style={s.stepItem}>
              <View style={[s.stepCircle, done && s.stepCircleDone, active && s.stepCircleActive]}>
                {done
                  ? <Feather name="check" size={14} color="#FFF" />
                  : <MaterialCommunityIcons name={step.icon as any} size={16} color={active ? '#FFF' : COLORS.textMuted} />}
              </View>
              <Text style={[s.stepLabel, active && { color: COLORS.primaryDark, fontWeight: '700' }, done && { color: COLORS.success }]}>
                {step.label}
              </Text>
            </View>
            {idx < STEPS.length - 1 && <View style={[s.stepLine, done && s.stepLineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function NewRegistrationScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);

  const [mainLab,      setMainLab]      = useState('');
  const [rateType,     setRateType]     = useState('MRP1');
  const [centerCode,   setCenterCode]   = useState('');
  const [centers,      setCenters]      = useState<CenterItem[]>([]);
  const [refDoctor,    setRefDoctor]    = useState('Self');
  const [initial,      setInitial]      = useState('');
  const [patName,      setPatName]      = useState('');
  const [gender,       setGender]       = useState('');
  const [ageType,      setAgeType]      = useState('Year');
  const [age,          setAge]          = useState('');
  const [dob,          setDob]          = useState<Date | null>(null);
  const [mobile,       setMobile]       = useState('');
  const [email,        setEmail]        = useState('');
  const [address,      setAddress]      = useState('');
  const [patCardNo,    setPatCardNo]    = useState('');
  const [cardExp,      setCardExp]      = useState('');
  const [hospitalId,   setHospitalId]   = useState('');
  const [weight,       setWeight]       = useState('');
  const [height,       setHeight]       = useState('');
  const [disease,      setDisease]      = useState('');
  const [symptoms,     setSymptoms]     = useState('');
  const [therapy,      setTherapy]      = useState('');
  const [fsTime,       setFsTime]       = useState('');
  const [lastPeriod,   setLastPeriod]   = useState<Date | null>(null);
  const [clinicalHist, setClinicalHist] = useState('');
  const [repPrint,     setRepPrint]     = useState(false);
  const [repEmail,     setRepEmail]     = useState(false);
  const [repWhatsapp,  setRepWhatsapp]  = useState(false);
  const [repOnline,    setRepOnline]    = useState(false);

  const [testSearch,    setTestSearch]   = useState('');
  const [addedTests,    setAddedTests]   = useState<string[]>([]);
  const [addedTestIds,  setAddedTestIds] = useState<Record<string, number>>({});  // name → MainTestId
  const [testPrices,    setTestPrices]   = useState<Record<string, number>>({});
  const [allTests,      setAllTests]     = useState<TestNameItem[]>([]);
  const [chargeMap,     setChargeMap]    = useState<Record<string, number>>({}); // testName -> price
  const [testResults,   setTestResults]  = useState<TestResult[]>([]);
  const [searchingTest, setSearchingTest]= useState(false);
  const [showTestDrop,  setShowTestDrop] = useState(false);
  const testDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payType,      setPayType]      = useState('Cash');
  const [otherCharge,  setOtherCharge]  = useState('0');
  const [otherRemark,  setOtherRemark]  = useState('');
  const [discType,     setDiscType]     = useState('Amt');
  const [discAmt,      setDiscAmt]      = useState('0');
  const [paidAmt,      setPaidAmt]      = useState('0.00');
  const [userEditedPaid, setUserEditedPaid] = useState(false);
  const [remark,       setRemark]       = useState('');
  const [emergency,    setEmergency]    = useState(false);

  // ── Computed totals ──────────────────────────────────────────────────────
  const testTotal   = addedTests.reduce((sum, t) => sum + (testPrices[t] ?? 0), 0);
  const other       = parseFloat(otherCharge) || 0;
  const disc        = parseFloat(discAmt) || 0;
  const grossTotal  = testTotal + other;
  const netTotal    = discType === 'Per%'
    ? grossTotal - (grossTotal * disc / 100)
    : grossTotal - disc;
  const balance     = netTotal - (parseFloat(paidAmt) || 0);

  // Auto-sync paid amount with net total by default, allowing user override
  useEffect(() => {
    if (!userEditedPaid) {
      setPaidAmt(netTotal > 0 ? netTotal.toFixed(2) : '0.00');
    }
  }, [netTotal, userEditedPaid]);
  const [prescriptionFile, setPrescriptionFile] = useState<string | null>(null);
  const [photoFile,        setPhotoFile]        = useState<string | null>(null);

  const [registering,  setRegistering]  = useState(false);
  const [updating,     setUpdating]     = useState(false);
  const [regNo,        setRegNo]        = useState<string>('—');
  const [initialsList, setInitialsList] = useState<InitialItem[]>([]);
  const [doctorsList,  setDoctorsList]  = useState<ReferringDoctorRecord[]>([]);

  // ── Patient search (auto-fill) ─────────────────────────────────────────────
  const [patSearch,        setPatSearch]        = useState('');
  const [patSearchResults, setPatSearchResults] = useState<SearchPatientItem[]>([]);
  const [searching,        setSearching]        = useState(false);

  // ── Autocomplete: Name field ───────────────────────────────────────────────
  const [nameResults,  setNameResults]  = useState<SearchPatientItem[]>([]);
  const [nameSearching,setNameSearching]= useState(false);
  const [showNameDrop, setShowNameDrop] = useState(false);

  // ── Autocomplete: Mobile field ─────────────────────────────────────────────
  const [mobileSearching, setMobileSearching] = useState(false);
  const [mobileMessage, setMobileMessage] = useState<string | null>(null);

  useEffect(() => {
    getCenters(1).then(d => {
      if (d && d.length > 0) {
        setCenters(d);
      }
    }).catch(() => {});
    getInitials().then(d => { if (d.length) setInitialsList(d); }).catch(() => {});
    // Load referring doctors from real API — always prepend "Self"
    getAllReferringDoctors(1).then(d => setDoctorsList(d)).catch(() => {});
    // Load all test names once for local filtering
    getTestNames(1).then(d => setAllTests(d)).catch(() => {});
    // Load test charges to build name->price map
    getAllTestCharges().then(charges => {
      const map: Record<string, number> = {};
      charges.forEach(c => {
        if (c.TestName && c.Amount > 0) map[c.TestName.trim().toLowerCase()] = c.Amount;
      });
      setChargeMap(map);
    }).catch(() => {});
  }, []);

  // ── Auto-fill all fields from a searched patient ───────────────────────────
  const handlePatientSelect = async (p: SearchPatientItem) => {
    setPatSearch('');
    setPatSearchResults([]);
    setShowNameDrop(false);
    setNameResults([]);
    setMobileMessage(null);
    
    // Populate basic fields from the search result immediately
    setRegNo(String(p.PPID));
    if (p.intial)          setInitial(p.intial);
    if (p.Patname)         setPatName(p.Patname);
    if (p.sex)             setGender(p.sex);
    if (p.Age != null)     setAge(String(p.Age));
    if (p.MDY)             setAgeType(p.MDY);
    if (p.MobileNo)        setMobile(p.MobileNo);
    if (p.Email)           setEmail(p.Email);
    if (p.Pataddress)      setAddress(p.Pataddress);
    if (p.PatientCardNo)   setPatCardNo(p.PatientCardNo);
    if (p.PatientCardExpNo)setCardExp(p.PatientCardExpNo);
    if (p.RefDoctor || p.DoctorName) {
      const doctorName = p.RefDoctor ?? p.DoctorName;
      if (doctorName) setRefDoctor(doctorName);
    }
    if (p.DateOfBirth) {
      const d = new Date(p.DateOfBirth);
      if (!isNaN(d.getTime())) setDob(d);
    } else if (p.Age != null) {
      // Reverse-calculate birth year from age when no exact DOB is available
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - Number(p.Age);
      setDob(new Date(birthYear, 0, 1)); // Jan 1st of estimated birth year
    }
    
    // Fetch full patient details since GetGrid doesn't provide them
    try {
      const { getPatient } = await import('../../services/editPatientService');
      const full = await getPatient(p.PPID);
      if (full) {
        const fetchedInitial = full.Initial || full.intial || full.Intial;
        if (fetchedInitial) setInitial(fetchedInitial);
        const fetchedGender = full.Gender ?? full.sex ?? full.Sex ?? full.gender ?? null;
        if (fetchedGender) setGender(fetchedGender);
        if (full.Age) setAge(String(full.Age));
        if (full.DOB) {
          setDob(new Date(full.DOB));
        } else if (full.Age) {
          // Reverse-calculate birth year from age when no exact DOB is available
          const currentYear = new Date().getFullYear();
          const birthYear = currentYear - Number(full.Age);
          setDob(new Date(birthYear, 0, 1));
        }
        if (full.Email) setEmail(full.Email);
        if (full.Address || full.Pataddress) setAddress(full.Address || full.Pataddress || '');
      }
    } catch(e) {
      // ignore, basic data is already populated
    }

    Alert.alert('✅ Patient Loaded', `Data auto-filled for ${p.Patname ?? 'Patient'} (ID: ${p.PPID})`);
  };

  // ── Pre-fill from route params ─────────────────────────────────────────────
  useEffect(() => {
    if (route?.params) {
      const { mobile: rMobile, name: rName } = route.params;
      if (rMobile) {
        setMobile(rMobile);
        // Automatically search and populate the rest of the patient details
        import('../../services/registrationService').then(({ searchPatient }) => {
          searchPatient(rMobile).then(results => {
            if (results && results.length > 0) {
              handlePatientSelect(results[0]);
            } else if (rName) {
              setPatName(rName);
            }
          }).catch(() => {
            if (rName) setPatName(rName);
          });
        });
      } else if (rName) {
        setPatName(rName);
      }
    }
  }, [route?.params]);

  // ── Live search helpers ────────────────────────────────────────────────────
  const searchByName = async (txt: string) => {
    setPatName(txt);
    if (txt.trim().length < 2) { setNameResults([]); setShowNameDrop(false); return; }
    setNameSearching(true);
    setShowNameDrop(true);
    try {
      const r = await searchPatient(txt.trim());
      setNameResults(r);
    } catch { setNameResults([]); }
    finally { setNameSearching(false); }
  };

  const clearPatientInfo = () => {
    setRegNo('—');
    setInitial(''); setPatName(''); setGender('');
    setAgeType('Year'); setAge(''); setDob(null);
    setEmail(''); setAddress('');
    setPatCardNo(''); setCardExp(''); setHospitalId('');
  };

  const searchByMobile = async (txt: string) => {
    const clean = txt.replace(/\D/g, '').slice(0, 10);
    const changed = mobile !== clean;
    setMobile(clean);
    
    if (changed && regNo !== '—') {
      clearPatientInfo();
    }
    
    if (clean.length < 10) { 
      setMobileMessage(null); 
      return; 
    }
    
    if (clean.length === 10) {
      setMobileSearching(true);
      setMobileMessage(null);
      try {
        const r = await searchPatientByMobile(clean);
        if (r.length === 1) {
          handlePatientSelect(r[0]);
          setMobileMessage('Patient found and loaded.');
        } else if (r.length > 1) {
          setMobileMessage('Multiple patients found. Please search by name.');
        } else {
          setMobileMessage('No patient found with this mobile number.');
        }
      } catch {
        setMobileMessage('Error searching patient.');
      } finally {
        setMobileSearching(false);
      }
    }
  };

  // ── Common test code → name abbreviation map ──────────────────────────────
  const TEST_CODE_MAP: Record<string, string[]> = {
    'cbc':    ['complete blood count'],
    'lft':    ['liver function test'],
    'kft':    ['kidney function test'],
    'rft':    ['kidney function test', 'renal function test'],
    'tft':    ['thyroid', 'thyroid profile'],
    'tsh':    ['thyroid'],
    'hba1c':  ['glycosylated hemoglobin', 'glycated hemoglobin'],
    'lp':     ['lipid profile'],
    'bsf':    ['blood sugar fasting'],
    'bspp':   ['blood sugar post prandial'],
    'bsr':    ['blood sugar random'],
    'esr':    ['esr'],
    'crp':    ['c-reactive protein'],
    'ure':    ['urine routine'],
    'ecg':    ['ecgtest', 'ecg'],
    'hiv':    ['hiv'],
    'hb':     ['hemoglobin', 'complete blood count'],
    'gram':   ['gram stain'],
    'sono':   ['sonography'],
    'usg':    ['sonography'],
    'vd3':    ['vitamin d'],
    'vb12':   ['vitamin b12', 'vitamin b 12'],
    'psa':    ['prostate'],
    'widal':  ['widal'],
    'dengue': ['dengue'],
    'malaria':['malaria'],
    'uric':   ['uric acid'],
    'sr':     ['serum creatinine'],
  };

  // ── API test search ────────────────────────────────────────────────────────
  const searchByTest = async (txt: string) => {
    setTestSearch(txt);
    if (txt.trim().length < 2) {
      setTestResults([]);
      setShowTestDrop(false);
      return;
    }
    setShowTestDrop(true);

    const q = txt.trim().toLowerCase();

    // Check if input matches a known code abbreviation
    const codeAliases = TEST_CODE_MAP[q] ?? [];

    // 1. Instant local filter — match by name, or by code alias
    const local = allTests
      .filter(t => {
        const name = (t.TestName || t.MainTestName).toLowerCase();
        // Direct name match
        if (name.includes(q)) return true;
        // Code alias match
        return codeAliases.some(alias => name.includes(alias));
      })
      .slice(0, 12)
      .map(t => ({
        mainTestId:  t.MainTestId ?? 0,
        displayText: t.TestName || t.MainTestName,
        testName:    t.TestName || t.MainTestName,
        testCode:    t.TestCode ?? '',
      }));

    if (local.length > 0) {
      setTestResults(local);
      setSearchingTest(false);
      return;
    }

    // 2. Fallback to API if local yields nothing
    setSearchingTest(true);
    try {
      const r = await searchTests(txt.trim());
      setTestResults(r.length > 0 ? r : []);
    } catch {
      setTestResults([]);
    } finally {
      setSearchingTest(false);
    }
  };

  const handleTestSelect = (name: string, mainTestId?: number) => {
    if (!addedTests.includes(name)) {
      setAddedTests(prev => [...prev, name]);
      // Store MainTestId for this test so it can be sent in the registration payload
      if (mainTestId && mainTestId > 0) {
        setAddedTestIds(prev => ({ ...prev, [name]: mainTestId }));
      } else {
        // Fallback: look up from allTests
        const found = allTests.find(t => t.TestName === name || t.MainTestName === name);
        if (found?.MainTestId) {
          setAddedTestIds(prev => ({ ...prev, [name]: found.MainTestId }));
        }
      }
      // Price lookup: use preloaded chargeMap first
      if (!testPrices[name]) {
        const price = chargeMap[name.trim().toLowerCase()] ?? 0;
        if (price > 0) {
          setTestPrices(prev => ({ ...prev, [name]: price }));
        }
      }
    }
    setTestSearch('');
    setTestResults([]);
    setShowTestDrop(false);
  };

  // Auto-set gender based on initial (new patients only — fetched patients preserve their saved gender)
  const handleInitialSelect = (val: string) => {
    setInitial(val);
    const v = val.trim().toLowerCase();
    if (['mr', 'master', 'dr'].includes(v))              setGender('Male');
    else if (['mrs', 'ms', 'miss'].includes(v))          setGender('Female');
  };

  // Auto-calculate age from DOB
  const handleDobChange = (date: Date) => {
    setDob(date);
    const today = new Date();
    let years = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) years--;
    setAgeType('Year');
    setAge(String(Math.max(0, years)));
  };

  const goToStep = (n: number) => {
    setStep(n);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleNext = () => {
    if (step === 1) {
      const missing: string[] = [];
      if (!initial.trim())    missing.push('• Initial (Mr / Mrs / Ms …)');
      if (!patName.trim())    missing.push('• Patient Name');
      if (!gender.trim())     missing.push('• Gender');
      if (!dob)               missing.push('• Date of Birth');
      if (!age.trim())        missing.push('• Age');
      if (!mobile.trim())     missing.push('• Mobile Number');
      if (!refDoctor.trim())  missing.push('• Ref Doctor');
      if (!address.trim())    missing.push('• Address');
      if (missing.length > 0) {
        Alert.alert('Required Fields Missing', `Please fill in the following fields:\n\n${missing.join('\n')}`);
        return;
      }
      if (mobile.length !== 10) {
        Alert.alert('Invalid Mobile', 'Mobile number must be exactly 10 digits.');
        return;
      }
    }
    if (step === 2 && addedTests.length === 0) {
      Alert.alert('No Tests Added', 'Please add at least one test to proceed.', [
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    if (step < 3) goToStep(step + 1);
  };

  const handleBack = () => { if (step > 1) goToStep(step - 1); };

  const handleClear = () => {
    setStep(1);
    setMainLab(''); setRateType('MRP1'); setRefDoctor('');
    setInitial(''); setPatName(''); setGender('');
    setAgeType('Year'); setAge(''); setDob(null);
    setMobile(''); setEmail(''); setAddress('');
    setPatCardNo(''); setCardExp(''); setHospitalId('');
    setWeight(''); setHeight(''); setDisease('');
    setSymptoms(''); setTherapy(''); setFsTime('');
    setLastPeriod(null); setClinicalHist('');
    setRepPrint(false); setRepEmail(false); setRepWhatsapp(false); setRepOnline(false);
    setTestSearch(''); setAddedTests([]); setAddedTestIds({});
    setTestResults([]); setShowTestDrop(false);
    setPayType('Cash'); setOtherCharge('0'); setOtherRemark('');
    setDiscType('Amt'); setDiscAmt('0'); setPaidAmt('0.00'); setUserEditedPaid(false);
    setRemark(''); setEmergency(false);
    setPrescriptionFile(null); setPhotoFile(null);
    setRegNo('—');
    setPatSearch(''); setPatSearchResults([]);
    setNameResults([]); setShowNameDrop(false);
    setMobileMessage(null);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!initial.trim())   missing.push('• Initial (Mr / Mrs / Ms …)');
    if (!patName.trim())   missing.push('• Patient Name');
    if (!gender.trim())    missing.push('• Gender');
    if (!dob)              missing.push('• Date of Birth');
    if (!age.trim())       missing.push('• Age');
    if (!mobile.trim())    missing.push('• Mobile Number');
    if (!refDoctor.trim()) missing.push('• Ref Doctor');
    if (!centerCode)       missing.push('• Center');
    if (!address.trim())   missing.push('• Address');
    if (addedTests.length === 0) missing.push('• At least one Test');
    if (!paidAmt.trim() || parseFloat(paidAmt) < 0) missing.push('• Paid Amount');
    if (missing.length > 0) {
      Alert.alert('Required Fields Missing', `Please fill in the following fields:\n\n${missing.join('\n')}`);
      return;
    }
    if (mobile.length !== 10) {
      Alert.alert('Invalid Mobile', 'Mobile number must be exactly 10 digits.');
      return;
    }

    setRegistering(true);
    try {
      // Resolve referring doctor code (dr_codeid) from the loaded list
      const docName = (refDoctor || 'Self').trim();
      const doctorMatch = doctorsList.find(
        d => d.DoctorName?.trim().toLowerCase() === docName.toLowerCase()
      );
      const doctorCode =
        doctorMatch?.dr_codeid ??
        doctorMatch?.DoctorCode ??
        doctorMatch?.ReferringDoctorId ??
        doctorMatch?.ReferingDoctorId ??
        doctorMatch?.DoctorId ??
        (docName.toLowerCase() === 'self' ? 7 : null);
      // Also send the doctor name in all field names the backend accepts
      const resolvedDoctorName = doctorMatch?.DoctorName?.trim() || docName;

      // Format DOB as ISO date string (YYYY-MM-DD)
      const dobISO = dob ? `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}` : null;

      // Format last period date
      const lastPeriodISO = lastPeriod
        ? `${lastPeriod.getFullYear()}-${String(lastPeriod.getMonth() + 1).padStart(2, '0')}-${String(lastPeriod.getDate()).padStart(2, '0')}`
        : null;

      // Build report type string from checkboxes
      const reportType = [
        repPrint    ? 'Print'    : '',
        repEmail    ? 'Email'    : '',
        repWhatsapp ? 'WhatsApp' : '',
        repOnline   ? 'Online'   : '',
      ].filter(Boolean).join(',') || 'Print';

      const data = await registerPatient({
        // ── Core patient demographics ──────────────────────────────────────
        Patname:           patName.trim(),
        Age:               parseInt(age, 10),
        MDY:               ageType,
        Pataddress:        address.trim() || 'N/A',
        BranchId:          1,
        BranchID:          1,
        intial:            initial.trim(),
        sex:               gender,
        MobileNo:          mobile.trim(),
        Patphoneno:        mobile.trim(),
        Email:             email.trim(),
        EmailID:           email.trim(),
        DateOfBirth:       dobISO,
        // ── Referring doctor ───────────────────────────────────────────────
        RefDoctor:         resolvedDoctorName,
        RefDr:             resolvedDoctorName,
        DoctorCode:        doctorCode ? Number(doctorCode) : 7,
        Drname:            resolvedDoctorName,
        DoctorName:        resolvedDoctorName,
        ReferingDoctor:    resolvedDoctorName,
        OtherRefDoctor:    null,
        // ── Patient card / hospital ────────────────────────────────────────
        PatientCardNo:     patCardNo.trim(),
        PatientCardExpNo:  cardExp.trim(),
        HospitalNo:        hospitalId.trim(),
        // ── Center ─────────────────────────────────────────────────────────
        CenterCode:        centerCode ? parseInt(centerCode, 10) : null,
        CenterName:        centers.find(c => String(c.CenterCode) === centerCode)?.CenterName || '',
        // ── Clinical ──────────────────────────────────────────────────────
        Weights:           weight.trim(),
        Heights:           height.trim(),
        Disease:           disease.trim(),
        Symptoms:          symptoms.trim(),
        Therapy:           therapy.trim(),
        FSTime:            fsTime.trim(),
        LastPeriod:        lastPeriodISO,
        ClinicalHist:      clinicalHist.trim(),
        // ── Report flags ───────────────────────────────────────────────────
        ReportType:        reportType,
        Isemergency:       emergency,
        // ── Tests — send both TestNames (strings) AND TestList (objects with IDs)
        // TestList is the format the backend uses to create billing/test records
        // that make the patient appear in GetPatientTestStatus.
        TestNames:  addedTests,
        TestList:   addedTests.map(name => {
          const match = allTests.find(t => t.TestName === name || t.MainTestName === name);
          const mainTestId = addedTestIds[name] ?? match?.MainTestId ?? 0;
          const mtCode = match?.MTCode ?? match?.TestCode ?? '';
          const subDept = match?.SubDeptId;
          const sampleMeta = resolveSampleType(name, subDept);

          return {
            MainTestId:      mainTestId,
            TestName:        name,
            PatTestName:     name,
            MainTestName:    name,
            TestType:        'T',
            PackageId:       0,
            PackageCode:     '',
            MTCode:          mtCode,
            SubDeptId:       sampleMeta.subDeptId,
            SubDepartmentId: sampleMeta.subDeptId,
            SampleType:      sampleMeta.sampleType,
            SampleTypeId:    sampleMeta.sampleTypeId,
            Amount:          testPrices[name] ?? 0,
            TestRate:        testPrices[name] ?? 0,
            ClientRate:      testPrices[name] ?? 0,
          };
        }),
        // ── Payment / billing ──────────────────────────────────────────────
        PaymentType:       payType,
        TotalAmount:       grossTotal,
        PaidAmount:        parseFloat(paidAmt) || 0,
        DiscountAmount:    parseFloat(discAmt) || 0,
        OtherCharges:      parseFloat(otherCharge) || 0,
        OtherChargeRemark: otherRemark.trim(),
        Remark:            remark.trim(),
        RateType:          rateType,
        TestCharges:       testTotal,
        BillAmt:           grossTotal,
        AmtPaid:           parseFloat(paidAmt) || 0,
        DisAmt:            parseFloat(discAmt) || 0,
        BalAmt:            balance,
        Status:            'Registered',
      });

      const pid = String(data?.PID ?? data?.PPID ?? data?.PatRegID ?? '—');
      setRegNo(pid);
      Alert.alert(
        '✅ ' + (data?.Message ?? 'Patient Registered'),
        `Patient ID : ${data?.PID ?? '—'}\nReg Number : ${data?.PrefixRegNumber ?? '—'}\nReceipt No : ${data?.ReceiptNo ?? '—'}\nBill No    : ${data?.BillNo ?? '—'}`,
        [{ text: 'New Patient', onPress: handleClear }, { text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.message ?? 'Could not connect to server.');
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdate = async () => {
    if (regNo === '—') { Alert.alert('No Patient', 'Register a patient first.'); return; }
    setUpdating(true);
    try {
      const data = await updatePatientFiles({ PID: parseInt(regNo, 10), Patname: patName.trim(), Age: parseInt(age, 10), Pataddress: address.trim() || 'N/A', BranchID: 1 });
      Alert.alert('✅ ' + (data?.Message ?? 'Updated'), `Patient ID: ${regNo}`, [{ text: 'OK' }]);
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message ?? 'Could not connect to server.');
    } finally { setUpdating(false); }
  };

  const handleChoosePrescription = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length) setPrescriptionFile(res.assets[0].name);
    } catch { Alert.alert('Error', 'Could not open file picker.'); }
  };

  const pickImage = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission Denied', `${camera ? 'Camera' : 'Gallery'} permission required.`); return; }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1,1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1,1] });
    if (!res.canceled && res.assets?.length) setPhotoFile(res.assets[0].uri);
  };

  const handleChoosePhoto = () => Alert.alert('Upload Photo', 'Choose source', [
    { text: 'Take Photo', onPress: () => pickImage(true) },
    { text: 'Choose from Gallery', onPress: () => pickImage(false) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const handleDeptBarcode   = () => Alert.alert('Dept Barcode',   'Coming soon.');
  const handleCard          = () => Alert.alert('Card',           'Coming soon.');
  const handleSampleBarcode = () => Alert.alert('Sample Barcode', 'Coming soon.');
  const handleCapturePhoto  = () => pickImage(true);

  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: Math.max(insets.top, 0) }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Registration</Text>
        <View style={s.regNoBadge}><Text style={s.regNoBadgeTxt}>Reg: {regNo}</Text></View>
      </View>

      <StepIndicator current={step} />

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>

        {step === 1 && (
          <>
            <SectionBar icon="account" title="Patient Information" />
            <View style={s.formCard}>



              {/* Initial | Name — with autocomplete */}
              <Field style={{ zIndex: 100 }}>
                <View style={s.rowWrap}>
                  <View style={{ width: 90 }}>
                    <InlineSelect
                      value={initial}
                      options={INITIALS}
                      onSelect={handleInitialSelect}
                      placeholder="Initial"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <TextInput
                      style={s.input}
                      placeholder="Enter Name"
                      placeholderTextColor={COLORS.textMuted}
                      value={patName}
                      onChangeText={searchByName}
                      onBlur={() => setTimeout(() => setShowNameDrop(false), 200)}
                      onFocus={() => { if (nameResults.length > 0) setShowNameDrop(true); }}
                    />
                    {showNameDrop && (
                      <View style={s.acDrop}>
                        {nameSearching && (
                          <View style={s.acLoading}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={s.acLoadingTxt}> Searching…</Text>
                          </View>
                        )}
                        {!nameSearching && nameResults.length === 0 && (
                          <View style={s.acEmpty}>
                            <Feather name="user-x" size={13} color={COLORS.textMuted} />
                            <Text style={s.acEmptyTxt}>  No patient found</Text>
                          </View>
                        )}
                        {!nameSearching && nameResults.slice(0, 5).map((p, i) => (
                          <TouchableOpacity
                            key={`n-${p.PPID}-${i}`}
                            style={[s.acRow, i < Math.min(nameResults.length, 5) - 1 && s.acRowBorder]}
                            onPress={() => handlePatientSelect(p)}
                            activeOpacity={0.75}
                          >
                            <MaterialCommunityIcons name="account-circle-outline" size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.acName}>{p.intial ? `${p.intial} ` : ''}{p.Patname ?? '—'}</Text>
                              <Text style={s.acSub}>📱 {p.MobileNo ?? '—'}  •  Age {p.Age ?? '—'}  •  ID: {p.PPID}</Text>
                            </View>
                            <View style={s.acBadge}><Text style={s.acBadgeTxt}>Select</Text></View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </Field>

              {/* Gender — auto-set from Initial, can still be changed */}
              <Field style={{ zIndex: 90 }}>
                <InlineSelect value={gender} options={GENDERS} onSelect={setGender} placeholder="Gender" />
              </Field>

              {/* DOB — auto-fills Age */}
              <Field style={{ zIndex: 80 }}>
                <View style={s.rowWrap}>
                  <Text style={[s.inputLabel, { marginRight: 8, alignSelf: 'center', width: 30 }]}>DOB</Text>
                  <View style={{ flex: 1 }}><DateField value={dob} onChange={handleDobChange} /></View>
                </View>
              </Field>

              {/* Age Type | Age — auto-filled from DOB, editable */}
              <Field style={{ zIndex: 70 }}>
                <View style={s.rowWrap}>
                  <View style={{ width: 90 }}>
                    <InlineSelect value={ageType} options={AGE_TYPES} onSelect={setAgeType} placeholder="Year" />
                  </View>
                  <TextInput
                    style={[s.input, { flex: 1, marginLeft: 8 }]}
                    placeholder="Age"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    value={age}
                    onChangeText={setAge}
                  />
                </View>
                {dob && <Text style={{ fontSize: 11, color: COLORS.primary, marginTop: 3, marginLeft: 2 }}>Auto-calculated from DOB</Text>}
              </Field>

              {/* Mobile */}
              <Field style={{ zIndex: 60 }}>
                <View style={[s.input, { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12 }]}>
                  <Feather name="phone" size={15} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: COLORS.textPrimary }}
                    placeholder="Mobile (10 digits)"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobile}
                    onChangeText={searchByMobile}
                  />
                  {mobileSearching
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : mobile.length > 0
                      ? <Text style={{ fontSize: 11, fontWeight: '700', color: mobile.length === 10 ? '#15803D' : COLORS.danger }}>
                          {mobile.length}/10
                        </Text>
                      : null}
                </View>
                {mobileMessage && !mobileSearching && (
                  <Text style={{ fontSize: 12, color: mobileMessage.includes('loaded') ? COLORS.success : COLORS.danger, marginTop: 4, marginLeft: 2 }}>
                    {mobileMessage}
                  </Text>
                )}
                {mobile.length > 0 && mobile.length !== 10 && (
                  <Text style={{ fontSize: 11, color: COLORS.danger, marginTop: 3, marginLeft: 2 }}>
                    Mobile must be exactly 10 digits
                  </Text>
                )}
              </Field>

              {/* Ref Doctor */}
              <Field style={{ zIndex: 50 }}>
                <InlineSelect value={refDoctor}
                  options={['Self', ...doctorsList
                    .filter(d => d.DoctorName?.toLowerCase() !== 'self')
                    .map(d => d.DoctorName)]}
                  onSelect={setRefDoctor} placeholder="Ref Doctor" />
              </Field>

              {/* Center */}
              <Field style={{ zIndex: 40 }}>
                <InlineSelect
                  value={centers.find(c => String(c.CenterCode) === centerCode)?.CenterName || ''}
                  options={centers.map(c => c.CenterName)}
                  onSelect={(name: string) => {
                    const match = centers.find(c => c.CenterName === name);
                    if (match) setCenterCode(String(match.CenterCode));
                  }}
                  placeholder="Select Center"
                />
              </Field>

              {/* Address */}
              <Field style={{ zIndex: 30 }}>
                <TextInput
                  style={[s.input, { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder="Enter Address"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  value={address}
                  onChangeText={setAddress}
                />
              </Field>

            </View>
          </>
        )}

        {step === 2 && (
          <>
            <SectionBar icon="flask-outline" title="Add Tests" />
            <View style={s.formCard}>
              <Field>
                <Text style={s.fieldHint}>Type at least 2 characters to search tests from database</Text>
                <View style={s.testSearchBox}>
                  <Feather name="search" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: COLORS.textPrimary }}
                    placeholder="Type test name or code (e.g. CBC, Blood)..."
                    placeholderTextColor={COLORS.textMuted}
                    value={testSearch}
                    onChangeText={searchByTest}
                    onBlur={() => setTimeout(() => setShowTestDrop(false), 200)}
                    onFocus={() => { if (testResults.length > 0) setShowTestDrop(true); }}
                    returnKeyType="search"
                  />
                  {searchingTest
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : testSearch.length > 0
                      ? <TouchableOpacity onPress={() => { setTestSearch(''); setTestResults([]); setShowTestDrop(false); }}>
                          <Feather name="x" size={16} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      : null}
                </View>

                {/* Autocomplete dropdown */}
                {showTestDrop && (
                  <View style={s.acDrop}>
                    {searchingTest && (
                      <View style={s.acLoading}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={s.acLoadingTxt}> Searching tests…</Text>
                      </View>
                    )}
                    {!searchingTest && testResults.length === 0 && (
                      <View style={s.acEmpty}>
                        <MaterialCommunityIcons name="flask-off-outline" size={14} color={COLORS.textMuted} />
                        <Text style={s.acEmptyTxt}>  No test found</Text>
                      </View>
                    )}
                    {!searchingTest && testResults.slice(0, 10).map((t, i) => {
                      const alreadyAdded = addedTests.includes(t.testName);
                      return (
                        <TouchableOpacity
                          key={`t-${t.mainTestId}-${i}`}
                          style={[
                            s.acRow,
                            i < Math.min(testResults.length, 10) - 1 && s.acRowBorder,
                            alreadyAdded && { backgroundColor: COLORS.primaryLight },
                          ]}
                          onPress={() => !alreadyAdded && handleTestSelect(t.testName, t.mainTestId)}
                          activeOpacity={alreadyAdded ? 1 : 0.75}
                        >
                          <View style={[s.testIconBox, { backgroundColor: alreadyAdded ? COLORS.primaryLight : '#F0F9FF' }]}>
                            <MaterialCommunityIcons
                              name="flask-outline"
                              size={16}
                              color={alreadyAdded ? COLORS.primaryDark : '#0369A1'}
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[s.acName, alreadyAdded && { color: COLORS.primaryDark }]}>
                              {t.testName}
                            </Text>
                            {t.testCode ? (
                              <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                                Code: {t.testCode}
                              </Text>
                            ) : null}
                          </View>
                          {alreadyAdded
                            ? <View style={[s.acBadge, { backgroundColor: COLORS.primaryDark }]}>
                                <Text style={s.acBadgeTxt}>Added ✓</Text>
                              </View>
                            : <View style={s.acBadge}>
                                <Text style={s.acBadgeTxt}>+ Add</Text>
                              </View>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Field>

              {/* Added tests chips */}
              {addedTests.length === 0
                ? <View style={s.noTestsBox}>
                    <MaterialCommunityIcons name="flask-outline" size={40} color={COLORS.primary} />
                    <Text style={s.noTestsText}>No tests added yet</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Search and select tests above</Text>
                  </View>
                : <View style={{ padding: 8 }}>
                    <Text style={[s.fieldHint, { marginBottom: 8 }]}>
                      {addedTests.length} test{addedTests.length > 1 ? 's' : ''} selected — tap to remove
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {addedTests.map((t, i) => (
                        <TouchableOpacity
                          key={i}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.primaryLight }}
                          onPress={() => {
                            setAddedTests(prev => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          <MaterialCommunityIcons name="flask-outline" size={13} color={COLORS.primaryDark} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' }}>{t}</Text>
                          <Feather name="x" size={13} color={COLORS.primaryDark} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
              }
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <SectionBar icon="credit-card-outline" title="Payment Details" />
            <View style={s.formCard}>
              <View style={s.payTypeRow}>
                <Text style={s.payTypeLabel}>Payment Type</Text>
                <View style={s.payTypeBtns}>
                  {PAYMENT_TYPES.map(pt => (
                    <TouchableOpacity key={pt} style={[s.payTypeBtn, payType===pt && s.payTypeBtnActive]} onPress={() => setPayType(pt)} activeOpacity={0.8}>
                      <Text style={[s.payTypeBtnText, payType===pt && s.payTypeBtnTextActive]}>{pt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.amountRow}>
                <Text style={s.amountLabel}>Total Amount</Text>
                <View style={s.amountValueBox}>
                  <Text style={s.amountValue}>
                    {grossTotal > 0 ? `₹${grossTotal.toFixed(2)}` : '0.00'}
                  </Text>
                </View>
                <Checkbox value={false} onToggle={() => {}} label="BTH" />
              </View>
              <View style={s.rowWrap2}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.fieldLabel}>Other Charge</Text>
                  <TextInput style={s.input} value={otherCharge} onChangeText={setOtherCharge} keyboardType="numeric" placeholderTextColor={COLORS.textMuted} />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={s.fieldLabel}>Other Charge Remark</Text>
                  <TextInput style={s.input} value={otherRemark} onChangeText={setOtherRemark} placeholderTextColor={COLORS.textMuted} />
                </View>
              </View>
              <View style={s.discRow}>
                <Text style={s.fieldLabel}>Disc Type</Text>
                <View style={{ flexDirection: 'row', marginLeft: 10, gap: 14 }}>
                  {DISC_TYPES.map(dt => (
                    <TouchableOpacity key={dt} style={s.radioRow} onPress={() => setDiscType(dt)}>
                      <View style={[s.radioOuter, discType===dt && s.radioOuterOn]}>{discType===dt && <View style={s.radioInner} />}</View>
                      <Text style={s.radioLabel}>{dt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flex: 1 }} />
                <Text style={[s.fieldLabel, { marginRight: 6, alignSelf: 'center' }]}>Disc Amt</Text>
                <TextInput
                  style={[s.input, { width: 80, textAlign: 'right' }]}
                  value={discAmt}
                  onChangeText={setDiscAmt}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <View style={s.netAmtRow}>
                <Text style={s.netAmtLabel}>Net Amount</Text>
                <Text style={s.netAmtValue}>₹ {netTotal.toFixed(2)}</Text>
              </View>
              <View style={s.rowWrap2}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.fieldLabel}>Paid Amt <Text style={{ color: COLORS.danger }}>*</Text></Text>
                  <TextInput
                    style={s.input}
                    value={paidAmt}
                    onChangeText={val => {
                      setUserEditedPaid(true);
                      setPaidAmt(val);
                    }}
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={s.fieldLabel}>Balance <Text style={{ color: COLORS.danger }}>*</Text></Text>
                  <View style={s.balanceBox}>
                    <Text style={[s.balanceText, { color: balance < 0 ? '#EF4444' : '#92400E' }]}>
                      {balance.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={s.remarkRow}>
                <Text style={s.fieldLabel}>Remark <Text style={{ color: COLORS.danger }}>*</Text></Text>
                <TextInput style={[s.input, { marginTop: 4 }]} placeholder="Remark" placeholderTextColor={COLORS.textMuted} value={remark} onChangeText={setRemark} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Checkbox value={emergency} onToggle={() => setEmergency(!emergency)} label="Emergency" />
                {emergency && <BlinkingEmergencyBulb size={18} style={{ marginLeft: 8 }} />}
              </View>
              <View style={s.uploadRow}>
                <Text style={s.uploadLabel}>Upload Prescription</Text>
                <TouchableOpacity style={s.chooseFileBtn} onPress={handleChoosePrescription} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="paperclip" size={14} color={COLORS.primaryDark} />
                  <Text style={s.chooseFileTxt}> {prescriptionFile ?? 'Choose File'}</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.uploadRow, { marginBottom: 14 }]}>
                <Text style={s.uploadLabel}>Upload Photo</Text>
                <TouchableOpacity style={s.chooseFileBtn} onPress={handleChoosePhoto} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="image-outline" size={14} color={COLORS.primaryDark} />
                  <Text style={s.chooseFileTxt}> {photoFile ? 'Change Photo' : 'Choose File'}</Text>
                </TouchableOpacity>
                {photoFile && <Image source={{ uri: photoFile }} style={{ width: 48, height: 48, borderRadius: 8, marginLeft: 10, borderWidth: 1, borderColor: COLORS.primaryLight }} />}
              </View>
              <View style={s.footerBtns}>
                <TouchableOpacity style={s.clearBtn} onPress={handleClear} activeOpacity={0.8}><MaterialCommunityIcons name="refresh" size={16} color="#FFF" /><Text style={s.saveBtnText}> Clear</Text></TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, registering && { opacity: 0.6 }]} onPress={handleSave} disabled={registering} activeOpacity={0.8}>
                  {registering ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialCommunityIcons name="content-save-outline" size={16} color="#FFF" />}
                  <Text style={s.saveBtnText}> {registering ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.updateBtn, (updating||regNo==='—') && { opacity: 0.5 }]} onPress={handleUpdate} disabled={updating||regNo==='—'} activeOpacity={0.8}>
                  {updating ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialCommunityIcons name="pencil-outline" size={16} color="#FFF" />}
                  <Text style={s.saveBtnText}> {updating ? 'Updating…' : 'Update'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBillBtn} activeOpacity={0.8}><MaterialCommunityIcons name="receipt" size={14} color="#FFF" /><Text style={s.saveBtnText}> Save &amp; Bill</Text></TouchableOpacity>
                <TouchableOpacity style={s.waBtn} activeOpacity={0.8}><MaterialCommunityIcons name="whatsapp" size={16} color="#FFF" /><Text style={s.saveBtnText}> WhatsApp</Text></TouchableOpacity>
              </View>
              <View style={s.bottomBar}>
                <TouchableOpacity style={s.bottomBarBtn} onPress={handleDeptBarcode} activeOpacity={0.8}><MaterialCommunityIcons name="barcode-scan" size={16} color="#FFF" /><Text style={s.bottomBarTxt}> Dept Barcode</Text></TouchableOpacity>
                <TouchableOpacity style={[s.bottomBarBtn,{backgroundColor:'#334155'}]} onPress={handleCard} activeOpacity={0.8}><MaterialCommunityIcons name="credit-card-outline" size={16} color="#FFF" /><Text style={s.bottomBarTxt}> Card</Text></TouchableOpacity>
                <TouchableOpacity style={[s.bottomBarBtn,{backgroundColor:COLORS.primaryDark}]} onPress={handleSampleBarcode} activeOpacity={0.8}><MaterialCommunityIcons name="qrcode-scan" size={16} color="#FFF" /><Text style={s.bottomBarTxt}> Sample Barcode</Text></TouchableOpacity>
                <TouchableOpacity style={[s.bottomBarBtn,{backgroundColor:'#1D4ED8'}]} onPress={handleCapturePhoto} activeOpacity={0.8}><MaterialCommunityIcons name="camera-outline" size={16} color="#FFF" /><Text style={s.bottomBarTxt}> Capture Photo</Text></TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={s.wizardNav}>
          {step > 1 && (
            <TouchableOpacity style={s.backNavBtn} onPress={handleBack} activeOpacity={0.8}>
              <Feather name="arrow-left" size={16} color={COLORS.primaryDark} />
              <Text style={s.backNavTxt}> Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < 3 && (
            <TouchableOpacity style={s.nextNavBtn} onPress={handleNext} activeOpacity={0.8}>
              <Text style={s.nextNavTxt}>Save & Next </Text>
              <Feather name="arrow-right" size={16} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, gap: 12 },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  regNoBadge:  { backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primaryLight },
  regNoBadgeTxt:{ fontSize: 11, fontWeight: '700', color: COLORS.primaryDark },
  stepBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  stepItem:    { alignItems: 'center', width: 64 },
  stepCircle:  { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceVariant, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.cardBorder, marginBottom: 4 },
  stepCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepCircleDone:   { backgroundColor: COLORS.success,   borderColor: COLORS.success   },
  stepLabel:   { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', lineHeight: 13 },
  stepLine:    { flex: 1, height: 2, backgroundColor: COLORS.cardBorder, marginBottom: 14 },
  stepLineDone:{ backgroundColor: COLORS.success },
  scroll:      { paddingBottom: 20 },
  sectionBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryDark, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  sectionBarText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  formCard:    { backgroundColor: COLORS.background, paddingHorizontal: 12, paddingTop: 8, marginBottom: 2 },
  fieldWrap:   { marginBottom: 8, position: 'relative' },
  rowWrap:     { flexDirection: 'row', alignItems: 'flex-start' },
  rowWrap2:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  input:       { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 6, paddingHorizontal: 10, height: 40, fontSize: 13, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  inputHighlight: { borderColor: COLORS.primary, borderWidth: 1.5 },
  inputLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  fieldLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  datePicker:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 6, paddingHorizontal: 10, height: 40, backgroundColor: COLORS.background },
  datePickerText: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  inlineSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 6, paddingHorizontal: 8, height: 40, backgroundColor: COLORS.background },
  inlineSelectText: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 440,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceVariant,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  modalList: {
    maxHeight: 340,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalItemActive: {
    backgroundColor: '#F0FDFA',
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  ddMenu:      { position: 'absolute', top: 42, left: 0, right: 0, minWidth: '100%', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 6, backgroundColor: COLORS.background, zIndex: 99999, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  ddItem:      { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  ddItemText:  { fontSize: 13, color: COLORS.textPrimary },
  checkRow:    { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  checkBox:    { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  checkBoxOn:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkLabel:  { fontSize: 12, color: COLORS.textPrimary, fontWeight: '500' },
  reportTypeRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  reportTypeLabel: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  reportTypeLabelText: { fontSize: 11, fontWeight: '800', color: COLORS.primaryDark, letterSpacing: 0.4 },
  noTestsBox:  { alignItems: 'center', paddingVertical: 32 },
  noTestsText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
  payTypeRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  payTypeLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginRight: 12, width: 90 },
  payTypeBtns:  { flexDirection: 'row', gap: 6 },
  payTypeBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.background },
  payTypeBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payTypeBtnText:       { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  payTypeBtnTextActive: { color: '#FFF' },
  amountRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  amountLabel:   { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', width: 100 },
  amountValueBox:{ flex: 1, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 6, paddingHorizontal: 10, height: 38, justifyContent: 'center', backgroundColor: '#F0FDFA' },
  amountValue:   { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  discRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  radioRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  radioOuter:  { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  radioOuterOn:{ borderColor: COLORS.primary },
  radioInner:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  radioLabel:  { fontSize: 13, color: COLORS.textPrimary },
  netAmtRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.primaryLight },
  netAmtLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.primaryDark },
  netAmtValue: { fontSize: 18, fontWeight: '900', color: COLORS.primaryDark },
  balanceBox:  { borderWidth: 1, borderColor: '#FDE68A', borderRadius: 6, paddingHorizontal: 10, height: 40, justifyContent: 'center', backgroundColor: '#FFFBEB' },
  balanceText: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  remarkRow:   { marginBottom: 10 },
  uploadRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 },
  uploadLabel:  { fontSize: 12, color: COLORS.textPrimary, fontWeight: '600', width: 130 },
  chooseFileBtn:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: COLORS.primaryLight },
  chooseFileTxt:{ fontSize: 12, color: COLORS.primaryDark, fontWeight: '600' },
  footerBtns:  { flexDirection: 'row', gap: 8, paddingVertical: 12, flexWrap: 'wrap' },
  clearBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.textSecondary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  updateBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D97706', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  saveBillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryDark, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11 },
  waBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16A34A', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  bottomBar:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  bottomBarBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#475569', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  bottomBarTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  wizardNav:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backNavBtn:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primaryDark, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  backNavTxt:  { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },
  nextNavBtn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  nextNavTxt:  { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Patient search
  searchHint:    { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginBottom: 6 },
  patSearchBar:  {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primaryLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.primaryLight,
  },
  patResultsBox: {
    borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: 10,
    backgroundColor: COLORS.background, marginTop: 4,
    elevation: 6, shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  patResultsHeader: {
    fontSize: 11, fontWeight: '700', color: COLORS.primaryDark,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.primaryLight, borderTopLeftRadius: 10, borderTopRightRadius: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.primaryLight,
  },
  patResultRow:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  patResultAvatar: { marginRight: 10 },
  patResultName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  patResultSub:  { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  patResultAddr: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  patResultFillBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8,
  },
  patResultFillTxt: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  noPatResult:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', borderRadius: 8,
    borderWidth: 1, borderColor: '#FDE68A',
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  noPatResultTxt:{ fontSize: 12, color: '#92400E', flex: 1 },

  // Test search
  fieldHint:    { fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  testSearchBox:{
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  testIconBox:  {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  // Autocomplete dropdown
  acDrop: {
    borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8,
    backgroundColor: COLORS.background, marginTop: 2,
    elevation: 10, shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
    zIndex: 9999,
  },
  acLoading: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  acLoadingTxt: { fontSize: 12, color: COLORS.textSecondary },
  acEmpty:  { flexDirection: 'row', alignItems: 'center', padding: 12 },
  acEmptyTxt: { fontSize: 12, color: COLORS.textMuted },
  acRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, backgroundColor: COLORS.background },
  acRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  acName:   { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  acSub:    { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  acBadge:  { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6 },
  acBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#FFF' },
});
