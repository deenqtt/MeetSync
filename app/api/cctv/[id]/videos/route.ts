import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cctv/:id/videos
 * Fetch recorded video list from Shinobi NVR API for a specific monitor
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Videos';
  let id = "";
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    id = (await params).id;
    const { searchParams } = new URL(req.url);
    const monitorId = searchParams.get("monitorId");

    if (!monitorId) {
      return errorResponse("Monitor ID is required", null, 400);
    }

    // Get camera configuration
    const cctv = await prisma.cctv.findUnique({
      where: { id },
    });

    if (!cctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    if (!cctv.apiKey || !cctv.group) {
      return errorResponse("Camera not configured for NVR API access (API Key or Group missing)", null, 400);
    }

    // Fetch videos from Shinobi NVR API
    const videosUrl = `http://${cctv.ipAddress}:${cctv.port}/${cctv.apiKey}/videos/${cctv.group}/${monitorId}`;

    logger.debug(CONTEXT, `Fetching videos from NVR: ${videosUrl}`);

    const response = await fetch(videosUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`NVR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const videos = data.videos || [];

    return successResponse({
      camera: {
        id: cctv.id,
        name: cctv.name,
        ipAddress: cctv.ipAddress,
        port: cctv.port,
        apiKey: cctv.apiKey,
        group: cctv.group,
      },
      monitorId,
      videos,
      total: videos.length,
    }, 'Recorded videos retrieved successfully');

  } catch (error: any) {
    logger.error(CONTEXT, `Failed to fetch videos for camera ${id}`, error.message);

    if (error.name === "TimeoutError") {
      return errorResponse("Request timeout - NVR may be unavailable", error.message, 504);
    }

    return errorResponse("Failed to fetch videos from NVR", error.message, 500);
  }
}
