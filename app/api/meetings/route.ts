// File: app/api/meetings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSmartRoomMeetings } from "@/lib/meeting-external";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
const CONTEXT = "MEETINGS_LIST";

/**
 * GET: Fetch all meetings (proxy to Smart Room)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "meetings", "read");
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const force = searchParams.get("force") === "true";

    const all = await fetchSmartRoomMeetings(force);
    let meetings = all;

    if (date) {
      meetings = meetings.filter((m) => m.date === date);
    } else {
      const now = new Date();
      const pastStr = new Date(now.getTime() - 14 * 86400_000).toISOString().slice(0, 10);
      const futureStr = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);
      meetings = meetings.filter((m) => m.date >= pastStr && m.date <= futureStr);
    }

    if (status) meetings = meetings.filter((m) => m.status === status);
    if (search) meetings = meetings.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()));

    meetings = meetings.sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
    );

    return successResponse(meetings, "Meetings retrieved successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Error fetching meetings", error);
    // Return empty array instead of error to prevent UI crash
    return successResponse([], "Failed to fetch meetings, returning empty list");
  }
}
