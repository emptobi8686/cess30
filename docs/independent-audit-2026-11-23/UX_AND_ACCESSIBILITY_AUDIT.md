# BLUEPRINT — UX and Accessibility Audit

**Audit date:** 2026-11-23 · **Method:** static review of components. **No browser rendering was performed**, so visual, contrast and mobile-layout judgements are marked UNVERIFIED where they depend on rendering.

## 1. Dead, misleading or broken controls

| ID | Control | Location | Problem | Fix |
|---|---|---|---|---|
| BP-010 | Account menu → "Sign out", "Profile & settings" | `dashboard-shell.tsx:152-197`, `admin-shell.tsx:151-176` | The menu label throws outside a Group. `onSelect` never fires. There is **no other logout control.** | See the Security doc |
| BP-027 | Leaderboard period buttons | `leaderboard/page.tsx:83-105` | Rendered as buttons with no action. They are highlighted when the user has a rank, which looks like a "selected" state. | Use links with `?period=` and render the chosen period |
| BP-051 | Quest dialog "Cancel" | `quests/page.tsx:211-213` | `type="button"` with no handler; it does not close the dialog | Use `DialogClose` |
| — | Upload progress bar | `profile-settings-client.tsx:160-170` | **Fake progress** (`setInterval` +10%). The real result is discarded, so a failed upload looks successful. | Use the real result and show the error |
| — | "Remove picture" | `profile-settings-client.tsx:71-73,175-186` | `void deleteProfilePicture()`. The result is ignored, the UI is not refreshed, and the Google avatar can never be removed. | Await, show the result, refresh the router |
| BP-011 | "Enable push on this device" | `push-device-settings.tsx:114` | Reports success, but the SW cannot display notifications | Restore SW handlers |
| — | Verification banner "Update your matriculation number … and submit it again" | `verification-banner.tsx:351-353` | Impossible action (BP-007) | Align copy with a real workflow |
| BP-024 | Admin approve/reject, quest create/edit/review, student quest submit | various | No success, error or pending feedback | `useActionState` with an inline status |
| BP-042 | Approve/Reject on already-reviewed rows | `admin/verifications/page.tsx:155+` | Shown for every status; the RPC rejects them silently | Show actions only for `pending` |
| — | "Admin"/"Student portal" identity | `admin/quests/page.tsx:101`, `admin/verifications/page.tsx:38` | `displayName={undefined}` | Pass the profile name |
| — | Sidebar "Pilot cohort: 200 Level, Civil Engineering" | `dashboard-shell.tsx:77-81` | Hard-coded and not the user's data | Bind to the profile, or label it as pilot info |

## 2. Feedback states

| Route | Loading | Empty | Error | Comment |
|---|---|---|---|---|
| `/dashboard` | ✅ | ✅ | ✅ | Good |
| `/study-planner` | ✅ | ✅ | ✅ | Toasts for actions (good) |
| `/notifications` | ✅ | ✅ | ✅ | – |
| `/settings*` | – | – | ✅ | – |
| `/timetable`, `/announcements` | ❌ | ✅ | ❌ | A thrown query renders the default Next error page |
| `/quests`, `/leaderboard` | ❌ | ✅ | ❌ | Both currently throw (BP-003/004/009) |
| `/admin/*` | ❌ | ✅ | ❌ (only `/admin/courses` inline) | `/admin` crashes without the service key (BP-025) |
| Root | – | – | ❌ | No `app/error.tsx`, `global-error.tsx` or `not-found.tsx` (BP-031) |

## 3. Accessibility

| ID | Issue | Location | WCAG | Fix |
|---|---|---|---|---|
| BP-036 | `<button>` nested in `<button>` (Base UI `Trigger` wrapping `Button`) | `dashboard-shell.tsx:154-155`, `admin-shell.tsx:153`, `quests/page.tsx:171-172` | 4.1.2; invalid HTML and React hydration warnings | `render={<Button/>}` |
| BP-036 | `<a>` wrapping `<button>` (`<Link><Button/></Link>`) | `admin/quests/page.tsx:110-115, 245-264`; `admin/verifications/page.tsx:47-52, 110-114`; `timetable/page.tsx:62-80` | 4.1.2, 2.1.1 (double tab stop) | `Button render={<Link/>}` (already used correctly in `settings/page.tsx:32`) |
| — | Form labels not associated with inputs (`<label>` without `htmlFor`, input not nested) | `admin/quests/page.tsx:152-166`; `quests/page.tsx:191-208` | 1.3.1, 4.1.2 | Use `Label htmlFor` and `id` |
| — | Approve/Reject require a "confirm" checkbox whose `required` error is the browser default | admin pages | 3.3.1 | Use explicit error text, or a confirm dialog |
| — | Status communicated by colour (submission badges, red "Expired") | quests pages | 1.4.1 | Text is also present; acceptable |
| — | Toasts have no `aria-live` region (to verify) | `study-planner-container.tsx` | 4.1.3 | Add `role="status"` |
| — | Emoji "📍" as a location icon is read aloud | `dashboard/page.tsx:287` | 1.1.1 | `aria-hidden` plus a text label |
| — | Leaderboard and Overview share the same icon (`LayoutGrid`) | `dashboard-shell.tsx:34,39` | cosmetic | Use a distinct icon |
| — | Colour contrast of `text-muted-foreground` on `bg-muted/20` and similar | many | 1.4.3 | **UNVERIFIED.** Run axe or Lighthouse. |
| — | Keyboard and focus in Base UI dialogs, menus and sheets | ui primitives | 2.4.3 | Expected good (library), **UNVERIFIED** |

## 4. Mobile and responsiveness

Static indicators are mostly positive: a mobile `Sheet` navigation, responsive grid classes (`grid-cols-1 lg:grid-cols-2`), tables wrapped in `overflow-x-auto`, and an iOS standalone check before push. Concerns:

- The admin quest edit form is inline beside each row (`w-40`, `w-24` inputs) and will squeeze on narrow screens.
- Admin tables with stacked forms per row (verifications, quests) are hard to use on phones.
- The notifications page is not in the sidebar navigation (only via the bell icon).
- **Mobile rendering is UNVERIFIED.** No browser test was run.

## 5. Information and content issues

- Dates in quests and admin pages use `toLocaleDateString()` without `timeZone: "Africa/Lagos"`, so they render in the server's locale and timezone (6 occurrences; BP-037). The `datetime-local` due date is sent without an offset and stored as UTC, so a deadline of "17:00" becomes 18:00 Lagos time.
- `/access-denied` text ("Configure Supabase credentials…") is developer-facing and shown to students.
- The rejection reason is never shown on the dashboard banner.
- Push payloads are always "BLUEPRINT Reminder – You have an upcoming academic activity", even for announcements.

## 6. Recommended corrections (no redesign)

1. Fix the menus and add a visible "Sign out" in the settings page.
2. Adopt one action-feedback pattern (`useActionState` + inline `Alert`) across admin and quest forms.
3. Add `error.tsx` at the root and for `/admin`, `/quests`, `/leaderboard`, `/timetable` and `/announcements`, plus `not-found.tsx`.
4. Replace nested interactive elements using `render` props.
5. Use the Lagos-aware `formatDisplayDate` and `formatTimestamp` from `lib/dates.ts` everywhere.
6. Run an axe and Lighthouse pass on mobile viewports before the pilot.
