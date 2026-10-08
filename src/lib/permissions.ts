/**
 * AceOne Solutions — Central Permission Registry
 *
 * Configurable, database-driven permissions organized by modules:
 * Tasks, Categories, Users, Daily Reports, Approvals, Files, Chat, Administration.
 */

export const PERMISSIONS = [
  // Tasks
  { key: "task.view", label: "View tasks", group: "Tasks" },
  { key: "task.create", label: "Create tasks", group: "Tasks" },
  { key: "task.edit", label: "Edit tasks", group: "Tasks" },
  { key: "task.delete", label: "Delete tasks", group: "Tasks" },
  { key: "task.assign", label: "Assign & reassign tasks", group: "Tasks" },
  { key: "task.comment", label: "Comment on tasks", group: "Tasks" },
  { key: "task.submit", label: "Submit task work", group: "Tasks" },
  { key: "task.review", label: "Review submissions & request changes", group: "Tasks" },
  { key: "task.approve", label: "Approve task submissions", group: "Tasks" },

  // Categories
  { key: "category.view", label: "View categories & departments", group: "Categories" },
  { key: "category.create", label: "Create categories", group: "Categories" },
  { key: "category.edit", label: "Edit categories", group: "Categories" },
  { key: "category.delete", label: "Delete / archive categories", group: "Categories" },

  // Users
  { key: "user.view", label: "View team members & directory", group: "Users" },
  { key: "user.create", label: "Create user accounts", group: "Users" },
  { key: "user.edit", label: "Edit user accounts", group: "Users" },
  { key: "user.delete", label: "Delete / deactivate users", group: "Users" },
  { key: "user.profile_edit", label: "Edit own profile details (Name, Phone, Bio)", group: "Users" },
  { key: "user.view_passwords", label: "View & recover user passwords (Credentials Vault)", group: "Users" },

  // Reports & Analytics CRM
  { key: "report.view", label: "View reports & analytics dashboard", group: "Reports" },
  { key: "report.category.view", label: "View category & department breakdown", group: "Reports" },
  { key: "report.crm.view", label: "Access CRM & Advanced Filtered Data Records", group: "Reports" },
  { key: "report.export", label: "Export CSV / Excel task reports", group: "Reports" },
  { key: "report.create", label: "Submit daily reports", group: "Reports" },
  { key: "report.review", label: "Review daily reports & request revisions", group: "Reports" },
  { key: "report.approve", label: "Approve daily reports", group: "Reports" },

  // Approvals
  { key: "approval.view", label: "View approvals queue", group: "Approvals" },
  { key: "approval.review", label: "Review & request changes on approvals", group: "Approvals" },
  { key: "approval.approve", label: "Approve workflow items", group: "Approvals" },

  // Files
  { key: "file.view", label: "View & preview files", group: "Files" },
  { key: "file.upload", label: "Upload files & attachments", group: "Files" },
  { key: "file.download", label: "Download files", group: "Files" },
  { key: "file.edit", label: "Edit & rename stored files", group: "Files" },
  { key: "file.delete", label: "Delete & archive stored files", group: "Files" },

  // Chat
  { key: "chat.view", label: "Access chat & team discussions", group: "Chat" },
  { key: "chat.send", label: "Send messages & media in chat", group: "Chat" },

  // Administration
  { key: "role.view", label: "View roles", group: "Administration" },
  { key: "role.manage", label: "Manage & configure roles", group: "Administration" },
  { key: "permission.view", label: "View permissions matrix", group: "Administration" },
  { key: "permission.assign", label: "Assign permissions & user overrides", group: "Administration" },
  { key: "scope.view", label: "View user scopes", group: "Administration" },
  { key: "scope.manage", label: "Manage category, assignment & approval scopes", group: "Administration" },
  { key: "audit.view", label: "View system audit logs", group: "Administration" },
  { key: "settings.manage", label: "Manage system settings & custom fields", group: "Administration" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type PermissionDefinition = (typeof PERMISSIONS)[number];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** Default permission sets per role code. Configurable in DB and overridable per user. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: [
    "task.view", "task.create", "task.edit", "task.delete", "task.assign", "task.comment", "task.submit", "task.review", "task.approve",
    "category.view", "category.create", "category.edit", "category.delete",
    "user.view", "user.create", "user.edit", "user.delete", "user.profile_edit", "user.view_passwords",
    "report.view", "report.category.view", "report.crm.view", "report.export", "report.create", "report.review", "report.approve",
    "approval.view", "approval.review", "approval.approve",
    "file.view", "file.upload", "file.download", "file.edit", "file.delete",
    "chat.view", "chat.send",
    "role.view", "role.manage", "permission.view", "permission.assign", "scope.view", "scope.manage",
    "audit.view", "settings.manage",
  ],
  manager: [
    "task.view", "task.create", "task.edit", "task.assign", "task.comment", "task.submit", "task.review", "task.approve",
    "category.view",
    "user.view",
    "report.view", "report.category.view", "report.crm.view", "report.export", "report.create", "report.review", "report.approve",
    "approval.view", "approval.review", "approval.approve",
    "file.view", "file.upload", "file.download", "file.edit",
    "chat.view", "chat.send",
  ],
  employee: [
    "task.view", "task.comment", "task.submit",
    "report.view", "report.create",
    "file.view", "file.upload", "file.download",
    "chat.view", "chat.send",
  ],
};

/**
 * Universal permission helper for client and server.
 * Checks whether user has the requested permission key (or full access '*').
 */
export function hasUserPermission(
  user: { role?: { isSystem?: boolean; code?: string }; effectivePermissions?: string[] } | null | undefined,
  key: PermissionKey | string
): boolean {
  if (!user) return false;
  if (user.role?.isSystem || user.role?.code === "super_admin") return true;
  if (user.effectivePermissions?.includes("*") || user.effectivePermissions?.includes(key)) return true;
  return false;
}