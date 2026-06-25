"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { getAiServiceBaseUrl, getAiServiceWsUrl } from "@/lib/utils/ai-service";
import {
    Trash2,
    Loader2,
    AlertTriangle,
    Camera,
    ChevronRight,
    Search,
    Wifi,
    X,
    ExternalLink,
    Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TrashObject {
    label: string;
    confidence: number;
    bbox_norm: number[];
}

interface TrashAlert {
    id: string;
    camera_id: string;
    camera_name: string;
    detected_at: string;
    objects: TrashObject[];
    frame_url: string;
    telegram_sent: boolean;
}

interface ScannerStatus {
    running: boolean;
    mode: "auto" | "manual";
    active: boolean;
    paused: boolean;
    scanning: boolean;
    total_alerts: number;
    detector_loaded: boolean;
}

interface Props {
    config: {
        widgetTitle: string;
        limit?: number;
    };
    isEditMode?: boolean;
}


export const TrashDetectionWidget = ({ config, isEditMode = false }: Props) => {
    const limit = config.limit ?? 20;
    const limitRef = useRef(limit);
    useEffect(() => { limitRef.current = limit; }, [limit]);

    const [alerts, setAlerts] = useState<TrashAlert[]>([]);
    const [status, setStatus] = useState<ScannerStatus | null>(null);
    const [fetchStatus, setFetchStatus] = useState<"loading" | "idle" | "error" | "ok">("loading");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isScanning, setIsScanning] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<TrashAlert | null>(null);

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

    const fetchAlerts = async () => {
        try {
            const aiBase = getAiServiceBaseUrl();
            const response = await fetch(`${aiBase}/api/trash/alerts?limit=${limitRef.current}`);
            if (!response.ok) throw new Error("Failed to fetch trash alerts");
            const data = await response.json();
            const sorted = (data.alerts || []).sort(
                (a: TrashAlert, b: TrashAlert) =>
                    new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
            );
            setAlerts(sorted);
            setFetchStatus("ok");
        } catch (err: any) {
            setFetchStatus("error");
            setErrorMessage(err.message);
        }
    };

    const fetchScannerStatus = async () => {
        try {
            const aiBase = getAiServiceBaseUrl();
            const response = await fetch(`${aiBase}/api/trash/status`);
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (err) {
            console.error("[TrashDetection] Status fetch error:", err);
        }
    };

    const handleManualScan = async () => {
        setIsScanning(true);
        try {
            const aiBase = getAiServiceBaseUrl();
            const response = await fetch(`${aiBase}/api/trash/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (response.ok) {
                // Refresh alerts after scan
                setTimeout(fetchAlerts, 1000);
            }
        } catch (err) {
            console.error("[TrashDetection] Manual scan error:", err);
        } finally {
            setIsScanning(false);
        }
    };

    useEffect(() => {
        if (isEditMode) return;

        fetchAlerts();
        fetchScannerStatus();

        // WebSocket for real-time updates
        const wsUrl = getAiServiceWsUrl() + "/ws/frontend";
        let ws: WebSocket;

        const connectWs = () => {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => setWsConnected(true);
            ws.onclose = () => {
                setWsConnected(false);
                setTimeout(connectWs, 3000);
            };
            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.event === "trash_detected") {
                        const newAlert: TrashAlert = {
                            id: data.alert_id,
                            camera_id: data.camera_id,
                            camera_name: data.camera_name,
                            detected_at: data.detected_at,
                            objects: data.objects,
                            frame_url: data.frame_url,
                            telegram_sent: false,
                        };

                        // Kirim notifikasi Telegram via Next.js API
                        fetch("/api/trash/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                alert_id: data.alert_id,
                                camera_name: data.camera_name,
                                detected_at: data.detected_at,
                                objects: data.objects,
                                frame_url: data.frame_url,
                            }),
                        }).then((r) => {
                            if (r.ok) {
                                // Update telegram_sent jadi true di list
                                setAlerts(prev =>
                                    prev.map(a => a.id === data.alert_id ? { ...a, telegram_sent: true } : a)
                                );
                            }
                        }).catch(() => { });

                        setAlerts(prev =>
                            [newAlert, ...prev]
                                .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
                                .slice(0, limitRef.current)
                        );
                    } else if (data.event === "trash_scan_status") {
                        setStatus(prev => prev ? { ...prev, ...data } : data);
                    }
                } catch (err) {
                    // ignore
                }
            };
        };

        connectWs();
        const intervalId = setInterval(fetchScannerStatus, 30000);

        return () => {
            if (ws) ws.close();
            clearInterval(intervalId);
        };
    }, [isEditMode, limit]);

    const renderContent = () => {
        if (fetchStatus === "loading") {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-slate-400 w-8 h-8" />
                </div>
            );
        }

        if (fetchStatus === "error") {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <AlertTriangle className="text-red-500 mb-2 w-8 h-8" />
                    <p className="font-medium text-red-600" style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}>
                        {errorMessage}
                    </p>
                </div>
            );
        }

        if (alerts.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                    <Trash2 className="w-10 h-10" />
                    <p style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}>
                        Belum ada deteksi sampah
                    </p>
                </div>
            );
        }

        return (
            <div className="flex flex-col divide-y divide-border/40">
                {alerts.map((alert, idx) => {
                    const dt = new Date(alert.detected_at);
                    const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const date = dt.toLocaleDateString([], { day: "numeric", month: "short" });
                    return (
                        <button
                            key={alert.id}
                            onClick={() => setSelectedAlert(alert)}
                            className="w-full text-left flex items-center gap-2.5 px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group"
                        >
                            {/* Index */}
                            <span className="text-[9px] font-mono text-slate-400 w-4 shrink-0 text-right">{idx + 1}</span>

                            {/* Camera icon */}
                            <Camera className="w-3 h-3 text-slate-400 shrink-0" />

                            {/* Camera name */}
                            <span
                                className="font-medium text-slate-700 dark:text-slate-300 truncate flex-1"
                                style={{ fontSize: `${dynamicSizes.contentFontSize}px` }}
                            >
                                {alert.camera_name}
                            </span>

                            {/* Object labels */}
                            <div className="flex gap-1 shrink-0">
                                {alert.objects.slice(0, 2).map((obj, i) => (
                                    <Badge key={i} className="bg-red-500/80 text-white text-[8px] h-4 px-1 py-0 border-none leading-none">
                                        {obj.label.split(" ").slice(-1)[0]}
                                    </Badge>
                                ))}
                                {alert.objects.length > 2 && (
                                    <Badge className="bg-slate-400/60 text-white text-[8px] h-4 px-1 py-0 border-none">
                                        +{alert.objects.length - 2}
                                    </Badge>
                                )}
                            </div>

                            {/* Telegram sent indicator */}
                            <span title={alert.telegram_sent ? "Telegram terkirim" : "Telegram belum terkirim"}>
                                <Send
                                    className={`w-2.5 h-2.5 shrink-0 ${alert.telegram_sent ? "text-blue-400" : "text-slate-200 dark:text-slate-700"}`}
                                />
                            </span>

                            {/* Time */}
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-[9px] font-mono text-slate-500">{time}</span>
                                <span className="text-[8px] text-slate-400">{date}</span>
                            </div>

                            <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <div
                ref={containerRef}
                className="relative w-full h-full bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col group"
            >
                {/* Header */}
                <div
                    className="flex-shrink-0 px-4 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between border-b border-border/40"
                    style={{ height: `${dynamicSizes.headerHeight}px` }}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Trash2 className="text-slate-500 dark:text-slate-400 w-4 h-4" />
                        <div className="flex flex-col min-w-0">
                            <h3
                                className="font-medium truncate text-slate-700 dark:text-slate-300"
                                style={{ fontSize: `${dynamicSizes.titleFontSize}px` }}
                            >
                                {config.widgetTitle}
                            </h3>
                            {status && (
                                <span className={cn(
                                    "text-[9px] uppercase tracking-wider font-bold flex items-center gap-1",
                                    status.scanning ? "text-emerald-500" : "text-amber-500"
                                )}>
                                    {status.scanning ? "Active Monitoring" : status.paused ? "Paused (Meeting)" : "Standby"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] gap-1.5 no-drag hover:bg-slate-200 dark:hover:bg-slate-800"
                            onClick={handleManualScan}
                            disabled={isScanning || !status?.detector_loaded}
                        >
                            {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            Scan
                        </Button>
                        <div className={cn(
                            "w-2 h-2 rounded-full transition-colors",
                            wsConnected ? "bg-emerald-500" : "bg-red-500"
                        )} title={wsConnected ? "WS Connected" : "WS Disconnected"} />
                    </div>
                </div>

                {/* Scrollable List */}
                <div
                    className="flex-1 overflow-y-auto"
                    style={{ padding: dynamicSizes.padding }}
                >
                    {renderContent()}
                </div>

                {/* Footer Stats */}
                {status && (
                    <div className="px-3 py-1.5 bg-slate-50/30 dark:bg-slate-900/20 border-t border-border/40 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                        <div className="flex items-center gap-3">
                            <span>MODE: {status.mode.toUpperCase()}</span>
                            <span>ALERTS: {status.total_alerts}</span>
                        </div>
                        {wsConnected && <span className="flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> LIVE</span>}
                    </div>
                )}

            </div>

            {/* Alert Detail Modal — rendered via portal ke document.body */}
            {selectedAlert && typeof document !== "undefined" && createPortal(
                <TrashAlertModal
                    alert={selectedAlert}
                    aiBase={getAiServiceBaseUrl()}
                    onClose={() => setSelectedAlert(null)}
                />,
                document.body
            )}
        </>
    );
};

// ── Trash Alert Modal ────────────────────────────────────────────────────────
function TrashAlertModal({
    alert,
    aiBase,
    onClose,
}: {
    alert: TrashAlert;
    aiBase: string;
    onClose: () => void;
}) {
    const dt = new Date(alert.detected_at);

    // Tutup dengan Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/60 overflow-hidden flex flex-col"
                style={{ maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-slate-50/60 dark:bg-slate-900/40 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">
                                {alert.camera_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                                {dt.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <a
                            href={`${aiBase}${alert.frame_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                            title="Buka gambar di tab baru"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Snapshot */}
                <div className="bg-black flex items-center justify-center overflow-hidden shrink-0" style={{ maxHeight: "50vh" }}>
                    <img
                        src={`${aiBase}${alert.frame_url}`}
                        alt="Trash snapshot"
                        className="w-full object-contain"
                        style={{ maxHeight: "50vh" }}
                    />
                </div>

                {/* Objects */}
                <div className="px-4 py-3 flex flex-col gap-2.5 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                            Objek Terdeteksi
                        </p>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {alert.objects.length} item
                        </span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {alert.objects.map((obj, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{obj.label}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full transition-all"
                                            style={{ width: `${Math.round(obj.confidence * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 w-9 text-right">
                                        {Math.round(obj.confidence * 100)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer: Telegram status + Alert ID */}
                    <div className="flex items-center justify-between mt-1">
                        <div className={`flex items-center gap-1 text-[10px] font-medium ${alert.telegram_sent ? "text-blue-500" : "text-slate-400"}`}>
                            <Send className="w-3 h-3" />
                            {alert.telegram_sent ? "Terkirim ke Telegram" : "Belum terkirim ke Telegram"}
                        </div>
                        <p className="text-[9px] font-mono text-slate-300 dark:text-slate-600">
                            ID: {alert.id}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
