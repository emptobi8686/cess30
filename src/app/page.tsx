import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Megaphone,
  Trophy,
} from "lucide-react";
import { PublicNavigation } from "@/components/shared/public-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

const features = [
  {
    icon: CalendarDays,
    title: "Academic timetable",
    description:
      "Keep the official class schedule easy to find, separate from the study time you plan for yourself.",
  },
  {
    icon: BookOpenCheck,
    title: "Personal study planner",
    description:
      "Make room for focused revision around your classes, with a plan that belongs to you.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    description:
      "Find course updates and important notices in one organised place.",
  },
  {
    icon: ClipboardCheck,
    title: "Quests and participation",
    description:
      "Take part in academic activities and provide evidence of completion when a quest is available.",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description:
      "Recognise participation through transparent progress, once the feature is available.",
  },
];

const steps = [
  {
    number: "01",
    title: "Get the course picture",
    description:
      "The academic timetable and course announcements are shared separately from personal plans.",
  },
  {
    number: "02",
    title: "Plan your own study",
    description:
      "Students can organise individual study sessions around their academic commitments.",
  },
  {
    number: "03",
    title: "Participate and progress",
    description:
      "Quests can make learning activities and evidence-based participation easier to follow.",
  },
];

function ProductPreview() {
  return (
    <div
      aria-label="Illustrative preview of the student workspace with no academic data"
      className="relative mx-auto w-full max-w-xl"
    >
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/[0.06]" />
      <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-xl shadow-foreground/[0.06]">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-white">
              <Image
                src="/images/blueprint-logo.png"
                alt=""
                fill
                sizes="36px"
                className="object-contain p-0.5"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">Student workspace</p>
              <p className="text-xs text-muted-foreground">Interface preview</p>
            </div>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[0.68rem] text-muted-foreground">
            Sample view
          </span>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Academic timetable
              </p>
              <p className="mt-1 text-sm font-medium">Official schedule</p>
            </div>
            <CalendarDays aria-hidden="true" className="size-4 text-primary" />
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            No schedule published in this preview.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpenCheck aria-hidden="true" className="size-4 text-primary" />
                Study planner
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Personal study plans stay separate.
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BellRing aria-hidden="true" className="size-4 text-primary" />
                Course updates
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                No announcements in this preview.
              </p>
            </div>
          </div>
          <p className="text-center text-[0.7rem] text-muted-foreground">
            Illustrative interface only — no student or course data shown
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <PublicNavigation />

      <main id="main-content">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1.5 text-xs font-medium text-primary">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              An academic companion for Civil Engineering
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-[3.55rem]">
              Make space for the work that moves you forward.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              BLUEPRINT brings academic schedules, personal study planning and
              course updates into a more organised student experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get Started
                <ArrowRight aria-hidden="true" className="ml-1 size-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Explore Features
                <ArrowDown aria-hidden="true" className="ml-1 size-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Scope: UNILAG Civil Engineering, 100 to 500 Level. BLUEPRINT is an
              independent project, not an official University of Lagos service.
            </p>
          </div>

          <ProductPreview />
        </section>

        <section
          id="features"
          aria-labelledby="features-title"
          className="border-y border-border/80 bg-card/60"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                One organised experience
              </p>
              <h2
                id="features-title"
                className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                The tools to keep academic life in view.
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Designed around the difference between shared course
                information and each student&apos;s personal study routine.
                Some capabilities are still in development.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <Card
                  key={title}
                  className="border-border/80 bg-background shadow-none transition-colors hover:border-primary/30"
                >
                  <CardContent className="p-5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              A clearer rhythm
            </p>
            <h2
              id="how-title"
              className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Shared course information. Your own study plan.
            </h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              The intended BLUEPRINT experience keeps official academic
              information distinct from a student&apos;s personal planning.
            </p>
          </div>
          <ol className="divide-y divide-border border-y border-border">
            {steps.map((step) => (
              <li key={step.number} className="flex gap-5 py-5 sm:gap-7">
                <span className="pt-0.5 font-mono text-sm text-primary">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="pilot"
          aria-labelledby="pilot-title"
          className="border-y border-border/80 bg-secondary/35"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Starting with a focused pilot
              </p>
              <h2
                id="pilot-title"
                className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Built for Civil Engineering, every level.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The initial pilot is intended for students at the University of
                Lagos. Initial administration is planned for the project owner
                and course representative. BLUEPRINT is not endorsed by UNILAG.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <Compass aria-hidden="true" className="size-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Pilot cohort</p>
                <p className="text-xs text-muted-foreground">
                  UNILAG Civil Engineering · 100–500 Level
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <CheckCircle2
            aria-hidden="true"
            className="mx-auto size-8 text-primary"
          />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Start with a clearer plan.
          </h2>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-muted-foreground">
            Explore the student experience and see what is available in this
            development preview.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get Started
            <ArrowRight aria-hidden="true" className="ml-1 size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/80 bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <div className="relative size-8 overflow-hidden rounded-md bg-white">
              <Image
                src="/images/blueprint-logo.png"
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <span className="font-semibold tracking-wide">{siteConfig.name}</span>
          </Link>
          <p className="text-xs leading-5 text-muted-foreground">
            Independent student project. Not an official University of Lagos
            service.
          </p>
          <Link
            href="/login"
            className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline"
          >
            Student access
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
