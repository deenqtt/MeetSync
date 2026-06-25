import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["meetings", "home-assistant"] as const;
type DashboardType = (typeof VALID_TYPES)[number];

function isValidType(t: string | null): t is DashboardType {
  return VALID_TYPES.includes(t as DashboardType);
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");

  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid dashboard type" }, { status: 400 });
  }

  try {
    const dashboard = await prisma.dashboard.findUnique({ where: { type } });
    return NextResponse.json({
      success: true,
      layout: (dashboard?.layout as any[]) ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");

  if (!isValidType(type)) {
    return NextResponse.json({ error: "Invalid dashboard type" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const layout = Array.isArray(body.layout) ? body.layout : [];

    const dashboard = await prisma.dashboard.upsert({
      where: { type },
      update: { layout },
      create: { type, layout },
    });

    return NextResponse.json({ success: true, layout: dashboard.layout });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
