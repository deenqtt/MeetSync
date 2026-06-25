// File: app/api/meetings/current/route.ts
import { NextRequest, NextResponse } from "next/server";
import { guardPermission } from "@/lib/auth";
import {
  getCachedSmartRoomMeetings,
  fetchSmartRoomMeetings,
} from "@/lib/meeting-external";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
const CONTEXT = "MEETINGS_CURRENT";

/**
 * GET: Fetch current ongoing meeting from cache
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "meetings", "read");
    if (auth instanceof NextResponse) return auth;

    let meetings = getCachedSmartRoomMeetings();
    if (!meetings) {
      meetings = await fetchSmartRoomMeetings();
    }

    const ongoing = meetings.find((m) => m.status === "ONGOING");
    if (!ongoing) return successResponse({ meeting: null }, "No ongoing meeting found");

    return successResponse({
      meeting: {
        meetingId: ongoing.id,
        title: ongoing.title,
        startTime: ongoing.startTime,
        endTime: ongoing.endTime,
      },
    }, "Current meeting retrieved successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Error fetching current meeting", error);
    return successResponse({ meeting: null }, "Failed to fetch current meeting, returning null");
  }
}
