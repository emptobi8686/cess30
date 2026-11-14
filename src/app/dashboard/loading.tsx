export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 bg-muted rounded animate-pulse" />
      <div className="space-y-4">
        <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-8 w-1/2 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-48 bg-muted rounded animate-pulse" />
    </div>
  );
}
