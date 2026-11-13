import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

type ScheduleItem = {
  course: string;
  time: string;
  venue: string;
  active?: boolean;
};

export function SchedulePreview({ items, title }: { items: ScheduleItem[]; title: string }) {
  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.course}-${item.time}`}
            className={cn(
              "rounded-xl border p-3",
              item.active ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{item.course}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.venue}</p>
              </div>
              {item.active ? (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                  Now
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">{item.time}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
