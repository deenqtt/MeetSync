import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE, SESSION_TTL, type AuthPayload } from "@/lib/auth";
import { loggers } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 },
      );
    }

    let payload: AuthPayload | null = null;

    // 1) Verify against the User table (bcrypt) when a matching user exists.
    try {
      const user = await prisma.user.findUnique({ where: { username } });
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        payload = { userId: user.id, username: user.username, role: "user" };
      }
    } catch (dbErr) {
      // DB unreachable / not migrated yet — fall through to env credentials.
      loggers.user.warn(`login DB check skipped: ${(dbErr as Error).message}`);
    }

    // 2) Fallback: plaintext env credentials (works before the DB is seeded).
    if (
      !payload &&
      process.env.APP_LOGIN_USER &&
      process.env.APP_LOGIN_PASSWORD &&
      username === process.env.APP_LOGIN_USER &&
      password === process.env.APP_LOGIN_PASSWORD
    ) {
      payload = { userId: "env-login", username, role: "user" };
    }

    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 },
      );
    }

    const token = await signSession(payload);
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL,
    });
    loggers.user.info(`login success: ${payload.username}`);
    return res;
  } catch (error) {
    loggers.user.error(`login error: ${(error as Error).message}`);
    return NextResponse.json(
      { success: false, message: "Login failed" },
      { status: 500 },
    );
  }
}
