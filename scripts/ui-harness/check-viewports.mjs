// Visits every route as each persona at the target widths against a running app
// (pointed at mock-supabase.mjs), and reports horizontal overflow, console errors
// and failed responses. Optional screenshots for a subset of widths.
//
// Usage: node scripts/ui-harness/check-viewports.mjs <baseUrl> <outDir> [--shots] [--only=/path]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { IDS } from "./mock-supabase-ids.mjs";

const [base = "http://localhost:3100", outDir = "ui-harness-out"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const shots = process.argv.includes("--shots");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const WIDTHS = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
const SHOT_WIDTHS = [375, 768, 1440];

const ROUTES = {
  public: ["/", "/login", "/register", "/reset-password"],
  student: ["/dashboard", "/timetable", "/timetable?view=week", "/study-planner", "/announcements", "/notifications", "/library", "/library/00000000-0000-4000-8000-000000001000", "/quests", "/leaderboard", "/settings", "/settings/profile", "/settings/notifications"],
  pending: ["/dashboard", "/quests"],
  admin: ["/admin", "/admin/timetable", "/admin/announcements", "/admin/verifications", "/admin/quests", "/admin/courses", "/admin/academic", "/admin/academic/sessions", "/admin/academic/offerings", "/admin/academic/placements", "/admin/academic/enrollments", "/admin/academic/review", "/admin/library", "/admin/library/new", "/admin/library/00000000-0000-4000-8000-000000001000", "/admin/staff"],
};

function sessionCookie(who) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: IDS[who], role: "authenticated", aud: "authenticated", exp })}.sig`;
  const session = {
    access_token: token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "mock-refresh",
    user: { id: IDS[who], aud: "authenticated", role: "authenticated", email: `${who}@example.test`, app_metadata: { provider: "google" }, user_metadata: {} },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = [];

for (const [who, routes] of Object.entries(ROUTES)) {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  if (who !== "public") {
    await context.addCookies([{ name: "blueprint-auth", value: sessionCookie(who), url: base }]);
  }
  for (const route of routes) {
    if (only && route !== only) continue;
    for (const width of WIDTHS) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 800 });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("/realtime/v1/")) errors.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
      let status = 0;
      try {
        const resp = await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 });
        status = resp?.status() ?? 0;
      } catch (e) {
        errors.push(`goto: ${e.message.slice(0, 120)}`);
      }
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => {
        const vw = window.innerWidth;
        const sw = document.documentElement.scrollWidth;
        const offenders = [];
        if (sw > vw) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1 && r.width > 0) {
              // skip elements inside a horizontally scrollable ancestor
              let p = el.parentElement, clipped = false;
              while (p) {
                const s = getComputedStyle(p);
                if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { clipped = true; break; }
                p = p.parentElement;
              }
              if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.right)}`);
            }
            if (offenders.length >= 4) break;
          }
        }
        const smallTargets = [...document.querySelectorAll("a, button, input, select, textarea, [role=button]")]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24); })
          .length;
        return { vw, sw, overflow: sw > vw, offenders, smallTargets, url: location.pathname + location.search };
      });
      report.push({ who, route, width, status, ...info, errors: [...new Set(errors)] });
      if (shots && SHOT_WIDTHS.includes(width)) {
        const name = `${who}${route.replace(/[/?=]/g, "_")}-${width}.png`;
        await page.screenshot({ path: path.join(outDir, name), fullPage: true });
      }
      await page.close();
    }
  }
  await context.close();
}
await browser.close();

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.overflow || r.errors.length || r.status >= 400);
console.log(`checked ${report.length} page views; ${report.filter((r) => r.overflow).length} with horizontal overflow; ${report.filter((r) => r.errors.length).length} with console errors`);
for (const r of bad) {
  console.log(`${r.who} ${r.route} @${r.width} status=${r.status} url=${r.url}${r.overflow ? ` OVERFLOW ${r.sw}>${r.vw} ${r.offenders.join(" | ")}` : ""}${r.errors.length ? ` ERR ${r.errors.slice(0, 2).join(" || ")}` : ""}`);
}
