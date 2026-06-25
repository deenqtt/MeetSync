import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { successResponse, errorResponse, validateRequest, logger } from "@/lib/api-utils";
import { cctvSchema } from "@/lib/validations";

/**
 * GET /api/cctv
 * List all CCTV camera configurations
 */
export async function GET(req: NextRequest) {
  const CONTEXT = 'CCTV-List';
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    const cctvConfigs = await prisma.cctv.findMany({
      orderBy: { createdAt: "asc" },
    });

    return successResponse(cctvConfigs, 'CCTV cameras retrieved successfully');
  } catch (error: any) {
    logger.error(CONTEXT, "Failed to fetch CCTV cameras", error.message);
    return errorResponse("Failed to fetch CCTV cameras", error.message, 500);
  }
}

/**
 * POST /api/cctv
 * Create a new CCTV camera configuration
 */
export async function POST(req: NextRequest) {
  const CONTEXT = 'CCTV-Create';
  try {
    const auth = await guardPermission(req, 'cctv', 'create');
    if (auth instanceof NextResponse) return auth;

    const json = await req.json();
    const validation = await validateRequest(cctvSchema, json);
    if (!validation.success) return validation.errorResponse;

    const data = validation.data;

    const newCctv = await prisma.cctv.create({
      data: {
        ...data,
        password: data.password ? encrypt(data.password) : null,
      },
    });

    logger.info(CONTEXT, `CCTV camera created: ${data.name} (IP: ${data.ipAddress})`);
    return successResponse(newCctv, "CCTV camera created successfully", 201);
  } catch (error: any) {
    logger.error(CONTEXT, "Failed to create CCTV camera", error.message);
    return errorResponse("Failed to create CCTV camera", error.message, 500);
  }
}
