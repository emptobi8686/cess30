import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlacementSection } from "@/app/settings/profile/_components/placement-section";
import { getAcademicContext } from "@/features/academic/context";
import { safeNextPath } from "@/lib/auth/safe-next";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MatricStep } from "./_components/matric-step";

export const dynamic = "force-dynamic";

/**
 * First stop after a new Google sign-in: matric number, then (optionally) the
 * student's level for the current session. Returning students skip it.
 */
export default async function WelcomePage(props: PageProps<"/welcome">) {
  const user = await requireUserSession();
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, matric_number")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(" ")[0];
  const hasMatric = Boolean(profile?.matric_number);
  const academic = hasMatric ? await getAcademicContext() : null;
  if (hasMatric && (!academic?.sessionLabel || academic.placementStatus !== "none")) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Step {hasMatric ? 2 : 1} of 2
            </p>
            <CardTitle className="text-2xl">{firstName ? `Welcome, ${firstName}` : "Welcome to BLUEPRINT"}</CardTitle>
            <CardDescription>
              {hasMatric
                ? "Choose your level for this session so your timetable and announcements match your class."
                : "You're signed in with Google. Add your matriculation number to link your account to UNILAG Civil Engineering."}
            </CardDescription>
          </CardHeader>
          <CardContent>{hasMatric ? null : <MatricStep />}</CardContent>
        </Card>
        {hasMatric && academic ? <PlacementSection academic={academic} /> : null}
        {hasMatric ? (
          <Button nativeButton={false} render={<Link href={next} />} className="w-full">
            Go to my dashboard
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Not now? <Link href={next} className="underline">Skip to the dashboard</Link>. You can add it later in your profile.
          </p>
        )}
      </div>
    </main>
  );
}
