// Stand-in for the Supabase HTTP API, for visual and responsive checks only.
// It answers auth, PostgREST and storage calls with fixed sample data for three
// personas (verified student, pending student, admin), chosen by the bearer token.
// It enforces nothing: never point a real deployment at it.
//
// Usage: node scripts/ui-harness/mock-supabase.mjs [port]   (default 54321)
import http from "node:http";
import { IDS } from "./mock-supabase-ids.mjs";

const PORT = Number(process.argv[2] ?? 54321);
const LOG_MISSES = process.env.MOCK_LOG === "1";


const today = new Date();
const iso = (d) => d.toISOString();
const day = (offset) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (hours) => iso(new Date(today.getTime() - hours * 3600e3));
const ahead = (hours) => iso(new Date(today.getTime() + hours * 3600e3));
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const people = [
  { id: IDS.student, full_name: "Adaeze Okafor", matric_number: "190404001", verification_status: "verified" },
  { id: IDS.pending, full_name: "Ifeanyi Chukwuemeka-Balogun", matric_number: "190404077", verification_status: "pending" },
  { id: IDS.admin, full_name: "Tunde Bello", matric_number: null, verification_status: "verified" },
  { id: uuid(901), full_name: "Kemi Adeyemi", matric_number: "190404012", verification_status: "pending" },
  { id: uuid(902), full_name: "Chinedu Eze", matric_number: "190404019", verification_status: "rejected" },
  { id: uuid(903), full_name: "Fatima Abdullahi", matric_number: "190404023", verification_status: "verified" },
];
const profiles = people.map((p) => ({
  ...p,
  nickname: null,
  department: "Civil Engineering",
  department_id: uuid(1),
  level: "200",
  avatar_url: null,
  verification_reviewed_at: null,
  verification_reviewed_by: null,
  verification_rejection_reason: p.verification_status === "rejected" ? "The matric number does not match the department list." : null,
  verification_submitted_at: ago(30),
  created_at: ago(400),
  updated_at: ago(30),
  email: `${p.full_name.split(" ")[0].toLowerCase()}@example.test`,
}));

const courses = [
  ["CVE201", "Strength of Materials I", 3],
  ["CVE203", "Engineering Surveying I", 3],
  ["CVE205", "Fluid Mechanics I", 2],
  ["GET209", "Engineering Mathematics III", 3],
  ["CVE207", "Building Drawing and Construction Technology", 2],
].map(([course_code, course_title, credit_units], i) => ({
  id: uuid(100 + i),
  course_code,
  course_title,
  credit_units,
  level: "200",
  department: "Civil Engineering",
  is_archived: false,
  created_at: ago(900),
}));
const courseRef = (i) => ({ course_code: courses[i].course_code, course_title: courses[i].course_title, level: "200" });

const offerings = courses.map((c, i) => ({
  id: uuid(200 + i),
  course_id: c.id,
  level_code: "200",
  semester_id: uuid(11),
  is_core: i !== 4,
  status: "active",
  created_at: ago(500),
  courses: courseRef(i),
  semesters: { label: "First Semester" },
}));

const venues = ["Civil Eng. LT1", "Faculty Auditorium", "Hydraulics Lab", "Drawing Studio B", "ETF Hall 2"];
const lectures = [];
for (let d = -3; d <= 10; d++) {
  [0, 1, 2].forEach((slot) => {
    const ci = (d + 9 + slot) % 5;
    lectures.push({
      id: uuid(300 + lectures.length),
      course_id: courses[ci].id,
      offering_id: offerings[ci].id,
      series_id: null,
      lecture_date: day(d),
      start_time: ["08:00:00", "11:00:00", "14:00:00"][slot],
      end_time: ["10:00:00", "13:00:00", "16:00:00"][slot],
      venue: venues[ci],
      lecturer_name: ["Prof. A. Ogundipe", "Dr. M. Salami", "Engr. O. Nwosu"][slot],
      is_cancelled: d === 1 && slot === 1,
      cancelled_at: null,
      created_by: IDS.admin,
      updated_by: null,
      created_at: ago(200),
      updated_at: ago(200),
      courses: courseRef(ci),
    });
  });
}

const announcements = [
  ["Mid-semester test timetable released", "The CVE201 and CVE203 mid-semester tests hold next week Tuesday in the Faculty Auditorium. Come with your ID card and a non-programmable calculator. Seats are allocated by matric number."],
  ["Surveying field practical: equipment collection", "Groups A to D should collect levels and staffs from the survey store on Thursday between 9am and 12pm. Each group leader signs for the equipment."],
  ["Change of venue for GET209", "Friday's Engineering Mathematics III lecture moves to ETF Hall 2 because of maintenance work in LT1."],
  ["Departmental week registration", "Registration for departmental week activities closes on the 30th. Visit the CESA secretariat to register your team."],
].map(([title, content], i) => ({
  id: uuid(400 + i),
  title,
  content,
  scope: "level",
  course_id: null,
  created_by: IDS.admin,
  updated_by: null,
  is_published: i !== 3,
  published_at: ago(5 + i * 20),
  created_at: ago(6 + i * 20),
  updated_at: ago(5 + i * 20),
  announcement_audiences: [{ audience_kind: "level", level_code: "200", course_id: null, offering_id: null }],
}));

const quests = [
  ["Upload your CVE203 field book", "Photograph or scan your completed field book pages from the levelling practical and upload them as one PDF.", 80, ahead(72)],
  ["Summarise a lecture for your class", "Write a one-page summary of any CVE201 lecture this week and share it with your study group.", 50, ahead(150)],
  ["Attend the ASCE student chapter talk", "Attend the talk on sustainable concrete and submit a photo of your attendance slip.", 30, ahead(20)],
  ["Past question walkthrough", "Solve and explain question 3 from the 2023 Fluid Mechanics paper.", 120, ago(10)],
].map(([title, description, xp_reward, due_date], i) => ({
  id: uuid(500 + i),
  title,
  description,
  xp_reward,
  due_date,
  is_active: i !== 3,
  level_code: "200",
  offering_id: null,
  semester_id: null,
  created_by: IDS.admin,
  created_at: ago(100 - i),
  updated_at: ago(50),
  quest_audiences: [{ audience_kind: "level", level_code: "200", course_id: null, offering_id: null }],
}));
const questRef = (i) => ({ id: quests[i].id, title: quests[i].title, xp_reward: quests[i].xp_reward });

const submissions = [
  { i: 0, student: IDS.student, status: "pending", url: null, path: `${IDS.student}/${uuid(9001)}.pdf` },
  { i: 1, student: IDS.student, status: "approved", url: "https://drive.google.com/file/d/example-summary", path: null },
  { i: 2, student: uuid(903), status: "rejected", url: "https://photos.example.test/slip", path: null },
  { i: 0, student: uuid(903), status: "pending", url: "https://drive.google.com/file/d/very-long-shared-link-for-field-book-pages-scan", path: null },
].map((s, n) => ({
  id: uuid(600 + n),
  quest_id: quests[s.i].id,
  student_id: s.student,
  evidence_url: s.url,
  evidence_path: s.path,
  notes: n === 3 ? "Pages 4 to 9 cover the second traverse; the first traverse is on pages 1 to 3." : null,
  status: s.status,
  reviewed_by: s.status === "pending" ? null : IDS.admin,
  reviewed_at: s.status === "pending" ? null : ago(12),
  rejection_reason: s.status === "rejected" ? "The slip is not legible. Please upload a clearer photo." : null,
  created_at: ago(30 + n),
  updated_at: ago(12),
  quests: questRef(s.i),
}));

const leaderboard = [
  ["Fatima Abdullahi", 420, 6],
  ["Adaeze Okafor", 310, 4],
  ["Oluwaseun Adebayo-Williams", 150, 2],
  ["Kemi Adeyemi", 90, 1],
  ["Chinedu Eze", 50, 1],
].map(([full_name, total_xp, quests_completed], i) => ({
  user_id: full_name === "Adaeze Okafor" ? IDS.student : uuid(950 + i),
  full_name,
  avatar_url: null,
  total_xp,
  quests_completed,
  rank: i + 1,
}));

const notifications = [
  ["New announcement", "Mid-semester test timetable released", "announcement", "/announcements", false, 5],
  ["Lecture in 30 minutes", "CVE201 Strength of Materials I at Civil Eng. LT1", "lecture_reminder", "/timetable", false, 26],
  ["Account verified", "Your account has been verified. All features are now available.", "system", "/dashboard", true, 200],
].map(([title, message, notification_type, action_url, is_read, h], i) => ({
  id: uuid(700 + i),
  user_id: IDS.student,
  title,
  message,
  notification_type,
  source_type: notification_type === "lecture_reminder" ? "lecture" : notification_type,
  source_id: null,
  action_url,
  is_read,
  read_at: is_read ? ago(h - 1) : null,
  push_requested: true,
  push_status: "sent",
  created_at: ago(h),
}));

const study = [0, 1, 2, -1].map((d, i) => ({
  id: uuid(800 + i),
  user_id: IDS.student,
  course_id: courses[i].id,
  title: ["Revise beam deflection", "Levelling calculations", "Bernoulli problems", "Matrix exercises"][i],
  study_date: day(d),
  start_time: "18:00:00",
  end_time: "19:30:00",
  notes: null,
  location: "Hall library",
  reminder_preference: "30_min",
  completed: d < 0,
  completed_at: d < 0 ? ago(20) : null,
  recurrence_id: null,
  recurrence_pattern: null,
  recurrence_end_date: null,
  created_at: ago(100),
  updated_at: ago(100),
  courses: courseRef(i),
}));

const library = [
  ["Lecture 6 slides: shear force and bending moment", "slides", 0],
  ["Levelling practical handout", "notes", 1],
  ["2023 Fluid Mechanics past questions", "past_question", 2],
  ["Tutorial sheet 3: partial differentiation", "tutorial_sheet", 3],
].map(([title, resource_type, ci], i) => ({
  id: uuid(1000 + i),
  title,
  description: "Shared by the course representative for this week's classes.",
  resource_type,
  course_id: courses[ci].id,
  level_code: "200",
  tags: ["week 6"],
  status: "published",
  published_at: ago(10 + i * 30),
  created_at: ago(20 + i * 30),
  updated_at: ago(10),
  created_by: IDS.admin,
  current_file_id: uuid(1100 + i),
  copyright_basis: "own_work",
  courses: courseRef(ci),
  library_resource_audiences: [{ audience_kind: "level", level_code: "200", course_id: null, offering_id: null }],
}));

const placements = [
  { student_id: IDS.student, status: "claimed" },
  { student_id: uuid(903), status: "confirmed" },
  { student_id: IDS.pending, status: "claimed" },
].map((p, i) => ({
  id: uuid(1200 + i),
  session_id: uuid(10),
  level_code: "200",
  requested_at: ago(48 + i),
  decided_at: null,
  ...p,
  profiles: { full_name: people.find((x) => x.id === p.student_id)?.full_name ?? "Student", matric_number: "190404001" },
}));

const tables = {
  profiles,
  user_roles: [{ id: uuid(2), user_id: IDS.admin, role: "admin", assigned_by: IDS.admin, created_at: ago(900) }],
  courses,
  course_offerings: offerings,
  lecture_sessions: lectures,
  announcements,
  announcement_audiences: [],
  quests,
  quest_submissions: submissions,
  xp_ledger: [
    { id: uuid(1300), user_id: IDS.student, quest_id: quests[1].id, xp_amount: 50, reason: "Approved", created_at: ago(12) },
  ],
  notifications,
  notification_preferences: [{
    user_id: IDS.student, push_enabled: true, lecture_reminders_enabled: true, study_reminders_enabled: true,
    announcement_notifications_enabled: true, lecture_reminder_minutes: 30, quiet_hours_enabled: false,
    quiet_hours_start: "22:00:00", quiet_hours_end: "06:00:00", created_at: ago(100), updated_at: ago(100),
  }],
  push_subscriptions: [{ id: uuid(1400), device_label: "Chrome on Android", created_at: ago(90), last_used_at: ago(3) }],
  study_sessions: study,
  academic_sessions: [{ id: uuid(10), label: "2026/2027", starts_on: day(-80), ends_on: day(250), is_current: true, created_at: ago(2000) }],
  semesters: [{ id: uuid(11), session_id: uuid(10), label: "First Semester", ordinal: 1, starts_on: day(-80), ends_on: day(60), is_current: true, academic_sessions: { label: "2026/2027" } }],
  student_placements: placements,
  course_enrollments: [],
  staff_assignments: [{
    id: uuid(1500), user_id: uuid(903), capability: "level_coordinator", level_code: "200", status: "active",
    expires_at: day(250), reason: "Elected class representative for 2026/2027", created_at: ago(300),
    profiles: { full_name: "Fatima Abdullahi", matric_number: "190404023" },
  }],
  library_resources: library,
  library_bookmarks: [],
  library_files: library.map((r, i) => ({
    id: uuid(1100 + i), resource_id: r.id, version: 1, storage_path: `${r.id}/${uuid(1100 + i)}.pdf`, mime_type: "application/pdf", size_bytes: 2_400_000,
    original_filename: `${r.title.slice(0, 20)}.pdf`, scan_status: "not_scanned", created_at: r.created_at,
  })),
  library_reports: [],
  migration_review_items: [],
  admin_migration_review: [],
  profile_verification_history: [],
  tutorials: [],
  tutorial_playlists: [],
  tutorial_progress: [],
  tutorial_saves: [],
};

function persona(req) {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return Object.keys(IDS).find((k) => IDS[k] === payload.sub) ?? null;
  } catch {
    return null;
  }
}

const rpcs = {
  my_capabilities: (who) => (who === "admin" ? [{ capability: "department_admin", level_code: null, expires_at: null }] : []),
  my_access_context: (who) => [{ level_code: "200", placement_status: who === "admin" ? null : "claimed" }],
  get_leaderboard: () => leaderboard,
  get_lagos_date: () => day(0),
  search_library: () => library,
  search_tutorials: () => [],
  managed_quest_ids: () => quests.map((q) => q.id),
  managed_announcement_ids: () => announcements.map((a) => a.id),
  managed_library_resource_ids: () => library.map((l) => l.id),
  managed_tutorial_ids: () => [],
  can_manage_library_resource: () => true,
  can_manage_tutorial: () => true,
};

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"].includes(key)) continue;
    const m = /^(not\.)?(eq|neq|in|is|gte|lte|gt|lt|ilike|like)\.(.*)$/.exec(raw);
    if (!m) continue;
    const [, not, op, val] = m;
    const col = key.split("->")[0];
    out = out.filter((row) => {
      if (!(col in row)) return true; // unknown column: do not filter
      const v = row[col];
      let hit = true;
      if (op === "eq") hit = String(v) === val;
      else if (op === "neq") hit = String(v) !== val;
      else if (op === "in") hit = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, "")).includes(String(v));
      else if (op === "is") hit = val === "null" ? v === null : String(v) === val;
      else if (op === "gte") hit = String(v) >= val;
      else if (op === "lte") hit = String(v) <= val;
      else if (op === "gt") hit = String(v) > val;
      else if (op === "lt") hit = String(v) < val;
      return not ? !hit : hit;
    });
  }
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(",")[0].split(".");
    out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
  }
  const limit = Number(params.get("limit") ?? "0");
  if (limit > 0) out = out.slice(0, limit);
  return out;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") return send(res, 204);
  const who = persona(req);

  if (url.pathname === "/auth/v1/user") {
    if (!who) return send(res, 401, { code: 401, msg: "invalid token" });
    const p = profiles.find((x) => x.id === IDS[who]);
    return send(res, 200, {
      id: p.id, aud: "authenticated", role: "authenticated", email: p.email,
      app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { full_name: p.full_name },
      created_at: p.created_at, updated_at: p.updated_at,
    });
  }
  if (url.pathname.startsWith("/auth/v1/")) return send(res, 200, {});
  if (url.pathname.startsWith("/storage/v1/object/sign/")) {
    return send(res, 200, { signedURL: `/object/sign/${url.pathname.split("/sign/")[1]}?token=mock` });
  }
  if (url.pathname.startsWith("/storage/v1/object/upload/sign/")) {
    return send(res, 200, { url: `/object/upload/sign/${url.pathname.split("/sign/")[1]}?token=mock` });
  }
  if (url.pathname.startsWith("/storage/v1/")) {
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end("%PDF-1.4\n%mock\n");
  }

  const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
  if (rpc) {
    const fn = rpcs[rpc[1]];
    if (!fn && LOG_MISSES) console.log("rpc miss", rpc[1]);
    return send(res, 200, fn ? fn(who) : []);
  }

  const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
  if (table) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 201, []);
    const rows0 = tables[table[1]];
    if (!rows0 && LOG_MISSES) console.log("table miss", table[1]);
    let rows = applyFilters(rows0 ?? [], url.searchParams);
    if (table[1] === "notifications" || table[1] === "study_sessions" || table[1] === "notification_preferences") {
      rows = who === "student" ? rows : [];
    }
    if (table[1] === "quest_submissions" && who !== "admin") rows = rows.filter((r) => r.student_id === IDS[who]);
    if (table[1] === "student_placements" && who !== "admin") rows = rows.filter((r) => r.student_id === IDS[who]);
    const range = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
    if (req.method === "HEAD") return send(res, 200, undefined, { "content-range": range });
    if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
      if (rows.length === 0) return send(res, 406, { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" });
      return send(res, 200, rows[0], { "content-range": range });
    }
    return send(res, 200, rows, { "content-range": range });
  }

  if (LOG_MISSES) console.log("miss", req.method, url.pathname);
  return send(res, 404, { message: "not found" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock supabase on http://127.0.0.1:${PORT}`));
