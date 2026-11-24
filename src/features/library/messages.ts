/** Database messages from the library rules that are safe to show as-is. */
const SAFE = [
  "Upload a file before publishing this resource.",
  "Choose who should see this resource before publishing it.",
  "Only a department administrator can approve past questions.",
  "The file belongs to a different resource.",
  "You cannot target that audience.",
  "You cannot change who sees this.",
];

export function libraryDbMessage(error: { message?: string; code?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.message && SAFE.includes(error.message)) return error.message;
  if (error.code === "23514") return "Past questions must be approved by the department before upload.";
  if (error.code === "42501") return "You cannot manage this resource.";
  return fallback;
}
