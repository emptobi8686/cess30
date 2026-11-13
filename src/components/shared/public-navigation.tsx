import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pilot", href: "#pilot" },
];

export function PublicNavigation() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="BLUEPRINT home">
          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-primary/20 bg-white shadow-sm">
            <Image src="/images/blueprint-logo.png" alt="" fill sizes="36px" className="object-cover" />
          </div>
          <div>
            <p className="text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground">Student hub</p>
            <p className="text-base font-semibold tracking-tight text-foreground">{siteConfig.name}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Student login
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Login
          </Link>
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open menu"
                >
                  <span className="sr-only">Open menu</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              }
            />
            <SheetContent side="right" className="w-[85vw] max-w-sm px-3 py-5">
              <SheetHeader className="mb-4 px-2">
                <SheetTitle className="text-left text-base">{siteConfig.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 px-2">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
                    {item.label}
                  </Link>
                ))}
                <Link href="/login" className="mt-2 block rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  Student login
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
