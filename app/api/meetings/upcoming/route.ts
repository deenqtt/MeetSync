// File: app/api/meetings/upcoming/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSmartRoomMeetings } from "@/lib/meeting-external";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
const CONTEXT = "MEETINGS_UPCOMING";

/**
 * GET: Fetch upcoming meetings within a day range
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "meetings", "read");
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const days  = Math.min(parseInt(searchParams.get("days")  ?? "7"),  90);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

    const now = new Date();
    const local = new Date(
      now.toLocaleString("en-US", { timeZone: process.env.APP_TIMEZONE ?? "Asia/Jakarta" })
    );
    const todayStr = [
      local.getFullYear(),
      String(local.getMonth() + 1).padStart(2, "0"),
      String(local.getDate()).padStart(2, "0"),
    ].join("-");

    const until = new Date(local);
    until.setDate(until.getDate() + days);
    const untilStr = [
      until.getFullYear(),
      String(until.getMonth() + 1).padStart(2, "0"),
      String(until.getDate()).padStart(2, "0"),
    ].join("-");

    const all = await fetchSmartRoomMeetings();
    const meetings = all
      .filter((m) => m.date >= todayStr && m.date <= untilStr)
      .filter((m) => m.status === "UPCOMING" || m.status === "ONGOING")
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, limit);

    return successResponse(meetings, "Upcoming meetings retrieved successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Error fetching upcoming meetings", error);
    return errorResponse("Failed to fetch upcoming meetings", error.message, 500);
  }
}
