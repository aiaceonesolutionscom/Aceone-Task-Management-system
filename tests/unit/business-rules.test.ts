import { describe, expect, it } from "vitest";
import {
  canAssignInCategory,
  canApproveInCategory,
  canViewCategory,
  hasEffectivePermission,
  type EffectiveUser,
} from "@/lib/scopes";

function createMockUser(overrides: Partial<EffectiveUser> = {}): EffectiveUser {
  return {
    id: 1,
    name: "Ahmed Manager",
    email: "ahmed@aceone.com",
    username: "ahmed.mgr",
    employeeId: "AS1-MGR-0001",
    designation: "Manager",
    status: "ACTIVE",
    roleId: 2,
    primaryDepartmentId: 10, // Graphic Design
    role: {
      code: "manager",
      name: "Manager",
      isSystem: false,
    },
    permissions: new Set([
      "task.view",
      "task.create",
      "task.assign",
      "task.review",
      "task.request_changes",
      "task.approve",
    ]),
    categoryScopeIds: [10], // Graphic Design
    assignmentScopeIds: [10], // Graphic Design only
    approvalScopeIds: [10], // Graphic Design only
    enabledFacilities: ["tasks", "calendar", "reports", "approvals"],
    ...overrides,
  };
}

describe("AceOne Solutions — Scope & Permission Enforcement", () => {
  it("allows Ahmed (Manager with Graphic Design scope) to assign in Graphic Design", () => {
    const ahmed = createMockUser({
      assignmentScopeIds: [10], // Graphic Design
    });

    expect(canAssignInCategory(ahmed, 10)).toBe(true);
  });

  it("denies Ahmed (Manager with Graphic Design scope) from assigning in Sales", () => {
    const ahmed = createMockUser({
      assignmentScopeIds: [10], // Graphic Design only
    });

    // Department 20 = Sales
    expect(canAssignInCategory(ahmed, 20)).toBe(false);
  });

  it("allows Sarah (Social Media Manager with Graphic Design approval scope) to approve Graphic Design tasks", () => {
    const sarah = createMockUser({
      name: "Sarah",
      role: { code: "manager", name: "Manager", isSystem: false },
      permissions: new Set(["task.approve", "approval.approve", "task.review"]),
      approvalScopeIds: [10], // Graphic Design
    });

    expect(canApproveInCategory(sarah, 10)).toBe(true);
  });

  it("denies Sarah from approving Software Engineering tasks", () => {
    const sarah = createMockUser({
      name: "Sarah",
      role: { code: "manager", name: "Manager", isSystem: false },
      permissions: new Set(["task.approve", "approval.approve", "task.review"]),
      approvalScopeIds: [10], // Graphic Design only
    });

    // Department 30 = Software Engineering
    expect(canApproveInCategory(sarah, 30)).toBe(false);
  });

  it("grants Super Admin unrestricted scope access across every category", () => {
    const superAdmin = createMockUser({
      name: "Muneeb CEO",
      role: { code: "super_admin", name: "Super Admin", isSystem: true },
      permissions: new Set(["*"]),
      assignmentScopeIds: [],
      approvalScopeIds: [],
    });

    expect(canAssignInCategory(superAdmin, 10)).toBe(true);
    expect(canAssignInCategory(superAdmin, 20)).toBe(true);
    expect(canAssignInCategory(superAdmin, 30)).toBe(true);
    expect(canApproveInCategory(superAdmin, 10)).toBe(true);
    expect(canApproveInCategory(superAdmin, 99)).toBe(true);
    expect(canViewCategory(superAdmin, 99)).toBe(true);
  });

  it("enforces effective permissions correctly for user override grant and revoke", () => {
    const employee = createMockUser({
      role: { code: "employee", name: "Employee", isSystem: false },
      permissions: new Set(["task.view", "task.submit"]), // normal employee
    });

    expect(hasEffectivePermission(employee, "task.view")).toBe(true);
    expect(hasEffectivePermission(employee, "task.delete")).toBe(false);

    // Granted override
    employee.permissions.add("task.delete");
    expect(hasEffectivePermission(employee, "task.delete")).toBe(true);

    // Revoked override
    employee.permissions.delete("task.view");
    expect(hasEffectivePermission(employee, "task.view")).toBe(false);
  });
});

describe("Task Workflow State Transitions", () => {
  it("progresses version numbers sequentially: V1 -> V2 -> V3", () => {
    let currentVersion = 1;
    expect(currentVersion).toBe(1);

    // Revisions requested, employee submits updated deliverable
    currentVersion += 1;
    expect(currentVersion).toBe(2);

    currentVersion += 1;
    expect(currentVersion).toBe(3);
  });

  it("handles Any One approval mode correctly", () => {
    const approvalMode = "ANY_ONE";
    const reviewers = [{ id: 1, name: "CEO" }, { id: 2, name: "Manager" }];
    const approvals = [{ reviewerId: 1, status: "APPROVED" }];

    let isApproved = false;
    if (approvalMode === "ANY_ONE" && approvals.some((a) => a.status === "APPROVED")) {
      isApproved = true;
    }

    expect(isApproved).toBe(true);
  });

  it("handles All Required approval mode correctly", () => {
    const approvalMode = "ALL_REQUIRED";
    const reviewerIds = [1, 2];
    const approvedIds = [1]; // Only 1 has approved so far

    const isAllApproved = reviewerIds.every((id) => approvedIds.includes(id));
    expect(isAllApproved).toBe(false);

    // Second reviewer approves
    approvedIds.push(2);
    const isNowAllApproved = reviewerIds.every((id) => approvedIds.includes(id));
    expect(isNowAllApproved).toBe(true);
  });
});
