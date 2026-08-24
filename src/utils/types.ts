export type UserRole = 'admin' | 'patient' | 'phlebotomist' | 'refdoctor' | 'doctor';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  role: UserRole;
}

export interface BookingItem {
  id: string;
  patientName: string;
  testName: string;
  date: string;
  status: 'pending' | 'collected' | 'processing' | 'ready';
  amount: number;
}

export interface ReportItem {
  id: string;
  reportName: string;
  date: string;
  status: 'ready' | 'pending' | 'processing';
  patientName: string;
}

export interface DashboardStats {
  totalBookings: number;
  pendingReports: number;
  todayRevenue: number;
  totalPatients: number;
}

export interface UpcomingTest {
  id: string;
  testName: string;
  date: string;
  status: 'scheduled' | 'sample_collected' | 'processing' | 'ready';
  collectionType: 'home' | 'lab';
}

export interface ServiceCard {
  id: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  screen: string;
}

// ── Test Charges ──────────────────────────────────────────────────────────────
export interface TestCharge {
  TestChargeId: number;
  SubDeptId: number;
  MainTestId: number;
  PackageId: number | null;
  PackageName: string | null;
  RateTypeName: string;
  RateTypeId: number;
  TestType: string;
  MTCODE: string;
  TestName: string;
  Amount: number;
  ClientRate: number;
  Percentage: number;
  Emergency: number;
  Branchid: number;
  username: string;
  Createdby: string;
  Createdon: string;
  updatedby: string;
  updatedon: string;
  [key: string]: any;
}

// ── Packages ──────────────────────────────────────────────────────────────────
export interface Package {
  PackageId: number;
  PackageName: string;
}

export interface PrescriptionItem {
  id: string;
  name: string;
  dose: string;
  duration: string;
  timing?: string;
}

export interface RecommendedTestItem {
  id: string;
  testName: string;
  recommendedOn: string;
  isRequestedOnly: boolean;
}

export interface ConsultationRecord {
  appointmentId: number;
  doctorName: string;
  patientName: string;
  diagnosis: string;
  clinicalNotes: string;
  prescriptions: PrescriptionItem[];
  recommendedTests: RecommendedTestItem[];
  completedAt?: string;
  status: 'Pending' | 'Completed';
}
