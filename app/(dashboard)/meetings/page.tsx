"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showToast } from "@/lib/toast-utils";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Users,
  Clock,
  RefreshCw,
  Search,
  Video,
  MapPin,
  Timer,
  Zap,
  X,
  CalendarDays,
  Eye,
  Mail,
  Building2,
} from "lucide-react";
import type { NexaBrickMeeting, NexaBrickParticipant } from "@/lib/meeting-external";

// ── Types ──────────────────────────────────────────────────────────────────────

type MeetingStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcDurationMinutes(startTime: string, endTime: string): number {
  if (startTime === "00:00" && endTime === "00:00") return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatDuration(totalMin: number): string {
  if (totalMin <= 0) return "-";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getMeetingStartDate(date: string, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function minsUntilStart(meeting: NexaBrickMeeting): number {
  return differenceInMinutes(getMeetingStartDate(meeting.date, meeting.startTime), new Date());
}

function getOngoingProgress(meeting: NexaBrickMeeting): number {
  const [sh, sm] = meeting.startTime.split(":").map(Number);
  const [eh, em] = meeting.endTime.split(":").map(Number);
  const now = new Date();
  const startSecs = sh * 3600 + sm * 60;
  const endSecs = eh * 3600 + em * 60;
  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const total = endSecs - startSecs;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((nowSecs - startSecs) / total) * 100)));
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const TOKEN = {
  navy: "#2D3250",
  teal: "#32AEAC",
  orange: "#FA9464",
} as const;

const STATUS_CFG: Record<
  MeetingStatus,
  {
    label: string;
    dot: string;
    badge: string;
    rowAccent: string;
    icon: React.ElementType;
    numColor: string;
    tileBg: string;
    accentBar: string;
  }
> = {
  UPCOMING: {
    label: "Upcoming",
    dot: "bg-[#2D3250]",
    badge: "bg-[#EEF0F8] text-[#2D3250] border-[#D1D5E8]",
    rowAccent: "border-l-[#2D3250]/40",
    icon: CalendarClock,
    numColor: TOKEN.navy,
    tileBg: "#EEF0F8",
    accentBar: TOKEN.navy,
  },
  ONGOING: {
    label: "Live",
    dot: "bg-[#32AEAC] animate-pulse",
    badge: "bg-[#E8F6F6] text-[#32AEAC] border-[#B2E0DF]",
    rowAccent: "border-l-[#32AEAC]",
    icon: Zap,
    numColor: TOKEN.teal,
    tileBg: "#E8F6F6",
    accentBar: TOKEN.teal,
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-gray-300",
    badge: "bg-gray-100 text-gray-500 border-gray-200",
    rowAccent: "border-l-gray-200",
    icon: CheckCircle2,
    numColor: "#9CA3AF",
    tileBg: "#F3F4F6",
    accentBar: "#D1D5DB",
  },
};

const RSVP_CFG: Record<string, { label: string; cls: string }> = {
  ATTENDING: { label: "Attending", cls: "bg-[#E8F6F6] text-[#32AEAC] border-[#B2E0DF]" },
  NOT_ATTENDING: { label: "Declined", cls: "bg-red-50 text-red-600 border-red-200" },
  OUTSTANDING: { label: "Pending", cls: "bg-amber-50 text-amber-600 border-amber-200" },
};

function getRsvpCfg(status: string) {
  return RSVP_CFG[status] ?? { label: status, cls: "bg-gray-100 text-gray-500 border-gray-200" };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ParticipantAvatars({
  participants,
  max = 4,
  onClick,
}: {
  participants: NexaBrickParticipant[];
  max?: number;
  onClick?: () => void;
}) {
  if (participants.length === 0)
    return <span className="text-xs text-gray-400">-</span>;

  const shown = participants.slice(0, max);
  const extra = participants.length - max;

  return (
    <button
      onClick={onClick}
      className="flex items-center -space-x-2 hover:opacity-75 transition-opacity"
      title="View all participants"
      type="button"
    >
      {shown.map((p) => (
        <div
          key={p.extUserId}
          className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
          style={{ backgroundColor: TOKEN.navy + "22" }}
        >
          <span className="text-[9px] font-bold leading-none" style={{ color: TOKEN.navy }}>
            {getInitials(p.name)}
          </span>
        </div>
      ))}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
          <span className="text-[9px] font-medium text-gray-500">+{extra}</span>
        </div>
      )}
    </button>
  );
}

function LiveBanner({ meeting }: { meeting: NexaBrickMeeting }) {
  const isOngoing = meeting.status === "ONGOING";
  const mins = minsUntilStart(meeting);
  const progress = isOngoing ? getOngoingProgress(meeting) : 0;
  const accentColor = isOngoing ? TOKEN.teal : TOKEN.navy;

  return (
    <div className="relative bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm overflow-hidden">
      {/* thick left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-2xl" style={{ backgroundColor: accentColor }} />

      <div className="pl-6 pr-5 py-4 flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentColor + "18" }}
        >
          {isOngoing ? (
            <span className="relative flex h-3 w-3">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ backgroundColor: TOKEN.teal }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ backgroundColor: TOKEN.teal }}
              />
            </span>
          ) : (
            <CalendarClock className="h-5 w-5" style={{ color: TOKEN.navy }} />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5"
            style={{ color: accentColor }}
          >
            {isOngoing ? "Live Now" : "Up Next"}
          </p>
          <p className="font-bold text-[15px] text-gray-900 dark:text-white truncate">{meeting.title}</p>
          <div className="flex items-center gap-3 mt-1 text-[12px] text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {meeting.startTime} – {meeting.endTime}
            </span>
            {meeting.type === "VIRTUAL" ? (
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Virtual
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {meeting.location ?? "Physical"}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {meeting.participantCount}
            </span>
          </div>
          {isOngoing && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: TOKEN.teal }}
                />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">{progress}%</span>
            </div>
          )}
        </div>

        {/* Right CTA */}
        <div className="shrink-0 text-right">
          {!isOngoing && (
            <div className="mb-1">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Starts in</p>
              <p className="text-[22px] font-extrabold leading-tight" style={{ color: TOKEN.navy }}>
                {mins <= 0 ? "Now" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}
              </p>
            </div>
          )}
          {meeting.meetingLink && (
            <a
              href={meeting.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white px-3.5 py-1.5 rounded-lg transition-opacity hover:opacity-85"
              style={{ backgroundColor: accentColor }}
            >
              <Video className="h-3.5 w-3.5" />
              Join
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const STATUSES: MeetingStatus[] = ["UPCOMING", "ONGOING", "COMPLETED"];

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<NexaBrickMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [participantMeeting, setParticipantMeeting] = useState<NexaBrickMeeting | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      if (force) params.set("force", "true");
      const res = await fetch(`/api/meetings?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setMeetings(json.data as NexaBrickMeeting[]);
      } else {
        showToast.error("Failed to load meetings", json.message ?? "");
      }
    } catch {
      showToast.error("Network error", "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackId: ReturnType<typeof setInterval> | null = null;

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const connect = () => {
      es = new EventSource("/api/meetings/stream");

      es.onopen = () => {
        if (fallbackId) { clearInterval(fallbackId); fallbackId = null; }
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "data-updated") load(true);
          if (data.type === "status-change") {
            load();
            if (data.status === "ONGOING") {
              showToast.success(`Meeting started: ${data.title}`, `${data.startTime} – ${data.endTime}`);
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("Meeting started", {
                  body: `${data.title}\n${data.startTime} – ${data.endTime}`,
                  icon: "/favicon.ico",
                  tag: `meeting-ongoing-${data.meetingId}`,
                });
              }
            } else if (data.status === "COMPLETED") {
              showToast.success(`Meeting completed: ${data.title}`);
            }
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        es?.close(); es = null;
        if (!fallbackId) fallbackId = setInterval(() => load(), 30_000);
        setTimeout(connect, 10_000);
      };
    };

    connect();
    return () => { es?.close(); if (fallbackId) clearInterval(fallbackId); };
  }, [load]);

  // ── Computed ──────────────────────────────────────────────────────────────────

  const filtered = meetings.filter(
    (m) => !search || m.title.toLowerCase().includes(search.toLowerCase())
  );

  const today = format(new Date(), "yyyy-MM-dd");

  const bannerMeeting =
    meetings.find((m) => m.status === "ONGOING") ??
    meetings
      .filter((m) => m.status === "UPCOMING" && m.date === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ??
    null;

  // ── Render ────────────────────────────────────────────────────────────────────

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
          <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">
            Meetings
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={loading}
          className="mt-1 border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="px-6 space-y-5 pb-10">

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          {STATUSES.map((status) => {
            const cfg = STATUS_CFG[status];
            const count = meetings.filter((m) => m.status === status).length;
            return (
              <div
                key={status}
                className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm px-5 py-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                  {cfg.label}
                </p>
                {loading ? (
                  <Skeleton className="h-11 w-10 mt-1" />
                ) : (
                  <p
                    className="text-[44px] font-extrabold leading-none"
                    style={{ color: cfg.numColor }}
                  >
                    {count}
                  </p>
                )}
                <div
                  className="mt-3 h-[3px] rounded-full w-10"
                  style={{ backgroundColor: cfg.accentBar, opacity: 0.3 }}
                />
              </div>
            );
          })}
        </div>

        {/* Live / next banner */}
        {loading ? (
          <Skeleton className="h-[88px] w-full rounded-2xl" />
        ) : bannerMeeting ? (
          <LiveBanner meeting={bannerMeeting} />
        ) : null}

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search meetings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white dark:bg-card border-gray-200 dark:border-border text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-xl shadow-sm focus-visible:ring-[#2D3250]/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl px-2.5 h-9 text-sm text-gray-400 dark:text-gray-500 shadow-sm">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent outline-none text-gray-900 dark:text-white text-[13px] w-[130px]"
              title="Filter by date"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter("")} className="hover:text-gray-600 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 bg-white dark:bg-card border-gray-200 dark:border-border text-gray-900 dark:text-white rounded-xl text-[13px] shadow-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="UPCOMING">Upcoming</SelectItem>
              <SelectItem value="ONGOING">Live</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>

          {(search || dateFilter || statusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setDateFilter(""); setStatusFilter("ALL"); }}
              className="text-gray-400 hover:text-gray-700 h-9"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}

          <span className="ml-auto text-[12px] text-gray-400 dark:text-gray-500 shrink-0">
            {filtered.length} meeting{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 dark:bg-gray-800/60 hover:bg-gray-50/80 dark:hover:bg-gray-800/60 border-b border-gray-100 dark:border-border">
                <TableHead className="pl-5 text-[11px] font-bold uppercase tracking-wider text-gray-400 w-[35%]">
                  Meeting
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Date</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Time</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Duration</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Participants</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-l-2 border-l-transparent">
                    <TableCell className="pl-5 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </TableCell>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="py-4"><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                    <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                        <CalendarCheck className="h-7 w-7 opacity-30" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-500 dark:text-gray-400">No meetings found</p>
                        <p className="text-[12px] mt-0.5">
                          {search || dateFilter || statusFilter !== "ALL"
                            ? "Try adjusting your filters"
                            : "No meetings in the current window"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((meeting) => {
                  const duration = calcDurationMinutes(meeting.startTime, meeting.endTime);
                  const cfg = STATUS_CFG[meeting.status];
                  const isToday = meeting.date === today;
                  const progress = meeting.status === "ONGOING" ? getOngoingProgress(meeting) : 0;

                  return (
                    <TableRow
                      key={meeting.id}
                      className={`border-l-2 ${cfg.rowAccent} hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors`}
                    >
                      {/* Title */}
                      <TableCell className="pl-4 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: cfg.tileBg }}
                          >
                            {meeting.type === "VIRTUAL" ? (
                              <Video className="h-3.5 w-3.5" style={{ color: cfg.numColor }} />
                            ) : (
                              <MapPin className="h-3.5 w-3.5" style={{ color: cfg.numColor }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-[13.5px] text-gray-900 dark:text-white leading-tight truncate max-w-[240px]">
                                {meeting.title}
                              </p>
                              {meeting.status === "ONGOING" && meeting.meetingLink && (
                                <a
                                  href={meeting.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: TOKEN.teal + "18", color: TOKEN.teal, border: `1px solid ${TOKEN.teal}44` }}
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  Join
                                </a>
                              )}
                              {isToday && meeting.status === "UPCOMING" && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: TOKEN.orange + "18", color: TOKEN.orange, border: `1px solid ${TOKEN.orange}44` }}
                                >
                                  <Timer className="h-2.5 w-2.5" />
                                  Today
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-4">
                        <p className="text-[13px] text-gray-700 dark:text-gray-300">{format(parseISO(meeting.date), "dd MMM yyyy")}</p>
                      </TableCell>

                      {/* Time */}
                      <TableCell className="py-4">
                        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                          {meeting.startTime} – {meeting.endTime}
                        </p>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="py-4">
                        <p className="text-[13px] font-mono text-gray-700 dark:text-gray-300">{formatDuration(duration)}</p>
                        {meeting.status === "ONGOING" && (
                          <div className="mt-1.5 w-14 h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: TOKEN.teal }}
                            />
                          </div>
                        )}
                      </TableCell>

                      {/* Participants */}
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <ParticipantAvatars
                            participants={meeting.participants}
                            max={4}
                            onClick={() => setParticipantMeeting(meeting)}
                          />
                          <span className="text-[12px] text-gray-400">{meeting.participantCount}</span>
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell className="py-4">
                        {meeting.location ? (
                          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]" title={meeting.location}>
                            {meeting.location}
                          </p>
                        ) : (
                          <span className="text-[12px] text-gray-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Participant dialog */}
      <Dialog
        open={!!participantMeeting}
        onOpenChange={(open) => { if (!open) setParticipantMeeting(null); }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: TOKEN.navy + "15" }}
              >
                <Users className="h-3.5 w-3.5" style={{ color: TOKEN.navy }} />
              </div>
              <span className="truncate">{participantMeeting?.title}</span>
            </DialogTitle>
            {participantMeeting && (
              <p className="text-[12px] text-gray-400 mt-1 pl-9">
                {format(parseISO(participantMeeting.date), "dd MMMM yyyy")} ·{" "}
                {participantMeeting.startTime} – {participantMeeting.endTime} ·{" "}
                <span className="font-semibold text-gray-600">{participantMeeting.participantCount} participants</span>
              </p>
            )}
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6 mt-2">
            {participantMeeting?.participants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No participants</p>
            ) : (
              <div className="space-y-1">
                {participantMeeting?.participants.map((p) => {
                  const rsvp = getRsvpCfg(p.actualRsvpStatus);
                  return (
                    <div
                      key={p.extUserId}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: TOKEN.navy + "15" }}
                      >
                        <span className="text-xs font-bold" style={{ color: TOKEN.navy }}>
                          {getInitials(p.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white leading-tight truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {p.department && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{p.department}</span>
                            </span>
                          )}
                          {p.email && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{p.email}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rsvp.cls}`}>
                        {rsvp.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
