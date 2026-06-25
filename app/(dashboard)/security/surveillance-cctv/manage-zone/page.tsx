"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin } from "lucide-react";
import ManageZone from "@/components/manage-zone/ManageZone";

const AI_HOST = process.env.NEXT_PUBLIC_AI_SERVICE_HOST ?? "10.8.0.82";
const AI_PORT = process.env.NEXT_PUBLIC_AI_SERVICE_PORT ?? "8567";
const AI_BASE_URL = `http://${AI_HOST}:${AI_PORT}`;

function ManageZoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameraId = searchParams.get("cameraId") ?? undefined;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Topbar sederhana */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CCTV
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Manage Detection Zone</span>
        </div>
        {cameraId && (
          <span className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded ml-1">
            cam: {cameraId}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 min-h-0 overflow-auto">
        <ManageZone apiBase={AI_BASE_URL} cameraId={cameraId} />
      </div>
    </div>
  );
}

export default function ManageZonePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Loading…
        </div>
      }
    >
      <ManageZoneContent />
    </Suspense>
  );
}
