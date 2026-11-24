# 05 — Tutorials Pack Assessment (External Video Integration and AI Content Governance)

## 1. Current completeness

**Nothing exists.** There are no tables, routes or components. The current app has no CSP, so iframes would load unrestricted, but there is also no embed code. Every requirement below is ❌ today.

| Requirement | Needs |
|---|---|
| Tutorial metadata (title, description, course, level, semester, topic, URL/ID, source type, creator/provider, duration, learning objectives, publication status, review status) | **DB migration** (E8), after E1–E3 |
| Browse, search, filter | SQL (full-text plus facets). No external service. |
| Watch embedded videos | iframe embed + CSP `frame-src` allow-list. No dependency. |
| Open external resources | Allow-listed outbound links (`rel="noopener noreferrer"`) |
| Save tutorials | Table plus RLS |
| Personal playlists | Tables plus RLS |
| Mark completed / track progress | Manual completion: table only. Automatic watch progress: **YouTube IFrame Player API** (loads `https://www.youtube.com/iframe_api`; CSP `script-src` addition). No npm dependency required. |
| Report broken or inappropriate | Reports table plus an admin queue; plus a link-health job (scheduled, existing cron route) |
| Admin add links, curate playlists, edit, publish, archive, remove, review reports | Server actions plus admin routes |
| Duration and title auto-fill | **YouTube Data API v3** (API key = **external service + secret**). oEmbed (`youtube.com/oembed`, no key) gives title, author and thumbnail but **not duration**. Manual entry is the fallback. |

## 2. Proposed data model (migration E8)

| Table | Key columns |
|---|---|
| `tutorials` | `id`, `title`, `description`, `topic`, `course_id`, `offering_id`, `level_code`, `semester_id`, `source_type` (`youtube`,`ai_generated`,`external_platform`,`lecturer_recording`,`departmental`), `provider` (`youtube`,`vimeo`,`other_allowlisted`), `provider_video_id` (validated), `external_url` (canonicalised), `embed_allowed` bool, `creator_name`, `provider_name`, `duration_seconds`, `learning_objectives text[]`, `status` (`draft`,`in_review`,`published`,`archived`,`removed`), `review_status` (`pending`,`approved`,`changes_requested`,`rejected`), `is_ai_generated` bool, `ai_tool`, `ai_disclosure`, `academic_reviewer_id`, `reviewed_at`, `review_notes`, `link_status` (`ok`,`broken`,`unavailable_embed`,`unchecked`), `last_link_check_at`, `created_by`, `published_by`, `published_at`, `search tsvector` |
| `tutorial_audiences` | Same shape as library audiences (doc 02 §4) |
| `tutorial_playlists` | `id`, `owner_id` (null = official), `title`, `description`, `is_official`, `status`, audience rows for official playlists |
| `tutorial_playlist_items` | `playlist_id`, `tutorial_id`, `position` (unique per playlist) |
| `tutorial_saves` | `user_id`, `tutorial_id` |
| `tutorial_progress` | `user_id`, `tutorial_id`, `status` (`not_started`,`in_progress`,`completed`), `last_position_seconds`, `percent_watched`, `completed_at` |
| `tutorial_reports` | Same shape as library reports, plus `reason` values `broken_link`,`not_embeddable`,`inaccurate`,`inappropriate`,`copyright` |

DB-enforced publication rules (trigger or CHECK):
- `status='published'` requires `review_status='approved'` and ≥1 audience row.
- `is_ai_generated = true` and `status='published'` require `academic_reviewer_id is not null`, `academic_reviewer_id <> created_by`, a reviewer holding `tutorial_curator` or `course_content_manager` for that course, and a non-empty `ai_disclosure`.
- Any edit to `external_url`, `provider_video_id`, `description` or `learning_objectives` on an AI-generated published tutorial resets `review_status='pending'` and unpublishes it (re-review on change).

## 3. External video integration assessment

| Provider | Mechanism | Notes |
|---|---|---|
| **YouTube** | Store only the **11-character video ID**, parsed server-side from `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` and `youtube.com/embed/` with the strict regex `^[A-Za-z0-9_-]{11}$`. Render `https://www.youtube-nocookie.com/embed/{id}` (privacy-enhanced mode). **Never store or render admin-supplied embed HTML.** | Complies with YouTube's ToS (embedding via the official player; no downloading or re-hosting). Some videos disable embedding: detect via oEmbed (401/404) or the Data API `status.embeddable`, and fall back to "Open on YouTube". |
| Vimeo | `player.vimeo.com/video/{numeric id}` | Optional; validate the numeric ID |
| Other platforms (MIT OCW, NPTEL, Khan Academy, departmental portal) | **Link-out only** unless the platform publishes an embeddable player on an allow-listed domain | Domain allow-list stored in a config table, editable by the department admin |
| Lecturer recordings / departmental videos | Preferably unlisted YouTube or Vimeo (cheaper bandwidth). If self-hosted: a private `tutorial-media` bucket with signed URLs, same model as the Library | Self-hosting video on Supabase Storage has real **egress cost**. Requires a budget decision. |
| AI-generated videos | Host as above (unlisted channel recommended), metadata in `tutorials` with `source_type='ai_generated'` | See governance (§4) |

Required platform changes:
- **CSP:** `frame-src https://www.youtube-nocookie.com https://player.vimeo.com`; `script-src` adds `https://www.youtube.com` (IFrame API) only if automatic progress tracking is enabled; `img-src` adds `i.ytimg.com` for thumbnails. No CSP exists today (parent BP-053), so introducing one is part of this work.
- **iframe attributes:** `sandbox="allow-scripts allow-same-origin allow-presentation"`, `allow="encrypted-media; picture-in-picture; fullscreen"`, `referrerpolicy="strict-origin-when-cross-origin"`, `loading="lazy"`, plus a `title` for accessibility.
- **Server-side metadata fetch:** only to fixed endpoints (`youtube.com/oembed`, `googleapis.com/youtube/v3/videos`). **Never fetch arbitrary admin-supplied URLs server-side (SSRF).**
- **Link-health job:** reuse the cron route pattern to re-check tutorials weekly (oEmbed status) and set `link_status`.

## 4. AI-generated educational content governance

| Control | Implementation |
|---|---|
| **Clear identification** | `is_ai_generated` is mandatory at creation. A persistent "AI-generated, reviewed by {reviewer}, {date}" label on the card, player and playlist entries. Filter facet. The label cannot be removed while the flag is true. |
| **Mandatory human review before publication** | DB rule (§2). The reviewer must be a different person from the uploader and must hold a curator or content-manager capability for the course. |
| **Not presented as authoritative** | A disclaimer on every AI item ("Supplementary explanation. Verify against lecture notes and your lecturer."). No "official" badge. Excluded from "Official course material" listings unless separately endorsed by a lecturer. |
| **Provenance** | `ai_tool`, generation date, prompt or source summary (`ai_disclosure`), and the source materials referenced |
| **Corrections** | Student "inaccurate" reports. A threshold (e.g. 2 reports) auto-moves the item to `in_review` (hidden) pending re-review. Correction notes are shown to viewers. |
| **Re-review on change** | Edits to content fields reset review (§2) |
| **Accountability** | Review decisions logged (`tutorial_review_events`: who, when, decision, notes) |
| **Scope** | AI content cannot satisfy quest requirements or appear in "past questions" or official notes |
| **Policy** | A written content policy approved by the department (who may review, which topics are excluded, takedown SLA). **Requires human approval before launch.** |

## 5. Tutorials-specific security and privacy risks

| Risk | Control |
|---|---|
| Malicious embed / clickjacking | ID-only storage; fixed embed templates; CSP `frame-src` allow-list; sandboxed iframe |
| Tracking of students by third parties | `youtube-nocookie`; no autoplay; disclose embeds in the privacy notice |
| SSRF via metadata fetching | Fixed provider endpoints only; no user-URL fetching |
| Open redirect / phishing via external links | Domain allow-list; links rendered with the visible host; `noopener noreferrer` |
| Copyright | Embeds via official players only; no download or re-hosting of third-party videos |
| Misinformation (AI) | Governance in §4 |
| Progress-data privacy | `tutorial_progress` is owner-only in RLS. Staff see aggregates only (a view with minimum group size). |
| API key leakage (YouTube Data API) | Server-only env var; restrict the key to the YouTube Data API and server IPs where possible |
