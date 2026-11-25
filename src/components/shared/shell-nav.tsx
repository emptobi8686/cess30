"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ComponentType, type ReactElement } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";
import { cn } from "cn";

export type ShellNavItem = { label: string; href: string; icon: ComponentType<{ className?: string }> };

/** One navigation row: shared by the student and admin sidebars and the slide-out menu. */
export function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: ShellNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { label, href, icon: Icon } = item;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
        "transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-(--shadow-card)"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Slide-out menu for phones and tablets. Controlled, so it closes as soon as a link is
 * chosen (the shell stays mounted across pages, which would otherwise keep it open).
 */
export function MobileNavSheet({
  items,
  currentLabel,
  trigger,
  title = siteConfig.name,
  footer,
}: {
  items: ShellNavItem[];
  currentLabel: string;
  trigger: ReactElement;
  title?: string;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="left" className="w-[85vw] max-w-xs px-3 py-5">
        <SheetHeader className="mb-2 px-2">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/20 bg-white">
              <Image src="/images/blueprint-logo.png" alt="" width={40} height={40} className="object-cover" />
            </div>
            <SheetTitle className="text-left text-base font-semibold">{title}</SheetTitle>
          </div>
        </SheetHeader>
        <nav aria-label="Main" className="space-y-1 overflow-y-auto px-2">
          {items.map((item) => (
            <NavLink key={item.label} item={item} active={item.label === currentLabel} onNavigate={() => setOpen(false)} />
          ))}
        </nav>
        {footer ? <div className="mt-auto px-2" onClick={() => setOpen(false)}>{footer}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Bottom bar for phones and tablets: the four daily destinations one tap away, plus
 * "More" for everything else. Hidden on desktop, where the sidebar shows everything.
 */
export function BottomNav({
  items,
  currentLabel,
  more,
}: {
  items: ShellNavItem[];
  currentLabel: string;
  more: ReactElement;
}) {
  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ label, href, icon: Icon }) => {
          const active = label === currentLabel;
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  "transition-colors duration-(--duration-fast) ease-(--ease-out)",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-(--duration-base) ease-(--ease-out)",
                    active ? "bg-primary/12 scale-100" : "scale-95 group-active:scale-90"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>{more}</li>
      </ul>
    </nav>
  );
}
