"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin } from "lucide-react";
import ManageZone from "@/components/manage-zone/ManageZone";

const TOKEN = { navy: "#2D3250", teal: "#32AEAC", orange: "#FA9464" };

function ManageZoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameraId = searchParams.get("cameraId") ?? undefined;

  return (
    <div
      className="min-h-full bg-[#F7F7F5] dark:bg-background"
      style={{ fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif" }}
    >
      {/* Header */}
      <div className="px-6 pt-7 pb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1.5"
            style={{ color: TOKEN.orange }}
          >
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 mt-0.5" style={{ color: TOKEN.teal }} />
            <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">
              Manage Detection Zone
            </h1>
          </div>
          {cameraId && (
            <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 mt-1.5">
              Camera ID: {cameraId}
            </p>
          )}
        </div>

        <div className="mt-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="border-gray-200 bg-white dark:bg-card dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to CCTV
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="px-6">
        <div className="border-t border-gray-200 dark:border-border" />
      </div>

      {/* Content */}
      <div className="p-6">
        <ManageZone cameraId={cameraId} />
      </div>
    </div>
  );
}

export default function ManageZonePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Loading...
        </div>
      }
    >
      <ManageZoneContent />
    </Suspense>
  );
}
