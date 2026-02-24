import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/app/api/auth/_utils/session-cookies";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookies(response);
  return response;
}
