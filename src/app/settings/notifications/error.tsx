"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function NotificationSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Notification settings failed to load.", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Notification settings are unavailable</h1>
      <p className="text-sm text-muted-foreground">
        We couldn’t load your preferences or registered devices. Nothing was changed.
      </p>
      <Button type="button" onClick={reset}>Try again</Button>
    </main>
  );
}
