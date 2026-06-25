"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import GridLayout, {
  type Layout,
  type LayoutItem,
  verticalCompactor,
} from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, LayoutDashboard, CalendarClock, Home } from "lucide-react";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import {
  type DashboardType,
  type DashboardWidgetItem,
} from "@/lib/widget-registry";

const TOKEN = { navy: "#2D3250", teal: "#32AEAC", orange: "#FA9464" } as const;
const ROW_HEIGHT = 80;
const COLS = 12;
const MARGIN = [12, 12] as readonly [number, number];
const PADDING = [0, 0] as readonly [number, number];

const TABS: { type: DashboardType; label: string; icon: React.ElementType }[] = [
  { type: "meetings", label: "Meetings", icon: CalendarClock },
  { type: "home-assistant", label: "Home Assistant", icon: Home },
];

// ── Floating tab bar ─────────────────────────────────────────────────────────

function FloatingTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: DashboardType;
  onTabChange: (t: DashboardType) => void;
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  }, []);

  useEffect(() => {
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("scroll", show, { passive: true });
    window.addEventListener("touchstart", show, { passive: true });
    window.addEventListener("keydown", show);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("scroll", show);
      window.removeEventListener("touchstart", show);
      window.removeEventListener("keydown", show);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none"
      }`}
      onMouseEnter={show}
    >
      <div className="flex gap-1 rounded-full border border-gray-200/60 dark:border-gray-700/60 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl bg-white/75 dark:bg-gray-900/80">
        {TABS.map((tab) => {
          const active = activeTab === tab.type;
          const Icon = tab.icon;
          return (
            <button
              key={tab.type}
              onClick={() => {
                onTabChange(tab.type);
                show();
              }}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 select-none ${
                active
                  ? "text-white shadow-md"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
              style={active ? { backgroundColor: TOKEN.teal } : {}}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const [activeTab, setActiveTab] = useState<DashboardType>("meetings");
  const [layout, setLayout] = useState<DashboardWidgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fetchLayout = useCallback(async (type: DashboardType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?type=${type}`);
      const json = await res.json();
      const raw: any[] = json.success ? (json.layout ?? []) : [];
      // Only filter truly invalid items (no id/type); null x/y/w/h get fallback in toGridLayout
      setLayout(raw.filter((w) => w.id && w.widgetType));
    } catch {
      setLayout([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayout(activeTab);
  }, [activeTab, fetchLayout]);

  const gridLayout: LayoutItem[] = layout.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    static: true,
  }));

  return (
    <div
      className="min-h-full bg-background"
      style={{ fontFamily: "var(--font-jakarta), var(--font-inter), sans-serif" }}
    >
      <div className="p-6 pb-28" ref={containerRef}>
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                <Skeleton className="w-full h-80 rounded-none" />
              </div>
            ))}
          </div>
        ) : layout.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border shadow-sm py-24 flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: TOKEN.teal + "18" }}
            >
              <LayoutDashboard className="h-7 w-7" style={{ color: TOKEN.teal }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-muted-foreground">
                No widgets on this dashboard
              </p>
              <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                Use Manage in the header to add widgets
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/dashboard/manage")}
              className="mt-1 font-semibold gap-1.5"
              style={{
                background: `linear-gradient(135deg, ${TOKEN.navy} 0%, #3d4a72 100%)`,
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              Manage Dashboard
            </Button>
          </div>
        ) : containerWidth > 0 ? (
          <GridLayout
            layout={gridLayout}
            width={containerWidth}
            gridConfig={{
              cols: COLS,
              rowHeight: ROW_HEIGHT,
              margin: MARGIN,
              containerPadding: PADDING,
            }}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            compactor={verticalCompactor}
          >
            {layout.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <WidgetRenderer item={item} isEditMode={false} />
              </div>
            ))}
          </GridLayout>
        ) : null}
      </div>

      <FloatingTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
