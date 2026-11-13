import { Card, CardContent } from "@/components/ui/card";

export default function NotificationsLoading() {
  return (
    <div className="space-y-4 p-6" aria-label="Loading notifications">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      {[1, 2, 3].map((item) => (
        <Card key={item}>
          <CardContent className="space-y-3 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
