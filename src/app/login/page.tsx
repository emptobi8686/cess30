import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage(props: PageProps<"/login">) {
  // If the user is already authenticated, redirect to the dashboard
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // If Supabase is unconfigured or throws, render the login page normally
  }

  const searchParams = await (props as { searchParams: SearchParams }).searchParams;

  const error = typeof searchParams?.error === "string" ? searchParams.error : null;
  const message = typeof searchParams?.message === "string" ? searchParams.message : null;

  return <LoginForm initialError={error} initialMessage={message} />;
}
