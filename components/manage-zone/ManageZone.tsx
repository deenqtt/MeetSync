/**
 * ManageZone.tsx
 * Zone editor component for Dashboard Production (NexaBrick-WebApps).
 *
 * Usage:
 *   <ManageZone apiBase="http://192.168.2.132:8567" />
 *
 * Dependencies: react, axios
 * No other external dependencies required.
 *
 * API endpoints used:
 *   GET  /api/cameras                                 — list cameras
 *   GET  /api/cameras/{id}/snapshot                   — camera JPEG snapshot
 *   GET  /api/cameras/{id}/zones                      — list zones
 *   POST /api/cameras/{id}/zones                      — create zone
 *   PUT  /api/cameras/{id}/zones/{zone_id}            — update zone (optional)
 *   DELETE /api/cameras/{id}/zones/{zone_id}          — delete zone
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Camera {
  id: string;
  camera_name: string;
  rtsp_url: string;
}

interface Zone {
  id: string;
  name: string;
  points: [number, number][]; // normalized 0.0–1.0
  color: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOSE_RADIUS = 10; // px to snap-close polygon
const PRESET_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
];

// ── Helper: normalize canvas coords ──────────────────────────────────────────

function toNorm(
  px: number,
  py: number,
  canvas: HTMLCanvasElement,
): [number, number] {
  if (canvas.width === 0 || canvas.height === 0) return [0, 0];
  return [px / canvas.width, py / canvas.height];
}

function toPx(
  nx: number,
  ny: number,
  canvas: HTMLCanvasElement,
): [number, number] {
  return [nx * canvas.width, ny * canvas.height];
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface ManageZoneProps {
  /** Base URL of backend-integration-api, e.g. "http://192.168.2.132:8567" */
  apiBase?: string;
  /** If provided, skip camera selector and auto-select this camera */
  cameraId?: string;
}

const ManageZone: React.FC<ManageZoneProps> = ({ apiBase = "", cameraId: initialCameraId }) => {
  const api = axios.create({ baseURL: apiBase });
  const fixedCamera = !!initialCameraId; // true = camera sudah ditentukan, sembunyikan selector

  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Camera list
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  // Snapshot
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");

  // Zones
  const [zones, setZones] = useState<Zone[]>([]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPointsRef = useRef<[number, number][]>([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const hoveredFirstPtRef = useRef(false);

  // Name modal
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const pendingPointsRef = useRef<[number, number][] | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneColor, setNewZoneColor] = useState("#3b82f6");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);

  // ── Canvas redraw ───────────────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Committed zones
    for (const z of zones) {
      if (z.points.length < 3) continue;
      drawPolygon(ctx, z.points, z.color, true, canvas);
      drawLabel(ctx, z.points, z.name, canvas);
    }

    // In-progress polygon
    const pts = drawingPointsRef.current;
    if (pts.length > 0) {
      drawPolygon(ctx, pts, "#f59e0b", false, canvas);

      // Ghost segment to cursor
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

      // Snap ring on first point
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

  // ── Resize canvas to match container ───────────────────────────────────────

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth || 1;
    canvas.height = canvas.clientHeight || 1;
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Fetch cameras ───────────────────────────────────────────────────────────

  useEffect(() => {
    api
      .get<{ cameras: Camera[] }>("/api/cameras")
      .then(({ data }) => {
        const list = data.cameras ?? [];
        setCameras(list);
        // Auto-select jika cameraId sudah ditentukan dari luar
        if (initialCameraId) {
          const cam = list.find((c) => c.id === initialCameraId);
          if (cam) {
            setSelectedCamera(cam);
            fetchZones(cam.id);
            fetchSnapshot(cam.id);
          }
        }
      })
      .catch(() => setCameras([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraId]);

  // ── ResizeObserver ──────────────────────────────────────────────────────────

  useEffect(() => {
    const obs = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [resizeCanvas]);

  // ── Keyboard ESC ───────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Redraw when zones change ────────────────────────────────────────────────

  useEffect(() => {
    redrawCanvas();
  }, [zones, redrawCanvas]);

  // ── Camera selection ────────────────────────────────────────────────────────

  async function selectCamera(cam: Camera) {
    if (selectedCamera?.id === cam.id) return;
    cancelDraw();
    setSelectedCamera(cam);
    setZones([]);
    setSnapshotUrl(null);
    setSnapshotError("");
    await Promise.all([fetchZones(cam.id), fetchSnapshot(cam.id)]);
  }

  async function fetchZones(cameraId: string) {
    try {
      const { data } = await api.get<Zone[]>(`/api/cameras/${cameraId}/zones`);
      setZones(data);
    } catch {
      setZones([]);
    }
  }

  async function fetchSnapshot(cameraId: string) {
    setSnapshotLoading(true);
    setSnapshotError("");
    setSnapshotUrl(null);
    // Small delay so loading state renders before URL set
    await new Promise((r) => setTimeout(r, 50));
    setSnapshotUrl(
      `${apiBase}/api/cameras/${cameraId}/snapshot?t=${Date.now()}`,
    );
    setSnapshotLoading(false);
  }

  async function refreshSnapshot() {
    if (!selectedCamera) return;
    await fetchSnapshot(selectedCamera.id);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  function startDraw() {
    if (!selectedCamera) return;
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
        Math.hypot(mousePosRef.current.x - fx, mousePosRef.current.y - fy) <
        CLOSE_RADIUS;
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
    // Browser fires click before dblclick — remove the duplicate last point
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

  // ── Zone save ────────────────────────────────────────────────────────────────

  async function saveZone() {
    setModalError("");
    if (!newZoneName.trim()) {
      setModalError("Zone name is required.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<Zone>(
        `/api/cameras/${selectedCamera!.id}/zones`,
        {
          name: newZoneName.trim(),
          points: pendingPointsRef.current,
          color: newZoneColor,
        },
      );
      setZones((prev) => [...prev, data]);
      setNameModalOpen(false);
      pendingPointsRef.current = null;
    } catch (e: any) {
      setModalError(e?.response?.data?.detail ?? "Failed to save zone.");
    } finally {
      setSaving(false);
    }
  }

  function cancelNameModal() {
    setNameModalOpen(false);
    pendingPointsRef.current = null;
    redrawCanvas();
  }

  // ── Zone delete ──────────────────────────────────────────────────────────────

  async function doDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(
        `/api/cameras/${selectedCamera!.id}/zones/${deleteTarget.id}`,
      );
      setZones((prev) => prev.filter((z) => z.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* ── Left: canvas editor ─── */}
      <div style={styles.editorPanel}>
        {/* Header editor */}
        <div style={styles.editorHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={styles.editorTitle}>
              {selectedCamera ? selectedCamera.camera_name : "Zone Editor"}
            </span>
            {selectedCamera && (
              <span style={styles.editorSubtitle}>
                {zones.length} zone{zones.length !== 1 ? "s" : ""} configured
              </span>
            )}
          </div>
          <div style={styles.editorActions}>
            {isDrawing ? (
              <button style={styles.btnDanger} onClick={cancelDraw}>
                ✕ Cancel
              </button>
            ) : selectedCamera ? (
              <>
                <button style={styles.btnGhost} onClick={refreshSnapshot}>
                  ↺ Refresh
                </button>
                <button style={styles.btnPrimary} onClick={startDraw}>
                  + Draw Zone
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} style={styles.canvasWrap}>
          {snapshotUrl && (
            <img
              ref={imgRef}
              src={snapshotUrl}
              style={styles.snapshotImg}
              draggable={false}
              onLoad={resizeCanvas}
              onError={() => setSnapshotError("Failed to load snapshot")}
              alt=""
            />
          )}
          {!snapshotUrl && (
            <div style={styles.canvasPlaceholder}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 32, opacity: 0.3 }}>📷</span>
                <span style={styles.placeholderText}>
                  {snapshotLoading
                    ? "Loading snapshot…"
                    : !selectedCamera
                      ? "Select a camera to begin"
                      : snapshotError
                        ? snapshotError
                        : "No snapshot available"}
                </span>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{
              ...styles.zoneCanvas,
              cursor: isDrawing ? "crosshair" : "default",
            }}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMouseMove}
            onMouseLeave={onCanvasMouseLeave}
            onDoubleClick={onCanvasDoubleClick}
            onContextMenu={(e) => {
              e.preventDefault();
              cancelDraw();
            }}
          />
          {/* Drawing mode overlay badge */}
          {isDrawing && (
            <div style={styles.drawingBadge}>
              ✏️ Drawing Mode
            </div>
          )}
        </div>

        {/* Drawing hint */}
        <div style={styles.drawHint}>
          {isDrawing ? (
            <span style={styles.hintActive}>
              Click to add points · Click first point or double-click to close · Right-click or ESC to cancel
            </span>
          ) : selectedCamera ? (
            <span>
              Click <strong style={{ color: "#94a3b8" }}>Draw Zone</strong> then click on the image to mark polygon zones.
            </span>
          ) : (
            <span>Select a camera from the list to start editing zones.</span>
          )}
        </div>
      </div>

      {/* ── Right: sidebar ─── */}
      <div style={styles.sidebarPanel}>
        {/* Camera list — hanya tampil kalau tidak di-fix dari luar */}
        {!fixedCamera && (
          <div style={styles.sidebarSection}>
            <div style={styles.sectionLabel}>Cameras</div>
            {cameras.length === 0 && (
              <span style={styles.emptyText}>No cameras configured.</span>
            )}
            {cameras.map((cam) => (
              <button
                key={cam.id}
                style={{
                  ...styles.camItem,
                  ...(selectedCamera?.id === cam.id ? styles.camItemActive : {}),
                }}
                onClick={() => selectCamera(cam)}
              >
                <span
                  style={{
                    ...styles.camDot,
                    ...(selectedCamera?.id === cam.id ? styles.camDotActive : {}),
                  }}
                />
                <span style={styles.camName}>{cam.camera_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Zone list */}
        <div style={styles.sidebarSection}>
          <div style={styles.sectionLabel}>
            Zones <span style={styles.zoneCount}>{zones.length}</span>
          </div>
          {!selectedCamera ? (
            <span style={styles.emptyText}>Select a camera first.</span>
          ) : zones.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0" }}>
              <span style={{ fontSize: 24, opacity: 0.3 }}>🗺️</span>
              <span style={styles.emptyText}>No zones yet.</span>
              <span style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
                Click "Draw Zone" to start
              </span>
            </div>
          ) : (
            zones.map((z) => (
              <div key={z.id} style={styles.zoneItem}>
                <span style={{ ...styles.zoneSwatch, background: z.color }} />
                <span style={styles.zoneNameText}>{z.name}</span>
                <button
                  style={styles.zoneDel}
                  onClick={() => setDeleteTarget(z)}
                  title="Delete zone"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Name zone modal ─── */}
      {nameModalOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelNameModal();
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Name this zone</div>
            <div style={styles.modalBody}>
              <label style={styles.fieldLabel}>Zone name</label>
              <input
                ref={nameInputRef}
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                style={styles.fieldInput}
                placeholder="e.g. Seat A"
                maxLength={40}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveZone();
                  if (e.key === "Escape") cancelNameModal();
                }}
              />
              <label style={{ ...styles.fieldLabel, marginTop: 12 }}>
                Color
              </label>
              <div style={styles.colorRow}>
                {PRESET_COLORS.map((c) => (
                  <span
                    key={c}
                    style={{
                      ...styles.colorChip,
                      background: c,
                      borderColor: newZoneColor === c ? "#fff" : "transparent",
                    }}
                    onClick={() => setNewZoneColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={newZoneColor}
                  onChange={(e) => setNewZoneColor(e.target.value)}
                  style={styles.colorPicker}
                  title="Custom color"
                />
              </div>
              {modalError && <div style={styles.modalError}>{modalError}</div>}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnGhost} onClick={cancelNameModal}>
                Cancel
              </button>
              <button
                style={{ ...styles.btnPrimary, opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onClick={saveZone}
              >
                {saving ? "Saving…" : "Save Zone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ─── */}
      {deleteTarget && (
        <div
          style={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Delete Zone</div>
            <div style={styles.modalBody}>
              Delete zone <strong>"{deleteTarget.name}"</strong>? This cannot be
              undone.
            </div>
            <div style={styles.modalFooter}>
              <button
                style={styles.btnGhost}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.btnDanger, opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onClick={doDelete}
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Inline styles (matches ManageZone.vue design) ────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
    fontFamily: "system-ui, sans-serif",
    color: "#f1f5f9",
  },
  editorPanel: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  editorHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editorTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#f1f5f9",
    lineHeight: 1.3,
  },
  editorSubtitle: {
    fontSize: 11,
    color: "#475569",
    fontWeight: 400,
  },
  drawingBadge: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    background: "rgba(245, 158, 11, 0.15)",
    border: "1px solid #f59e0b",
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 20,
    letterSpacing: "0.04em",
  },
  editorActions: {
    display: "flex",
    gap: 8,
  },
  canvasWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#0f172a",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #334155",
  },
  snapshotImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    userSelect: "none",
    pointerEvents: "none",
  },
  canvasPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 13,
    color: "#475569",
  },
  zoneCanvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  drawHint: {
    fontSize: 12,
    color: "#64748b",
    padding: "2px 0",
  },
  hintActive: {
    color: "#f59e0b",
  },
  sidebarPanel: {
    width: 220,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  sidebarSection: {
    background: "#1e293b",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#64748b",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  zoneCount: {
    background: "#334155",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
    padding: "1px 6px",
  },
  emptyText: {
    fontSize: 12,
    color: "#475569",
    padding: "4px 0",
  },
  camItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 13,
    color: "#94a3b8",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  camItemActive: {
    background: "#1d4ed8",
    color: "#fff",
  },
  camDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#475569",
    flexShrink: 0,
  },
  camDotActive: {
    background: "#93c5fd",
  },
  camName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  zoneItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 4px",
    borderRadius: 5,
  },
  zoneSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
  },
  zoneNameText: {
    flex: 1,
    fontSize: 13,
    color: "#cbd5e1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  zoneDel: {
    background: "transparent",
    border: "none",
    color: "#475569",
    fontSize: 11,
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: 4,
    lineHeight: 1,
  },
  btnPrimary: {
    padding: "7px 14px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "7px 14px",
    background: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "7px 14px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    width: 340,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  modalBody: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "#94a3b8",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
    display: "block",
    marginBottom: 4,
  },
  fieldInput: {
    width: "100%",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 7,
    padding: "8px 10px",
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  colorChip: {
    width: 22,
    height: 22,
    borderRadius: 5,
    cursor: "pointer",
    border: "2px solid transparent",
    display: "inline-block",
  },
  colorPicker: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 5,
    padding: 0,
    cursor: "pointer",
    background: "transparent",
  },
  modalError: {
    fontSize: 12,
    color: "#f87171",
    marginTop: 4,
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
};

export default ManageZone;
