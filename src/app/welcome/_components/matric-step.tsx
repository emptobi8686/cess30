"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitMatricNumber, type CompleteProfileState } from "@/app/actions/profile";

export function MatricStep() {
  const [state, action, pending] = useActionState<CompleteProfileState, FormData>(submitMatricNumber, null);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="welcome-matric">UNILAG matriculation number</Label>
        <Input id="welcome-matric" name="matricNumber" placeholder="e.g. 190408012" required autoComplete="off" inputMode="text" disabled={pending} />
        <p className="text-xs text-muted-foreground">An administrator checks it against the class list before you get full access.</p>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>) : "Continue"}
      </Button>
      {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
