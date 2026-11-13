"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  UserRound,
  Users,
} from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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

const adminNavItems = [
  { label: "Overview",      href: "/admin",               icon: LayoutGrid },
  { label: "Timetable",     href: "/admin/timetable",     icon: CalendarDays },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "Courses",       href: "/admin/courses",       icon: BookOpen },
];

function AdminSidebarNav({ currentLabel }: { currentLabel: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/80 bg-card/80 p-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b border-border/80 pb-5">
        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/20 bg-white shadow-sm">
          <Image src="/images/blueprint-logo.png" alt="BLUEPRINT logo" width={40} height={40} className="object-cover" priority />
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.26em] text-muted-foreground">Admin panel</p>
          <p className="text-base font-semibold text-foreground">{siteConfig.name}</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1.5">
        {adminNavItems.map(({ label, href, icon: Icon }) => {
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

      <div className="mt-6 border-t border-border/80 pt-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Users className="h-4 w-4" />
          Student view
        </Link>
      </div>
    </aside>
  );
}

function AdminMobileNav({ currentLabel }: { currentLabel: string }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open admin navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-[85vw] max-w-xs px-3 py-5">
        <SheetHeader className="mb-4 px-2">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-primary/20 bg-white shadow-sm">
              <Image src="/images/blueprint-logo.png" alt="BLUEPRINT logo" width={36} height={36} className="object-cover" priority />
            </div>
            <SheetTitle className="text-left text-sm font-semibold">
              {siteConfig.name} — Admin
            </SheetTitle>
          </div>
        </SheetHeader>
        <nav className="space-y-1.5 px-2">
          {adminNavItems.map(({ label, href, icon: Icon }) => {
            const active = label === currentLabel;
            return (
              <Link key={label} href={href} className="block">
                <div className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </Link>
            );
          })}
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <Users className="h-4 w-4" />
            Student view
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function AdminProfileMenu({ displayName }: { displayName?: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button type="button" variant="ghost" className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-foreground">{displayName ?? "Admin"}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Administrator</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="end" sideOffset={8}>
        <DropdownMenuLabel>Admin account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
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

export function AdminShell({
  children,
  currentLabel,
  displayName,
}: {
  children: React.ReactNode;
  currentLabel: string;
  displayName?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px]">
        <AdminSidebarNav currentLabel={currentLabel} />
        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <AdminMobileNav currentLabel={currentLabel} />
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Admin
                  </p>
                  <h1 className="text-lg font-semibold text-foreground md:text-xl">{currentLabel}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationsMenu />
                <AdminProfileMenu displayName={displayName} />
              </div>
            </div>
          </header>
          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
