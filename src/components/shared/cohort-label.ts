export type ShellAcademic = { levelCode: string | null; sessionLabel: string | null };

/** Sidebar cohort text from the academic context; null when the page did not pass one. */
export function cohortLabel(academic: ShellAcademic | undefined): string | null {
  if (!academic) return null;
  if (!academic.levelCode) return "Level not set";
  return academic.sessionLabel ? `Level ${academic.levelCode} · ${academic.sessionLabel}` : `Level ${academic.levelCode}`;
}
