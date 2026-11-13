"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitMatricNumber, type CompleteProfileState } from "@/app/actions/profile";
import type { VerificationStatus } from "@/types";

type Props = {
  matricNumber: string | null;
  verificationStatus: VerificationStatus;
};

export function VerificationBanner({ matricNumber, verificationStatus }: Props) {
  const [state, formAction, isPending] = useActionState<CompleteProfileState, FormData>(
    submitMatricNumber,
    null
  );

  // If matric number is missing (e.g. initial Google OAuth registration), prompt the user to complete it
  if (!matricNumber) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Action Required: Complete your student profile
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-muted-foreground">
            You are signed in with Google. To associate your account with the Civil Engineering 200-level pilot and submit your profile for admin verification, please provide your UNILAG matriculation number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="matricNumber" className="text-xs">
                  Matriculation number
                </Label>
                <Input
                  id="matricNumber"
                  name="matricNumber"
                  placeholder="e.g. 190408012"
                  disabled={isPending}
                  required
                  className="bg-background max-w-sm"
                />
              </div>
              <Button type="submit" disabled={isPending} className="h-9">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit for verification"
                )}
              </Button>
            </div>

            {state?.error ? (
              <p className="text-xs text-destructive">{state.error}</p>
            ) : null}
            {state?.success ? (
              <p className="text-xs text-primary">{state.success}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    );
  }

  // Display pending verification status
  if (verificationStatus === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
        <Clock className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="text-sm">
          <p className="font-semibold">Student Verification Pending</p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
            Your matriculation details ({matricNumber}) have been submitted and are awaiting administrator verification for the 200-level Civil Engineering pilot.
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Student Verification Rejected</p>
          <p className="mt-0.5 text-xs">
            Your student verification request was not approved. Please speak directly with your course representative or project administrator.
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === "suspended") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Account Suspended</p>
          <p className="mt-0.5 text-xs">
            Your platform access has been suspended by an administrator.
          </p>
        </div>
      </div>
    );
  }

  // If verified, return null or a verified status badge
  return null;
}

