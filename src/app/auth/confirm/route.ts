import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/safe-next";
import { formatOAuthError, type AuthMessageCode } from "@/lib/auth/messages";

const ALLOWED_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function toOtpType(value: string | null): EmailOtpType {
  return ALLOWED_OTP_TYPES.includes(value as EmailOtpType)
    ? (value as EmailOtpType)
    : "email";
}

function isRecoveryRequest(type: string | null, next: string | null): boolean {
  return type === "recovery" || (next ?? "").includes("/reset-password");
}

function redirectWithError(request: NextRequest, path: string, code: AuthMessageCode) {
  return NextResponse.redirect(
    new URL(`${path}?error=${code}`, request.url)
  );
}

export async function handleAuthCallback(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next");
  const providerErrorCode = searchParams.get("error");
  const providerErrorDesc = searchParams.get("error_description");

  const recovery = isRecoveryRequest(type, rawNext);
  const fallback = recovery ? "/reset-password/update" : "/dashboard";
  const next = safeNextPath(rawNext, fallback);
  const failurePath = recovery ? "/reset-password" : "/login";

  if (providerErrorCode || providerErrorDesc) {
    return redirectWithError(request, failurePath, formatOAuthError(providerErrorCode, providerErrorDesc));
  }

  if (!token_hash && !code) {
    return redirectWithError(request, failurePath, "signin_failed");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return redirectWithError(request, failurePath, "not_configured");
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      name: COOKIE_NAME,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let errorMessage: string | null = null;

  if (code) {
    // PKCE flow: Supabase appends ?code=... to the redirect URL.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      errorMessage = error.message;
    }
  } else if (token_hash) {
    // Token-hash flow used by custom email templates.
    const { error } = await supabase.auth.verifyOtp({
      type: toOtpType(type),
      token_hash,
    });
    if (error) {
      errorMessage = error.message;
    }
  }

  if (errorMessage) {
    // Map common messages to user-friendly text
    if (errorMessage.toLowerCase().includes("expired")) {
      if (recovery) {
        return redirectWithError(request, failurePath, "recovery_expired");
      }
      if (type === "signup" || type === "email") {
        return redirectWithError(request, failurePath, "verification_expired");
      }
      return redirectWithError(request, failurePath, "signin_failed");
    }
    return redirectWithError(request, failurePath, "signin_failed");
  }

  return response;
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
