/**
 * AI Service URL helpers.
 *
 * Priority:
 *  1. NEXT_PUBLIC_AI_SERVICE_HOST env var  (set at build time — recommended for prod)
 *  2. "localhost"                           (safe fallback for both dev & prod co-located)
 *
 * NOTE: window.location.hostname is intentionally NOT used here because it breaks
 * when the web app and AI service run on different hosts, and it cannot be used
 * server-side (API routes, scheduler).
 *
 * For dev: set NEXT_PUBLIC_AI_SERVICE_HOST in .env (already set to 192.168.2.133)
 * For prod: set NEXT_PUBLIC_AI_SERVICE_HOST="localhost" if co-located, or the actual IP
 */

function getHost(): string {
    return process.env.NEXT_PUBLIC_AI_SERVICE_HOST || "localhost";
}

function getPort(): string {
    return process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567";
}

/** Returns base HTTP URL, e.g. http://192.168.2.133:8567 */
export function getAiServiceBaseUrl(): string {
    return `http://${getHost()}:${getPort()}`;
}

/** Returns base WebSocket URL, e.g. ws://192.168.2.133:8567 */
export function getAiServiceWsUrl(): string {
    return `ws://${getHost()}:${getPort()}`;
}

/** Returns host:port string (no protocol), e.g. 192.168.2.133:8567 */
export function getAiServiceHost(): string {
    return `${getHost()}:${getPort()}`;
}
