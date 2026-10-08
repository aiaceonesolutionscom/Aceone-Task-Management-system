import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { CategoryManager } from "@/components/organization/category-manager";

export default async function CategoriesPage() {
  const user = await requireUser();

  const categories = await db.department.findMany({
    include: {
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { name: "asc" },
  });

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
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">
            Category & Department Configuration
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configure dynamic company departments, codes, reporting mandates, and approval rules.
          </p>
        </div>

        <CategoryManager categories={categories} />
      </div>
    </AppShell>
  );
}
