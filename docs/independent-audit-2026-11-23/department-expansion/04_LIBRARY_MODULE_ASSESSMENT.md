# 04 — Library Module Assessment

## 1. Current completeness

**Nothing exists.** No routes, tables, buckets, components or tests for a Library. The only related assets are the `quest-evidence` private bucket definition (019, unapplyable and unused) and the `profile-pictures` **public** bucket (014, unapplyable). Neither can be reused for the Library: one is public, and the other is scoped to quest evidence.

| Requirement | Status | Implementable with existing infrastructure? |
|---|---|---|
| Resource metadata (title, description, course, level, session, semester, type, storage ref, uploader, upload date, status, visibility, tags) | ❌ | Needs a **DB migration** (E7) and E1–E3 for academic references |
| Search | ❌ | Postgres full-text (`tsvector` + GIN) and `pg_trgm` (Supabase extension). **No external service.** |
| Filtering | ❌ | SQL plus indexes |
| Preview of PDFs | ❌ | Browser-native PDF viewer in an `<iframe>`/`<object>` with a short-TTL signed URL. **No dependency.** Needs CSP `frame-src`/`object-src` for the Supabase Storage host. Optional `pdf.js` (`pdfjs-dist`, **new dependency**) for consistent mobile rendering. |
| Preview of PPTX/DOCX | ❌ | **Not possible privately without an external converter.** Microsoft and Google online viewers need a public URL, which violates the "private" requirement. Options: (a) download-only for Office formats in v1 (recommended); (b) require a PDF rendition at upload; (c) server-side conversion (LibreOffice/Gotenberg container = **external service**). |
| Download | ❌ | Server-minted signed URL with `download` disposition. Existing infrastructure. |
| Bookmarks | ❌ | Table plus RLS (migration) |
| Recently added | ❌ | Query on `published_at` |
| Related resources | ❌ | Same offering, course, tags or topic (SQL). No ML needed. |
| Admin upload, edit metadata, replace file, publish, archive, remove, visibility | ❌ | Migration, Storage bucket, server actions |
| Review reported resources | ❌ | Reports table plus an admin queue |

## 2. Proposed data model (migration E7)

| Table | Purpose | Key columns |
|---|---|---|
| `library_resources` | Logical resource | `id`, `title` (3–200), `description` (≤2000), `resource_type` (`lecture_slides`,`course_notes`,`pdf_document`,`presentation`,`tutorial_sheet`,`lab_manual`,`reading_material`,`past_question`,`other`), `course_id` (catalogue, nullable), `offering_id` (nullable), `level_code`, `session_id`, `semester_id`, `status` (`draft`,`in_review`,`published`,`archived`,`removed`), `current_file_id`, `copyright_basis` (`own_work`,`lecturer_permission`,`department_owned`,`open_licence`,`public_domain`,`approved_past_question`), `licence_note`, `tags text[]`, `search tsvector generated`, `created_by`, `published_by`, `published_at`, `archived_at`, `removed_at`, `removal_reason` |
| `library_resource_audiences` | Visibility (doc 02 §4) | `resource_id` FK cascade, `audience_kind`, targets |
| `library_files` | Versioned file objects; **replace = new version** | `id`, `resource_id`, `version`, `storage_path` (unique), `mime_type`, `size_bytes`, `sha256`, `original_filename` (display only), `uploaded_by`, `created_at`, `scan_status` (`pending`,`clean`,`rejected`,`not_scanned`) |
| `library_bookmarks` | Per-student | `user_id`, `resource_id`, PK both |
| `library_reports` | Reports and takedown | `id`, `resource_id`, `reporter_id`, `reason` (`broken`,`wrong_course`,`copyright`,`inappropriate`,`outdated`,`other`), `details`, `status` (`open`,`actioned`,`dismissed`), `resolved_by`, `resolved_at`, `resolution_note`; unique open report per reporter and resource |
| `library_access_log` (optional) | Download audit for copyright disputes | `user_id`, `resource_id`, `file_id`, `at` (no URLs stored) |

DB constraints:
- `status='published'` requires `current_file_id is not null`, `published_by is not null`, at least one audience row (trigger), and `copyright_basis is not null`.
- `resource_type='past_question'` requires `copyright_basis='approved_past_question'`.

## 3. Storage design

| Aspect | Design |
|---|---|
| Bucket | `library` (**private**, `public = false`), `file_size_limit` 25 MB (tunable; Supabase project limits apply: 50 MiB in local `config.toml`), `allowed_mime_types` = `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`, `image/png`, `image/jpeg`, `text/plain`, `application/zip` (only if lab datasets are approved). **Exclude** SVG, HTML, macro-enabled Office (`.pptm`, `.docm`, `.xlsm`) and executables. |
| Object path | `resources/{resource_id}/{file_id}.{ext}`, server-generated. The extension comes from the **validated MIME type**, never from the filename. The original filename is stored only as metadata, sanitised for display. |
| Write path | Recommended: server action authorises (`has_capability('library_manager', …)`), creates the `library_files` row, then returns a **signed upload URL** (`createSignedUploadUrl`) scoped to that exact path. The browser uploads directly, so large files avoid the server-action 1 MB body limit (parent BP-026). A finalise action then verifies object existence, size, MIME and magic bytes before linking. |
| Storage RLS | **No `select`, `insert`, `update` or `delete` policies for `authenticated` on bucket `library`.** All access is via service-role-minted signed URLs after authorisation. This makes accidental public or broad access structurally impossible. |
| Read path | `GET /api/library/{resourceId}/download` (or a server action): user-context query `select … where id = $1` (RLS + `can_view_library_resource`) → if visible, service role `createSignedUrl(path, 120, { download: safeName })` → 302 redirect. Preview uses the same flow without `download`, with a 60–300 s TTL. Signed URLs are never stored and never logged. |
| Replace file | New `library_files` version; flip `current_file_id`; keep the old version for audit (retention policy) or delete via a service-role job after N days. |
| Remove | `status='removed'`, revoke visibility immediately (RLS). Object deletion via a service-role job (copyright takedown = immediate delete plus log). |
| Validation | Server-side magic-byte sniffing (e.g. the `file-type` package = **new dependency**, or a small hand-written PDF/ZIP/OLE signature check). Size limit from the object's metadata. SHA-256 for de-duplication. |
| Malware scanning | Not provided by Supabase. Options: ClamAV container or a scanning API = **external service**. Until then, `scan_status='not_scanned'`, limit uploads to trusted staff, and block macro formats. **Risk accepted only with approval.** |

## 4. Student and admin UX (routes)

| Route | Purpose |
|---|---|
| `/library` | Default filter = my level, current semester, my offerings. Search box, facets (course, type, level, semester, session, tags). "Recently added" and "Bookmarked" sections. |
| `/library/[id]` | Metadata, PDF preview, download, bookmark, report, related resources |
| `/admin/library` | Queue (draft, in review, reported), upload wizard (metadata → audience → copyright attestation → file), edit, publish, archive, remove, version history |

## 5. Library-specific security risks

| Risk | Control |
|---|---|
| Accidental public exposure | Private bucket; no authenticated storage policies; CI check that `library` has `public=false`; advisor check |
| Signed URL forwarding | Short TTL (≤5 min); per-request minting; optional access log; watermark PDFs (future, external tool) |
| Malicious files (PDF JavaScript, Office macros, polyglots) | MIME allow-list plus magic bytes; no macro formats; `Content-Disposition: attachment` for downloads; preview only PDFs; scanning (external) |
| Stored XSS via SVG/HTML | Not allowed in the bucket allow-list |
| Path traversal / overwrite | Server-generated paths; signed upload URL bound to a path; `upsert:false` |
| Copyright infringement | `copyright_basis` required; uploader attestation; report → takedown workflow with SLA; past questions only with departmental approval; audience-limited (never public) |
| Resource enumeration via search | Search through RLS-respecting queries or a SECURITY INVOKER function only. Never a definer function that bypasses `can_view`. |
| Storage cost and DoS | Size limits, staff-only uploads, per-user upload quotas, de-duplication by hash |
| Draft leakage | RLS: students see only `published` plus a matching audience; drafts only for scoped staff |
