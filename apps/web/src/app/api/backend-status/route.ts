import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<{ online: boolean }>> {
  const apiUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const res = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return NextResponse.json({ online: res.ok });
  } catch {
    return NextResponse.json({ online: false });
  } finally {
    clearTimeout(timeout);
  }
}
