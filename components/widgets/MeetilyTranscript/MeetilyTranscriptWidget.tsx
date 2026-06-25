// components/widgets/MeetilyTranscript/MeetilyTranscriptWidget.tsx
"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Mic, Loader2, MicOff, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  config: {
    widgetTitle: string;
  };
}

interface TranscriptLine {
  meetingId: string;
  text: string;
  timestamp: string;
}

interface ActiveMeeting {
  id: string;
  title: string;
}

export const MeetilyTranscriptWidget = ({ config }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeeting | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dynamicSizes, setDynamicSizes] = useState({
    titleFontSize: 13,
    headerHeight: 42,
    lineFontSize: 12,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const { width, height } = container.getBoundingClientRect();
      setDynamicSizes({
        titleFontSize: Math.max(11, Math.min(width * 0.04, 15)),
        headerHeight: Math.max(36, Math.min(height * 0.15, 52)),
        lineFontSize: Math.max(10, Math.min(width * 0.033, 13)),
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, []);

  // Poll active meeting
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/meetings?status=ONGOING");
        const json = await res.json();
        const meetings: ActiveMeeting[] = json.data || [];
        const meeting = meetings.length > 0 ? meetings[0] : null;
        setActiveMeeting((prev) => {
          // Reset transcript saat meeting berubah
          if (prev?.id !== meeting?.id) {
            setLines([]);
            setStopped(false);
          }
          return meeting;
        });
      } catch {
        setActiveMeeting(null);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
    const iv = setInterval(fetch_, 15000);
    return () => clearInterval(iv);
  }, []);

  // SSE: subscribe ke NexaBrick transcript stream
  useEffect(() => {
    const es = new EventSource("/api/meetily/transcript/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "transcript" && data.text) {
          setConnected(true);
          setStopped(false);
          setLines((prev) => [
            ...prev.slice(-199), // simpan max 200 baris
            {
              meetingId: data.meetingId,
              text: data.text,
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "stop") {
          setStopped(true);
          setConnected(false);
        }
      } catch { }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => es.close();
  }, []);

  // Auto-scroll ke bawah saat ada baris baru
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 px-3 flex items-center justify-between
                   bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/40 dark:border-slate-700/40"
        style={{ height: dynamicSizes.headerHeight }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Mic
            className="text-violet-500 flex-shrink-0"
            style={{ width: 15, height: 15 }}
          />
          <h3
            className="font-medium truncate text-slate-700 dark:text-slate-300"
            style={{ fontSize: dynamicSizes.titleFontSize }}
          >
            {config.widgetTitle}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stopped ? (
            <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
              Stopped
            </Badge>
          ) : connected && lines.length > 0 ? (
            <Badge className="bg-violet-600 hover:bg-violet-600 text-white text-xs px-2 py-0 h-5">
              <Circle className="h-1.5 w-1.5 fill-white mr-1 animate-pulse" />
              LIVE
            </Badge>
          ) : null}
          {lines.length > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {lines.length} lines
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ top: dynamicSizes.headerHeight }}
      >
        {lines.length > 0 ? (
          <div
            ref={scrollRef}
            className="w-full h-full overflow-y-auto px-3 py-2 space-y-1.5 scroll-smooth"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 items-start",
                  i === lines.length - 1 && "opacity-100",
                  i !== lines.length - 1 && "opacity-75"
                )}
              >
                <span
                  className="text-slate-400 dark:text-slate-600 flex-shrink-0 tabular-nums"
                  style={{ fontSize: Math.max(9, dynamicSizes.lineFontSize - 2) }}
                >
                  {formatTime(line.timestamp)}
                </span>
                <p
                  className="text-slate-700 dark:text-slate-300 leading-snug"
                  style={{ fontSize: dynamicSizes.lineFontSize }}
                >
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <MicOff className="text-slate-300 dark:text-slate-600" style={{ width: 28, height: 28 }} />
            <p className="text-slate-400 text-xs">Waiting for transcript...</p>
          </div>
        )}
      </div>
    </div>
  );
};
