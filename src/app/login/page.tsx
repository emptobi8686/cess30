import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messageFromCode } from "@/lib/auth/messages";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage(props: PageProps<"/login">) {
  // Already signed in? Go to the dashboard. redirect() throws a control-flow error,
  // so it must run outside the try/catch (BP-039).
  let signedIn = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // If Supabase is unconfigured or unreachable, render the login page normally.
  }
  if (signedIn) redirect("/dashboard");

  const searchParams = await (props as { searchParams: SearchParams }).searchParams;

  // Only allow-listed codes are rendered (BP-040).
  const error = messageFromCode(searchParams?.error);
  const message = messageFromCode(searchParams?.message);

  return <LoginForm initialError={error} initialMessage={message} />;
}
