"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { ADMIN_NAV } from "@/components/shared/admin-nav";
import { DashboardShell, studentLabelFor } from "@/components/shared/dashboard-shell";
import { PageSkeleton } from "@/components/shared/page-skeleton";

type Variant = { variant?: "list" | "grid"; rows?: number };

/** Loading screen inside the student layout, so the menu stays put while a page loads. */
export function StudentShellLoading({ variant, rows }: Variant) {
  const pathname = usePathname();
  return (
    <DashboardShell currentLabel={studentLabelFor(pathname)}>
      <PageSkeleton variant={variant} rows={rows} />
    </DashboardShell>
  );
}

/** Loading screen inside the admin layout. */
export function AdminShellLoading({ variant, rows }: Variant) {
  const pathname = usePathname();
  const label =
    [...ADMIN_NAV]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Overview";
  return (
    <AdminShell currentLabel={label}>
      <PageSkeleton variant={variant} rows={rows} />
    </AdminShell>
  );
}
