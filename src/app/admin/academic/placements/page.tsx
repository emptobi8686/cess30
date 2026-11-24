import { getAccessContext } from "@/lib/auth/access-server";
import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlacementQueue } from "@/features/academic/queries";
import { LEVEL_CODES } from "@/features/academic/validation";
import { PlacementQueue } from "../_components/placement-queue";

export const dynamic = "force-dynamic";

const STATUSES = ["claimed", "confirmed", "rejected"] as const;

export default async function PlacementsPage(props: PageProps<"/admin/academic/placements">) {
  const params = await props.searchParams;
  const status = STATUSES.find((s) => s === params.status) ?? "claimed";
  const access = await getAccessContext();
  const allowed: readonly string[] = access?.isAdmin ? LEVEL_CODES : (access?.staffLevels ?? []);
  const requested = allowed.find((l) => l === params.level) ?? null;
  // Course representatives always work inside their own level.
  const level = access?.isAdmin ? requested : (requested ?? allowed[0] ?? null);
  const rows = await getPlacementQueue({ status, levelCode: level });
  const href = (s: string, l: string | null) => `/admin/academic/placements?status=${s}${l ? `&level=${l}` : ""}`;

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic"
          title="Student placements"
          description="Students request their level for the current session; confirm it here. Nobody can confirm their own placement."
        />
        <Card>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="text-base">Placements · {status}</CardTitle>
            <nav aria-label="Placement status" className="flex flex-wrap gap-2 text-xs">
              {STATUSES.map((s) => (
                <Link key={s} href={href(s, level)} aria-current={s === status ? "page" : undefined}
                  className={s === status ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg border px-2.5 py-1 hover:bg-muted"}>
                  {s}
                </Link>
              ))}
            </nav>
            <nav aria-label="Level filter" className="flex flex-wrap gap-2 text-xs">
              {[...(access?.isAdmin ? [null] : []), ...allowed].map((l) => (
                <Link key={l ?? "all"} href={href(status, l)} aria-current={l === level ? "page" : undefined}
                  className={l === level ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg border px-2.5 py-1 hover:bg-muted"}>
                  {l ? `Level ${l}` : "All levels"}
                </Link>
              ))}
            </nav>
          </CardHeader>
          <CardContent>
            <PlacementQueue rows={rows} readOnly={status !== "claimed"} />
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
