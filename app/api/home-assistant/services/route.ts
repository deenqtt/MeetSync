import { NextRequest, NextResponse } from "next/server";
import { callHAService, HaUnreachableError, shouldEmitHaWarning } from "@/lib/home-assistant";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger, validateRequest } from "@/lib/api-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CONTEXT = "HA_SERVICES";

const serviceCallSchema = z.object({
  domain: z.string().min(1),
  service: z.string().min(1),
  entity_id: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "home-assistant", "write");
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const result = await validateRequest(serviceCallSchema, body);
    
    if (!result.success) {
      return result.errorResponse;
    }

    const { domain, service, entity_id, data } = result.data;

    logger.info(CONTEXT, `Calling HA service ${domain}.${service} for user ${auth.userId}`, { entity_id });

    const payload = entity_id ? { entity_id, ...data } : data;
    const haResult = await callHAService(domain, service, payload);

    return successResponse(haResult, "HA service called successfully");

  } catch (error: any) {
    if (error instanceof HaUnreachableError) {
      if (shouldEmitHaWarning()) {
        logger.warn(CONTEXT, `Home Assistant unreachable: ${error.message}`);
      }
      return errorResponse("Home Assistant is unreachable", error.code, 503);
    }
    logger.error(CONTEXT, "Failed to call HA service", error);
    return errorResponse("Failed to call Home Assistant service", error.message, 502);
  }
}
