import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cctv/:id/monitors
 * Fetch monitor data from Shinobi NVR API for a specific camera
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Monitors';
  const { id } = await params;
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

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

    // Fetch monitor data from Shinobi NVR API
    const monitorUrl = `http://${cctv.ipAddress}:${cctv.port}/${cctv.apiKey}/monitor/${cctv.group}`;

    logger.info(CONTEXT, `Fetching monitors from NVR: ${monitorUrl}`);

    const response = await fetch(monitorUrl, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`NVR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const monitors = Array.isArray(data) ? data : [];

    return successResponse({
      camera: {
        id: cctv.id,
        name: cctv.name,
        ipAddress: cctv.ipAddress,
        port: cctv.port,
        apiKey: cctv.apiKey,
        group: cctv.group,
      },
      monitors,
      total: monitors.length,
    }, 'Monitors retrieved successfully from NVR');

  } catch (error: any) {
    logger.error(CONTEXT, `Failed to fetch monitors for camera ${id}`, error.message);

    if (error.name === "TimeoutError") {
      return errorResponse("Request timeout - NVR may be unavailable", error.message, 504);
    }

    return errorResponse("Failed to fetch monitors from NVR", error.message, 500);
  }
}
