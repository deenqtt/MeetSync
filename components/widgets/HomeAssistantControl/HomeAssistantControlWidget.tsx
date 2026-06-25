"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home, Lightbulb, ToggleLeft, Thermometer,
  Tv, Fan, Lock, LockOpen, WifiOff, Loader2,
  ChevronUp, ChevronDown, Activity, Droplets,
  Play, Pause, RefreshCw,
} from "lucide-react";
import type { HAControlConfig } from "./HomeAssistantControlConfigModal";

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
}

interface HADevice {
  device_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  entities: HAState[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomain(entityId: string) { return entityId.split(".")[0]; }
function isOn(state: string) { return ["on", "open", "unlocked", "playing"].includes(state.toLowerCase()); }
function isUnavailable(state: string) { return state === "unavailable" || state === "unknown"; }
function entityLabel(e: HAState) {
  return e.attributes.friendly_name || e.entity_id.split(".")[1].replace(/_/g, " ");
}
function primaryDomain(entities: HAState[]): string {
  const counts: Record<string, number> = {};
  for (const e of entities) {
    const d = getDomain(e.entity_id);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "switch";
}

const DOMAIN_ICON: Record<string, React.ElementType> = {
  light: Lightbulb, switch: ToggleLeft, climate: Thermometer,
  media_player: Tv, fan: Fan, lock: Lock, cover: ChevronDown,
  binary_sensor: Activity, automation: Activity,
};

const DOMAIN_COLOR: Record<string, string> = {
  light: "text-yellow-400",
  switch: "text-blue-500",
  climate: "text-orange-500",
  media_player: "text-pink-500",
  fan: "text-teal-500",
  lock: "text-red-400",
  cover: "text-cyan-500",
};

const DOMAIN_GLOW: Record<string, string> = {
  light: "shadow-yellow-400/30",
  switch: "shadow-blue-500/20",
  climate: "shadow-orange-500/20",
  media_player: "shadow-pink-500/20",
  fan: "shadow-teal-500/20",
};

// ─── Single Entity – Big Card (widget 1 entity) ───────────────────────────────

function SingleEntityCard({
  entity, device, onToggle, onBrightness, loading,
}: {
  entity: HAState;
  device: HADevice;
  onToggle: (e: HAState) => void;
  onBrightness: (e: HAState, v: number) => void;
  loading: boolean;
}) {
  const domain = getDomain(entity.entity_id);
  const on = isOn(entity.state);
  const unavail = isUnavailable(entity.state);
  const controllable = ["light","switch","input_boolean","fan","cover","lock","automation","media_player"].includes(domain);
  const brightness = entity.attributes.brightness
    ? Math.round((entity.attributes.brightness / 255) * 100) : null;
  const Icon = DOMAIN_ICON[domain] ?? Home;
  const color = DOMAIN_COLOR[domain] ?? "text-gray-400";
  const glow = DOMAIN_GLOW[domain] ?? "";

  const stateLabel = domain === "lock"
    ? (on ? "Unlocked" : "Locked")
    : domain === "cover"
    ? (on ? "Open" : "Closed")
    : domain === "media_player"
    ? (on ? "Playing" : "Paused")
    : on ? "On" : "Off";

  return (
    <div className="flex flex-col items-center justify-between h-full gap-3 py-2">
      {/* Big icon */}
      <div className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 ${
        on && !unavail
          ? `bg-primary/10 p-5 shadow-lg ${glow}`
          : "bg-muted/60 p-5"
      }`}>
        {domain === "lock" && on
          ? <LockOpen className={`h-8 w-8 ${on && !unavail ? color : "text-muted-foreground"}`} />
          : domain === "media_player"
          ? (on ? <Play className={`h-8 w-8 ${color}`} /> : <Pause className="h-8 w-8 text-muted-foreground" />)
          : <Icon className={`h-8 w-8 transition-colors ${on && !unavail ? color : "text-muted-foreground"}`} />
        }
        {/* Pulse ring when on */}
        {on && !unavail && domain === "light" && (
          <span className={`absolute inset-0 rounded-2xl animate-ping opacity-10 bg-yellow-400`} />
        )}
      </div>

      {/* State + name */}
      <div className="text-center">
        <p className="text-xs font-semibold truncate max-w-[120px] capitalize">
          {device.name}
        </p>
        <Badge
          variant={unavail ? "outline" : on ? "default" : "secondary"}
          className={`mt-1 text-[10px] px-2 transition-all ${on && !unavail ? "" : "opacity-70"}`}
        >
          {unavail ? "Unavailable" : stateLabel}
        </Badge>
      </div>

      {/* Control area */}
      <div className="w-full space-y-2">
        {controllable && !unavail && (
          <div className="flex items-center justify-center">
            {loading
              ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              : <Switch
                  checked={on}
                  onCheckedChange={() => onToggle(entity)}
                  className="scale-110"
                />
            }
          </div>
        )}

        {/* Brightness */}
        {domain === "light" && on && brightness !== null && !unavail && (
          <div className="space-y-1 px-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Brightness</span>
              <span className="font-medium">{brightness}%</span>
            </div>
            <Slider
              value={[brightness]} min={1} max={100} step={5}
              onValueCommit={([v]) => onBrightness(entity, Math.round((v / 100) * 255))}
              disabled={loading}
            />
          </div>
        )}

        {/* Climate info */}
        {domain === "climate" && !unavail && (
          <div className="flex justify-center gap-3">
            {entity.attributes.current_temperature != null && (
              <span className="flex items-center gap-0.5 text-xs font-semibold">
                <Thermometer className="h-3.5 w-3.5 text-orange-400" />
                {entity.attributes.current_temperature}°C
              </span>
            )}
            {entity.attributes.humidity != null && (
              <span className="flex items-center gap-0.5 text-xs font-semibold">
                <Droplets className="h-3.5 w-3.5 text-blue-400" />
                {entity.attributes.humidity}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Multi Entity Row ──────────────────────────────────────────────────────────

function MultiEntityRow({
  entity, onToggle, onBrightness, loading,
}: {
  entity: HAState;
  onToggle: (e: HAState) => void;
  onBrightness: (e: HAState, v: number) => void;
  loading: boolean;
}) {
  const domain = getDomain(entity.entity_id);
  const on = isOn(entity.state);
  const unavail = isUnavailable(entity.state);
  const controllable = ["light","switch","input_boolean","fan","cover","lock","automation","media_player"].includes(domain);
  const brightness = entity.attributes.brightness
    ? Math.round((entity.attributes.brightness / 255) * 100) : null;
  const Icon = DOMAIN_ICON[domain] ?? Home;
  const color = DOMAIN_COLOR[domain] ?? "text-gray-400";
  const label = entityLabel(entity);

  const stateText = domain === "lock"
    ? (on ? "Unlocked" : "Locked")
    : domain === "cover" ? (on ? "Open" : "Closed")
    : domain === "media_player" ? (on ? "Playing" : "Stopped")
    : on ? "On" : "Off";

  return (
    <div className={`transition-opacity ${unavail ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2.5 py-2">
        {/* Icon */}
        <div className={`shrink-0 rounded-lg p-1.5 transition-colors ${
          on && !unavail ? "bg-primary/10" : "bg-muted"
        }`}>
          {domain === "lock" && on
            ? <LockOpen className={`h-3.5 w-3.5 ${on && !unavail ? color : "text-muted-foreground"}`} />
            : <Icon className={`h-3.5 w-3.5 ${on && !unavail ? color : "text-muted-foreground"}`} />
          }
        </div>

        {/* Label + state */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate capitalize leading-tight">{label}</p>
          <p className={`text-[10px] leading-tight ${on && !unavail ? "text-primary/80" : "text-muted-foreground"}`}>
            {unavail ? "Unavailable" : stateText}
          </p>
        </div>

        {/* Control */}
        {controllable && !unavail && (
          <div className="shrink-0">
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              : <Switch checked={on} onCheckedChange={() => onToggle(entity)} className="scale-90" />
            }
          </div>
        )}
      </div>

      {/* Brightness */}
      {domain === "light" && on && brightness !== null && !unavail && (
        <div className="pb-2 px-1 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Brightness</span>
            <span>{brightness}%</span>
          </div>
          <Slider
            value={[brightness]} min={1} max={100} step={5}
            onValueCommit={([v]) => onBrightness(entity, Math.round((v / 100) * 255))}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

interface Props {
  config: {
    title?: string;
    deviceId?: string;
    deviceName?: string;
    [key: string]: any;
  };
  isEditMode?: boolean;
}

export function HomeAssistantControlWidget({ config, isEditMode }: Props) {
  const widgetConfig: HAControlConfig | null = config.deviceId
    ? { title: config.title || config.deviceName || "", deviceId: config.deviceId, deviceName: config.deviceName || "" }
    : null;

  const [device, setDevice] = useState<HADevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const configRef = useRef(widgetConfig);
  configRef.current = widgetConfig;

  const fetchDevice = useCallback(async (silent = false) => {
    const cfg = configRef.current;
    if (!cfg?.deviceId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/home-assistant/devices");
      const json = await res.json();
      if (json.success) {
        const found = (json.data as HADevice[]).find((d) => d.device_id === cfg.deviceId);
        setDevice(found ?? null);
        if (!found) setError("Device tidak ditemukan");
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
    fetchDevice();
    const interval = setInterval(() => fetchDevice(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchDevice]);

  const handleToggle = useCallback(async (entity: HAState) => {
    const domain = getDomain(entity.entity_id);
    const on = isOn(entity.state);
    const service =
      domain === "lock" ? (on ? "lock" : "unlock") :
      domain === "cover" ? (on ? "close_cover" : "open_cover") :
      domain === "media_player" ? "media_play_pause" :
      on ? "turn_off" : "turn_on";

    setToggling((p) => ({ ...p, [entity.entity_id]: true }));
    try {
      await fetch("/api/home-assistant/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, service, entity_id: entity.entity_id }),
      });
      setDevice((prev) => prev ? {
        ...prev,
        entities: prev.entities.map((e) =>
          e.entity_id === entity.entity_id ? { ...e, state: on ? "off" : "on" } : e
        ),
      } : prev);
    } finally {
      setToggling((p) => ({ ...p, [entity.entity_id]: false }));
    }
  }, []);

  const handleBrightness = useCallback(async (entity: HAState, brightness: number) => {
    setToggling((p) => ({ ...p, [entity.entity_id]: true }));
    try {
      await fetch("/api/home-assistant/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "light", service: "turn_on", entity_id: entity.entity_id, data: { brightness } }),
      });
      setDevice((prev) => prev ? {
        ...prev,
        entities: prev.entities.map((e) =>
          e.entity_id === entity.entity_id ? { ...e, attributes: { ...e.attributes, brightness } } : e
        ),
      } : prev);
    } finally {
      setToggling((p) => ({ ...p, [entity.entity_id]: false }));
    }
  }, []);

  // ── Not configured ──────────────────────────────────────────────────────────

  if (!widgetConfig?.deviceId) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground p-4">
          <Home className="h-8 w-8 opacity-40" />
          <p className="text-sm text-center">Klik konfigurasi untuk pilih device</p>
        </CardContent>
      </Card>
    );
  }

  const title = widgetConfig?.title || config.title || "Home Assistant";
  const anyOn = device?.entities.some((e) => isOn(e.state)) ?? false;
  const single = (device?.entities.length ?? 0) === 1;
  const domain = device ? primaryDomain(device.entities) : "switch";
  const Icon = DOMAIN_ICON[domain] ?? Home;
  const iconColor = DOMAIN_COLOR[domain] ?? "text-gray-400";

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 flex-1" />
        </div>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-destructive p-4">
          <WifiOff className="h-6 w-6" />
          <p className="text-xs text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Card className={`h-full flex flex-col transition-all duration-300 ${
      anyOn ? `ring-1 ring-primary/40` : ""
    }`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b transition-colors ${
        anyOn ? "bg-primary/5" : ""
      }`}>
        <div className={`rounded-md p-1 shrink-0 transition-colors ${anyOn ? "bg-primary/15" : "bg-muted"}`}>
          <Icon className={`h-3.5 w-3.5 ${anyOn ? iconColor : "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate leading-tight">{title}</p>
          {device && (device.manufacturer || device.model) && (
            <p className="text-[10px] text-muted-foreground truncate leading-tight">
              {[device.manufacturer, device.model].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {/* Refresh indicator */}
        <RefreshCw className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      </div>

      {/* Body */}
      <CardContent className="flex-1 px-3 pb-3 pt-2 min-h-0 overflow-auto">
        {!device ? null : single ? (
          // Single entity: big centered card
          <SingleEntityCard
            entity={device.entities[0]}
            device={device}
            onToggle={handleToggle}
            onBrightness={handleBrightness}
            loading={!!toggling[device.entities[0].entity_id]}
          />
        ) : (
          // Multi entity: list
          <div className="divide-y divide-border/60">
            {device.entities.map((entity) => (
              <MultiEntityRow
                key={entity.entity_id}
                entity={entity}
                onToggle={handleToggle}
                onBrightness={handleBrightness}
                loading={!!toggling[entity.entity_id]}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
