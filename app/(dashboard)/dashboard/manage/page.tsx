"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import GridLayout, {
  type Layout,
  type LayoutItem,
  verticalCompactor,
} from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast-utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Settings2,
  CalendarClock,
  Home,
  Save,
  LayoutDashboard,
  GripHorizontal,
} from "lucide-react";
import {
  type DashboardType,
  type DashboardWidgetItem,
  type WidgetMeta,
  WIDGET_REGISTRY,
} from "@/lib/widget-registry";
import { WidgetConfigModal } from "@/components/widgets/WidgetConfigModal";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";

const TOKEN = { navy: "#2D3250", teal: "#32AEAC", orange: "#FA9464" } as const;
const ROW_HEIGHT = 80;
const COLS = 12;
const MARGIN = [12, 12] as readonly [number, number];
const PADDING = [0, 0] as readonly [number, number];

const TABS: { type: DashboardType; label: string; icon: React.ElementType }[] = [
  { type: "meetings", label: "Meetings", icon: CalendarClock },
  { type: "home-assistant", label: "Home Assistant", icon: Home },
];

function toGridLayout(items: DashboardWidgetItem[]): LayoutItem[] {
  return items.map((w) => ({
    i: w.id,
    x: w.x ?? 0,
    y: w.y ?? 0,
    w: w.w ?? 4,
    h: w.h ?? 4,
    minW: 2,
    minH: 2,
  }));
}

export default function ManageDashboardPage() {
  const router = useRouter();

  // ref on ALWAYS-RENDERED right panel — so ResizeObserver always attaches
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // Skip first onLayoutChange fired by GridLayout on mount (not a real user action)
  const skipLayoutChange = useRef(false);

  const [activeTab, setActiveTab] = useState<DashboardType>("meetings");
  const [layout, setLayout] = useState<DashboardWidgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [configItem, setConfigItem] = useState<DashboardWidgetItem | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // Observe the canvas panel width (always mounted)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    // Set initial width
    setContainerWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const fetchLayout = useCallback(async (type: DashboardType) => {
    setLoading(true);
    setDirty(false);
    try {
      const res = await fetch(`/api/dashboard?type=${type}`);
      const json = await res.json();
      const raw: any[] = json.success ? (json.layout ?? []) : [];
      setLayout(raw.filter((w) => w.id && w.widgetType));
      skipLayoutChange.current = true; // next GridLayout onLayoutChange = initial render, skip it
    } catch {
      setLayout([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayout(activeTab);
  }, [activeTab, fetchLayout]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard?type=${activeTab}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const json = await res.json();
      if (json.success) {
        showToast.success("Dashboard saved");
        setDirty(false);
      } else {
        showToast.error("Save failed", json.error);
      }
    } catch {
      showToast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addWidget = (meta: WidgetMeta) => {
    setLayout((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        widgetType: meta.type,
        x: 0,
        y: 9999, // large finite so JSON.stringify keeps it valid (Infinity → null)
        w: meta.defaultW,
        h: meta.defaultH,
        config: { ...meta.defaultConfig },
      },
    ]);
    setDirty(true);
  };

  const removeWidget = (id: string) => {
    setLayout((prev) => prev.filter((item) => item.id !== id));
    setDirty(true);
  };

  const saveConfig = (config: Record<string, any>) => {
    if (!configItem) return;
    setLayout((prev) =>
      prev.map((item) =>
        item.id === configItem.id ? { ...item, config } : item
      )
    );
    setDirty(true);
    setConfigOpen(false);
    setConfigItem(null);
  };

  const handleLayoutChange = (newLayout: Layout) => {
    if (skipLayoutChange.current) {
      skipLayoutChange.current = false;
      return;
    }
    setLayout((prev) =>
      prev.map((w) => {
        const pos = newLayout.find((l) => l.i === w.id);
        return pos ? { ...w, x: pos.x, y: pos.y, w: pos.w, h: pos.h } : w;
      })
    );
    setDirty(true);
  };

  const registry = WIDGET_REGISTRY[activeTab];

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      style={{ fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-6 pb-5 flex items-center justify-between gap-4 border-b border-border bg-background">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: TOKEN.orange }}>
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground flex items-center gap-2 leading-none">
            <LayoutDashboard className="h-5 w-5" style={{ color: TOKEN.teal }} />
            Manage Dashboard
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => router.push("/")}
            className="gap-1.5 border-border text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button
            size="sm" onClick={save} disabled={saving || !dirty}
            className="gap-1.5 font-semibold"
            style={{ background: `linear-gradient(135deg, ${TOKEN.navy}, #3d4a72)` }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel */}
        <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Tab switcher */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-1 p-1 bg-background rounded-xl border border-border">
              {TABS.map((tab) => {
                const active = activeTab === tab.type;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.type}
                    onClick={() => setActiveTab(tab.type)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={active ? { backgroundColor: TOKEN.teal } : {}}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Widget list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3 px-0.5">
              Widgets — click to add
            </p>
            {registry.map((meta) => {
              const Icon = meta.icon;
              return (
                <button
                  key={meta.type}
                  onClick={() => addWidget(meta)}
                  className="w-full flex items-center gap-3 p-3 bg-background hover:bg-secondary rounded-xl border border-border hover:border-[#32AEAC]/50 transition-all text-left group"
                >
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: TOKEN.teal + "20" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: TOKEN.teal }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{meta.defaultW}×{meta.defaultH} grid</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-[#32AEAC] shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Unsaved banner */}
          {dirty && (
            <div className="shrink-0 px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 bg-[#FA9464]/10 border border-[#FA9464]/30 rounded-xl px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FA9464]" />
                <p className="text-[11px] font-medium text-[#FA9464] flex-1">Unsaved changes</p>
                <button onClick={save} disabled={saving} className="text-[11px] font-bold text-[#FA9464] hover:underline disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Grid canvas — ref HERE so ResizeObserver always attaches ─── */}
        <div ref={canvasRef} className="flex-1 overflow-auto p-5 bg-background">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 rounded-full border-2 border-[#32AEAC]/30 border-t-[#32AEAC] animate-spin" />
            </div>
          ) : layout.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: TOKEN.teal + "18" }}>
                <LayoutDashboard className="h-7 w-7" style={{ color: TOKEN.teal }} />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">No widgets yet</p>
              <p className="text-[12px] text-muted-foreground/60">Click any widget on the left to add it</p>
            </div>
          ) : containerWidth > 0 ? (
            <GridLayout
              layout={toGridLayout(layout)}
              width={containerWidth - 40}
              gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: MARGIN, containerPadding: PADDING }}
              dragConfig={{ enabled: true, handle: ".drag-handle", cancel: ".nodrag" }}
              resizeConfig={{ enabled: true }}
              compactor={verticalCompactor}
              onLayoutChange={handleLayoutChange}
            >
              {layout.map((item) => {
                const meta = registry.find((m) => m.type === item.widgetType);
                const Icon = meta?.icon ?? LayoutDashboard;
                return (
                  <div
                    key={item.id}
                    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col"
                  >
                    {/* Drag handle bar */}
                    <div className="drag-handle shrink-0 flex items-center gap-2 px-3 min-h-9 py-1.5 border-b border-border cursor-grab active:cursor-grabbing select-none bg-card/80">
                      <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                      <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: TOKEN.teal + "20" }}>
                        <Icon className="h-2.5 w-2.5" style={{ color: TOKEN.teal }} />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="text-[11px] font-semibold text-muted-foreground truncate">
                          {meta?.label ?? item.widgetType}
                        </p>
                        {(item.config?.widgetTitle ?? item.config?.title) && (
                          <p className="text-[9px] text-muted-foreground/50 truncate">
                            {item.config.widgetTitle ?? item.config.title}
                          </p>
                        )}
                      </div>
                      <div className="nodrag flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfigItem(item); setConfigOpen(true); }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                          title="Configure"
                        >
                          <Settings2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeWidget(item.id); }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden min-h-0">
                      <WidgetRenderer item={item} isEditMode />
                    </div>
                  </div>
                );
              })}
            </GridLayout>
          ) : null}
        </div>
      </div>

      {configItem && (
        <WidgetConfigModal
          widgetType={configItem.widgetType}
          isOpen={configOpen}
          onClose={() => { setConfigOpen(false); setConfigItem(null); }}
          initialConfig={configItem.config}
          onSave={saveConfig}
        />
      )}
    </div>
  );
}
