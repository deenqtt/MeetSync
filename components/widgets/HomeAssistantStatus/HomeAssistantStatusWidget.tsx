"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, Lightbulb, ToggleLeft, Thermometer,
  Tv, Fan, Lock, WifiOff, Eye, Wind, Droplets,
  ChevronDown, Bell, Sun, Home, Radio, RefreshCw,
} from "lucide-react";

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(entityId: string) { return entityId.split(".")[0]; }

function entityLabel(e: HAState) {
  return e.attributes.friendly_name || e.entity_id.split(".")[1].replace(/_/g, " ");
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isAlertState(e: HAState): boolean {
  const domain = getDomain(e.entity_id);
  if (domain === "binary_sensor" && e.state === "on") return true;
  if (domain === "alarm_control_panel" && e.state !== "disarmed") return true;
  return false;
}

function isActiveState(e: HAState): boolean {
  return ["on", "open", "unlocked", "playing", "armed"].includes(e.state.toLowerCase());
}

const DOMAIN_ICON: Record<string, React.ElementType> = {
  sensor: Activity, binary_sensor: Eye, climate: Thermometer,
  weather: Wind, alarm_control_panel: Bell, sun: Sun,
  lock: Lock, cover: ChevronDown, switch: ToggleLeft,
  light: Lightbulb, fan: Fan, media_player: Tv,
  input_boolean: ToggleLeft, input_number: Activity, input_select: Radio,
};

const DOMAIN_COLOR: Record<string, string> = {
  sensor: "text-emerald-500", binary_sensor: "text-violet-500",
  climate: "text-orange-500", weather: "text-sky-500",
  alarm_control_panel: "text-red-600", sun: "text-amber-400",
  lock: "text-red-500", cover: "text-cyan-500",
  switch: "text-blue-500", light: "text-yellow-400",
  fan: "text-teal-500", media_player: "text-pink-500",
};

const DOMAIN_BG: Record<string, string> = {
  sensor: "bg-emerald-500/10", binary_sensor: "bg-violet-500/10",
  climate: "bg-orange-500/10", weather: "bg-sky-500/10",
  alarm_control_panel: "bg-red-500/10", sun: "bg-amber-400/10",
  lock: "bg-red-500/10", cover: "bg-cyan-500/10",
  switch: "bg-blue-500/10", light: "bg-yellow-400/10",
  fan: "bg-teal-500/10", media_player: "bg-pink-500/10",
};

// ─── Sensor Row (nilai besar) ──────────────────────────────────────────────────

function SensorRow({ entity }: { entity: HAState }) {
  const label = entityLabel(entity);
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const unit = entity.attributes.unit_of_measurement || "";
  const deviceClass = entity.attributes.device_class || "";

  return (
    <div className={`flex items-center justify-between gap-2 py-2 ${unavailable ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate capitalize leading-tight">{label}</p>
        {entity.last_updated && (
          <p className="text-[10px] text-muted-foreground/50 leading-tight">{relativeTime(entity.last_updated)}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {unavailable ? (
          <span className="text-xs text-muted-foreground">–</span>
        ) : (
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-semibold tabular-nums leading-none">{entity.state}</span>
            {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Binary Sensor Row ────────────────────────────────────────────────────────

function BinarySensorRow({ entity }: { entity: HAState }) {
  const label = entityLabel(entity);
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const triggered = entity.state === "on";
  const deviceClass = entity.attributes.device_class || "";

  const stateLabel = triggered
    ? (deviceClass === "motion" ? "Motion" : deviceClass === "door" ? "Open" : deviceClass === "smoke" ? "Smoke!" : "Detected")
    : (deviceClass === "motion" ? "Clear" : deviceClass === "door" ? "Closed" : "Clear");

  return (
    <div className={`flex items-center justify-between gap-2 py-2 ${unavailable ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate capitalize leading-tight">{label}</p>
        {entity.last_updated && (
          <p className="text-[10px] text-muted-foreground/50">{relativeTime(entity.last_updated)}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${
          unavailable ? "bg-muted" : triggered ? "bg-destructive animate-pulse" : "bg-emerald-500"
        }`} />
        <span className={`text-xs font-medium ${triggered ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
          {unavailable ? "–" : stateLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Climate Row ──────────────────────────────────────────────────────────────

function ClimateRow({ entity }: { entity: HAState }) {
  const label = entityLabel(entity);
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const cur = entity.attributes.current_temperature;
  const target = entity.attributes.temperature;
  const hum = entity.attributes.humidity;

  return (
    <div className={`py-2 ${unavailable ? "opacity-40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate capitalize leading-tight">{label}</p>
        <Badge
          variant={entity.state === "off" ? "secondary" : "default"}
          className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
        >
          {entity.state}
        </Badge>
      </div>
      {!unavailable && (cur != null || hum != null) && (
        <div className="flex gap-3 mt-1.5">
          {cur != null && (
            <div className="flex items-center gap-1">
              <Thermometer className="h-3 w-3 text-orange-400" />
              <span className="text-sm font-semibold tabular-nums">{cur}°C</span>
              {target != null && (
                <span className="text-[10px] text-muted-foreground">→ {target}°</span>
              )}
            </div>
          )}
          {hum != null && (
            <div className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-blue-400" />
              <span className="text-sm font-semibold tabular-nums">{hum}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Generic Row (switch, light, lock, dll.) ──────────────────────────────────

function GenericRow({ entity }: { entity: HAState }) {
  const domain = getDomain(entity.entity_id);
  const Icon = DOMAIN_ICON[domain] ?? Home;
  const color = DOMAIN_COLOR[domain] ?? "text-gray-400";
  const bg = DOMAIN_BG[domain] ?? "bg-muted";
  const label = entityLabel(entity);
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const alert = isAlertState(entity);
  const active = isActiveState(entity);

  return (
    <div className={`flex items-center gap-2 py-2 ${unavailable ? "opacity-40" : ""}`}>
      <div className={`shrink-0 rounded-md p-1.5 ${alert ? "bg-destructive/10" : active ? bg : "bg-muted"}`}>
        <Icon className={`h-3 w-3 ${alert ? "text-destructive" : active ? color : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate capitalize leading-tight">{label}</p>
        {entity.last_updated && (
          <p className="text-[10px] text-muted-foreground/50">{relativeTime(entity.last_updated)}</p>
        )}
      </div>
      <Badge
        variant={unavailable ? "outline" : alert ? "destructive" : active ? "default" : "secondary"}
        className="text-[10px] px-1.5 py-0 shrink-0 max-w-[72px] truncate capitalize"
      >
        {entity.state}
      </Badge>
    </div>
  );
}

// ─── Dispatch row by domain ───────────────────────────────────────────────────

function EntityRow({ entity }: { entity: HAState }) {
  const domain = getDomain(entity.entity_id);
  if (domain === "sensor") return <SensorRow entity={entity} />;
  if (domain === "binary_sensor") return <BinarySensorRow entity={entity} />;
  if (domain === "climate") return <ClimateRow entity={entity} />;
  return <GenericRow entity={entity} />;
}

// ─── Widget ───────────────────────────────────────────────────────────────────

interface Props {
  config: {
    title?: string;
    entityIds?: string[];
    [key: string]: any;
  };
  isEditMode?: boolean;
}

export function HomeAssistantStatusWidget({ config }: Props) {
  const entityIds: string[] = config.entityIds || [];
  const title = config.title || "HA Status";

  const [entities, setEntities] = useState<HAState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const entityIdsRef = useRef(entityIds);
  entityIdsRef.current = entityIds;

  const fetchStatus = useCallback(async (silent = false) => {
    const ids = entityIdsRef.current;
    if (ids.length === 0) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/home-assistant/entities");
      const json = await res.json();
      if (json.success) {
        const all = json.data as HAState[];
        const ordered = ids
          .map((id) => all.find((e) => e.entity_id === id))
          .filter(Boolean) as HAState[];
        setEntities(ordered);
        setLastRefresh(new Date());
      } else {
        setError(json.error || "Gagal fetch HA");
      }
    } catch {
      setError("Tidak bisa reach HA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Not configured
  if (entityIds.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground p-4">
          <Activity className="h-8 w-8 opacity-40" />
          <p className="text-sm text-center">Klik konfigurasi untuk pilih entity status</p>
        </CardContent>
      </Card>
    );
  }

  const alertCount = entities.filter(isAlertState).length;
  const activeCount = entities.filter((e) => isActiveState(e) && !isAlertState(e)).length;

  return (
    <Card className={`h-full flex flex-col transition-all duration-300 ${alertCount > 0 ? "ring-1 ring-destructive/50" : ""}`}>
      {/* Header */}
      <CardHeader className="py-2 px-3 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`rounded-md p-1 shrink-0 ${alertCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
              <Activity className={`h-3.5 w-3.5 ${alertCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <span className="text-sm font-semibold truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {alertCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {alertCount} alert
              </Badge>
            )}
            {alertCount === 0 && activeCount > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                {activeCount} active
              </Badge>
            )}
            {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Summary pills */}
        {!loading && !error && entities.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 pb-1 border-b flex-wrap">
            {alertCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {alertCount} alert
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {entityIds.length} entities • {lastRefresh ? relativeTime(lastRefresh.toISOString()) : "–"}
            </span>
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 px-3 pb-2 pt-0 min-h-0">
        {loading ? (
          <div className="space-y-3 mt-3">
            {Array.from({ length: Math.min(entityIds.length, 4) }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-md shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
                <Skeleton className="h-5 w-10 shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-destructive">
            <WifiOff className="h-5 w-5" />
            <p className="text-xs text-center">{error}</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y divide-border/60 pr-1">
              {entities.map((e) => (
                <EntityRow key={e.entity_id} entity={e} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
