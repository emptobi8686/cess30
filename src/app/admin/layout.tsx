import { redirect } from "next/navigation";
import { requireUserSession } from "@/lib/supabase/auth";
import { getCurrentUserRole } from "@/lib/supabase/role";

/**
 * Admin layout guard.
 * This is a second layer of protection in addition to the middleware check.
 * Both must pass for a user to access any admin route.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserSession();
  const role = await getCurrentUserRole();

  if (role !== "admin") {
    redirect("/access-denied");
  }

  // Suppress unused variable warning — user confirms authentication happened
  void user;

  return <>{children}</>;
}
