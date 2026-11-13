import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function StudyPlannerPreview() {
  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">Study planner preview</CardTitle>
        <CardDescription>
          Planning workspace for future weekly revision sessions and reminder routines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Select>
              <SelectTrigger id="course" className="w-full">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="structural-analysis">Structural Analysis</SelectItem>
                <SelectItem value="geotech">Geotechnical Engineering</SelectItem>
                <SelectItem value="fluid">Fluid Mechanics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-time">Start time</Label>
            <Input id="start-time" type="time" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-time">End time</Label>
            <Input id="end-time" type="time" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Study goal</Label>
          <Textarea id="goal" placeholder="Review chapter notes, solve tutorial questions and summarise key formulas." className="min-h-28" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recurrence">Recurrence</Label>
            <Select>
              <SelectTrigger id="recurrence" className="w-full">
                <SelectValue placeholder="Choose cadence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder">Reminder</Label>
            <Select>
              <SelectTrigger id="reminder" className="w-full">
                <SelectValue placeholder="Choose reminder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30m">30 minutes before</SelectItem>
                <SelectItem value="1h">1 hour before</SelectItem>
                <SelectItem value="day">1 day before</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button>Save study block</Button>
          <Button variant="outline">Preview reminder</Button>
        </div>
      </CardContent>
    </Card>
  );
}
