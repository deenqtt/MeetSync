"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { getAiServiceBaseUrl } from "@/lib/utils/ai-service";
import { Loader2, AlertTriangle, Video, Users, Clock, PlayCircle, Eye, CalendarDays, CalendarClock, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BehaviorClip {
    filename: string;
    meeting_id: string;
    person: string;
    behavior: string;
    timestamp: string | null;
    url: string;
}

interface Props {
    config: {
        widgetTitle: string;
        clipMode?: "all" | "by-meeting";
    };
    isEditMode?: boolean;
}

export const AiCctvSnapshotsWidget = ({ config, isEditMode = false }: Props) => {
    const clipMode = config.clipMode ?? "by-meeting";
    const isAllMode = clipMode === "all";

    const [clips, setClips] = useState<BehaviorClip[]>([]);
    const [fetchStatus, setFetchStatus] = useState<"loading" | "idle" | "error" | "ok">("loading");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
    const [activeMeetingTitle, setActiveMeetingTitle] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const [dynamicSizes, setDynamicSizes] = useState({
        titleFontSize: 12,
        contentFontSize: 11,
        headerHeight: 40,
        padding: 16,
    });

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateLayout = () => {
            const rect = container.getBoundingClientRect();
            const { width, height } = rect;
            const headerHeight = Math.max(36, Math.min(height * 0.25, 56));
            const baseSize = Math.sqrt(width * height);
            setDynamicSizes({
                titleFontSize: Math.max(11, Math.min(headerHeight * 0.35, 16)),
                contentFontSize: Math.max(10, Math.min(baseSize * 0.04, 13)),
                headerHeight,
                padding: Math.max(12, Math.min(baseSize * 0.05, 20)),
            });
        };

        updateLayout();
        const resizeObserver = new ResizeObserver(updateLayout);
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    // ── Step 1: cek meeting yang sedang ONGOING saat widget mount ──────────────
    useEffect(() => {
        if (isAllMode || isEditMode) return;

        const checkCurrentMeeting = async () => {
            try {
                const res = await fetch("/api/meetings/current");
                if (!res.ok) return;
                const data = await res.json();
                if (data.meeting) {
                    setActiveMeetingId(data.meeting.meetingId);
                    setActiveMeetingTitle(data.meeting.title);
                } else {
                    setActiveMeetingId(null);
                    setActiveMeetingTitle(null);
                    setFetchStatus("idle");
                }
            } catch {
                setFetchStatus("idle");
            }
        };
        checkCurrentMeeting();
    }, [isAllMode, isEditMode]);

    // ── Step 2: subscribe SSE untuk update real-time ───────────────────────────
    useEffect(() => {
        if (isAllMode || isEditMode) return;

        const es = new EventSource("/api/meetings/stream");

        es.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                if (event.type === "status-change") {
                    if (event.status === "ONGOING") {
                        setActiveMeetingId(event.meetingId);
                        setActiveMeetingTitle(event.title);
                        setClips([]);
                        setFetchStatus("loading");
                    } else if (event.status === "COMPLETED" || event.status === "UPCOMING") {
                        setActiveMeetingId(null);
                        setActiveMeetingTitle(null);
                        setClips([]);
                        setFetchStatus("idle");
                    }
                }
            } catch {
                // ignore
            }
        };

        return () => es.close();
    }, [isAllMode, isEditMode]);

    // ── Step 3: fetch clips, auto-refresh 30s ─────────────────────────────────
    useEffect(() => {
        if (isEditMode) return;
        if (!isAllMode && !activeMeetingId) return;

        const fetchClips = async () => {
            if (fetchStatus !== "ok") setFetchStatus("loading");
            try {
                const aiBase = getAiServiceBaseUrl();
                const url = new URL(`${aiBase}/api/clips`);
                if (!isAllMode && activeMeetingId) {
                    url.searchParams.append("meeting_id", activeMeetingId);
                }

                const response = await fetch(url.toString());
                if (!response.ok) throw new Error("Failed to fetch clips");

                const responseData = await response.json();
                setClips(Array.isArray(responseData.clips) ? responseData.clips : []);
                setFetchStatus("ok");
            } catch (err: any) {
                setFetchStatus("error");
                setErrorMessage(err.message);
            }
        };

        fetchClips();
        const intervalId = setInterval(fetchClips, 30 * 1000);
        return () => clearInterval(intervalId);
    }, [isAllMode, activeMeetingId, isEditMode]);

    const handleDeleteClip = async (filename: string) => {
        try {
            const aiBase = getAiServiceBaseUrl();
            const res = await fetch(`${aiBase}/api/clips/${encodeURIComponent(filename)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setClips((prev) => prev.filter((c) => c.filename !== filename));
            }
        } catch (err) {
            console.error("[AiCctvSnapshots] Delete error:", err);
        }
    };

    // Group clips by person
    const groupedClips = clips.reduce((acc, clip) => {
        const person = clip.person || "Unknown";
        if (!acc[person]) acc[person] = [];
        acc[person].push(clip);
        return acc;
    }, {} as Record<string, BehaviorClip[]>);

    const getStatusStyles = () => ({
        title: "text-slate-700 dark:text-slate-300",
        indicator:
            fetchStatus === "ok" ? "bg-emerald-500" :
                fetchStatus === "error" ? "bg-red-500" :
                    fetchStatus === "idle" ? "bg-slate-400" :
                        "bg-amber-500",
        pulse: fetchStatus === "loading",
    });

    if (isEditMode) {
        return (
            <div
                ref={containerRef}
                className="w-full h-full flex flex-col bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden opacity-80"
            >
                <div
                    className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-border/40 flex items-center justify-between shrink-0"
                    style={{ height: `${dynamicSizes.headerHeight}px`, padding: "0 16px" }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Video className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate" style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}>
                            {config.widgetTitle}
                        </span>
                    </div>
                    <Badge variant="outline" className="text-[9px]">EDIT MODE</Badge>
                </div>
                <div className="flex-1 bg-slate-950/20 flex flex-col items-center justify-center gap-2">
                    <Video className="w-10 h-10 text-slate-400/30" />
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Snapshots Preview</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        const styles = getStatusStyles();

        if (!isAllMode && !activeMeetingId) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                    <CalendarClock className="text-slate-300 dark:text-slate-600 w-10 h-10" />
                    <p className="font-medium text-slate-500 dark:text-slate-400" style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}>
                        Menunggu meeting...
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600">
                        Clips akan muncul otomatis saat meeting dimulai
                    </p>
                </div>
            );
        }

        if (fetchStatus === "loading") {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-slate-400 dark:text-slate-500 w-8 h-8" />
                </div>
            );
        }

        if (fetchStatus === "error") {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <AlertTriangle className="text-red-500 dark:text-red-400 mb-2 w-8 h-8" />
                    <p className="font-medium text-red-600 dark:text-red-400" style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}>
                        {errorMessage}
                    </p>
                </div>
            );
        }

        if (clips.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                    <Video className="w-8 h-8" />
                    <p style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}>Belum ada clip terdeteksi</p>
                </div>
            );
        }

        const aiBase = getAiServiceBaseUrl();
        return (
            <div className="space-y-6">
                {Object.entries(groupedClips).map(([person, personClips]) => (
                    <div key={person} className="flex flex-col gap-3">
                        <div className="sticky top-0 z-10 flex items-center justify-between pb-2 mb-1 border-b border-slate-200 dark:border-slate-800 bg-card/95 backdrop-blur-sm pt-2 -mt-2">
                            <div className="flex items-center gap-2.5">
                                <Users className="w-4 h-4 text-emerald-500" />
                                <h4 className="font-bold text-slate-800 dark:text-slate-100" style={{ fontSize: `${dynamicSizes.contentFontSize + 2}px` }}>
                                    {person}
                                </h4>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                                {personClips.length} clips
                            </Badge>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {personClips.map((clip, idx) => (
                                <a
                                    key={idx}
                                    href={`${aiBase}${clip.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-stretch bg-slate-50 dark:bg-slate-800/40 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 no-drag"
                                >
                                    <div className="relative w-28 sm:w-32 flex-shrink-0 bg-slate-950 flex items-center justify-center">
                                        <PlayCircle className="text-white/60 group-hover:text-white w-8 h-8 transition-transform group-hover:scale-110 z-20 drop-shadow-md" />
                                    </div>

                                    <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h5 className="font-semibold text-slate-800 dark:text-slate-200 truncate capitalize" style={{ fontSize: `${dynamicSizes.contentFontSize + 1}px` }}>
                                                {clip.behavior.replace(/_/g, " ")}
                                            </h5>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Download className="w-3.5 h-3.5 text-blue-500" />
                                                {isAllMode && <Trash2 className="w-3.5 h-3.5 text-red-500" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClip(clip.filename); }} />}
                                            </div>
                                        </div>

                                        {clip.timestamp && (
                                            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-auto text-[10px] font-mono">
                                                <span>{new Date(clip.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                                                <span>{new Date(clip.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                            </div>
                                        )}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const styles = getStatusStyles();

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-card rounded-xl shadow-sm border border-border/60 overflow-hidden group flex flex-col"
        >
            <div
                className="flex-shrink-0 px-4 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between border-b border-border/40"
                style={{ height: `${dynamicSizes.headerHeight}px` }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Video className="text-slate-500 dark:text-slate-400 w-4 h-4" />
                    <div className="flex flex-col min-w-0">
                        <h3 className={cn("font-medium truncate transition-colors duration-200", styles.title)} style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}>
                            {config.widgetTitle}
                        </h3>
                        {activeMeetingTitle && (
                            <span className="text-emerald-600 dark:text-emerald-400 truncate font-normal text-[9px]">
                                {activeMeetingTitle}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className={cn("w-2 h-2 rounded-full", styles.indicator, styles.pulse ? "animate-pulse" : "")} />
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto"
                style={{ padding: dynamicSizes.padding }}
            >
                {renderContent()}
            </div>
        </div>
    );
};
