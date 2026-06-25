import { NextRequest, NextResponse } from "next/server";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const CONTEXT = "HA_CONVERSATION";
const HA_URL = process.env.HA_URL || "http://10.8.0.182:8123";
const HA_TOKEN = process.env.HA_TOKEN || "";

export async function POST(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "home-assistant", "read");
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { text, language = "id", conversation_id } = body;

    if (!text?.trim()) {
      return errorResponse("Text is required", null, 400);
    }

    logger.info(CONTEXT, `Processing HA conversation for user ${auth.userId}: "${text.trim()}"`);

    const res = await fetch(`${HA_URL}/api/conversation/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        language,
        ...(conversation_id ? { conversation_id } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(CONTEXT, `HA API Error ${res.status}: ${errorText}`);
      return errorResponse(`Home Assistant API error: ${res.statusText}`, null, 502);
    }

    const data = await res.json();
    return successResponse(data, "Conversation processed successfully");

  } catch (error: any) {
    logger.error(CONTEXT, "Failed to process HA conversation", error);
    return errorResponse("Failed to process conversation", error.message, 500);
  }
}
