const AI_PORT = process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567";

/**
 * HTTP calls go through the Next.js proxy (/api/ai-proxy/...).
 * Avoids CORS and fixes the "localhost = user's machine" problem when
 * accessing the app from another device on the LAN.
 */
export function getAiServiceBaseUrl(): string {
  return "/api/ai-proxy";
}

/**
 * WebSocket must be a direct browser connection (can't proxy via HTTP route).
 * Uses window.location.hostname so it resolves to the correct server IP
 * regardless of how the user accesses the app.
 */
export function getAiServiceWsUrl(): string {
  if (typeof window === "undefined") return `ws://localhost:${AI_PORT}`;
  return `ws://${window.location.hostname}:${AI_PORT}`;
}

/** host:port for display/label purposes only */
export function getAiServiceHost(): string {
  if (typeof window === "undefined") return `localhost:${AI_PORT}`;
  return `${window.location.hostname}:${AI_PORT}`;
}
