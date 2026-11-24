"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, signInWithGoogle, signUpWithEmail } from "@/lib/auth";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    matricNumber: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSubmitting = isEmailSubmitting || isGoogleSubmitting;

  async function handleGoogleSignUp() {
    if (isSubmitting) return;

    setError(null);
    setSuccess(null);
    setIsGoogleSubmitting(true);

    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
        setIsGoogleSubmitting(false);
      }
      // If successful, Supabase navigates the browser to Google OAuth
    } catch {
      setError("Unable to initiate Google sign-up. Please try again.");
      setIsGoogleSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccess(null);
    setIsEmailSubmitting(true);

    try {
      const { error: signUpError } = await signUpWithEmail(form.email, form.password, {
        full_name: form.fullName.trim(),
        matric_number: form.matricNumber.trim(),
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsEmailSubmitting(false);
        return;
      }

      setSuccess("Registration submitted. Please check your email to confirm your account.");
      setIsEmailSubmitting(false);
      setForm({ fullName: "", matricNumber: "", email: "", password: "" });
      router.push("/login?message=registration_submitted");
    } catch {
      setError("Unable to complete registration. Please try again.");
      setIsEmailSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <Card className="w-full max-w-xl border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to login
          </Link>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Create student account</CardTitle>
            <CardDescription>
              Registration is for University of Lagos Civil Engineering students. You choose your level after verification. Student accounts require administrator verification.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isSupabaseConfigured() ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Supabase credentials are required before the registration flow can complete.
            </div>
          ) : null}

          {/* Continue with Google */}
          <div className="space-y-3">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleSignUp}
              className="w-full h-11 font-medium gap-2"
            >
              {isGoogleSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <GoogleIcon className="h-4 w-4" />
                  Continue with Google
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Students: use the Google account you use for school. First time? This creates your account; you add your matric number next.
            </p>
          </div>

          {/* Visual Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground font-medium">
                or register with email
              </span>
            </div>
          </div>

          {/* Email / Password registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Babatunde Adeyemi"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matricNumber">Matric number</Label>
                <Input
                  id="matricNumber"
                  placeholder="e.g. 190408012"
                  value={form.matricNumber}
                  onChange={(event) => setForm({ ...form, matricNumber: event.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="student@live.unilag.edu.ng"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    disabled={isSubmitting}
                    className="pr-10"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                {success}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px] h-10">
                {isEmailSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <div className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

