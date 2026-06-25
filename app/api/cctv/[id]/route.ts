import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { successResponse, errorResponse, validateRequest, logger } from "@/lib/api-utils";
import { cctvSchema } from "@/lib/validations";

/**
 * GET /api/cctv/:id
 * Get detail of a specific CCTV camera
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Detail';
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const cctv = await prisma.cctv.findUnique({
      where: { id },
    });

    if (!cctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    return successResponse(cctv, 'CCTV camera details retrieved successfully');
  } catch (error: any) {
    logger.error(CONTEXT, "Failed to fetch CCTV camera", error.message);
    return errorResponse("Failed to fetch CCTV camera", error.message, 500);
  }
}

/**
 * PUT /api/cctv/:id
 * Update an existing CCTV camera configuration
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Update';
  try {
    const auth = await guardPermission(req, 'cctv', 'update');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const json = await req.json();
    const validation = await validateRequest(cctvSchema.partial(), json);
    if (!validation.success) return validation.errorResponse;

    const data = validation.data;

    const existingCctv = await prisma.cctv.findUnique({
      where: { id },
    });

    if (!existingCctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    // Prepare update data
    const updateData: any = { ...data };

    // Only update password if provided
    if (data.password) {
      updateData.password = encrypt(data.password);
    }

    const updatedCctv = await prisma.cctv.update({
      where: { id },
      data: updateData,
    });

    logger.info(CONTEXT, `CCTV camera updated: ${id} (${updatedCctv.name})`);
    return successResponse(updatedCctv, "CCTV camera updated successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Failed to update CCTV camera", error.message);
    return errorResponse("Failed to update CCTV camera", error.message, 500);
  }
}

/**
 * DELETE /api/cctv/:id
 * Delete a CCTV camera configuration
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const CONTEXT = 'CCTV-Delete';
  try {
    const auth = await guardPermission(req, 'cctv', 'delete');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const existingCctv = await prisma.cctv.findUnique({
      where: { id },
    });

    if (!existingCctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    await prisma.cctv.delete({
      where: { id },
    });

    logger.info(CONTEXT, `CCTV camera deleted: ${id} (${existingCctv.name})`);
    return successResponse(null, "CCTV camera deleted successfully");
  } catch (error: any) {
    logger.error(CONTEXT, "Failed to delete CCTV camera", error.message);
    return errorResponse("Failed to delete CCTV camera", error.message, 500);
  }
}
