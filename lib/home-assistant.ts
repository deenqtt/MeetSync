const HA_URL = process.env.HA_URL || "http://10.8.0.182:8123";
const HA_TOKEN = process.env.HA_TOKEN || "";

// ALFI-FIX (2026-05-25): HA fetch hardening (same pattern as MQTT env-bus).
// Problem: when Home Assistant is unreachable, EVERY haFetch() call hung for
// ~10 s waiting for fetch's default timeout, threw raw `TypeError: fetch
// failed` with full stack + cause chain, and route handlers logged it as
// ERROR. With the frontend polling /api/home-assistant/devices every second,
// the dev log filled with multi-line error stacks at ERROR severity for a
// transient external-service outage. Now:
//   - Bounded timeout (HA_REQUEST_TIMEOUT_MS, default 3000ms) via AbortSignal
//   - Cool-off: after a failure, refuse subsequent requests for HA_COOLOFF_MS
//     so frontend polling does not generate a fresh attempt every tick
//   - HaUnreachableError thrown with clean one-line message; callers can
//     check `err instanceof HaUnreachableError` to log at warn level
const HA_REQUEST_TIMEOUT_MS = Number(process.env.HA_REQUEST_TIMEOUT_MS) || 3_000;
const HA_COOLOFF_MS = Number(process.env.HA_COOLOFF_MS) || 30_000;

export class HaUnreachableError extends Error {
  readonly code = "HA_UNREACHABLE";
  constructor(message: string) {
    super(message);
    this.name = "HaUnreachableError";
  }
}

const haState = {
  lastFailureAt: 0,
  consecutiveFailures: 0,
  lastErrorMessage: "",
  warnedThisWindow: false,
};

function nowMs() {
  return Date.now();
}

/** Returns true if we are inside the cool-off window after a recent failure. */
function inCoolOff(): boolean {
  if (haState.consecutiveFailures === 0) return false;
  return nowMs() - haState.lastFailureAt < HA_COOLOFF_MS;
}

function recordFailure(message: string) {
  haState.consecutiveFailures++;
  haState.lastFailureAt = nowMs();
  if (message !== haState.lastErrorMessage) {
    haState.lastErrorMessage = message;
    haState.warnedThisWindow = false;
  }
}

function recordSuccess() {
  if (haState.consecutiveFailures > 0) {
    haState.consecutiveFailures = 0;
    haState.lastErrorMessage = "";
    haState.warnedThisWindow = false;
  }
}

async function haFetch(path: string, options?: RequestInit) {
  // Fast-fail during cool-off — no network attempt, no timeout wait.
  if (inCoolOff()) {
    throw new HaUnreachableError(
      `Home Assistant unreachable (cool-off ${Math.ceil((HA_COOLOFF_MS - (nowMs() - haState.lastFailureAt)) / 1000)}s left): ${haState.lastErrorMessage}`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HA_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${HA_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: any) {
    // Map low-level fetch errors (DNS, ECONNREFUSED, timeout abort) to a
    // clean HaUnreachableError. Original cause is kept for debugging but
    // the .message is one short line — no stack/cause chain in default toString.
    const isAbort = err?.name === "AbortError";
    const isConnRefused = /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|fetch failed/i.test(
      String(err?.message || err?.cause?.message || err),
    );
    if (isAbort || isConnRefused) {
      const msg = isAbort
        ? `timeout after ${HA_REQUEST_TIMEOUT_MS}ms`
        : err?.cause?.code || err?.cause?.message || err?.message || String(err);
      recordFailure(msg);
      throw new HaUnreachableError(`Home Assistant unreachable (${HA_URL}): ${msg}`);
    }
    // Anything else is unexpected; rethrow as-is so the original signal surfaces.
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // HTTP-level errors (auth, 5xx from HA itself) are NOT cool-off triggers
    // — the broker is reachable, just unhappy. Surface as plain Error.
    throw new Error(`HA API ${res.status}: ${res.statusText}`);
  }

  recordSuccess();
  return res.json();
}

/** Has the cool-off been freshly warned for the current failure window?
 *  Callers use this to log a single warn line per window. */
export function shouldEmitHaWarning(): boolean {
  if (haState.warnedThisWindow) return false;
  haState.warnedThisWindow = true;
  return true;
}

/** Diagnostic — for /api/health-style probes. */
export function getHaConnectionState() {
  return {
    inCoolOff: inCoolOff(),
    consecutiveFailures: haState.consecutiveFailures,
    lastErrorMessage: haState.lastErrorMessage,
    coolOffMsRemaining: inCoolOff()
      ? HA_COOLOFF_MS - (nowMs() - haState.lastFailureAt)
      : 0,
  };
}

export type HAState = {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: { id: string };
};

export function getHAStates(): Promise<HAState[]> {
  return haFetch("/api/states");
}

export function getHAState(entityId: string): Promise<HAState> {
  return haFetch(`/api/states/${entityId}`);
}

export function callHAService(
  domain: string,
  service: string,
  data?: object
): Promise<HAState[]> {
  return haFetch(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}

export function checkHAConnection(): Promise<{ message: string }> {
  return haFetch("/api/");
}

export type HAEntityRegistryEntry = {
  entity_id: string;
  device_id: string | null;
  name: string | null;
  original_name: string | null;
  platform: string;
  disabled_by: string | null;
  hidden_by: string | null;
};

export type HADeviceRegistryEntry = {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  model_id: string | null;
};

export function getHAEntityRegistry(): Promise<HAEntityRegistryEntry[]> {
  return haFetch("/api/config/entity_registry/list");
}

export function getHADeviceRegistry(): Promise<HADeviceRegistryEntry[]> {
  return haFetch("/api/config/device_registry/list");
}
