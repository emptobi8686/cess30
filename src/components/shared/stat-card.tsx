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
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <span
            className={cn(
              "inline-flex h-2.5 w-2.5 rounded-full",
              tone === "success" && "bg-emerald-500",
              tone === "muted" && "bg-slate-400",
              tone === "default" && "bg-primary"
            )}
          />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
