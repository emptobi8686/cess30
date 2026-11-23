"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  NotebookPen,
  Settings,
  Trophy,
  UserRound,
} from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";
import { signOut } from "@/app/actions/auth";
import { cn } from "cn";
import { NotificationsMenu } from "@/components/shared/notifications/notifications-menu";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
  { label: "Study Planner", href: "/study-planner", icon: NotebookPen },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Quests", href: "/quests", icon: Trophy },
  { label: "Leaderboard", href: "/leaderboard", icon: LayoutGrid },
  { label: "Settings", href: "/settings", icon: Settings },
];

function SidebarNav({ currentLabel }: { currentLabel: string }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-border/80 bg-card/80 p-5 lg:block">
      <div className="flex items-center gap-3 border-b border-border/80 pb-5">
        <div className="relative h-11 w-11 overflow-hidden rounded-full border border-primary/20 bg-white shadow-sm">
          <Image src="/images/blueprint-logo.png" alt="BLUEPRINT logo" width={44} height={44} className="object-cover" priority />
        </div>
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-muted-foreground">Student portal</p>
          <p className="text-lg font-semibold text-foreground">{siteConfig.name}</p>
        </div>
      </div>

      <nav className="mt-6 space-y-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = label === currentLabel;
          return (
            <Link key={label} href={href} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Pilot cohort</p>
        <p className="mt-3 text-lg font-semibold text-foreground">200 Level</p>
        <p className="mt-1 text-sm text-muted-foreground">Civil Engineering</p>
      </div>
    </aside>
  );
}

function MobileNav({ currentLabel }: { currentLabel: string }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-[85vw] max-w-sm px-3 py-5">
        <SheetHeader className="mb-4 px-2">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/20 bg-white shadow-sm">
              <Image src="/images/blueprint-logo.png" alt="BLUEPRINT logo" width={40} height={40} className="object-cover" priority />
            </div>
            <SheetTitle className="text-left text-base font-semibold">{siteConfig.name}</SheetTitle>
          </div>
        </SheetHeader>

        <nav className="space-y-2 px-2">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = label === currentLabel;
            return (
              <Link key={label} href={href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ProfileMenu({
  displayName,
  avatarUrl,
}: {
  displayName?: string;
  avatarUrl?: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted" />}
      >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile"
              className="h-8 w-8 rounded-full object-cover border border-border/60"
              width={32}
              height={32}
              priority
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </div>
          )}
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-foreground">{displayName ?? "Student"}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pilot</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem className="gap-2" render={<Link href="/settings/profile" />}>
          <UserRound className="h-4 w-4" aria-hidden />
          Profile &amp; settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isPending}
          variant="destructive"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({
  children,
  currentLabel,
  displayName,
  avatarUrl,
}: {
  children: React.ReactNode;
  currentLabel: string;
  displayName?: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px]">
        <SidebarNav currentLabel={currentLabel} />

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-sm">
            <div className="flex h-18 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <MobileNav currentLabel={currentLabel} />
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Blueprint</p>
                  <h1 className="text-lg font-semibold text-foreground md:text-xl">{currentLabel}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationsMenu />
                <ProfileMenu displayName={displayName} avatarUrl={avatarUrl} />
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
