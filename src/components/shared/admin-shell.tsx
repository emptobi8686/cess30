"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  Library,
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
import { MobileNavSheet, NavLink } from "@/components/shared/shell-nav";
import { NotificationsMenu } from "@/components/shared/notifications/notifications-menu";
import { visibleAdminNav } from "@/components/shared/admin-nav";
import { useStaffAccess } from "@/components/shared/staff-access";

const NAV_ICONS = {
  Overview: LayoutGrid,
  Timetable: CalendarDays,
  Announcements: Megaphone,
  Verifications: ShieldCheck,
  Quests: Trophy,
  Courses: BookOpen,
  Academic: GraduationCap,
  Library: Library,
  Tutorials: PlayCircle,
  Staff: UsersRound,
} as const;

function useAdminNavItems() {
  const { isAdmin } = useStaffAccess();
  return visibleAdminNav(isAdmin).map((item) => ({ ...item, icon: NAV_ICONS[item.label] }));
}

function AdminSidebarNav({ currentLabel }: { currentLabel: string }) {
  const adminNavItems = useAdminNavItems();
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

      <nav aria-label="Admin" className="mt-6 flex-1 space-y-1">
        {adminNavItems.map((item) => (
          <NavLink key={item.label} item={item} active={item.label === currentLabel} />
        ))}
      </nav>

      <div className="mt-6 border-t border-border/80 pt-4">
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Users className="h-4 w-4" />
          Student view
        </Link>
      </div>
    </aside>
  );
}

function AdminMobileNav({ currentLabel }: { currentLabel: string }) {
  const adminNavItems = useAdminNavItems();
  return (
    <MobileNavSheet
      items={adminNavItems}
      currentLabel={currentLabel}
      title={`${siteConfig.name} admin`}
      trigger={
        <Button type="button" variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open admin navigation">
          <Menu className="h-4 w-4" />
        </Button>
      }
      footer={
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-3 rounded-lg border-t border-border/80 px-3 pt-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Users className="h-4 w-4" />
          Student view
        </Link>
      }
    />
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
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted" />}
      >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-foreground">{displayName ?? "Admin"}</p>
            <p className="text-xs text-muted-foreground">Staff</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Admin account</DropdownMenuLabel>
        </DropdownMenuGroup>
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1600px]">
        <AdminSidebarNav currentLabel={currentLabel} />
        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <AdminMobileNav currentLabel={currentLabel} />
                <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">{currentLabel}</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <NotificationsMenu />
                <AdminProfileMenu displayName={displayName} />
              </div>
            </div>
          </header>
          <div key={currentLabel} id="main-content"
            tabIndex={-1}
            className="w-full max-w-(--container-content) flex-1 animate-page-enter focus:outline-none px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
