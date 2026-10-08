import { describe, expect, it } from "vitest";
import {
  assertPermission,
  hasPermission,
  type PermissionedUser,
} from "@/lib/authz";

function userWith(keys: string[], isSystem = false): PermissionedUser {
  return {
    role: {
      isSystem,
      permissions: keys.map((key) => ({ permission: { key } })),
    },
  };
}

describe("hasPermission", () => {
  it("grants every permission to the system role", () => {
    expect(hasPermission(userWith([], true), "task.delete")).toBe(true);
    expect(hasPermission(userWith([], true), "settings.manage")).toBe(true);
  });

  it("grants a permission the role holds", () => {
    expect(hasPermission(userWith(["task.view"]), "task.view")).toBe(true);
  });

  it("denies a permission the role does not hold", () => {
    expect(hasPermission(userWith(["task.view"]), "task.delete")).toBe(false);
  });

  it("denies for a null user", () => {
    expect(hasPermission(null, "task.view")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("throws when the permission is missing", () => {
    expect(() =>
      assertPermission(userWith(["task.view"]), "task.delete"),
    ).toThrow(/permission/i);
  });

  it("does not throw when the permission is held", () => {
    expect(() =>
      assertPermission(userWith(["task.delete"]), "task.delete"),
    ).not.toThrow();
  });
});