"use client";

import React, {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
} from "react";
import { getAiServiceBaseUrl, getAiServiceWsUrl } from "@/lib/utils/ai-service";
import {
  VideoOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Zap,
  Camera,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  config: {
    widgetTitle: string;
    streamType?: "manual" | "ai";
    streamUrl: string;
    cameraId?: string;
  };
  isEditMode?: boolean;
}

interface TrashObject {
  label: string;
  confidence: number;
  bbox_norm: number[];
}

interface StreamFrame {
  event: string;
  camera_id: string;
  frame: string;
  ai_mode: boolean;
  camera_name?: string;
  status?: string;
  trash_active?: boolean;
  trash_objects?: TrashObject[];
}

type StreamState = "idle" | "connecting" | "live" | "offline" | "error";

export const AiCctvStreamWidget = ({ config, isEditMode = false }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiActive, setAiActive] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [isTrashToggling, setIsTrashToggling] = useState(false);

  // Refs — performance optimization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamStateRef = useRef<StreamState>("idle");
  const aiActiveRef = useRef(false);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for trash objects to draw them on canvas
  const trashObjectsRef = useRef<TrashObject[]>([]);

  const [dynamicSizes, setDynamicSizes] = useState({
    titleFontSize: 14,
    headerPadding: 12,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateLayout = () => {
      const { width } = container.getBoundingClientRect();
      setDynamicSizes({
        titleFontSize: Math.max(12, Math.min(width * 0.04, 16)),
        headerPadding: Math.max(8, Math.min(width * 0.025, 16)),
      });
    };
    const ro = new ResizeObserver(updateLayout);
    ro.observe(container);
    updateLayout();
    return () => ro.disconnect();
  }, []);

  const isAiType = config.streamType === "ai";

  const setStreamStateSafe = useCallback((s: StreamState) => {
    if (streamStateRef.current === s) return;
    streamStateRef.current = s;
    setStreamState(s);
  }, []);

  const setAiActiveSafe = useCallback((v: boolean) => {
    if (aiActiveRef.current === v) return;
    aiActiveRef.current = v;
    setAiActive(v);
  }, []);

  useEffect(() => {
    if (!isAiType || isEditMode) return;

    destroyedRef.current = false;

    const fetchStatus = async () => {
      try {
        const baseUrl = getAiServiceBaseUrl();
        const res = await fetch(`${baseUrl}/api/stream/status`);
        if (res.ok) {
          const data = await res.json();
          const camStatus = data.cameras?.[config.cameraId || ""];
          if (camStatus) {
            setAiActiveSafe(camStatus.ai_mode);
            setTrashActive(camStatus.trash_active || false);
            if (camStatus.is_streaming) setStreamStateSafe("connecting");
          }
        }
      } catch {
        // ignore
      }
    };
    fetchStatus();

    statusPollRef.current = setInterval(async () => {
      if (streamStateRef.current !== "live") return;
      try {
        const baseUrl = getAiServiceBaseUrl();
        const res = await fetch(`${baseUrl}/api/stream/status`);
        if (res.ok) {
          const data = await res.json();
          const camStatus = data.cameras?.[config.cameraId || ""];
          if (camStatus && !camStatus.is_streaming) {
            setStreamStateSafe("idle");
            setAiActiveSafe(false);
          }
        }
      } catch {
        // ignore
      }
    }, 15000);

    const connect = () => {
      if (destroyedRef.current) return;

      const wsUrl = `${getAiServiceWsUrl()}/ws/stream`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setError(null);

      ws.onmessage = (event) => {
        try {
          const data: StreamFrame = JSON.parse(event.data);
          if (data.camera_id !== config.cameraId) return;

          if (data.event === "frame") {
            trashObjectsRef.current = data.trash_objects || [];
            if (data.trash_active !== undefined) setTrashActive(data.trash_active);

            const bmp = new Image();
            bmp.onload = () => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              canvas.width = bmp.naturalWidth;
              canvas.height = bmp.naturalHeight;
              ctx.drawImage(bmp, 0, 0);

              // Draw trash detection boxes
              if (trashObjectsRef.current.length > 0) {
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = 3;
                ctx.fillStyle = "#ef4444";
                ctx.font = "bold 16px sans-serif";

                for (const obj of trashObjectsRef.current) {
                  const [y1, x1, y2, x2] = obj.bbox_norm;
                  const left = x1 * canvas.width;
                  const top = y1 * canvas.height;
                  const width = (x2 - x1) * canvas.width;
                  const height = (y2 - y1) * canvas.height;

                  ctx.strokeRect(left, top, width, height);

                  // Label background
                  const label = `${obj.label} ${Math.round(obj.confidence * 100)}%`;
                  const textWidth = ctx.measureText(label).width;
                  ctx.fillRect(left, top - 20, textWidth + 10, 20);

                  ctx.fillStyle = "white";
                  ctx.fillText(label, left + 5, top - 5);
                  ctx.fillStyle = "#ef4444"; // reset for next box
                }
              }
            };
            bmp.src = `data:image/jpeg;base64,${data.frame}`;
            setAiActiveSafe(data.ai_mode);
            setStreamStateSafe("live");
          }

          if (data.event === "stream_status" && data.status === "offline") {
            setStreamStateSafe("idle");
            setAiActiveSafe(false);
          }
        } catch {
          // ignore parse error
        }
      };

      ws.onclose = () => {
        if (destroyedRef.current) return;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => setError("WebSocket error");
    };

    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
      wsRef.current?.close();
    };
  }, [isAiType, config.cameraId, isEditMode]);

  const handleRetry = () => {
    setError(null);
    setStreamStateSafe("connecting");
    setRefreshKey((prev) => prev + 1);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
  };

  const handleTrashToggle = async () => {
    if (isTrashToggling) return;
    setIsTrashToggling(true);
    const action = trashActive ? "deactivate" : "activate";

    try {
      const baseUrl = getAiServiceBaseUrl();
      const res = await fetch(`${baseUrl}/api/trash/${action}`, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        setTrashActive(!trashActive);
      }
    } catch (err) {
      console.error("[AiCctvStream] Trash toggle error:", err);
    } finally {
      setIsTrashToggling(false);
    }
  };

  if (isEditMode) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden opacity-80"
      >
        <div
          className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-border/40 flex items-center justify-between shrink-0"
          style={{ padding: `${dynamicSizes.headerPadding}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Camera className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span
              className="text-slate-700 dark:text-slate-300 font-semibold truncate"
              style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}
            >
              {config.widgetTitle}
            </span>
          </div>
          <Badge variant="outline" className="text-[9px]">EDIT MODE</Badge>
        </div>
        <div className="flex-1 bg-slate-950/20 flex flex-col items-center justify-center gap-2">
          <Camera className="w-10 h-10 text-slate-400/30" />
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">CCTV Stream Preview</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div
        className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between shrink-0"
        style={{ padding: `${dynamicSizes.headerPadding}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <h3
            className="text-slate-700 dark:text-slate-300 font-semibold truncate"
            style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}
          >
            {config.widgetTitle || "AI CCTV Stream"}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {streamState === "live" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTrashToggle}
              disabled={isTrashToggling}
              className={`h-6 px-2 text-[9px] gap-1.5 transition-all no-drag ${trashActive
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  : "bg-slate-200/50 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
            >
              {isTrashToggling ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Trash2 className={`h-2.5 w-2.5 ${trashActive ? "fill-red-500" : ""}`} />
              )}
              {trashActive ? "SCANNING" : "SCAN"}
            </Button>
          )}

          {streamState === "live" && (
            aiActive ? (
              <Badge className="bg-violet-600 text-white text-[10px] h-5 animate-pulse gap-1">
                <Zap className="h-2.5 w-2.5 fill-yellow-300 text-yellow-300" /> AI LIVE
              </Badge>
            ) : (
              <Badge className="bg-red-600 text-white text-[10px] h-5 animate-pulse gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" /> LIVE
              </Badge>
            )
          )}
          {streamState === "connecting" && (
            <Badge className="bg-yellow-500 text-white text-[10px] h-5">CONNECTING</Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="h-6 w-6 p-0 text-slate-500 no-drag"
          >
            <RefreshCw
              className={`h-3 w-3 ${streamState === "connecting" ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
        {isAiType && (
          <canvas
            ref={canvasRef}
            style={{
              display: streamState === "live" ? "block" : "none",
              maxWidth: "100%",
              maxHeight: "100%",
              imageRendering: "pixelated",
            }}
          />
        )}

        {!isAiType && config.streamUrl && (
          <img
            key={refreshKey}
            src={config.streamUrl}
            alt="CCTV Stream"
            className="w-full h-full object-contain"
            onLoad={() => setStreamStateSafe("live")}
            onError={() => {
              setStreamStateSafe("error");
              setError("Stream unavailable.");
            }}
          />
        )}

        {!isAiType && !config.streamUrl && <PlaceholderIdle />}
        {isAiType && streamState === "idle" && <PlaceholderIdle />}
        {isAiType && streamState === "connecting" && <PlaceholderConnecting />}
        {isAiType && streamState === "offline" && <PlaceholderOffline onRetry={handleRetry} />}
        {isAiType && streamState === "error" && <PlaceholderError message={error} onRetry={handleRetry} />}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-slate-50/30 dark:bg-slate-900/20 border-t border-border/40 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <span className="truncate max-w-[70%] font-mono">
          {isAiType ? `cam: ${config.cameraId ?? "—"}` : config.streamUrl || "—"}
        </span>
        <span className="font-mono bg-slate-200/50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded uppercase">
          {isAiType ? "WS" : "MJPEG"}
        </span>
      </div>
    </div>
  );
};

function PlaceholderIdle() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-600 select-none">
      <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
        <VideoOff className="h-7 w-7 text-slate-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Stream Offline</p>
        <p className="text-[9px] text-slate-600 tracking-wider">Waiting for scheduler…</p>
      </div>
    </div>
  );
}

function PlaceholderConnecting() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 select-none">
      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Connecting</p>
    </div>
  );
}

function PlaceholderOffline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 select-none">
      <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
        <WifiOff className="h-7 w-7 text-slate-500" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Camera Offline</p>
      <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/40 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

function PlaceholderError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 select-none">
      <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-700/30 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-red-500/70" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400/80">Stream Error</p>
      <p className="text-[9px] text-slate-600 tracking-wider max-w-[180px] text-center">{message || "Unknown error occurred"}</p>
      <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-700/30 text-red-400/80 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}
