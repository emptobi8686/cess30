import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseDeviceId } from "@/lib/notifications/device-id";

const requestSchema = z.object({
  currentEndpoint: z.string().url().max(2048).nullable(),
});

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid device request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device request." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = parseDeviceId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Device not found." }, { status: 404 });
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .select("id, endpoint")
    .maybeSingle();

  if (error) {
    console.error("Could not remove push device.", { code: error.code });
    return NextResponse.json({ error: "Could not remove this device." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Device not found." }, { status: 404 });

  const { count, error: countError } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authData.user.id);
  if (countError) {
    console.error("Could not count remaining push devices.", { code: countError.code });
    return NextResponse.json({ error: "Device removed, but push status could not be updated." }, { status: 500 });
  }

  if (count === 0) {
    const { error: preferenceError } = await admin
      .from("notification_preferences")
      .upsert({ user_id: authData.user.id, push_enabled: false }, { onConflict: "user_id" });
    if (preferenceError) {
      console.error("Could not disable push preferences.", { code: preferenceError.code });
      return NextResponse.json({ error: "Device removed, but push status could not be updated." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    removedCurrentDevice: data.endpoint === parsed.data.currentEndpoint,
  });
}
