"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  ClipboardCheck,
  Calendar,
  BarChart3,
  FileText,
  HardDrive,
  Users,
  FolderTree,
  Shield,
  KeyRound,
  Compass,
  FileCode2,
  History,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  User as UserIcon,
  Images,
  MessageSquare,
  PanelLeftClose,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { AuthUser } from "@/lib/auth-types";
import { NotificationPopover } from "@/components/layout/notification-popover";
import { MandatoryPushModal } from "@/components/notifications/mandatory-push-modal";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string;
  permission?: string;
  adminOnly?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export function AppShell({
  user,
  unreadCount = 0,
  children,
}: {
  user: AuthUser;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [realTimeTasksCount, setRealTimeTasksCount] = useState<number>(0);
  const [realTimeApprovalsCount, setRealTimeApprovalsCount] = useState<number>(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Persist collapsed state & auto-collapse on compact screens (e.g. laptops < 1200px) or user preferences
  useEffect(() => {
    try {
      const prefsRaw = localStorage.getItem("aceone_user_preferences");
      if (prefsRaw) {
        const p = JSON.parse(prefsRaw);
        if (p.autoCollapseSidebar === true) {
          setCollapsed(true);
          return;
        }
        if (p.compactDensity === true) {
          document.documentElement.classList.add("compact-density");
        } else {
          document.documentElement.classList.remove("compact-density");
        }
      }
    } catch {}

    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setCollapsed(true);
    } else if (saved === null && typeof window !== "undefined" && window.innerWidth < 1200) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const isSystemAdmin = Boolean(
    user.role.isSystem || user.role.code === "super_admin" || user.role.code === "admin"
  );
  const isEmployee = user.role.code === "employee";
  const isManager = user.role.code === "manager";
  const userPerms = new Set(
    user.effectivePermissions || user.role.permissions?.map((p) => p.permission.key) || []
  );

  const hasPerm = (perm?: string) => {
    if (!perm) return true;
    if (user.role.isSystem || user.role.code === "super_admin") return true;
    if (userPerms.has("*")) return true;
    return userPerms.has(perm);
  };

  // Build dynamic, permission-driven navigation groups
  const overviewItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ...(hasPerm("task.view")
      ? [
          {
            label: isEmployee ? "My Tasks" : isManager ? "Department Tasks" : "All Tasks",
            href: "/tasks",
            icon: CheckSquare,
            badge: realTimeTasksCount > 0 ? realTimeTasksCount : undefined,
          },
        ]
      : []),
    ...(hasPerm("approval.view") || hasPerm("task.review") || hasPerm("task.approve")
      ? [
          {
            label: "Approvals Queue",
            href: "/approvals",
            icon: ClipboardCheck,
            badge: realTimeApprovalsCount > 0 ? realTimeApprovalsCount : undefined,
          },
        ]
      : []),
    ...(hasPerm("chat.view") ? [{ label: "Chat & Discussions", href: "/chat", icon: MessageSquare }] : []),
    ...(hasPerm("file.view") ? [{ label: "Media Library", href: "/media", icon: Images }] : []),
    ...(hasPerm("report.view") || hasPerm("report.create")
      ? [{ label: "Daily Reports", href: "/daily-reports", icon: FileText }]
      : []),
    ...(hasPerm("task.view")
      ? [{ label: isEmployee ? "Calendar & Deadlines" : "Calendar", href: "/calendar", icon: Calendar }]
      : []),
    ...(hasPerm("report.view") || hasPerm("report.category.view")
      ? [{ label: "Reports & Analytics", href: "/reports", icon: BarChart3 }]
      : []),
  ];

  const organizationItems: NavItem[] = [
    ...(hasPerm("user.view")
      ? [{ label: isManager && !isSystemAdmin ? "Team Members" : "Users & Team", href: "/organization/users", icon: Users }]
      : []),
    ...(hasPerm("category.view") && !isEmployee
      ? [{ label: "Categories", href: "/organization/categories", icon: FolderTree }]
      : []),
    ...(hasPerm("role.view")
      ? [{ label: "Roles", href: "/organization/roles", icon: Shield }]
      : []),
    ...(hasPerm("scope.view") || hasPerm("scope.manage")
      ? [{ label: "Scopes", href: "/organization/scopes", icon: Compass }]
      : []),
  ];

  const systemItems: NavItem[] = [
    ...(hasPerm("file.view") && !isEmployee && !isManager
      ? [{ label: "Files & Storage", href: "/files", icon: HardDrive }]
      : []),
    ...(hasPerm("audit.view")
      ? [{ label: "Audit Logs", href: "/audit", icon: History }]
      : []),
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const navGroups: NavGroup[] = [
    {
      title: isEmployee ? "My Workspace" : "Overview",
      items: overviewItems,
    },
    ...(organizationItems.length > 0
      ? [
          {
            title: isManager && !isSystemAdmin ? "Management & Team" : "Organization",
            items: organizationItems,
          },
        ]
      : []),
    {
      title: isEmployee ? "Settings & Preferences" : "System & Settings",
      items: systemItems,
    },
  ];


  return (
    <div className="min-h-screen bg-[#fafbfc] text-neutral-900 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {pathname !== "/dashboard" && pathname !== "/" && (
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700 inline-flex items-center"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-700 inline-flex items-center"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center ml-0.5">
            <Image
              src="/aceone-logo.webp"
              alt="AceOne Solutions"
              width={120}
              height={30}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationPopover
            isPrimary={false}
            initialUnreadCount={unreadCount}
            onSyncCounts={({ activeTasksCount, pendingApprovalsCount }) => {
              setRealTimeTasksCount(activeTasksCount);
              setRealTimeApprovalsCount(pendingApprovalsCount);
            }}
          />
          <Link href="/profile" className="p-1 rounded-full hover:bg-neutral-100" title="My Profile">
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </Link>
          <Link
            href="/settings"
            className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign out"
            className="p-1.5 text-neutral-500 hover:text-rose-600 rounded-md hover:bg-neutral-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — Fixed on desktop, overlay on mobile */}
      {(() => {
        const isEffectiveCollapsed = collapsed && !mobileOpen;

        return (
          <aside
            className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-neutral-200 flex flex-col transition-all duration-300 ease-in-out
              ${mobileOpen ? "translate-x-0 w-72 shadow-2xl" : "-translate-x-full"}
              md:translate-x-0 md:sticky md:top-0 md:h-screen md:z-30 md:shrink-0
            `}
            style={{ width: mobileOpen ? 288 : (collapsed ? 68 : 256) }}
          >
            {/* Brand Header */}
            <div className={`border-b border-neutral-100 flex items-center ${isEffectiveCollapsed ? "justify-center px-2 py-3" : "justify-between px-5 py-4"}`}>
              {isEffectiveCollapsed ? (
            /* Collapsed: branded "A" icon → hover shows hamburger menu to expand */
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="group relative w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-neutral-100"
              title="Expand sidebar"
            >
              {/* Branded AceOne A emblem — visible by default, hidden on hover */}
              <Image
                src="/aceone-icon.png"
                alt="AceOne"
                width={32}
                height={32}
                className="w-7 h-7 object-contain select-none group-hover:opacity-0 transition-opacity duration-150"
                priority
              />
              {/* Hamburger — hidden by default, visible on hover */}
              <Menu className="w-5 h-5 text-neutral-600 absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
            </button>
          ) : (
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/aceone-logo.webp"
                alt="AceOne Solutions"
                width={140}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? "hidden" : ""}`}>
            {/* Collapse toggle — Desktop only */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden md:inline-flex p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
            {/* Mobile close */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded hover:bg-neutral-100 text-neutral-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation list */}
        <div className={`flex-1 overflow-y-auto no-scrollbar py-3 space-y-5 ${collapsed ? "px-1.5" : "px-3"}`}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => hasPerm(item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    {group.title}
                  </p>
                )}
                {collapsed && (
                  <div className="h-[1px] bg-neutral-100 mx-1 my-2" />
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`relative group flex items-center rounded-md text-xs font-medium transition-colors ${
                          collapsed
                            ? `justify-center px-0 py-2 ${
                                active
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                              }`
                            : `justify-between px-2.5 py-1.5 ${
                                active
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                              }`
                        }`}
                      >
                        <div className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}>
                          <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-neutral-500"}`} />
                          {!collapsed && <span>{item.label}</span>}
                        </div>

                        {/* Badge */}
                        {item.badge != null && !collapsed && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-2xs ${
                              active
                                ? "bg-white text-neutral-900"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.badge != null && collapsed && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600" />
                        )}

                        {/* Tooltip on collapsed hover */}
                        {collapsed && (
                          <span className="pointer-events-none absolute left-full ml-2.5 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[60] shadow-lg">
                            {item.label}
                            {item.badge != null && (
                              <span className="ml-1.5 px-1 py-0.5 rounded bg-blue-500 text-[10px]">
                                {item.badge}
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </aside>
    );
  })()}

      {/* Main Content Area — scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto overflow-x-hidden">
        {/* Desktop Top Header */}
        <header className="hidden md:flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-neutral-200 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium min-w-0 flex-1 overflow-x-auto no-scrollbar mr-3">
            {pathname !== "/dashboard" && pathname !== "/" && (
              <>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded transition-colors mr-1 cursor-pointer shadow-2xs shrink-0"
                  title="Go back to previous page"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <div className="h-4 w-[1px] bg-neutral-200 mr-1 shrink-0" />
              </>
            )}
            <Link href="/dashboard" className="hover:text-neutral-900 font-medium shrink-0">
              Home
            </Link>
            {pathname
              .split("/")
              .filter(Boolean)
              .map((segment, idx, arr) => {
                const href = "/" + arr.slice(0, idx + 1).join("/");
                const isLast = idx === arr.length - 1;
                return (
                  <React.Fragment key={href}>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    {isLast ? (
                      <span className="text-neutral-900 font-semibold capitalize whitespace-nowrap">
                        {segment.replace("-", " ")}
                      </span>
                    ) : (
                      <Link href={href} className="hover:text-neutral-900 capitalize whitespace-nowrap">
                        {segment.replace("-", " ")}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <NotificationPopover
              initialUnreadCount={unreadCount}
              onSyncCounts={({ activeTasksCount, pendingApprovalsCount }) => {
                setRealTimeTasksCount(activeTasksCount);
                setRealTimeApprovalsCount(pendingApprovalsCount);
              }}
            />
            <div className="h-4 w-[1px] bg-neutral-200 mx-1" />
            <Link
              href="/profile"
              className="flex items-center gap-2 text-xs font-medium text-neutral-700 hover:text-neutral-900"
            >
              <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden lg:inline">{user.name}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 rounded text-neutral-600">
                {user.role.code}
              </span>
            </Link>
            <Link
              href="/settings"
              className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign out"
              className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-7 max-w-full 2xl:max-w-[1600px] w-full mx-auto min-w-0 overflow-x-hidden">{children}</main>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <LogOut className="w-6 h-6 ml-0.5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900">Sign Out of AceOne?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Are you sure you want to end your current session? You will need to log back in to access tasks, approvals, and team chat.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <form action={logoutAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Yes, Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
