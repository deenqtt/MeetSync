"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import type { DashboardWidgetItem } from "@/lib/widget-registry";

// Each widget loaded only when actually rendered — not bundled upfront
const WIDGET_MAP: Record<
  string,
  React.ComponentType<{ config: any; isEditMode?: boolean }>
> = {
  MeetilyTranscript: dynamic(
    () => import("./MeetilyTranscript/MeetilyTranscriptWidget").then((m) => ({
      default: ({ config }: any) => <m.MeetilyTranscriptWidget config={config} />,
    })),
    { ssr: false }
  ),
  MeetilySummary: dynamic(
    () => import("./MeetilySummary/MeetilySummaryWidget").then((m) => ({
      default: ({ config }: any) => <m.MeetilySummaryWidget config={config} />,
    })),
    { ssr: false }
  ),
  AiCctvStream: dynamic(
    () => import("./AiCctvStream/AiCctvStreamWidget").then((m) => ({
      default: ({ config, isEditMode }: any) => (
        <m.AiCctvStreamWidget config={config} isEditMode={isEditMode} />
      ),
    })),
    { ssr: false }
  ),
  AiCctvSnapshots: dynamic(
    () => import("./AiCctvSnapshots/AiCctvSnapshotsWidget").then((m) => ({
      default: ({ config, isEditMode }: any) => (
        <m.AiCctvSnapshotsWidget config={config} isEditMode={isEditMode} />
      ),
    })),
    { ssr: false }
  ),
  AiCctvStatistics: dynamic(
    () => import("./AiCctvStatistics/AiCctvStatisticsWidget").then((m) => ({
      default: ({ config, isEditMode }: any) => (
        <m.AiCctvStatisticsWidget config={config} isEditMode={isEditMode} />
      ),
    })),
    { ssr: false }
  ),
  TrashDetection: dynamic(
    () => import("./TrashDetection/TrashDetectionWidget").then((m) => ({
      default: ({ config, isEditMode }: any) => (
        <m.TrashDetectionWidget config={config} isEditMode={isEditMode} />
      ),
    })),
    { ssr: false }
  ),
  HomeAssistantControl: dynamic(
    () => import("./HomeAssistantControl/HomeAssistantControlWidget").then((m) => ({
      default: ({ config, isEditMode }: any) => (
        <m.HomeAssistantControlWidget config={config} isEditMode={isEditMode} />
      ),
    })),
    { ssr: false }
  ),
  HomeAssistantStatus: dynamic(
    () => import("./HomeAssistantStatus/HomeAssistantStatusWidget").then((m) => ({
      default: ({ config }: any) => <m.HomeAssistantStatusWidget config={config} />,
    })),
    { ssr: false }
  ),
  HomeAssistantAssist: dynamic(
    () => import("./HomeAssistantAssist/HomeAssistantAssistWidget").then((m) => ({
      default: ({ config }: any) => <m.HomeAssistantAssistWidget config={config} />,
    })),
    { ssr: false }
  ),
};

function WidgetSkeleton() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-6 h-6 rounded-full border-2 border-[#32AEAC]/30 border-t-[#32AEAC] animate-spin" />
    </div>
  );
}

interface Props {
  item: DashboardWidgetItem;
  isEditMode?: boolean;
}

export function WidgetRenderer({ item, isEditMode = false }: Props) {
  const Component = WIDGET_MAP[item.widgetType];

  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground bg-secondary rounded-2xl">
        Unknown widget: {item.widgetType}
      </div>
    );
  }

  return (
    <Suspense fallback={<WidgetSkeleton />}>
      <Component config={item.config} isEditMode={isEditMode} />
    </Suspense>
  );
}
