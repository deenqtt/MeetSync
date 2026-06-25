import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAuthFromRequest(req);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { username: session.username, role: session.role } });
}
