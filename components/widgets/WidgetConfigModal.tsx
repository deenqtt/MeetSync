"use client";

import { MeetilyTranscriptConfigModal } from "./MeetilyTranscript/MeetilyTranscriptConfigModal";
import { MeetilySummaryConfigModal } from "./MeetilySummary/MeetilySummaryConfigModal";
import { AiCctvStreamConfigModal } from "./AiCctvStream/AiCctvStreamConfigModal";
import { AiCctvSnapshotsConfigModal } from "./AiCctvSnapshots/AiCctvSnapshotsConfigModal";
import { AiCctvStatisticsConfigModal } from "./AiCctvStatistics/AiCctvStatisticsConfigModal";
import { TrashDetectionConfigModal } from "./TrashDetection/TrashDetectionConfigModal";
import { HomeAssistantControlConfigModal } from "./HomeAssistantControl/HomeAssistantControlConfigModal";
import { HomeAssistantStatusConfigModal } from "./HomeAssistantStatus/HomeAssistantStatusConfigModal";
import { HomeAssistantAssistConfigModal } from "./HomeAssistantAssist/HomeAssistantAssistConfigModal";

interface Props {
  widgetType: string;
  isOpen: boolean;
  onClose: () => void;
  initialConfig: Record<string, any>;
  onSave: (config: Record<string, any>) => void;
}

export function WidgetConfigModal({ widgetType, isOpen, onClose, initialConfig, onSave }: Props) {
  // Cast initialConfig to any — each widget's Props has a specific shaped interface
  // but we store config as Record<string, any> in the DB layout JSON.
  const shared = { isOpen, onClose, initialConfig: initialConfig as any, onSave: onSave as any };

  switch (widgetType) {
    case "MeetilyTranscript":
      return <MeetilyTranscriptConfigModal {...shared} />;
    case "MeetilySummary":
      return <MeetilySummaryConfigModal {...shared} />;
    case "AiCctvStream":
      return <AiCctvStreamConfigModal {...shared} />;
    case "AiCctvSnapshots":
      return <AiCctvSnapshotsConfigModal {...shared} />;
    case "AiCctvStatistics":
      return <AiCctvStatisticsConfigModal {...shared} />;
    case "TrashDetection":
      return <TrashDetectionConfigModal {...shared} />;
    case "HomeAssistantControl":
      return <HomeAssistantControlConfigModal {...shared} />;
    case "HomeAssistantStatus":
      return <HomeAssistantStatusConfigModal {...shared} />;
    case "HomeAssistantAssist":
      return <HomeAssistantAssistConfigModal {...shared} />;
    default:
      return null;
  }
}
