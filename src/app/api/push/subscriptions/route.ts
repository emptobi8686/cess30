import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSafePushEndpoint } from "@/lib/notifications/validation";
import { studentAccessLevel } from "@/lib/auth/access";
import { getAccessContext } from "@/lib/auth/access-server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(32).max(256),
    auth: z.string().min(16).max(128),
  }),
});

const requestSchema = z.object({
  subscription: subscriptionSchema,
  deviceLabel: z.string().trim().min(1).max(80).default("This device"),
});
const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, device_label, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not list push devices.", { code: error.code });
    return NextResponse.json({ error: "Could not load registered devices." }, { status: 500 });
  }

  return NextResponse.json({ devices: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const access = await getAccessContext();
  if (!access || studentAccessLevel(access) === "none") {
    return NextResponse.json(
      { error: "Your account cannot register notification devices." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid subscription request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The browser subscription was invalid." }, { status: 400 });
  }
  if (!isSafePushEndpoint(parsed.data.subscription.endpoint)) {
    return NextResponse.json({ error: "The browser subscription was invalid." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const subscription = parsed.data.subscription;
  const { data: existing, error: existingError } = await admin
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();

  if (existingError) {
    console.error("Could not check push subscription.", { code: existingError.code });
    return NextResponse.json({ error: "Could not register this device." }, { status: 500 });
  }
  // A browser endpoint belongs to whoever is signed in on that device now: when a shared
  // device changes hands, move the subscription instead of blocking it (BP-047).
  if (existing && existing.user_id !== user.id) {
    const { error: releaseError } = await admin.from("push_subscriptions").delete().eq("id", existing.id);
    if (releaseError) {
      console.error("Could not release push subscription.", { code: releaseError.code });
      return NextResponse.json({ error: "Could not register this device." }, { status: 500 });
    }
  }
  const owned = existing && existing.user_id === user.id ? existing : null;

  if (!owned) {
    const { count, error: countError } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countError) {
      console.error("Could not count push devices.", { code: countError.code });
      return NextResponse.json({ error: "Could not register this device." }, { status: 500 });
    }
    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "Remove a registered device before adding another one." },
        { status: 409 }
      );
    }
  }

  const subscriptionRow = {
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    device_label: parsed.data.deviceLabel,
    last_used_at: new Date().toISOString(),
  };
  const { error: saveError } = owned
    ? await admin
        .from("push_subscriptions")
        .update(subscriptionRow)
        .eq("id", owned.id)
        .eq("user_id", user.id)
    : await admin.from("push_subscriptions").insert(subscriptionRow);

  if (saveError) {
    console.error("Could not save push subscription.", { code: saveError.code });
    return NextResponse.json({ error: "Could not register this device." }, { status: 500 });
  }

  const { error: preferenceError } = await admin
    .from("notification_preferences")
    .upsert({ user_id: user.id, push_enabled: true }, { onConflict: "user_id" });
  if (preferenceError) {
    console.error("Could not enable push preferences.", { code: preferenceError.code });
    return NextResponse.json(
      { error: "The device was saved, but push notifications could not be enabled." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid device request." }, { status: 400 });
  }
  const parsed = endpointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device request." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existing, error: existingError } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", parsed.data.endpoint)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) {
    console.error("Could not find current push device.", { code: existingError.code });
    return NextResponse.json({ error: "Could not remove this device." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Device not found." }, { status: 404 });

  const { error: deleteError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", existing.id)
    .eq("user_id", user.id);
  if (deleteError) {
    console.error("Could not remove current push device.", { code: deleteError.code });
    return NextResponse.json({ error: "Could not remove this device." }, { status: 500 });
  }

  const { count, error: countError } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) {
    console.error("Could not count remaining push devices.", { code: countError.code });
    return NextResponse.json({ error: "Device removed, but push status could not be updated." }, { status: 500 });
  }
  if (count === 0) {
    const { error: preferenceError } = await admin
      .from("notification_preferences")
      .upsert({ user_id: user.id, push_enabled: false }, { onConflict: "user_id" });
    if (preferenceError) {
      console.error("Could not disable push preferences.", { code: preferenceError.code });
      return NextResponse.json({ error: "Device removed, but push status could not be updated." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
