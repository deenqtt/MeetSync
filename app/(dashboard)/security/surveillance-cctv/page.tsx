"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { showToast } from "@/lib/toast-utils";
import {
  Camera,
  VideoOff,
  RefreshCw,
  Search,
  X,
  Trash2,
  Map,
  Plus,
  Circle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RtspCamera {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  channel?: string | null;
  username?: string | null;
  createdAt: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const TOKEN = {
  navy: "#2D3250",
  teal: "#32AEAC",
  orange: "#FA9464",
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

const AI_PORT = process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567";
// HTTP → proxy (same-origin, no CORS). WS → direct via window.location.hostname.
const getAiWsHost = () =>
  typeof window !== "undefined" ? `${window.location.hostname}:${AI_PORT}` : `localhost:${AI_PORT}`;

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 5000,
): Promise<Response | null> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch {
    clearTimeout(id);
    return null;
  }
};

// ── RTSP Stream Player ─────────────────────────────────────────────────────────

function RtspStreamPlayer({ cameraId, name }: { cameraId: string; name: string }) {
  const [isLive, setIsLive] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiWsHost = getAiWsHost();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetchWithTimeout(`/api/ai-proxy/api/stream/status`);
        if (res?.ok) {
          const data = await res.json();
          const cam = data?.cameras?.[cameraId];
          if (cam) setIsStreaming(cam.is_streaming);
        }
      } catch { /* ignore */ }
    };
    fetchStatus();
  }, [cameraId]);

  useEffect(() => {
    destroyedRef.current = false;

    const connect = () => {
      if (destroyedRef.current) return;
      const ws = new WebSocket(`ws://${aiWsHost}/ws/stream`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "frame" && data.camera_id === cameraId) {
            const bmp = new Image();
            bmp.onload = () => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              canvas.width = bmp.naturalWidth;
              canvas.height = bmp.naturalHeight;
              canvas.getContext("2d")?.drawImage(bmp, 0, 0);
              setIsLive(true);
            };
            bmp.src = `data:image/jpeg;base64,${data.frame}`;
          }
          if (data.event === "stream_status" && data.camera_id === cameraId && data.status === "offline") {
            setIsLive(false);
            setIsStreaming(false);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (destroyedRef.current) return;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [aiWsHost, cameraId]);

  return (
    <div className="relative w-full aspect-video bg-gray-950 rounded-t-2xl overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{ display: isLive ? "block" : "none", maxWidth: "100%", maxHeight: "100%" }}
      />

      {!isLive && (
        <div className="flex flex-col items-center gap-2 text-white/25">
          <VideoOff className="h-9 w-9" />
          <p className="text-[11px] font-medium">
            {isStreaming ? "Waiting for frame..." : "No signal"}
          </p>
        </div>
      )}

      {isStreaming && !isLive && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <RefreshCw className="h-4 w-4 text-white/60 animate-spin" />
          <span className="text-[10px] text-white/50">Connecting...</span>
        </div>
      )}

      {/* LIVE badge */}
      <div className="absolute top-2.5 left-2.5 z-10">
        {isLive ? (
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white bg-red-600/90">
            <Circle className="h-1.5 w-1.5 fill-white animate-pulse" />
            LIVE
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white/60 bg-white/10">
            IDLE
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CctvPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState<RtspCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cameraToDelete, setCameraToDelete] = useState<RtspCamera | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", ipAddress: "", port: "554", channel: "", username: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cctv`);
      if (res.ok) {
        const data = await res.json();
        setCameras(Array.isArray(data?.data) ? data.data : []);
      } else {
        setCameras([]);
      }
    } catch {
      showToast.error("Network error", "Could not load cameras");
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cameras.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.ipAddress.trim() || !formData.port.trim()) {
      showToast.error("Validation error", "Name, IP Address, and Port are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cctv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          ipAddress: formData.ipAddress.trim(),
          port: Number(formData.port),
          channel: formData.channel.trim() || null,
          username: formData.username.trim() || null,
          password: formData.password.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add camera");
      showToast.success("Camera added");
      setAddOpen(false);
      setFormData({ name: "", ipAddress: "", port: "554", channel: "", username: "", password: "" });
      load();
    } catch (e: any) {
      showToast.error("Failed to add camera", e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!cameraToDelete) return;
    const cam = cameraToDelete;
    setCameraToDelete(null);
    try {
      const res = await fetch(`/api/cctv/${cam.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete camera");
      showToast.success(`Camera "${cam.name}" deleted`);
      load();
    } catch (e: any) {
      showToast.error("Failed to delete camera", e.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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
            CCTV Surveillance
          </h1>
        </div>
        <div className="flex gap-2 mt-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            disabled={loading}
            className="border-gray-200 bg-white dark:bg-card dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="shadow-sm font-semibold"
            style={{ background: `linear-gradient(135deg, ${TOKEN.navy} 0%, #3d4a72 100%)` }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Camera
          </Button>
        </div>
      </div>

      <div className="px-6 space-y-5 pb-10">

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", count: cameras.length, color: TOKEN.navy },
            { label: "Configured", count: cameras.length, color: TOKEN.teal },
            { label: "No AI Service", count: 0, color: "#EF4444" },
          ].map(({ label, count, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm px-5 py-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                {label}
              </p>
              {loading ? (
                <Skeleton className="h-11 w-10 mt-1" />
              ) : (
                <p className="text-[44px] font-extrabold leading-none" style={{ color }}>
                  {count}
                </p>
              )}
              <div
                className="mt-3 h-[3px] rounded-full w-10"
                style={{ backgroundColor: color, opacity: 0.25 }}
              />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search cameras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white dark:bg-card border-gray-200 dark:border-border text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-xl shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-[12px] text-gray-400 dark:text-gray-500 ml-1">
            {filtered.length} camera{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Camera grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border overflow-hidden">
                <Skeleton className="w-full aspect-video rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Camera className="h-7 w-7 text-gray-300 dark:text-gray-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-500 dark:text-gray-400">
                {search ? "No cameras match your search" : "No cameras configured"}
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                {search ? "Try a different name" : "Add your first RTSP camera to get started"}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                onClick={() => setAddOpen(true)}
                className="mt-1 font-semibold"
                style={{ background: `linear-gradient(135deg, ${TOKEN.navy} 0%, #3d4a72 100%)` }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Camera
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((camera) => (
                <div
                  key={camera.id}
                  className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm overflow-hidden flex flex-col"
                >
                  <RtspStreamPlayer cameraId={camera.id} name={camera.name} />

                  {/* Info bar */}
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[14px] text-gray-900 dark:text-white truncate">
                          {camera.name}
                        </p>
                        <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {camera.ipAddress}:{camera.port}{camera.channel ? `/${camera.channel}` : ""}
                        </p>
                      </div>
                      <div
                        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                        style={{ backgroundColor: TOKEN.teal + "18", color: TOKEN.teal, border: `1px solid ${TOKEN.teal}44` }}
                      >
                        <Circle className="h-2 w-2 fill-current" />
                        Configured
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[11px] gap-1 border-gray-200 dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() =>
                          router.push(`/security/surveillance-cctv/manage-zone`)
                        }
                      >
                        <Map className="h-3 w-3" />
                        Manage Zone
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 border-gray-200 dark:border-border text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 dark:border-border"
                        onClick={() => setCameraToDelete(camera)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Camera Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-gray-900 dark:text-white">
              Add RTSP Camera
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Configure a new RTSP camera for real-time monitoring.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">
                Camera Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Lobby Camera"
                className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <div className="space-y-1.5 flex-1">
                <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">
                  IP Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="192.168.1.x"
                  className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5 w-24">
                <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">
                  Port <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="554"
                  className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white font-mono text-[13px]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="space-y-1.5 flex-1">
                <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">Username</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin"
                  className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••"
                  className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">Channel / Stream path</Label>
              <Input
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                placeholder="e.g. stream1 or ch01"
                className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white font-mono text-[13px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setAddOpen(false); setFormData({ name: "", ipAddress: "", port: "554", channel: "", username: "", password: "" }); }}
              className="border-gray-200 dark:border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isSubmitting}
              className="font-semibold"
              style={{ background: `linear-gradient(135deg, ${TOKEN.navy} 0%, #3d4a72 100%)` }}
            >
              {isSubmitting ? "Adding..." : "Add Camera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!cameraToDelete}
        onOpenChange={(open) => { if (!open) setCameraToDelete(null); }}
        type="destructive"
        title="Delete Camera"
        description={`Remove "${cameraToDelete?.name}"? This cannot be undone.`}
        confirmText="Delete Camera"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setCameraToDelete(null)}
      />
    </div>
  );
}
