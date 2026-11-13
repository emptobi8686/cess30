import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

type QuickActionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function QuickAction({ icon: Icon, title, description }: QuickActionProps) {
  return (
    <Card className="border-border/80 bg-card">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={title}>
          <span className="sr-only">Open</span>
          <span aria-hidden="true">→</span>
        </Button>
      </CardContent>
    </Card>
  );
}
