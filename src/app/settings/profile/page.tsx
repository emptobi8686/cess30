export const dynamic = "force-dynamic";

import { getProfile } from "@/app/actions/profile";
import { ProfileSettingsClient } from "./_components/profile-settings-client";
import { getAcademicContext } from "@/features/academic/context";

export default async function ProfileSettingsPage() {
  const [profile, academic] = await Promise.all([getProfile(), getAcademicContext()]);

  if (!profile) {
    return (
      <ProfileSettingsClient
        profile={{
          id: "",
          full_name: "",
          nickname: null,
          matric_number: null,
          department: "",
          level: "",
          avatar_url: null,
          verification_status: "pending",
          verification_reviewed_at: null,
          verification_reviewed_by: null,
          verification_rejection_reason: null,
          created_at: "",
          updated_at: "",
        }}
        displayName=""
        initials=""
        academic={academic}
      />
    );
  }

  const displayName = profile.nickname || profile.full_name;
  const initials = profile.full_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <ProfileSettingsClient
      profile={profile}
      displayName={displayName}
      initials={initials}
      academic={academic}
    />
  );
}
