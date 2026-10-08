import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";

describe("permission registry", () => {
  it("has unique permission keys", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every default role permission references a known key", () => {
    const known = new Set(PERMISSIONS.map((p) => p.key));
    for (const keys of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const key of keys) {
        expect(known.has(key)).toBe(true);
      }
    }
  });

  it("does not grant permissions to a non-existent role code", () => {
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS)).not.toContain("super_admin");
  });
});