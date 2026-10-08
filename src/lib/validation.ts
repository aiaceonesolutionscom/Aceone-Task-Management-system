import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
  roleId: z.coerce.number().int().positive("Select a role."),
  primaryDepartmentId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Convert a ZodError into a simple field -> message map. */
export function zodIssueMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}