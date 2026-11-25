"use client";

import { FEATURES } from "@/config/features";
import { cohortLabel, type ShellAcademic } from "./cohort-label";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Medal,
  Megaphone,
  Menu,
  NotebookPen,
  Settings,
  Trophy,
  UserRound,
  Library as LibraryIcon,
  PlayCircle,
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
import { siteConfig } from "@/config/site";
import { signOut } from "@/app/actions/auth";
import { cn } from "cn";
import { NotificationsMenu } from "@/components/shared/notifications/notifications-menu";
import { BottomNav, MobileNavSheet, NavLink, type ShellNavItem } from "@/components/shared/shell-nav";

const navItems: ShellNavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
  { label: "Study Planner", href: "/study-planner", icon: NotebookPen },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Quests", href: "/quests", icon: Trophy },
  { label: "Leaderboard", href: "/leaderboard", icon: Medal },
  { label: "Library", href: "/library", icon: LibraryIcon },
  ...(FEATURES.tutorials ? [{ label: "Tutorials", href: "/tutorials", icon: PlayCircle }] : []),
  { label: "Settings", href: "/settings", icon: Settings },
];

/** The menu label for a student path ("/quests/x" → "Quests"), for loading screens. */
export function studentLabelFor(pathname: string): string {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "";
}

function SidebarNav({ currentLabel, academic }: { currentLabel: string; academic?: ShellAcademic }) {
  const cohort = cohortLabel(academic);
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

      <nav aria-label="Main" className="mt-6 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.label} item={item} active={item.label === currentLabel} />
        ))}
      </nav>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Your cohort</p>
        {cohort ? <p className="mt-3 text-lg font-semibold text-foreground">{cohort}</p> : null}
        <p className="mt-1 text-sm text-muted-foreground">Civil Engineering</p>
      </div>
    </aside>
  );
}

/** Bottom bar destinations on phones and tablets; everything else sits under "More". */
const quickItems = navItems.filter((item) => ["Overview", "Timetable", "Quests", "Library"].includes(item.label));

function StudentBottomNav({ currentLabel }: { currentLabel: string }) {
  const inMore = !quickItems.some((item) => item.label === currentLabel);
  return (
    <BottomNav
      items={quickItems}
      currentLabel={currentLabel}
      more={
        <MobileNavSheet
          items={navItems}
          currentLabel={currentLabel}
          trigger={
            <button
              type="button"
              aria-label="More pages"
              className={cn(
                "group flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                "transition-colors duration-(--duration-fast) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                inMore ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", inMore && "bg-primary/12")}>
                <Menu className="h-5 w-5" />
              </span>
              More
            </button>
          }
        />
      }
    />
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
  academic,
}: {
  children: React.ReactNode;
  currentLabel: string;
  displayName?: string;
  avatarUrl?: string | null;
  /** Level and session for the sidebar cohort card; omitted pages show the department only. */
  academic?: ShellAcademic;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1600px]">
        <SidebarNav currentLabel={currentLabel} academic={academic} />

        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-primary/20 bg-white lg:hidden">
                  <Image src="/images/blueprint-logo.png" alt="" width={32} height={32} className="object-cover" />
                </div>
                <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">{currentLabel}</h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationsMenu />
                <ProfileMenu displayName={displayName} avatarUrl={avatarUrl} />
              </div>
            </div>
          </header>

          <div
            key={currentLabel}
            id="main-content"
            tabIndex={-1}
            className="w-full max-w-(--container-content) flex-1 animate-page-enter focus:outline-none px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-8"
          >
            {children}
          </div>
        </main>
        <StudentBottomNav currentLabel={currentLabel} />
      </div>
    </div>
  );
}
