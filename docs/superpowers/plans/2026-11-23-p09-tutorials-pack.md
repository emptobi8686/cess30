# P9 Tutorials Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a curated, course-oriented video tutorial module (YouTube and approved providers by embed or link, AI-generated content under mandatory human review), with saves, playlists, progress tracking and reports.

**Architecture:** `tutorials` plus audience rows (P6 shape), with RLS via `can_view_tutorial`. Video URLs are parsed server-side into `(provider, id)`, and embeds are rendered from fixed templates on allow-listed domains only. A DB trigger enforces the AI review gate. Optional metadata fetch uses fixed provider endpoints only. A weekly link-health job reuses the cron pattern.

**Tech Stack:** PostgreSQL/pgTAP, Next.js 16, YouTube embed (`youtube-nocookie.com`), optional YouTube IFrame Player API, optional YouTube Data API v3.

**Spec:** `department-expansion/05_TUTORIALS_PACK_ASSESSMENT.md`; `06` §6 (R6, R7, R9, R12).

## Global Constraints

- **Gate 🔐:** the AI content policy and reviewer pool (decision 0004) must be approved. YouTube Data API use needs approval plus the server-only env var `YOUTUBE_API_KEY`. Without it, duration is entered manually.
- Store only provider IDs for embeds; never store or render admin-supplied HTML. YouTube IDs match `^[A-Za-z0-9_-]{11}$`; Vimeo IDs `^\d{6,12}$`.
- Embed templates: `https://www.youtube-nocookie.com/embed/{id}?rel=0` and `https://player.vimeo.com/video/{id}?dnt=1`.
- iframe attributes: `sandbox="allow-scripts allow-same-origin allow-presentation"`, `allow="encrypted-media; picture-in-picture; fullscreen"`, `referrerpolicy="strict-origin-when-cross-origin"`, `loading="lazy"`, and a `title` equal to the tutorial title.
- External link-outs only to domains in `tutorial_provider_domains` (admin-managed allow-list).
- The server never fetches a user-supplied URL. Only `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={id}&format=json` and `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id={id}` are fetched.
- The AI label copy (exact): "AI-generated explanation · Reviewed by {reviewer} on {date} · Supplementary material — verify against your lecture notes."

## Review Focus

- A pasted URL like `https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ` must be rejected, not treated as YouTube.
- An AI-generated tutorial edited after approval must disappear from students until it is re-reviewed.
- A video whose owner disabled embedding must show "Open on YouTube" instead of a broken player.
- Progress tracking must never let one student write another student's progress, and must not record more than 100%.
- With JavaScript blocked for youtube.com (school network), manual "Mark as completed" must still work.

---

### Task 1: Tutorials schema, AI gate and RLS

**Files:**
- Create: `supabase/migrations/038_tutorials.sql`
- Test: `supabase/tests/database/600_tutorials.test.sql`

**Interfaces:**
- Tables exactly as in doc 05 §2: `tutorials`, `tutorial_audiences`, `tutorial_playlists`, `tutorial_playlist_items` (unique `(playlist_id, position)` and `(playlist_id, tutorial_id)`), `tutorial_saves`, `tutorial_progress` (`percent_watched numeric check between 0 and 100`, PK `(user_id, tutorial_id)`), `tutorial_reports`, `tutorial_review_events`, and `tutorial_provider_domains(domain text pk, provider text, embed_allowed bool)` seeded with `youtube.com`, `youtu.be`, `vimeo.com` and the domains listed in decision 0004.
- CHECK: `provider in ('youtube','vimeo')` requires a `provider_video_id` matching the provider regex; `provider='other_allowlisted'` requires `external_url like 'https://%'` and `provider_video_id is null`.
- Trigger `tutorials_publication_gate` (before insert or update):
  1. `status='published'` requires `review_status='approved'` and ≥1 audience.
  2. `is_ai_generated and status='published'` requires `academic_reviewer_id is not null`, `academic_reviewer_id <> created_by`, non-empty `ai_disclosure`, and the reviewer holding `has_capability('tutorial_curator')` or `course_content_manager` for the course (checked via the definer helper `user_has_capability(p_user uuid, …)`).
  3. On update of a published AI item, a change to any of `external_url`, `provider_video_id`, `description`, `learning_objectives` or `title` sets `status='in_review'`, `review_status='pending'`, `academic_reviewer_id=null`, and inserts a review event `reset_on_edit`.
- `can_view_tutorial(p_id uuid)` (published and audience match, or staff). RLS mirrors Library: saves, progress and personal playlists are owner-only; official playlists are visible when `is_official` and audience matches.

- [ ] **Step 1: Write failing tests:**
  - publishing an AI item without a reviewer → raises;
  - reviewer = creator → raises;
  - a valid review → publishes;
  - editing the description of a published AI item → status `in_review`;
  - a level-300 student cannot see a level-200-only tutorial;
  - a student upserting another user's progress → `42501`;
  - `percent_watched = 101` → `23514`;
  - YouTube with id `"abc"` → `23514`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): tutorials schema with AI review gate and RLS`.

### Task 2: Video URL parsing

**Files:**
- Create: `src/features/tutorials/video-url.ts`
- Test: `src/features/tutorials/__tests__/video-url.test.ts`

**Interfaces:**
- `type ParsedVideo = { provider: "youtube"; id: string } | { provider: "vimeo"; id: string } | { provider: "other_allowlisted"; url: string; host: string }`
- `parseVideoUrl(input: string, allowedDomains: string[]): ParsedVideo | null`: https only (http is upgraded only for YouTube and Vimeo hosts). The host must equal an allowed domain or be a subdomain of one (`host === d || host.endsWith("." + d)`). YouTube forms: `watch?v=`, `youtu.be/{id}`, `/shorts/{id}`, `/embed/{id}`, `/live/{id}`.
- `embedUrlFor(v: ParsedVideo): string | null` (templates from Global Constraints; null for `other_allowlisted`)

- [ ] **Step 1: Write failing tests (table-driven):** `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10` → youtube/`dQw4w9WgXcQ`; `https://youtu.be/dQw4w9WgXcQ` → same; `/shorts/dQw4w9WgXcQ` → same; `https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ` → null; `javascript:alert(1)` → null; `https://www.youtube.com/watch?v=short` → null; `https://vimeo.com/76979871` → vimeo/`76979871`; `https://ocw.mit.edu/x` with `ocw.mit.edu` allowed → other_allowlisted; `embedUrlFor({provider:"youtube",id:"dQw4w9WgXcQ"})==="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): strict video URL parsing and embed URLs`.

### Task 3: Provider metadata

**Files:**
- Create: `src/features/tutorials/metadata.ts` (server-only): `fetchYouTubeMetadata(id: string, fetchImpl?: typeof fetch): Promise<{ title: string | null; author: string | null; durationSeconds: number | null; embeddable: boolean | null }>`. Uses oEmbed always (401 or 404 → `embeddable:false`), plus the Data API only when `YOUTUBE_API_KEY` is set. 5 s timeout. Never throws (returns nulls).
- `parseIsoDuration(value: string): number | null` (e.g. `PT1H2M3S` → 3723)
- Test: `src/features/tutorials/__tests__/metadata.test.ts` (inject a fake `fetchImpl`; assert the requested URLs start with exactly the two allowed endpoints)

- [ ] **Step 1: Write failing tests:** `parseIsoDuration("PT4M13S")===253`; a fake oEmbed 401 → `embeddable:false`; with no key, the Data API is not called; the requested URL host is in `["www.youtube.com","www.googleapis.com"]`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): safe provider metadata lookup`.

### Task 4: Admin tutorial curation and review

**Files:**
- Create: `src/features/tutorials/{schema,actions,queries}.ts`: `tutorialSchema` (title 3–160, description ≤2000, topic 2–80, `learning_objectives` 1–8 items × 5–200 characters, `source_type` enum, `video_url` string, `is_ai_generated` bool, `ai_tool` and `ai_disclosure` required when AI, duration optional int 1–36000, audiences via `audienceListSchema`). Actions: `createTutorialAction` (parse URL → set provider and id; fetch metadata to prefill and to set `embed_allowed`), `updateTutorialAction`, `submitForReviewAction`, `reviewTutorialAction(decision: "approved"|"changes_requested"|"rejected", notes)` (`requireCapability("tutorial_curator")`), `publishTutorialAction`, `archiveTutorialAction`, `removeTutorialAction`. Playlist actions: `createOfficialPlaylistAction`, `reorderPlaylistAction(playlistId, orderedTutorialIds[])`.
- Create: `src/app/admin/tutorials/page.tsx` (queues: Drafts, In review, Published, Reported, Link problems), `new/page.tsx`, `[id]/page.tsx` (review panel shows the AI disclosure and requires the reviewer's notes), `playlists/page.tsx`
- Test: `src/features/tutorials/__tests__/schema.test.ts`

- [ ] **Step 1: Write failing tests:** the schema requires `ai_disclosure` when `is_ai_generated`; rejects 9 learning objectives; rejects a non-allow-listed URL (via a refine using `parseVideoUrl`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: curator A creates an AI tutorial → submits → A cannot approve ("You cannot review your own content."); curator B approves → publishes → visible to the targeted level. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): admin curation, review workflow and playlists`.

### Task 5: Student tutorials experience

**Files:**
- Create: `src/components/shared/video-embed.tsx` (props `{ embedUrl: string; title: string }`; attributes from Global Constraints)
- Create: `src/app/tutorials/page.tsx` (browse and search via the SECURITY INVOKER `search_tutorials(p_query, p_course_id, p_level_code, p_source_type, p_topic, p_limit, p_offset)` added in `038b_search_tutorials.sql`; filters; an "AI-generated" filter; my saved; my playlists; official playlists), `src/app/tutorials/[id]/page.tsx` (embed or "Open on {provider}" button; AI label exact copy; learning objectives; save; add to playlist; "Mark as completed"; report), `src/app/tutorials/playlists/[id]/page.tsx`
- Create: `src/features/tutorials/student-actions.ts`: `toggleSaveTutorialAction`, `createPlaylistAction`, `addToPlaylistAction`, `removeFromPlaylistAction`, `markTutorialCompletedAction(tutorialId, completed: boolean)`, `reportTutorialAction(prev, formData)`
- Modify: `src/lib/security/csp.ts` (`frame-src` adds `https://www.youtube-nocookie.com https://player.vimeo.com`; `img-src` adds `https://i.ytimg.com`)
- Modify: the student nav ("Tutorials")
- Test: `e2e/tutorials-student.spec.ts`; `src/lib/security/__tests__/csp.test.ts` (extend)

- [ ] **Step 1: Write failing tests:** the CSP contains `frame-src` with `youtube-nocookie` and not `youtube.com` alone; e2e: a student opens a seeded tutorial → iframe `src` starts with `https://www.youtube-nocookie.com/embed/`; a non-embeddable seed shows the "Open on YouTube" link with `rel="noopener noreferrer"`; mark completed persists; the AI label text is visible on the AI seed.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run (plus the a11y suite with `/tutorials` added). Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): student browsing, embeds, saves, playlists, completion`.

### Task 6: Automatic progress tracking (optional flag)

**Files:**
- Create: `src/features/tutorials/progress.ts`: `nextProgress(prev: { percent: number; status: string } | null, positionSeconds: number, durationSeconds: number): { percent: number; status: "in_progress" | "completed"; lastPosition: number }` (percent capped at 100, never decreasing; completed at ≥ 90)
- Create: `src/components/shared/youtube-progress-player.tsx` (client; loads `https://www.youtube.com/iframe_api` only when `NEXT_PUBLIC_TUTORIAL_PROGRESS_TRACKING === "true"`; reports at most once every 15 s and on pause or end via `recordTutorialProgressAction(tutorialId, positionSeconds, durationSeconds)`)
- Modify: `src/lib/security/csp.ts` (`script-src` adds `https://www.youtube.com` only when the flag is on)
- Test: `src/features/tutorials/__tests__/progress.test.ts`

- [ ] **Step 1: Write failing tests:** `nextProgress(null, 30, 100)` → `{percent:30,status:"in_progress"}`; `nextProgress({percent:50,status:"in_progress"}, 10, 100).percent===50`; `nextProgress(null, 95, 100).status==="completed"`; `nextProgress(null, 500, 100).percent===100`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): optional automatic watch-progress tracking`.

### Task 7: Reports and link health

**Files:**
- Modify: `src/features/tutorials/actions.ts`: `resolveTutorialReportAction`. Two open `inaccurate` reports on an AI item automatically set `status='in_review'` (DB trigger `tutorial_reports_autohide` in `038c_tutorial_report_rules.sql`).
- Create: `src/app/api/cron/tutorial-links/route.ts` (POST, same bearer-secret check as the notifications cron; extract `isAuthorizedCron(request)` into `src/lib/cron/auth.ts` and reuse it in both routes). It checks up to 50 published tutorials ordered by `last_link_check_at nulls first` using `fetchYouTubeMetadata` and sets `link_status` and `embed_allowed`.
- Modify: `supabase/schedule_notifications.sql` → add `supabase/schedule_tutorial_links.sql` (weekly `cron.schedule`, same Vault pattern) 🔐 to run on staging and production
- Test: `src/lib/cron/__tests__/auth.test.ts`; `supabase/tests/database/610_tutorial_reports.test.sql`

- [ ] **Step 1: Write failing tests:** `isAuthorizedCron` rejects a missing or wrong header and accepts the exact `Bearer <secret>`; the DB autohide trigger fires on the second distinct reporter only.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && supabase test db`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(tutorials): report rules and weekly link-health checks`.
