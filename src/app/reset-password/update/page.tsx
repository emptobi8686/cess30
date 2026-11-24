"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type UpdatePasswordState } from "@/app/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

type SessionStatus = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [state, formAction, isPending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    null
  );

  useEffect(() => {
    let active = true;

    async function establishRecoverySession() {
      try {
        const supabase = createClient();

        // If Supabase redirected straight here with a PKCE code, exchange it
        // for a session before checking the user.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) setStatus("invalid");
            return;
          }
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.toString());
        }

        // getUser() validates the JWT against the auth server rather than
        // trusting a possibly stale local session.
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;
        setStatus(!error && data.user ? "ready" : "invalid");
      } catch {
        if (active) setStatus("invalid");
      }
    }

    void establishRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
        <Card className="w-full max-w-lg border-border/80 bg-card shadow-sm">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying your recovery link…
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
        <Card className="w-full max-w-lg border-border/80 bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back to login
            </Link>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Reset link expired
            </CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Request a new link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button nativeButton={false} render={<Link href="/reset-password" />}>Request a new link</Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>Back to login</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <Card className="w-full max-w-lg border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-2">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to login
          </Link>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <KeyRound className="h-6 w-6 text-primary" />
            Set a new password
          </CardTitle>
          <CardDescription>
            Choose a new password for your account. You will be signed out and asked to log in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>

            {state?.error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {state.error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
              <Link href="/login" className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
