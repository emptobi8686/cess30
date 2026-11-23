import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/auth/access-server";

/**
 * Admin layout guard: a second layer behind the proxy/middleware check.
 * Every admin server action also calls requireAdmin() independently.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccessContext();

  if (!access) {
    redirect("/login");
  }

  if (!access.isAdmin) {
    redirect("/access-denied");
  }

  return <>{children}</>;
}
