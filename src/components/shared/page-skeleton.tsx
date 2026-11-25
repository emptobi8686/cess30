import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder shaped like a BLUEPRINT page: a title block, then either a list of
 * rows or a grid of cards. Shown while the server prepares the page; never a full-screen
 * spinner, and never a delay of its own.
 */
export function PageSkeleton({ variant = "list", rows = 4 }: { variant?: "list" | "grid"; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {variant === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
