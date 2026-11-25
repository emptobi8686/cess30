import { cn } from "@/lib/utils";

/**
 * A drawing-office stamp that lands when something is submitted or approved.
 * Shown only in answer to the person's own action, never on page load.
 */
export function Stamp({ label, detail, tone = "primary" }: { label: string; detail?: string | null; tone?: "primary" | "muted" }) {
  return (
    <div role="status" className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "stamp inline-block rounded-md border-[3px] border-double px-3 py-1 text-sm font-bold tracking-wide",
          tone === "primary" ? "border-primary text-primary" : "border-muted-foreground text-muted-foreground"
        )}
      >
        {label}
      </span>
      {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}
