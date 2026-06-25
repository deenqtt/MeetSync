import { NextRequest, NextResponse } from "next/server";
import { getHAStates, HaUnreachableError, shouldEmitHaWarning, type HAState } from "@/lib/home-assistant";
import { guardPermission } from "@/lib/auth";
import { successResponse, errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const CONTEXT = "HA_DEVICES";

export type HADevice = {
  device_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  model_id: string | null;
  entities: HAState[];
};

const MULTI_SUFFIXES = [
  "_left", "_right",
  "_1", "_2", "_3", "_4", "_5", "_6",
  "_l", "_r",
  "_gang_1", "_gang_2", "_gang_3", "_gang_4",
  "_channel_1", "_channel_2",
  "_switch_1", "_switch_2",
];

const EXCLUDED_DOMAINS = new Set([
  "update", "person", "zone", "device_tracker",
  "conversation", "stt", "tts", "wake_word",
  "event", "image",
]);

function getGroupKey(entityId: string): string {
  const [domain, ...rest] = entityId.split(".");
  const name = rest.join(".");
  for (const suffix of MULTI_SUFFIXES) {
    if (name.endsWith(suffix)) {
      return `${domain}.${name.slice(0, -suffix.length)}`;
    }
  }
  return entityId;
}

function deriveDeviceName(entities: HAState[]): string {
  if (entities.length === 1) {
    return entities[0].attributes?.friendly_name || entities[0].entity_id;
  }

  const names = entities
    .map((e) => e.attributes?.friendly_name as string | undefined)
    .filter(Boolean) as string[];

  if (names.length === 0) {
    const base = getGroupKey(entities[0].entity_id);
    return base.split(".")[1]?.replace(/_/g, " ") || base;
  }

  const words0 = names[0].split(" ");
  let commonLen = words0.length;

  for (const name of names.slice(1)) {
    const words = name.split(" ");
    let match = 0;
    for (let i = 0; i < Math.min(commonLen, words.length); i++) {
      if (words0[i].toLowerCase() === words[i].toLowerCase()) match++;
      else break;
    }
    commonLen = match;
  }

  if (commonLen > 0) {
    return words0.slice(0, commonLen).join(" ");
  }

  return names[0];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await guardPermission(request, "home-assistant", "read");
    if (auth instanceof NextResponse) return auth;

    logger.info(CONTEXT, `Fetching HA devices for user ${auth.userId}`);

    const states = await getHAStates();
    const grouped = new Map<string, HAState[]>();

    for (const state of states) {
      const domain = state.entity_id.split(".")[0];
      if (EXCLUDED_DOMAINS.has(domain)) continue;
      const key = getGroupKey(state.entity_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(state);
    }

    const devices: HADevice[] = [];

    for (const [key, entities] of grouped.entries()) {
      devices.push({
        device_id: key,
        name: deriveDeviceName(entities),
        manufacturer: null,
        model: null,
        model_id: null,
        entities,
      });
    }

    return successResponse(devices, "HA devices retrieved successfully");

  } catch (error: any) {
    // ALFI-FIX (2026-05-25): distinguish "external service is down" from
    // "code is broken". HA being offline is operationally normal (dev
    // laptop, HA reboot, etc.) — it should not flood the log with ERROR
    // stack traces every time the frontend polls.
    if (error instanceof HaUnreachableError) {
      if (shouldEmitHaWarning()) {
        logger.warn(CONTEXT, `Home Assistant unreachable: ${error.message}`);
      }
      return errorResponse("Home Assistant is unreachable", error.code, 503);
    }
    logger.error(CONTEXT, "Failed to fetch HA devices", error);
    return errorResponse("Failed to fetch Home Assistant devices", error.message, 502);
  }
}
