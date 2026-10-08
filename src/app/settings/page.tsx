import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { UserPreferencesForm } from "@/components/settings/user-preferences-form";
import { SuperAdminPasswordVault } from "@/components/settings/super-admin-password-vault";
import { getFullPasswordVault, getPasswordAuditHistory } from "@/lib/password-vault";
import {
  User,
  Shield,
  KeyRound,
  Sliders,
} from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();

  // Load complete profile with description/bio
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
      primaryDepartment: true,
    },
  });

  const canViewPasswords = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin" ||
    user.effectivePermissions?.includes("*") ||
    user.effectivePermissions?.includes("user.view_passwords")
  );

  const canEditProfile = Boolean(
    user.role.isSystem ||
    user.role.code === "super_admin" ||
    user.role.code === "admin" ||
    user.effectivePermissions?.includes("*") ||
    user.effectivePermissions?.includes("user.profile_edit")
  );

  // If permitted (Super Admin, Admin, CEO, or user.view_passwords grant), fetch vault and audit history
  let allUsers: any[] = [];
  let vault: Record<string, any> = {};
  let passwordAuditLogs: any[] = [];

  if (canViewPasswords) {
    const [fetchedUsers, fetchedVault, fetchedLogs] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          role: { select: { name: true, code: true } },
          primaryDepartment: { select: { name: true } },
          status: true,
        },
        orderBy: { name: "asc" },
      }),
      getFullPasswordVault(),
      getPasswordAuditHistory(undefined, 100),
    ]);

    allUsers = fetchedUsers;
    vault = fetchedVault;
    passwordAuditLogs = fetchedLogs;
  }

  const profileData = {
    id: user.id,
    name: fullUser?.name || user.name,
    email: user.email,
    username: user.username,
    employeeId: user.employeeId,
    phone: fullUser?.phone || user.phone,
    designation: user.designation,
    description: fullUser?.description,
    role: {
      name: user.role.name,
      code: user.role.code,
    },
    primaryDepartment: user.primaryDepartment
      ? { name: user.primaryDepartment.name }
      : null,
  };

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6 pb-14">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-200">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              <span>Account &amp; Workspace Settings</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Manage your personal credentials, contact details, display preferences, and account security.
            </p>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded text-xs font-semibold bg-neutral-100 text-neutral-800 uppercase tracking-wide">
            {user.role.name}
          </span>
        </div>

        {/* Section 1: User Profile & Contact Info (Default for ALL employees/users) */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-neutral-900">Personal &amp; Profile Information</h2>
            </div>
            <span className="text-[11px] text-neutral-400">
              Default for all team members
            </span>
          </div>

          <ProfileSettingsForm user={profileData} canEditProfile={canEditProfile} />
        </div>

        {/* Section 2: Password & Credentials Management (Default for ALL employees/users) */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-neutral-900">Change Password</h2>
            </div>
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-600" /> End-to-end encrypted
            </span>
          </div>

          <ChangePasswordForm />
        </div>

        {/* Section 3: Workspace Preferences (Default for ALL employees/users) */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-neutral-900">Display &amp; Notification Preferences</h2>
            </div>
            <span className="text-[11px] text-neutral-400">
              Customize your workstation
            </span>
          </div>

          <UserPreferencesForm />
        </div>

        {/* Section 4: Super Admin / Executive Password Vault & Audit History */}
        {canViewPasswords && (
          <SuperAdminPasswordVault
            users={allUsers}
            vault={vault}
            auditLogs={passwordAuditLogs}
          />
        )}
      </div>
    </AppShell>
  );
}
