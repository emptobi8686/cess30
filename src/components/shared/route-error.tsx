"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shared body for route error boundaries: friendly copy, retry, and a digest for support. */
export function RouteError({
  title = "We couldn't load this page.",
  error,
  reset,
}: {
  title?: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Please try again. If the problem continues, contact your course representative
        {error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
