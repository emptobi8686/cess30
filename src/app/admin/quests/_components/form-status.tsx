import type { ActionState } from "@/lib/action-state";

export function FormStatus({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-primary"}
    >
      {state.message}
    </p>
  );
}
