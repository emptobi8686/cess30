import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Announcement = {
  title: string;
  summary: string;
  meta: string;
  tag: string;
};

export function AnnouncementPreview({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Announcements</CardTitle>
          <Badge variant="secondary" className="rounded-full text-xs">
            {announcements.length} new
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {announcements.map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                {item.tag}
              </Badge>
              <span className="text-xs text-muted-foreground">{item.meta}</span>
            </div>
            <p className="font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.summary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
