import {
  Tv2,
  FileText,
  Camera,
  Image,
  BarChart2,
  Trash2,
  Home,
  Activity,
  MessageSquare,
} from "lucide-react";

export interface DashboardWidgetItem {
  id: string;
  widgetType: string;
  // react-grid-layout position (12-col grid, rowHeight=80)
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, any>;
}

export interface WidgetMeta {
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultW: number; // grid cols (out of 12)
  defaultH: number; // grid rows (×80px = height)
  defaultConfig: Record<string, any>;
}

export type DashboardType = "meetings" | "home-assistant";

export const WIDGET_REGISTRY: Record<DashboardType, WidgetMeta[]> = {
  meetings: [
    {
      type: "MeetilyTranscript",
      label: "Live Transcript",
      description: "Real-time meeting transcript via SSE stream",
      icon: FileText,
      defaultW: 6,
      defaultH: 4,
      defaultConfig: { widgetTitle: "Meeting Transcript" },
    },
    {
      type: "MeetilySummary",
      label: "Meeting Summary",
      description: "AI-generated meeting summary with export options",
      icon: Tv2,
      defaultW: 4,
      defaultH: 4,
      defaultConfig: {
        widgetTitle: "Meeting Summary",
        sendWhatsapp: false,
        sendEmail: false,
        sendTelegram: false,
      },
    },
    {
      type: "AiCctvStream",
      label: "CCTV Stream",
      description: "Live video stream from RTSP/AI camera",
      icon: Camera,
      defaultW: 6,
      defaultH: 5,
      defaultConfig: {
        widgetTitle: "AI CCTV Stream",
        streamType: "ai",
        streamUrl: "",
        cameraId: "",
      },
    },
    {
      type: "AiCctvSnapshots",
      label: "CCTV Snapshots",
      description: "Behavioral video clips grouped by person",
      icon: Image,
      defaultW: 6,
      defaultH: 4,
      defaultConfig: { widgetTitle: "CCTV Snapshots", clipMode: "all" },
    },
    {
      type: "AiCctvStatistics",
      label: "CCTV Statistics",
      description: "Attendance, identity detection and behavior stats",
      icon: BarChart2,
      defaultW: 4,
      defaultH: 4,
      defaultConfig: {
        widgetTitle: "CCTV Statistics",
        lateThresholdMinutes: 15,
      },
    },
    {
      type: "TrashDetection",
      label: "Trash Detection",
      description: "Live trash/cleanliness alert feed",
      icon: Trash2,
      defaultW: 4,
      defaultH: 4,
      defaultConfig: { widgetTitle: "Trash Detection", limit: 20 },
    },
  ],
  "home-assistant": [
    {
      type: "HomeAssistantControl",
      label: "Device Control",
      description: "Control a single Home Assistant device",
      icon: Home,
      defaultW: 4,
      defaultH: 4,
      defaultConfig: { title: "Device Control", deviceId: "", deviceName: "" },
    },
    {
      type: "HomeAssistantStatus",
      label: "Device Status",
      description: "Monitor multiple HA entities at a glance",
      icon: Activity,
      defaultW: 4,
      defaultH: 3,
      defaultConfig: { title: "Device Status", entityIds: [] },
    },
    {
      type: "HomeAssistantAssist",
      label: "HA Assistant",
      description: "Voice & text command interface for Home Assistant",
      icon: MessageSquare,
      defaultW: 6,
      defaultH: 4,
      defaultConfig: { title: "HA Assistant", language: "en", tts: false },
    },
  ],
};
