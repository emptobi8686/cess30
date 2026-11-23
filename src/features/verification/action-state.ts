/** Result shape for forms driven by React's useActionState. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const IDLE_ACTION_STATE: ActionState = { status: "idle", message: null };

export const GENERIC_ACTION_ERROR = "The action could not be completed. Please try again.";

/** Validation messages raised by verification RPCs that are safe to show verbatim. */
const SAFE_RPC_MESSAGES = [
  "Rejection reason must be at least 12 characters.",
  "A suspension reason of at least 12 characters is required.",
  "Enter a valid matriculation number.",
  "Only rejected verification requests can be resubmitted.",
  "Administrator access required.",
  "Student profile not found.",
];

export function rpcErrorToMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";

  if (error.code === "23505") {
    return "This matriculation number is already registered. Contact your course representative.";
  }
  if (message.includes("already been reviewed")) {
    return "This profile has already been reviewed.";
  }
  if (message.includes("cannot review their own") || message.includes("cannot change their own")) {
    return "You cannot review your own profile.";
  }
  if (/^A \w+ profile cannot be changed to \w+\.$/.test(message)) {
    return message;
  }

  const safe = SAFE_RPC_MESSAGES.find((candidate) => message === candidate);
  return safe ?? GENERIC_ACTION_ERROR;
}

export function successState(message: string): ActionState {
  return { status: "success", message };
}

export function errorState(message: string): ActionState {
  return { status: "error", message };
}
