export default function StudyPlannerLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 bg-muted rounded animate-pulse" />
      <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit">
        <div className="h-8 w-16 bg-muted rounded-full animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded-full animate-pulse" />
        <div className="h-8 w-24 bg-muted rounded-full animate-pulse" />
        <div className="h-8 w-28 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}
