// File: app/api/meetings/today/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSmartRoomMeetings } from "@/lib/meeting-external";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
const CONTEXT = "MEETINGS_TODAY";

/**
 * GET: Fetch today's meetings
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "meetings", "read");
    if (auth instanceof NextResponse) return auth;

    const now = new Date();
    const local = new Date(
      now.toLocaleString("en-US", { timeZone: process.env.APP_TIMEZONE ?? "Asia/Jakarta" })
    );
    const todayStr = [
      local.getFullYear(),
      String(local.getMonth() + 1).padStart(2, "0"),
      String(local.getDate()).padStart(2, "0"),
    ].join("-");
    const currentTime = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;

    const all = await fetchSmartRoomMeetings();
    const meetings = all
      .filter((m) => m.date === todayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const nextMeeting =
      meetings.find((m) => m.status === "ONGOING") ??
      meetings.find((m) => m.status === "UPCOMING" && m.startTime > currentTime) ??
      null;

    return successResponse({
      total: meetings.length,
      meetings,
      nextMeeting
    }, "Today's meetings retrieved successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Error fetching today's meetings", error);
    return errorResponse("Failed to fetch today's meetings", error.message, 500);
  }
}
