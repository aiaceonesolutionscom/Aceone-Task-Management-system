/**
 * The user shape used by authorization and session helpers. It is the result
 * of including role + role permissions + computed effective permissions.
 */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  username: string | null;
  employeeId: string | null;
  designation: string | null;
  avatarUrl: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleId: number;
  primaryDepartmentId: number | null;
  primaryDepartment?: {
    id: number;
    name: string;
    code: string | null;
  } | null;
  role: {
    code: string;
    name: string;
    isSystem: boolean;
    permissions: Array<{ permission: { key: string } }>;
  };
  effectivePermissions: string[];
};