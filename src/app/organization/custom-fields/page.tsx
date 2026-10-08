import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { CustomFieldManager } from "@/components/organization/custom-field-manager";

export default async function CustomFieldsPage() {
  const user = await requireUser();

  const [customFields, categories] = await Promise.all([
    db.customField.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
    db.department.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Custom Fields Builder</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure dynamic fields for task forms and daily activity reporting per category without code changes.
          </p>
        </div>

        <CustomFieldManager customFields={customFields} categories={categories} />
      </div>
    </AppShell>
  );
}
