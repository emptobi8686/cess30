import { redirect } from "next/navigation";
import { RegisterForm } from "@/app/register/register-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // If the user is already authenticated, redirect to the dashboard
  let signedIn = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // If Supabase is unconfigured or unreachable, render the registration form normally.
  }
  if (signedIn) redirect("/dashboard");

  return <RegisterForm />;
}
