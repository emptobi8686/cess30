"use client";

export default function StudyPlannerError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h2 className="text-lg font-semibold">Unable to load study planner</h2>
      <p className="text-muted-foreground mt-2">
        Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 text-primary underline underline-offset-4 hover:text-primary-foreground"
      >
        Refresh page
      </button>
    </div>
  );
}
