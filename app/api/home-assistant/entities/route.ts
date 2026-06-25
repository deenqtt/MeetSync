import { NextRequest, NextResponse } from "next/server";
import { getHAStates, getHAState, checkHAConnection, HaUnreachableError, shouldEmitHaWarning } from "@/lib/home-assistant";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const CONTEXT = "HA_ENTITIES";

export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "home-assistant", "read");
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entity_id");
    const ping = searchParams.get("ping");

    if (ping === "true") {
      logger.info(CONTEXT, `Checking HA connection for user ${auth.userId}`);
      const result = await checkHAConnection();
      return successResponse(result, "HA connection check completed");
    }

    if (entityId) {
      logger.info(CONTEXT, `Fetching HA entity ${entityId} for user ${auth.userId}`);
      const state = await getHAState(entityId);
      if (!state) return errorResponse("Entity not found", null, 404);
      return successResponse(state, "HA entity retrieved successfully");
    }

    logger.info(CONTEXT, `Fetching all HA entities for user ${auth.userId}`);
    const states = await getHAStates();
    return successResponse(states, "HA entities retrieved successfully");

  } catch (error: any) {
    if (error instanceof HaUnreachableError) {
      if (shouldEmitHaWarning()) {
        logger.warn(CONTEXT, `Home Assistant unreachable: ${error.message}`);
      }
      return errorResponse("Home Assistant is unreachable", error.code, 503);
    }
    logger.error(CONTEXT, "Failed to fetch HA entities", error);
    return errorResponse("Failed to fetch Home Assistant entities", error.message, 502);
  }
}
