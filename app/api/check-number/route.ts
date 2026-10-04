import { NextResponse } from "next/server";
import { checkReportedNumber } from "@/lib/reportedNumbers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const result = checkReportedNumber(new URL(request.url).searchParams.get("phone") ?? "");
  if (result.status === "invalid") return NextResponse.json({ ...result, error: "Please enter a 10-digit US phone number." }, { status: 400 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
