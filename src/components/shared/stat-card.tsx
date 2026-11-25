import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "success" | "muted";
  className?: string;
};

export function StatCard({ label, value, description, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("border-border/80 bg-card", className)}>
      <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <span
            className={cn(
              "inline-flex h-2 w-2 shrink-0 rounded-full",
              tone === "success" && "bg-emerald-500",
              tone === "muted" && "bg-slate-400",
              tone === "default" && "bg-primary"
            )}
          />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
