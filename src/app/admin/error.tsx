"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t load this admin page.</h1>
      <p className="text-sm text-muted-foreground">Please try again. If it keeps failing, check the server logs.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
