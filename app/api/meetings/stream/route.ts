// File: app/api/meetings/stream/route.ts
import { NextRequest, NextResponse } from "next/server";
import { guardPermission } from "@/lib/auth";
import { meetingEvents, MeetingStatusEvent, MeetingDataUpdatedEvent } from "@/lib/meeting-events";

export const dynamic = "force-dynamic";

/**
 * GET: SSE endpoint for real-time meeting updates
 */
export async function GET(request: NextRequest) {
  const auth = await guardPermission(request, "meetings", "read");
  if (auth instanceof NextResponse) return auth;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      const onStatusChange = (event: MeetingStatusEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* Controller closed */ }
      };

      const onDataUpdated = (event: MeetingDataUpdatedEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* Controller closed */ }
      };

      meetingEvents.on("status-change", onStatusChange);
      meetingEvents.on("data-updated", onDataUpdated);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`));
        } catch { clearInterval(heartbeat); }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        meetingEvents.off("status-change", onStatusChange);
        meetingEvents.off("data-updated", onDataUpdated);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
