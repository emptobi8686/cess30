"use client";

import { createContext, useContext } from "react";

/** What the admin area shows to this user. Navigation only: the database authorises every write. */
export type StaffAccess = { isAdmin: boolean; staffLevels: string[] };

const StaffAccessContext = createContext<StaffAccess>({ isAdmin: false, staffLevels: [] });

export function StaffAccessProvider({ value, children }: { value: StaffAccess; children: React.ReactNode }) {
  return <StaffAccessContext.Provider value={value}>{children}</StaffAccessContext.Provider>;
}

export function useStaffAccess(): StaffAccess {
  return useContext(StaffAccessContext);
}

const ALL_LEVELS = ["100", "200", "300", "400", "500"] as const;

/** Levels this user may act on in admin forms (all for administrators). */
export function useAllowedLevels(): string[] {
  const { isAdmin, staffLevels } = useStaffAccess();
  return isAdmin ? [...ALL_LEVELS] : staffLevels;
}
