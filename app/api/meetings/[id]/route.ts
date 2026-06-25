// File: app/api/meetings/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSmartRoomMeetingById } from "@/lib/meeting-external";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
const CONTEXT = "MEETING_DETAIL";

/**
 * GET: Fetch meeting detail by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await guardPermission(request, "meetings", "read");
    if (auth instanceof NextResponse) return auth;

    const meeting = await fetchSmartRoomMeetingById(id);

    if (!meeting) {
      return errorResponse("Meeting not found", null, 404);
    }

    return successResponse(meeting, "Meeting detail retrieved successfully");
  } catch (error: any) {
    logger.error(CONTEXT, `Error fetching meeting ${id}`, error);
    return errorResponse("Failed to fetch meeting", error.message, 500);
  }
}
