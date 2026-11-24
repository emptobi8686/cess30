import { redirect } from "next/navigation";
import { StaffAccessProvider } from "@/components/shared/staff-access";
import { AudienceOptionsProvider } from "@/components/shared/audience-picker";
import { getAudienceOptions } from "@/features/audiences/server";
import { getAccessContext } from "@/lib/auth/access-server";

/**
 * Admin layout guard: a second layer behind the proxy check. Administrators and course
 * representatives (staff) enter; admin-only pages call requireAdmin() themselves, and
 * every server action, RLS policy and RPC authorises independently.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccessContext();

  if (!access) {
    redirect("/login");
  }

  if (!access.isStaff) {
    redirect("/access-denied");
  }

  const audienceOptions = await getAudienceOptions();

  return (
    <StaffAccessProvider value={{ isAdmin: access.isAdmin, staffLevels: access.staffLevels }}>
      <AudienceOptionsProvider value={audienceOptions}>{children}</AudienceOptionsProvider>
    </StaffAccessProvider>
  );
}
