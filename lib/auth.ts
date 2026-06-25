// Minimal single-login auth for the standalone internal app.
//
// No RBAC, no per-menu permissions. A single signed session cookie (HS256 via
// jose) gates everything. `guardPermission(req, resource, action)` keeps the
// exact signature the ported API routes call, but ignores resource/action —
// any valid session passes. Middleware also gates routes at the edge; this is
// the in-route belt-and-suspenders check.

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[auth] AUTH_SECRET is not set. Refusing to start.");
    }
    // Dev fallback — stable within a process run so cookies survive HMR.
    return new TextEncoder().encode("dev-insecure-auth-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session JWT for a logged-in user. */
export async function signSession(payload: AuthPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Verify a session token string. Returns the payload or null. */
export async function verifySession(token: string | undefined | null): Promise<AuthPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      username: (payload.username as string) ?? "",
      role: (payload.role as string) ?? "user",
    };
  } catch {
    return null;
  }
}

/** Read + verify the session from a request's cookies. */
export async function getAuthFromRequest(
  request: Request | NextRequest,
): Promise<AuthPayload | null> {
  let token: string | undefined;
  const anyReq = request as NextRequest;
  if (anyReq.cookies?.get) {
    token = anyReq.cookies.get(SESSION_COOKIE)?.value;
  } else {
    // Plain Request: parse Cookie header manually.
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    token = match?.split("=").slice(1).join("=");
  }
  return verifySession(token);
}

export const SESSION_TTL = SESSION_TTL_SECONDS;

/**
 * Drop-in replacement for the NexaBrick guardPermission. resource/action are
 * accepted for signature compatibility but not enforced (no RBAC here).
 *
 *   const auth = await guardPermission(req, 'cctv', 'read');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function guardPermission(
  request: Request | NextRequest,
  _resource: string,
  _action: string,
): Promise<AuthPayload | NextResponse> {
  const auth = await getAuthFromRequest(request);
  if (!auth?.userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return auth;
}
