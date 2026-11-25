"use client";

import { useActionState } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { AvatarControls } from "./avatar-controls";
import { PlacementSection } from "./placement-section";
import type { AcademicContext } from "@/features/academic/context-core";
import { PageHeader } from "@/components/shared/page-header";
import { VerificationBanner } from "@/components/shared/verification-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfile,
  submitMatricNumber,
  type CompleteProfileState,
} from "@/app/actions/profile";
import { cn } from "cn";

export function ProfileSettingsClient({
  profile,
  displayName,
  initials,
  academic,
}: {
  academic: AcademicContext;
  profile: {
    id: string;
    full_name: string;
    nickname: string | null;
    matric_number: string | null;
    department: string;
    level: string;
    avatar_url: string | null;
    verification_status: string;
    verification_reviewed_at: string | null;
    verification_reviewed_by: string | null;
    verification_rejection_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  displayName: string;
  initials: string;
}) {

  const [matricState, matricFormAction, isMatricPending] = useActionState<
    CompleteProfileState,
    FormData
  >(submitMatricNumber, null);
  const [profileState, profileFormAction] = useActionState<
    CompleteProfileState,
    FormData
  >(updateProfile, null);

  const avatarUrl = profile.avatar_url;

  return (
    <DashboardShell
      currentLabel="Profile"
      displayName={displayName}
      avatarUrl={avatarUrl}
      academic={academic}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Profile settings"
          title="Manage your account"
          description="Update your nickname, profile picture, and view your verification status."
        />

        <VerificationBanner
          matricNumber={profile.matric_number}
          verificationStatus={
            profile.verification_status as
              | "pending"
              | "verified"
              | "rejected"
              | "suspended"
          }
          rejectionReason={profile.verification_rejection_reason}
        />

        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          {/* Profile picture card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Profile picture</CardTitle>
              <CardDescription>
                Upload a photo so classmates and instructors can recognize you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AvatarControls
                userId={profile.id}
                avatarUrl={profile.avatar_url}
                initials={initials}
              />
            </CardContent>
          </Card>

          {/* Profile details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
                <CardDescription>
                  Your name, department, and level are set during registration
                  and cannot be changed here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.full_name}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.department}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.level}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Verification status</Label>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        {
                          "bg-primary/10 text-primary border border-primary/20":
                            profile.verification_status === "verified",
                          "bg-amber-500/10 text-amber-900 border border-amber-500/30":
                            profile.verification_status === "pending",
                          "bg-destructive/10 text-destructive border border-destructive/30":
                            profile.verification_status === "rejected" ||
                            profile.verification_status === "suspended",
                        }
                      )}
                    >
                      {profile.verification_status === "verified" && (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      {profile.verification_status.charAt(0).toUpperCase() +
                        profile.verification_status.slice(1)}
                    </span>
                  </div>
                </div>

                {profile.matric_number ? (
                  <div className="space-y-2">
                    <Label>Matriculation number</Label>
                    <p className="text-sm font-mono text-muted-foreground truncate">
                      {profile.matric_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your matriculation number is set and cannot be changed.
                      Contact your course representative if it is incorrect.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Matriculation number</Label>
                    <form action={matricFormAction} className="space-y-2">
                      <Input
                        name="matricNumber"
                        placeholder="e.g. 190408012"
                        disabled={isMatricPending}
                        required
                        className="bg-background max-w-md"
                      />
                      <Button
                        type="submit"
                        disabled={isMatricPending}
                        className="h-9"
                      >
                        {isMatricPending ? (
                          <>
                            <Clock className="mr-2 h-3 w-3 animate-spin" />
                            Submitting…
                          </>
                        ) : (
                          "Submit for verification"
                        )}
                      </Button>
                      {matricState?.error && (
                        <p className="text-xs text-destructive">{matricState.error}</p>
                      )}
                      {matricState?.success && (
                        <p className="text-xs text-primary">{matricState.success}</p>
                      )}
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>

            <PlacementSection academic={academic} />

            <Card>
              <CardHeader>
                <CardTitle>Nickname</CardTitle>
                <CardDescription>
                  Choose how your name appears to other students and instructors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={profileFormAction} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      name="nickname"
                      defaultValue={profile.nickname ?? ""}
                      maxLength={100}
                      className="bg-background max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Up to 100 characters.
                    </p>
                  </div>
                  <Button type="submit" className="h-9">Save nickname</Button>
                  {profileState?.error && (
                    <p className="text-xs text-destructive">{profileState.error}</p>
                  )}
                  {profileState?.success && (
                    <p className="text-xs text-primary">{profileState.success}</p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-4">
          <Button variant="outline" nativeButton={false} render={<Link href="/settings" />}>← Back to settings</Button>
        </div>
      </div>
    </DashboardShell>
  );
}
