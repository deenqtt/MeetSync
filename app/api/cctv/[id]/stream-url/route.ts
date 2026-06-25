import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cctv/:id/stream-url
 * Returns direct streaming URLs (HLS/MJPEG) for a specific monitor
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Stream-Url';
  let cameraId = 'unknown';
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    cameraId = id;
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
      return errorResponse("Camera not configured for streaming (API Key or Group missing)", null, 400);
    }

    // Fetch monitor data from Shinobi NVR API to verify monitor exists
    const monitorUrl = `http://${cctv.ipAddress}:${cctv.port}/${cctv.apiKey}/monitor/${cctv.group}`;

    logger.debug(CONTEXT, `Fetching monitor data from NVR: ${monitorUrl}`);

    const monitorResponse = await fetch(monitorUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!monitorResponse.ok) {
      throw new Error(`NVR API error: ${monitorResponse.status} ${monitorResponse.statusText}`);
    }

    const monitorData = await monitorResponse.json();
    const monitors = Array.isArray(monitorData) ? monitorData : [];
    const targetMonitor = monitors.find((m: any) => m.mid === monitorId);

    if (!targetMonitor) {
      return errorResponse("Monitor not found on NVR", null, 404);
    }

    if (!targetMonitor.streams || targetMonitor.streams.length === 0) {
      return errorResponse("No streams available for this monitor", null, 404);
    }

    // Generate stream URLs
    const streams = targetMonitor.streams.map((streamPath: string) => ({
      type: streamPath.includes(".m3u8") ? "hls" : "mjpeg",
      url: `http://${cctv.ipAddress}:${cctv.port}${streamPath}`,
      path: streamPath,
    }));

    return successResponse({
      camera: {
        id: cctv.id,
        name: cctv.name,
        ipAddress: cctv.ipAddress,
        port: cctv.port,
      },
      monitor: {
        mid: targetMonitor.mid,
        name: targetMonitor.name,
        status: targetMonitor.status,
        host: targetMonitor.host,
        port: targetMonitor.port,
        protocol: targetMonitor.protocol,
        width: targetMonitor.width,
        height: targetMonitor.height,
        fps: targetMonitor.fps,
        type: targetMonitor.type,
        mode: targetMonitor.mode,
        currentlyWatching: targetMonitor.currentlyWatching,
        streams: targetMonitor.streams,
      },
      streams,
      primaryStream: streams[0],
      streamCount: streams.length,
    }, 'Stream URLs retrieved successfully');

  } catch (error: any) {
    logger.error(CONTEXT, `Failed to get stream URL for camera ${cameraId}`, error.message);

    if (error.name === "TimeoutError") {
      return errorResponse("Request timeout - NVR may be unavailable", error.message, 504);
    }

    return errorResponse("Failed to get stream URL from NVR", error.message, 500);
  }
}
