"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import { getAiServiceBaseUrl, getAiServiceWsUrl } from "@/lib/utils/ai-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, Activity, Wifi, WifiOff, Clock, Timer, UserX, Download } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface IdentityCard {
  name: string;
  active: boolean;
  last_seen_ts: number | null;
  first_seen_ts: number | null;
  zone_seconds: number;
}

interface StreamStats {
  meeting_id: string;
  total_persons: number;
  total_behaviors: number;
  identities: IdentityCard[];
}

interface BehaviorEvent {
  meeting_id: string;
  person_id: string;
  behavior: string;
  confidence: number;
  cam_id: number;
  timestamp: number;
  clip_filename: string | null;
  clip_url: string | null;
}

const DEFAULT_STATS: StreamStats = {
  meeting_id: "",
  total_persons: 0,
  total_behaviors: 0,
  identities: [],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLastSeen(ts: number | null): string {
  if (ts === null) return "In frame";
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatZoneSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatBehavior(b: string): string {
  return b.replace(/_/g, " ");
}

function namesMatch(participantName: string, detectedName: string): boolean {
  const a = participantName.toLowerCase();
  const b = detectedName.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function isIdentityLate(
  identity: IdentityCard,
  meetingStartTs: number | null,
  thresholdSec: number,
): boolean {
  if (!identity.first_seen_ts || !meetingStartTs) return false;
  return identity.first_seen_ts - meetingStartTs > thresholdSec;
}

// Dedup key: 1 entry per person+behavior, selalu tampil yang terbaru
function behaviorDedupKey(b: BehaviorEvent): string {
  return `${b.person_id}|${b.behavior}`;
}

// ── CSV Download ────────────────────────────────────────────────────────────

interface SummaryIdentity {
  name: string;
  zone_seconds: number;
  first_seen_ts: number | null;
  is_late: boolean;
}

function downloadAttendanceCsv(
  meetingId: string,
  participantNames: Set<string>,
  summaryIdentities: SummaryIdentity[],
  lateThresholdSec: number,
  meetingStartTs: number | null,
) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  const rows: string[][] = [
    ["Name", "Status", "Zone Duration", "First Seen", "Late", "Meeting ID"],
  ];

  const allParticipants = Array.from(participantNames);

  for (const pName of allParticipants) {
    // Cari match di detected (partial)
    const detected = summaryIdentities.find((id) =>
      namesMatch(pName, id.name)
    );

    if (detected) {
      const firstSeenStr = detected.first_seen_ts
        ? new Date(detected.first_seen_ts * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "-";

      const isLate = detected.is_late !== undefined
        ? detected.is_late
        : meetingStartTs !== null && detected.first_seen_ts !== null
          ? detected.first_seen_ts - meetingStartTs > lateThresholdSec
          : false;

      rows.push([
        pName,
        "Present",
        formatZoneSeconds(detected.zone_seconds),
        firstSeenStr,
        isLate ? "Yes" : "No",
        meetingId,
      ]);
    } else {
      rows.push([pName, "Absent", "-", "-", "-", meetingId]);
    }
  }

  const csvContent = rows
    .map((r) => r.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance_${meetingId}_${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  config: {
    widgetTitle: string;
    lateThresholdMinutes?: number; // default 15 menit
  };
  isEditMode?: boolean;
}

export const AiCctvStatisticsWidget = ({ config, isEditMode = false }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<StreamStats>(DEFAULT_STATS);
  const [behaviors, setBehaviors] = useState<BehaviorEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [meetingStartTs, setMeetingStartTs] = useState<number | null>(null);
  const [participantNames, setParticipantNames] = useState<Set<string>>(new Set());

  // Threshold late dalam detik (default 15 menit)
  const lateThresholdSec = (config.lateThresholdMinutes ?? 15) * 60;

  // Auto-fetch meeting data saat meeting_id berubah
  useEffect(() => {
    if (isEditMode || !stats.meeting_id) {
      setMeetingStartTs(null);
      setParticipantNames(new Set());
      return;
    }
    const fetchMeetingData = async () => {
      try {
        const res = await fetch(`/api/meetings/${stats.meeting_id}`);
        if (!res.ok) return;
        const data = await res.json();
        const meeting = data.data;
        if (!meeting) return;

        if (meeting.startTime) {
          const [h, m] = meeting.startTime.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          setMeetingStartTs(d.getTime() / 1000);
        }

        if (meeting.participants?.length) {
          const names = new Set<string>(
            meeting.participants.map((p: { name: string }) => p.name.toLowerCase())
          );
          setParticipantNames(names);
        }
      } catch {
        // ignore
      }
    };
    fetchMeetingData();
  }, [stats.meeting_id, isEditMode]);

  const visibleIdentities = useMemo(() => {
    if (participantNames.size === 0) return stats.identities;
    return stats.identities.filter((id) =>
      Array.from(participantNames).some((pName) => namesMatch(pName, id.name))
    );
  }, [stats.identities, participantNames]);

  const activeCount = useMemo(
    () => visibleIdentities.filter((id) => id.active).length,
    [visibleIdentities],
  );
  const lateCount = useMemo(
    () => visibleIdentities.filter((id) => isIdentityLate(id, meetingStartTs, lateThresholdSec)).length,
    [visibleIdentities, meetingStartTs, lateThresholdSec],
  );

  const absentParticipants = useMemo(() => {
    if (participantNames.size === 0) return [];
    return Array.from(participantNames).filter(
      (pName) => !stats.identities.some((id) => namesMatch(pName, id.name))
    );
  }, [participantNames, stats.identities]);

  const wsRef = useRef<WebSocket | null>(null);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const participantNamesRef = useRef<Set<string>>(new Set());
  const meetingStartTsRef = useRef<number | null>(null);
  const lateThresholdSecRef = useRef<number>(lateThresholdSec);

  useEffect(() => { participantNamesRef.current = participantNames; }, [participantNames]);
  useEffect(() => { meetingStartTsRef.current = meetingStartTs; }, [meetingStartTs]);
  useEffect(() => { lateThresholdSecRef.current = lateThresholdSec; }, [lateThresholdSec]);

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

  useEffect(() => {
    if (isEditMode) return;

    destroyedRef.current = false;
    setStats(DEFAULT_STATS);
    setBehaviors([]);

    const connect = () => {
      if (destroyedRef.current) return;

      const wsUrl = `${getAiServiceWsUrl()}/ws/frontend`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.event === "stream_stats") {
            const seen = new Set<string>();
            const uniqueIdentities: IdentityCard[] = [];
            for (const id of (msg.identities ?? []) as any[]) {
              if (!seen.has(id.name)) {
                seen.add(id.name);
                uniqueIdentities.push({
                  name: id.name,
                  active: id.active ?? false,
                  last_seen_ts: id.last_seen_ts ?? null,
                  first_seen_ts: id.first_seen_ts ?? null,
                  zone_seconds: id.zone_seconds ?? 0,
                });
              }
            }
            setStats({
              meeting_id: msg.meeting_id,
              total_persons: msg.total_persons ?? 0,
              total_behaviors: msg.total_behaviors ?? 0,
              identities: uniqueIdentities,
            });
          }

          if (msg.event === "meeting_auto_stopped") {
            const summaryIdentities: SummaryIdentity[] =
              (msg.summary?.identities ?? []).map((id: any) => ({
                name: id.name,
                zone_seconds: id.zone_seconds ?? 0,
                first_seen_ts: id.first_seen_ts ?? null,
                is_late: id.is_late ?? false,
              }));
            downloadAttendanceCsv(
              msg.meeting_id ?? "",
              participantNamesRef.current,
              summaryIdentities,
              lateThresholdSecRef.current,
              meetingStartTsRef.current,
            );
          }

          if (msg.event === "behavior_detected") {
            const incoming: BehaviorEvent = {
              meeting_id: msg.meeting_id,
              person_id: msg.person_id,
              behavior: msg.behavior,
              confidence: msg.confidence,
              cam_id: msg.cam_id,
              timestamp: msg.timestamp,
              clip_filename: msg.clip_filename,
              clip_url: msg.clip_url,
            };
            const incomingKey = behaviorDedupKey(incoming);

            setBehaviors((prev) => {
              const filtered = prev.filter(
                (b) => behaviorDedupKey(b) !== incomingKey
              );
              return [incoming, ...filtered].slice(0, 50);
            });
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!destroyedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 1000);
        }
      };

      ws.onerror = () => setConnected(false);
    };

    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [isEditMode]);

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
            <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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
          <Activity className="w-10 h-10 text-slate-400/30" />
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Statistics Preview</p>
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
          <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <h3
            className="text-slate-700 dark:text-slate-300 font-semibold truncate"
            style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}
          >
            {config.widgetTitle || "Smart Room Stats"}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected ? (
            <Badge className="bg-emerald-600 text-white text-[10px] h-5 gap-1 animate-pulse">
              <Wifi className="h-2.5 w-2.5" /> LIVE
            </Badge>
          ) : (
            <Badge className="bg-slate-600 text-white text-[10px] h-5 gap-1">
              <WifiOff className="h-2.5 w-2.5" /> OFFLINE
            </Badge>
          )}
          {stats.meeting_id && visibleIdentities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadAttendanceCsv(
                  stats.meeting_id,
                  participantNamesRef.current,
                  visibleIdentities.map((id) => ({
                    name: id.name,
                    zone_seconds: id.zone_seconds,
                    first_seen_ts: id.first_seen_ts,
                    is_late: isIdentityLate(id, meetingStartTsRef.current, lateThresholdSecRef.current),
                  })),
                  lateThresholdSecRef.current,
                  meetingStartTsRef.current,
                )
              }
              className="no-drag h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
              title="Download attendance CSV"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-blue-700/30 bg-blue-900/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <Users className="h-3 w-3" /> Persons Now
            </p>
            <p className="text-2xl font-bold text-blue-300 mt-0.5">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-red-700/30 bg-red-900/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Behaviors
            </p>
            <p className="text-2xl font-bold text-red-300 mt-0.5">{stats.total_behaviors}</p>
          </div>
          <div className="rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Present
            </p>
            <p className="text-2xl font-bold text-emerald-300 mt-0.5">{visibleIdentities.length}</p>
          </div>
          <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Late
            </p>
            <p className="text-2xl font-bold text-amber-300 mt-0.5">
              {meetingStartTs !== null ? lateCount : <span className="text-sm text-slate-500 font-normal">—</span>}
            </p>
          </div>
        </div>

        {participantNames.size > 0 && (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <UserX className="h-3 w-3" /> Absent
              </p>
              <span className="text-[10px] text-slate-500 font-mono">{absentParticipants.length}/{participantNames.size}</span>
            </div>
            {absentParticipants.length === 0 ? (
              <p className="text-[11px] text-emerald-500 mt-1">All present ✓</p>
            ) : (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {absentParticipants.map((name) => (
                  <span key={name} className="text-[10px] bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded border border-slate-600/40">{name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Identities Detected</p>
          {visibleIdentities.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">No identities yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {visibleIdentities.map((id) => {
                const late = isIdentityLate(id, meetingStartTs, lateThresholdSec);
                return (
                  <div key={id.name} className={`flex items-center justify-between rounded-lg px-2.5 py-2 border text-xs ${id.active ? "border-emerald-700/40 bg-emerald-900/15" : "border-slate-700/30 bg-slate-800/20 opacity-60"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${id.active ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                      <span className="font-medium text-slate-200 truncate">{id.name}</span>
                      {late && <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">LATE</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {id.zone_seconds > 0 && <span className="text-[10px] text-slate-500 font-mono">⏱ {formatZoneSeconds(id.zone_seconds)}</span>}
                      <span className="text-[10px] text-slate-400 font-mono">{formatLastSeen(id.last_seen_ts)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {behaviors.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Recent Alerts</p>
            <div className="flex flex-col gap-1">
              {behaviors.slice(0, 10).map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded px-2 py-1.5 bg-slate-800/40 border border-slate-700/30 text-xs text-slate-300">
                  <div className="min-w-0 flex-1">
                    <span className="text-white font-medium">{b.person_id}</span>
                    <span className="text-red-400 ml-1.5">{formatBehavior(b.behavior)}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[10px] ml-2">{Math.round(b.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 bg-slate-50/30 dark:bg-slate-900/20 border-t border-border/40 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <span className="font-mono truncate max-w-[70%]">{stats.meeting_id ? `id: ${stats.meeting_id}` : "waiting…"}</span>
        <span className="font-mono bg-slate-200/50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">WS</span>
      </div>
    </div>
  );
};
