import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// â”€â”€ Tab root screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import DashboardScreen        from '../screens/admin/DashboardScreen';
import FrontDeskScreen        from '../screens/admin/FrontDeskScreen';
import LaboratoryScreen       from '../screens/admin/LaboratoryScreen';
import CompletedReportsScreen from '../screens/admin/CompletedReportsScreen';
import MasterScreen           from '../screens/admin/MasterScreen';

// ──────────────────────────────────────────────────────────────────────────────────
import NewRegistrationScreen  from '../screens/admin/NewRegistrationScreen';
import PatientsScreen         from '../screens/admin/PatientsScreen';       // Patient Status
import PlaceholderScreen      from '../screens/admin/PlaceholderScreen';

// ──────────────────────────────────────────────────────────────────────────────────
import SamplesScreen          from '../screens/admin/SamplesScreen';        // Accession
import ReportsScreen          from '../screens/admin/ReportsScreen';        // Result Entry
import PendingReportsScreen   from '../screens/admin/PendingReportsScreen'; // Pending Reports
import ReportApprovalScreen  from '../screens/admin/ReportApprovalScreen';  // Report Approval
import AddResultWithTestParamScreen from '../screens/doctor/AddResultWithTestParamScreen';

// ──────────────────────────────────────────────────────────────────────────────────
import DoctorManagementScreen from '../screens/admin/DoctorManagementScreen';
import DoctorAppointmentScreen from '../screens/admin/DoctorAppointmentScreen';
import AddDoctorScheduleScreen from '../screens/admin/AddDoctorScheduleScreen';
import AddDoctorSlotScreen    from '../screens/admin/AddDoctorSlotScreen';
import AppointmentRecordsScreen   from '../screens/admin/AppointmentRecordsScreen';
import SearchAvailableSlotsScreen from '../screens/admin/SearchAvailableSlotsScreen';
import AppointmentListScreen      from '../screens/admin/AppointmentListScreen';
import TestChargesScreen          from '../screens/admin/TestChargesScreen';
import TestChargeDetailScreen     from '../screens/admin/TestChargeDetailScreen';
import PackagesScreen             from '../screens/admin/PackagesScreen';
import ReferralDoctorScreen       from '../screens/admin/ReferralDoctorScreen';
import CollectionCenterScreen     from '../screens/admin/CollectionCenterScreen';
import EditPatientScreen          from '../screens/admin/EditPatientScreen';
import SharedProfileScreen        from '../screens/shared/SharedProfileScreen';
import BillingDeskScreen          from '../screens/shared/BillingDeskScreen';

import { COLORS } from '../utils/constants';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Screens that should SHOW the tab bar
const TAB_ROOTS = new Set([
  'DashboardMain', 'FrontDeskMain', 'LaboratoryMain', 'ReportsMain', 'MasterMain',
]);

function getTabStyle(route: any) {
  const name = getFocusedRouteNameFromRoute(route) ?? '';
  if (name !== '' && !TAB_ROOTS.has(name)) return { display: 'none' as const };
  return {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    height: 64, paddingBottom: 8, paddingTop: 8,
    elevation: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06, shadowRadius: 10,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1. DASHBOARD STACK
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain"    component={DashboardScreen} />
      <Stack.Screen name="NewRegistration"  component={NewRegistrationScreen} />
      <Stack.Screen name="PatientStatus"    component={PatientsScreen} />
      <Stack.Screen name="EditPatient"      component={EditPatientScreen} />
      <Stack.Screen name="SampleCollection" component={SamplesScreen} />
      <Stack.Screen name="ResultEntry"      component={ReportsScreen} />
      <Stack.Screen name="AddResultWithTestParam" component={AddResultWithTestParamScreen} />
      <Stack.Screen name="BillPayment"      component={BillingDeskScreen} />
      <Stack.Screen name="PendingReports"   component={PendingReportsScreen} />
      <Stack.Screen name="ReportApproval"   component={ReportApprovalScreen} />
    </Stack.Navigator>
  );
}

// ──────────────────────────────────────────────────────────────────────────────────
// 2. FRONT DESK STACK
// ──────────────────────────────────────────────────────────────────────────────────
function FrontDeskStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FrontDeskMain"   component={FrontDeskScreen} />
      <Stack.Screen name="NewRegistration" component={NewRegistrationScreen} />
      <Stack.Screen name="PatientStatus"   component={PatientsScreen} />
      <Stack.Screen name="EditPatient"     component={EditPatientScreen} />
      <Stack.Screen name="BillPayment"     component={BillingDeskScreen} />
      <Stack.Screen name="HomeCollection"
        component={PlaceholderScreen}
        initialParams={{ title: 'Home Collection Booking', icon: 'home-city-outline' }}
      />
    </Stack.Navigator>
  );
}

// ──────────────────────────────────────────────────────────────────────────────────
// 3. LABORATORY STACK
// ──────────────────────────────────────────────────────────────────────────────────
function LaboratoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LaboratoryMain"  component={LaboratoryScreen} />
      <Stack.Screen name="SampleCollection" component={SamplesScreen} />
      <Stack.Screen name="Accession"       component={SamplesScreen} />
      <Stack.Screen name="ResultEntry"     component={ReportsScreen} />
      <Stack.Screen name="AddResultWithTestParam" component={AddResultWithTestParamScreen} />
      <Stack.Screen name="PendingReports"  component={PendingReportsScreen} />
      <Stack.Screen name="ReportApproval"  component={ReportApprovalScreen} />
    </Stack.Navigator>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4. REPORTS STACK
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsMain"     component={CompletedReportsScreen} />
    </Stack.Navigator>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 5. MASTER STACK
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MasterStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MasterMain"      component={MasterScreen} />

      {/* Doctor Management */}
      <Stack.Screen name="DoctorManagement"     component={DoctorManagementScreen} />
      {/* 1. Doctor Schedule */}
      <Stack.Screen name="DrAppointment"        component={DoctorAppointmentScreen} />
      <Stack.Screen name="AddDoctorSchedule"    component={AddDoctorScheduleScreen} />
      {/* 2. Dr Slot */}
      <Stack.Screen name="DrSlot"               component={AddDoctorSlotScreen} />
      <Stack.Screen name="AddDoctorSlot"        component={AddDoctorSlotScreen} />
      {/* 3. Dr Appointment (Appointment Desk) */}
      <Stack.Screen name="AppointmentRecords"   component={AppointmentRecordsScreen} />
      <Stack.Screen name="SearchAvailableSlots" component={SearchAvailableSlotsScreen} />
      {/* 4. Show Appointment */}
      <Stack.Screen name="ShowAppointment"      component={AppointmentListScreen} />
      <Stack.Screen name="ReferralDoctor"       component={ReferralDoctorScreen} />

      {/* Test Management */}
      <Stack.Screen name="TestCharges"      component={TestChargesScreen} />
      <Stack.Screen name="TestMaster"       component={PlaceholderScreen} initialParams={{ title: 'Test Master', icon: 'test-tube' }} />
      <Stack.Screen name="TestChargeDetail" component={TestChargeDetailScreen} />
      <Stack.Screen name="Packages"         component={PackagesScreen} />
      <Stack.Screen name="PackageMaster"    component={PlaceholderScreen} initialParams={{ title: 'Package Master', icon: 'package-variant' }} />
      <Stack.Screen name="DepartmentMaster" component={PlaceholderScreen} initialParams={{ title: 'Department Master', icon: 'office-building-outline' }} />
      <Stack.Screen name="SampleTypeMaster" component={PlaceholderScreen} initialParams={{ title: 'Sample Type Master', icon: 'flask-outline' }} />
      <Stack.Screen name="TubeMaster"       component={PlaceholderScreen} initialParams={{ title: 'Tube Master', icon: 'test-tube-empty' }} />

      {/* Laboratory masters */}
      <Stack.Screen name="CollectionCenter" component={CollectionCenterScreen} />
      <Stack.Screen name="Instruments"      component={PlaceholderScreen} initialParams={{ title: 'Instruments', icon: 'robot-industrial-outline' }} />

      {/* Staff */}
      <Stack.Screen name="StaffManagement"  component={PlaceholderScreen} initialParams={{ title: 'Staff', icon: 'account-multiple-outline' }} />
      <Stack.Screen name="Roles"            component={PlaceholderScreen} initialParams={{ title: 'Roles', icon: 'shield-account-outline' }} />
      <Stack.Screen name="Permissions"      component={PlaceholderScreen} initialParams={{ title: 'Permissions', icon: 'lock-outline' }} />
      {/* Profile */}
      <Stack.Screen name="AdminProfile"     component={SharedProfileScreen} />
    </Stack.Navigator>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ROOT TAB NAVIGATOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AdminNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: getTabStyle(route),
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ color, focused }) => {
          switch (route.name) {
            case 'Dashboard':
              return <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />;
            case 'FrontDesk':
              return <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />;
            case 'Laboratory':
              return <MaterialCommunityIcons name={focused ? 'flask' : 'flask-outline'} size={22} color={color} />;
            case 'Reports':
              return <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />;
            case 'More':
              return <MaterialCommunityIcons name={focused ? 'cog' : 'cog-outline'} size={22} color={color} />;
            default:
              return <Ionicons name="ellipse-outline" size={22} color={color} />;
          }
        },
      })}
    >
      <Tab.Screen name="Dashboard"  component={DashboardStack}  options={{ title: 'Dashboard'   }} />
      <Tab.Screen name="FrontDesk"  component={FrontDeskStack}  options={{ title: 'Front Desk'  }} />
      <Tab.Screen name="Laboratory" component={LaboratoryStack} options={{ title: 'Laboratory'  }} />
      <Tab.Screen name="Reports"    component={ReportsStack}    options={{ title: 'Reports'     }} />
      <Tab.Screen name="More"       component={MasterStack}     options={{ title: 'More'        }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({});

