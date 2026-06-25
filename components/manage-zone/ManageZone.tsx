"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Camera,
  RefreshCw,
  X,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Map,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiCamera {
  id: string;
  camera_name: string;
  rtsp_url: string;
}

interface Zone {
  id: string;
  name: string;
  points: [number, number][];
  color: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOSE_RADIUS = 10;
const PRESET_COLORS = [
  "#3b82f6",
  "#32AEAC",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#FA9464",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNorm(px: number, py: number, canvas: HTMLCanvasElement): [number, number] {
  if (canvas.width === 0 || canvas.height === 0) return [0, 0];
  return [px / canvas.width, py / canvas.height];
}

function toPx(nx: number, ny: number, canvas: HTMLCanvasElement): [number, number] {
  return [nx * canvas.width, ny * canvas.height];
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  normPts: [number, number][],
  color: string,
  closed: boolean,
  canvas: HTMLCanvasElement,
) {
  if (!normPts || normPts.length === 0) return;
  ctx.save();
  ctx.beginPath();
  const [x0, y0] = toPx(...normPts[0], canvas);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < normPts.length; i++) {
    const [xi, yi] = toPx(...normPts[i], canvas);
    ctx.lineTo(xi, yi);
  }
  if (closed) ctx.closePath();
  ctx.fillStyle = color + "26";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  for (const [nx, ny] of normPts) {
    const [px, py] = toPx(nx, ny, canvas);
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  normPts: [number, number][],
  name: string,
  canvas: HTMLCanvasElement,
) {
  if (!normPts || normPts.length === 0) return;
  const cx = normPts.reduce((s, p) => s + p[0], 0) / normPts.length;
  const cy = normPts.reduce((s, p) => s + p[1], 0) / normPts.length;
  const [px, py] = toPx(cx, cy, canvas);
  ctx.save();
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#fff";
  ctx.fillText(name, px, py);
  ctx.restore();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ManageZoneProps {
  cameraId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ManageZone: React.FC<ManageZoneProps> = ({ cameraId: initialCameraId }) => {
  const fixedCamera = !!initialCameraId;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [cameras, setCameras] = useState<AiCamera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<AiCamera | null>(null);
  const [aiServiceError, setAiServiceError] = useState(false);

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");

  const [zones, setZones] = useState<Zone[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPointsRef = useRef<[number, number][]>([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hoveredFirstPtRef = useRef(false);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const pendingPointsRef = useRef<[number, number][] | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneColor, setNewZoneColor] = useState("#3b82f6");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);

  // ── Canvas ────────────────────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const z of zones) {
      if (z.points.length < 3) continue;
      drawPolygon(ctx, z.points, z.color, true, canvas);
      drawLabel(ctx, z.points, z.name, canvas);
    }

    const pts = drawingPointsRef.current;
    if (pts.length > 0) {
      drawPolygon(ctx, pts, "#f59e0b", false, canvas);

      const [lx, ly] = toPx(...pts[pts.length - 1], canvas);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
      ctx.stroke();
      ctx.restore();

      if (hoveredFirstPtRef.current && pts.length >= 3) {
        const [fx, fy] = toPx(...pts[0], canvas);
        ctx.save();
        ctx.beginPath();
        ctx.arc(fx, fy, CLOSE_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [zones]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth || 1;
    canvas.height = canvas.clientHeight || 1;
    redrawCanvas();
  }, [redrawCanvas]);

  // ── API helpers ───────────────────────────────────────────────────────────

  async function fetchZones(camId: string) {
    try {
      const res = await fetch(`/api/ai-proxy/api/cameras/${camId}/zones`);
      if (res.ok) {
        const data = await res.json();
        setZones(Array.isArray(data) ? data : []);
      } else {
        setZones([]);
      }
    } catch {
      setZones([]);
    }
  }

  async function fetchSnapshot(camId: string) {
    setSnapshotLoading(true);
    setSnapshotError("");
    setSnapshotUrl(null);
    await new Promise((r) => setTimeout(r, 50));
    setSnapshotUrl(`/api/ai-proxy/api/cameras/${camId}/snapshot?t=${Date.now()}`);
    setSnapshotLoading(false);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (fixedCamera) {
      // cameraId from DB passed; zones + snapshot via AI proxy using same ID
      fetchZones(initialCameraId!);
      fetchSnapshot(initialCameraId!);
    } else {
      fetch("/api/ai-proxy/api/cameras")
        .then((r) => {
          if (!r.ok) throw new Error("unreachable");
          return r.json();
        })
        .then((data) => {
          const list: AiCamera[] = data.cameras ?? [];
          setCameras(list);
        })
        .catch(() => {
          setCameras([]);
          setAiServiceError(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraId]);

  useEffect(() => {
    const obs = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [zones, redrawCanvas]);

  // ── Camera selection ──────────────────────────────────────────────────────

  async function selectCamera(cam: AiCamera) {
    if (selectedCamera?.id === cam.id) return;
    cancelDraw();
    setSelectedCamera(cam);
    setZones([]);
    setSnapshotUrl(null);
    setSnapshotError("");
    await Promise.all([fetchZones(cam.id), fetchSnapshot(cam.id)]);
  }

  async function refreshSnapshot() {
    const camId = fixedCamera ? initialCameraId! : selectedCamera?.id;
    if (!camId) return;
    await fetchSnapshot(camId);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  function startDraw() {
    const camId = fixedCamera ? initialCameraId : selectedCamera?.id;
    if (!camId) return;
    drawingPointsRef.current = [];
    hoveredFirstPtRef.current = false;
    setIsDrawing(true);
  }

  function cancelDraw() {
    drawingPointsRef.current = [];
    hoveredFirstPtRef.current = false;
    setIsDrawing(false);
    redrawCanvas();
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const pts = drawingPointsRef.current;
    if (pts.length >= 3) {
      const [fx, fy] = toPx(...pts[0], canvas);
      if (Math.hypot(px - fx, py - fy) < CLOSE_RADIUS) {
        finishPolygon();
        return;
      }
    }
    drawingPointsRef.current = [...pts, toNorm(px, py, canvas)];
    redrawCanvas();
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (!isDrawing) return;
    const pts = drawingPointsRef.current;
    if (pts.length >= 3) {
      const [fx, fy] = toPx(...pts[0], canvas);
      hoveredFirstPtRef.current =
        Math.hypot(mousePosRef.current.x - fx, mousePosRef.current.y - fy) < CLOSE_RADIUS;
    } else {
      hoveredFirstPtRef.current = false;
    }
    redrawCanvas();
  }

  function onCanvasMouseLeave() {
    hoveredFirstPtRef.current = false;
    if (isDrawing) redrawCanvas();
  }

  function onCanvasDoubleClick() {
    if (!isDrawing || drawingPointsRef.current.length < 3) return;
    drawingPointsRef.current = drawingPointsRef.current.slice(0, -1);
    if (drawingPointsRef.current.length >= 3) finishPolygon();
  }

  function finishPolygon() {
    if (drawingPointsRef.current.length < 3) return;
    pendingPointsRef.current = [...drawingPointsRef.current];
    drawingPointsRef.current = [];
    hoveredFirstPtRef.current = false;
    setIsDrawing(false);
    setNewZoneName("");
    setNewZoneColor("#3b82f6");
    setModalError("");
    setNameModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
    redrawCanvas();
  }

  // ── Zone save ─────────────────────────────────────────────────────────────

  async function saveZone() {
    setModalError("");
    if (!newZoneName.trim()) {
      setModalError("Zone name is required.");
      return;
    }
    const camId = fixedCamera ? initialCameraId! : selectedCamera?.id;
    if (!camId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-proxy/api/cameras/${camId}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newZoneName.trim(),
          points: pendingPointsRef.current,
          color: newZoneColor,
        }),
      });
      if (!res.ok) throw new Error("Failed to save zone");
      const data: Zone = await res.json();
      setZones((prev) => [...prev, data]);
      setNameModalOpen(false);
      pendingPointsRef.current = null;
    } catch (e: any) {
      setModalError(e.message ?? "Failed to save zone.");
    } finally {
      setSaving(false);
    }
  }

  function cancelNameModal() {
    setNameModalOpen(false);
    pendingPointsRef.current = null;
    redrawCanvas();
  }

  // ── Zone delete ───────────────────────────────────────────────────────────

  async function doDelete() {
    if (!deleteTarget) return;
    const camId = fixedCamera ? initialCameraId! : selectedCamera?.id;
    if (!camId) return;
    setSaving(true);
    try {
      await fetch(`/api/ai-proxy/api/cameras/${camId}/zones/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setZones((prev) => prev.filter((z) => z.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasCamera = fixedCamera || !!selectedCamera;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 items-start" style={{ fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif" }}>

      {/* Left: canvas editor */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Editor header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-gray-900 dark:text-white leading-snug">
              {selectedCamera ? selectedCamera.camera_name : "Zone Editor"}
            </span>
            {hasCamera && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {zones.length} zone{zones.length !== 1 ? "s" : ""} configured
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDrawing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={cancelDraw}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-400/10 h-8 text-[12.5px]"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            ) : hasCamera ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refreshSnapshot}
                  className="border-gray-200 dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 h-8 text-[12.5px]"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={startDraw}
                  className="h-8 text-[12.5px] font-semibold shadow-sm"
                  style={{ background: "linear-gradient(135deg, #2D3250 0%, #3d4a72 100%)" }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Draw Zone
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="relative w-full bg-gray-950 dark:bg-gray-950 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800"
          style={{ aspectRatio: "16 / 9" }}
        >
          {snapshotUrl && (
            <img
              ref={imgRef}
              src={snapshotUrl}
              className="w-full h-full object-contain block select-none pointer-events-none"
              draggable={false}
              onLoad={resizeCanvas}
              onError={() => setSnapshotError("Failed to load snapshot")}
              alt=""
            />
          )}
          {!snapshotUrl && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                {snapshotLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-gray-600 animate-spin" />
                    <span className="text-[13px] text-gray-500">Loading snapshot...</span>
                  </>
                ) : snapshotError ? (
                  <>
                    <AlertCircle className="h-8 w-8 text-red-500/40" />
                    <span className="text-[13px] text-red-400">{snapshotError}</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-10 w-10 text-gray-700" />
                    <span className="text-[13px] text-gray-500">
                      {aiServiceError ? "AI service not running" : !hasCamera ? "Select a camera to begin" : "No snapshot available"}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: isDrawing ? "crosshair" : "default" }}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMouseMove}
            onMouseLeave={onCanvasMouseLeave}
            onDoubleClick={onCanvasDoubleClick}
            onContextMenu={(e) => { e.preventDefault(); cancelDraw(); }}
          />
          {isDrawing && (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b", color: "#f59e0b", letterSpacing: "0.04em" }}>
              <Pencil className="h-3 w-3" />
              Drawing Mode
            </div>
          )}
        </div>

        {/* Drawing hint */}
        <p className="text-[12px] text-gray-400 dark:text-gray-500 px-0.5">
          {isDrawing ? (
            <span style={{ color: "#f59e0b" }}>
              Click to add points · Click first point or double-click to close · Right-click or ESC to cancel
            </span>
          ) : hasCamera ? (
            <>Click <strong className="text-gray-600 dark:text-gray-300">Draw Zone</strong> then click on the image to mark polygon zones.</>
          ) : (
            "Select a camera from the list to start editing zones."
          )}
        </p>
      </div>

      {/* Right: sidebar */}
      <div className="w-56 shrink-0 flex flex-col gap-4">

        {/* Camera list — only when not fixed */}
        {!fixedCamera && (
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-4 flex flex-col gap-1.5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
              Cameras
            </p>
            {aiServiceError ? (
              <div className="flex flex-col gap-1.5 py-2">
                <div className="flex items-center gap-1.5 text-red-500">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12px] font-medium">AI service offline</span>
                </div>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                  Zone management requires the AI service running on port {process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567"}.
                </span>
              </div>
            ) : cameras.length === 0 ? (
              <span className="text-[12px] text-gray-400 dark:text-gray-500 py-1">No cameras configured.</span>
            ) : cameras.map((cam) => (
              <button
                key={cam.id}
                onClick={() => selectCamera(cam)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-left transition-colors ${
                  selectedCamera?.id === cam.id
                    ? "text-white font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                style={selectedCamera?.id === cam.id ? { background: "linear-gradient(135deg, #2D3250 0%, #3d4a72 100%)" } : {}}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: selectedCamera?.id === cam.id ? "#93c5fd" : "#94a3b8" }}
                />
                <span className="truncate">{cam.camera_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Zone list */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
              Zones
            </p>
            {zones.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {zones.length}
              </span>
            )}
          </div>

          {!hasCamera ? (
            <span className="text-[12px] text-gray-400 dark:text-gray-500 py-1">Select a camera first.</span>
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Map className="h-6 w-6 text-gray-300 dark:text-gray-600" />
              <span className="text-[12px] text-gray-400 dark:text-gray-500">No zones yet.</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-600 text-center">Click "Draw Zone" to start</span>
            </div>
          ) : zones.map((z) => (
            <div key={z.id} className="flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: z.color }}
              />
              <span className="flex-1 text-[13px] text-gray-700 dark:text-gray-300 truncate">{z.name}</span>
              <button
                onClick={() => setDeleteTarget(z)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded"
                title="Delete zone"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Name zone dialog */}
      <Dialog open={nameModalOpen} onOpenChange={(open) => { if (!open) cancelNameModal(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-gray-900 dark:text-white">
              Name this zone
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Give this detection zone a name and choose a color.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">
                Zone name <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={nameInputRef}
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="e.g. Seat A, Entry Door"
                maxLength={40}
                className="h-10 rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card text-gray-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveZone();
                  if (e.key === "Escape") cancelNameModal();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-gray-600 dark:text-gray-400">
                Color
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewZoneColor(c)}
                    className="w-6 h-6 rounded-md transition-all"
                    style={{
                      background: c,
                      border: newZoneColor === c ? "2px solid white" : "2px solid transparent",
                      boxShadow: newZoneColor === c ? `0 0 0 2px ${c}` : "none",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={newZoneColor}
                  onChange={(e) => setNewZoneColor(e.target.value)}
                  className="w-7 h-7 rounded-md border-0 cursor-pointer bg-transparent p-0"
                  title="Custom color"
                />
              </div>
            </div>

            {modalError && (
              <p className="text-[12px] text-red-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {modalError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelNameModal} className="border-gray-200 dark:border-border">
              Cancel
            </Button>
            <Button
              onClick={saveZone}
              disabled={saving}
              className="font-semibold"
              style={{ background: "linear-gradient(135deg, #2D3250 0%, #3d4a72 100%)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {saving ? "Saving..." : "Save Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-gray-900 dark:text-white">
              Delete Zone
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Delete zone <strong className="text-gray-700 dark:text-gray-300">"{deleteTarget?.name}"</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-gray-200 dark:border-border">
              Cancel
            </Button>
            <Button
              onClick={doDelete}
              disabled={saving}
              variant="destructive"
              className="font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageZone;
