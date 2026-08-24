import { LoginCredentials, AuthResponse, User, UserRole } from '../utils/types';
import { API_BASE_URL } from '../utils/constants';
import { authenticateUser } from './mockDatabase';

import { Alert } from 'react-native';

/**
 * POST /api/ManageUser/Login
 * Body   : { UserName: string, Password: string }
 *
 * The API may return different shapes depending on the backend.
 * We normalise whatever comes back into the AuthResponse the app expects.
 */
export async function loginUser(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const requestBody = {
    UserName: credentials.username,
    Password: credentials.password,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/ManageUser/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr: any) {
    // Network unreachable — try mock database
    const mock = authenticateUser(credentials.username, credentials.password);
    if (mock) return { user: mock.user, token: mock.token, role: mock.role };
    throw new Error('Cannot reach the server. Please check your internet connection.');
  }

  // Parse body (guard against empty / non-JSON responses)
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    // Try mock database as fallback (for dev/demo users)
    const mock = authenticateUser(credentials.username, credentials.password);
    if (mock) {
      return { user: mock.user, token: mock.token, role: mock.role };
    }
    const msg =
      data?.message ||
      data?.Message ||
      data?.title ||
      `Login failed (HTTP ${response.status})`;
    throw new Error(msg);
  }


  // ── Normalise API response → AuthResponse ─────────────────────────────────
  //
  // The backend may return the user fields at the top level or nested.
  // Common shapes handled:
  //   { token, userId, userName, role, fullName, email, ... }   ← flat
  //   { token, user: { id, name, email, role, ... } }           ← nested
  //   { Token, UserId, UserName, Role, ... }                     ← Pascal case
  //   [ { menuName: "...", canView: true }, ... ]                ← Menu array
  //

  const raw = data ?? {};
  let role: UserRole = 'admin';

  // Extract menus regardless of whether it's an Array, Dictionary, or nested Array
  let menuList: any[] = [];
  if (Array.isArray(data)) {
    menuList = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.permissions)) menuList = data.permissions;
    else if (Array.isArray(data.menuPermissions)) menuList = data.menuPermissions;
    else if (Array.isArray(data.data)) menuList = data.data;
    else if (Array.isArray(data.Data)) menuList = data.Data;
    else if (Array.isArray(data.menus)) menuList = data.menus;
    else if (Array.isArray(data.menuList)) menuList = data.menuList;
    else if (Array.isArray(data.response)) menuList = data.response;
    else {
      const values = Object.values(data);
      if (values.length > 0 && values[0] && typeof values[0] === 'object' && 'menuName' in (values[0] as any)) {
        menuList = values;
      }
    }
  }

  // Resolve role from object as a strong fallback
  const rawRole: string =
    (raw.roleName || raw.RoleName || raw.role || raw.Role || raw.userRole || raw.UserRole || raw.userType || raw.UserType || 'admin')
      .toString()
      .toLowerCase();

  const stringRole =
    rawRole.includes('patient')               ? 'patient'
    : (rawRole.includes('phlebotomist') || rawRole.includes('collection') || rawRole.includes('phlebo')) ? 'phlebotomist'
    : (rawRole.includes('refdoctor') || rawRole.includes('referring') || rawRole.includes('ref doctor')) ? 'refdoctor'
    : (rawRole.includes('doctor') || rawRole.includes('main doctor')) ? 'doctor'
    : 'admin';

  // If the backend provided a clear explicit role, trust it over menu inferences.
  // Phlebotomists often have some billing permissions (for home collection payments),
  // which can falsely flag them as Admins if we strictly rely on menu inference.
  if (stringRole !== 'admin') {
    role = stringRole as UserRole;
  } else if (menuList.length > 0) {
    // Fallback: Infer role based on menus ONLY if roleName was missing or "admin"
    const hasAccess = (item: any) => item.canView === true || item.canView === 1 || item.canView === "true";
    
    const hasAdminPowers = menuList.some(m => 
      m.menuName && 
      (m.menuName.toLowerCase() === 'billing' || m.menuName.toLowerCase() === 'account section') && 
      hasAccess(m)
    );

    const isPhlebo = menuList.some(m => 
      m.pageUrl && 
      m.pageUrl.toLowerCase().includes('phlebotomist') && 
      hasAccess(m)
    );

    if (hasAdminPowers) {
      role = 'admin';
    } else if (isPhlebo) {
      role = 'phlebotomist';
    } else {
      role = 'patient';
    }
  } else {
    role = 'admin';
  }

  // Resolve token
  const token: string =
    raw.token || raw.Token || raw.accessToken || raw.AccessToken || 'no-token';

  // Resolve user fields (handle both flat and nested)
  const nested = raw.user || raw.User || {};
  const fullNameStr = raw.firstName ? `${raw.firstName} ${raw.lastName || ''}`.trim() : null;
  
  const user: User = {
    id:       String(raw.userId || raw.UserId || nested.id || nested.Id || raw.id || ''),
    name:     String(fullNameStr || raw.employeeName || raw.EmployeeName || raw.fullName || raw.FullName || nested.name || nested.Name || raw.name || raw.userName || raw.UserName || credentials.username),
    username: String(raw.userName || raw.UserName || raw.loginName || raw.LoginName || raw.name || credentials.username || ''),
    email:    String(raw.email || raw.Email || nested.email || nested.Email || ''),
    role,
    phone:    raw.mobile || raw.Mobile || raw.mobileNo || raw.MobileNo || raw.phone || raw.Phone || nested.phone || undefined,
  };

  return { user, token, role };
}

export async function logoutUser(): Promise<void> {
  // Token is stateless (JWT) — clearing local storage in AuthContext is enough.
  // Add a server-side invalidation call here if the backend supports it.
  await new Promise(res => setTimeout(res, 100));
}
