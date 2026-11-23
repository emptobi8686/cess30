"use client";

import { Button } from "@/components/ui/button";

export default function LeaderboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t load the leaderboard.</h1>
      <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
