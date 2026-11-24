"use client";

import { RouteError } from "@/components/shared/route-error";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="We couldn't load this page." error={error} reset={reset} />;
}
