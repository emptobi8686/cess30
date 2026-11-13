"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePwaInstall } from "@/components/shared/pwa-install-provider";

function subscribeToPlatformChanges() {
  return () => {};
}

function getIsIosPlatform() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallCard() {
  const { isInstalled, canPromptInstall, promptInstall } = usePwaInstall();
  const isIos = useSyncExternalStore(
    subscribeToPlatformChanges,
    getIsIosPlatform,
    () => false
  );
  const [message, setMessage] = useState<string | null>(null);

  if (isInstalled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4 text-primary" />
            BLUEPRINT is installed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You can open BLUEPRINT from your device home screen.
        </CardContent>
      </Card>
    );
  }

  async function handleInstall() {
    const result = await promptInstall();
    setMessage(
      result === "accepted"
        ? "BLUEPRINT is ready to install."
        : result === "dismissed"
          ? "Installation was dismissed. You can try again whenever you are ready."
          : "Use your browser’s menu and choose Install app or Add to Home Screen."
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="size-4 text-primary" />
          Install BLUEPRINT
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add the academic companion to your device for a focused, app-like experience.
        </p>
        {canPromptInstall ? (
          <Button type="button" onClick={handleInstall}>
            Install app
          </Button>
        ) : isIos ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open BLUEPRINT in Safari.</li>
            <li>Tap Share, then Add to Home Screen.</li>
            <li>Confirm by tapping Add.</li>
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Open your browser menu and choose Install app or Add to Home Screen when available.
          </p>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
