import { type NextRequest } from "next/server";
import { handleAuthCallback } from "@/app/auth/confirm/route";

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}

