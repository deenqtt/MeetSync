import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AI_BASE = `http://${process.env.NEXT_PUBLIC_AI_SERVICE_HOST || "localhost"}:${process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567"}`;

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  // Proxy /api/ai-proxy/a/b/c → http://ai-service/a/b/c (strip prefix only)
  const targetUrl = new URL(`${AI_BASE}/${path.join("/")}`);
  req.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const isBodyMethod = !["GET", "HEAD"].includes(req.method);
  const body = isBodyMethod ? await req.arrayBuffer() : undefined;
  const contentType = req.headers.get("content-type");

  try {
    const res = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: contentType ? { "Content-Type": contentType } : {},
      body,
    });
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "AI service unreachable" }, { status: 503 });
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
export const PATCH = handler;
