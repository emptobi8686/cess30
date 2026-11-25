import { useId } from "react";
import { engineerRank } from "@/features/quests/ranks";

/**
 * XP shown as a beam drafted on blueprint paper: the beam's length is progress through
 * the current engineer rank. Pure CSS/SVG motion (see globals.css), no client JS.
 */
export function XpBeam({ totalXp, questsCompleted }: { totalXp: number; questsCompleted: number }) {
  const rank = engineerRank(totalXp);
  const span = 260;
  const end = 20 + span * rank.progress;
  const patternId = `bp-grid-${useId().replace(/:/g, "")}`;

  return (
    <div className="space-y-3" data-testid="xp-beam">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">{rank.title}</p>
          <p className="text-xs text-muted-foreground">Rank {rank.level} of 6</p>
        </div>
        <p className="text-right">
          <span className="count-up text-3xl font-semibold tabular-nums" style={{ ["--to" as string]: totalXp }} aria-hidden data-testid="my-xp-visual" />
          <span className="sr-only" data-testid="my-xp">{totalXp}</span>
          <span className="ml-1 text-xs text-muted-foreground">XP</span>
        </p>
      </div>

      <svg viewBox="0 0 300 74" className="w-full text-primary" role="img" aria-label={`${Math.round(rank.progress * 100)}% of the way to ${rank.next?.title ?? "the top rank"}`}>
        <defs>
          <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M12 0H0V12" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect className="bp-grid" width="300" height="74" rx="6" fill={`url(#${patternId})`} />
        {/* Supports */}
        <path className="bp-grid" d="M20 48 l-8 12 h16 Z M280 48 l-8 12 h16 Z" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
        <line className="bp-grid" x1="4" y1="60" x2="296" y2="60" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" />
        {/* The full beam, as drawn outline */}
        <rect className="bp-grid" x="20" y="38" width={span} height="10" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 3" strokeWidth="1" />
        {/* Built so far */}
        {rank.progress > 0 ? (
          <line className="bp-draw" x1="20" y1="43" x2={end} y2="43" stroke="currentColor" strokeWidth="10" pathLength={1} />
        ) : null}
        {/* Dimension line to the next rank */}
        {rank.next ? (
          <g className="bp-late" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8">
            <line x1={end} y1="28" x2="280" y2="28" />
            <line x1={end} y1="24" x2={end} y2="32" />
            <line x1="280" y1="24" x2="280" y2="32" />
          </g>
        ) : null}
      </svg>

      <p className="text-xs text-muted-foreground">
        {rank.next
          ? `${rank.toNext} XP to ${rank.next.title}. ${questsCompleted} quest${questsCompleted === 1 ? "" : "s"} completed.`
          : `Top rank reached. ${questsCompleted} quests completed.`}
      </p>
    </div>
  );
}
