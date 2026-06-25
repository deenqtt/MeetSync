"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/lib/toast-utils";
import {
  Home,
  Lightbulb,
  ToggleLeft,
  Thermometer,
  Activity,
  Tv,
  Fan,
  Lock,
  Bell,
  Eye,
  Wind,
  Droplets,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Power,
  PowerOff,
  Sun,
  Loader2,
  ChevronDown,
  Building2,
  Mic,
  MicOff,
  MessageSquare,
  Send,
  X,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const TOKEN = {
  navy: "#2D3250",
  teal: "#32AEAC",
  orange: "#FA9464",
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

interface HADevice {
  device_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  model_id: string | null;
  entities: HAState[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDomain(entityId: string): string {
  return entityId.split(".")[0];
}

function isControllable(domain: string): boolean {
  return [
    "light", "switch", "input_boolean", "fan",
    "cover", "lock", "automation", "script", "media_player",
  ].includes(domain);
}

function isOnState(state: string): boolean {
  return ["on", "open", "unlocked", "playing", "armed"].includes(state.toLowerCase());
}

function entityLabel(entity: HAState): string {
  return entity.attributes.friendly_name || entity.entity_id.split(".")[1].replace(/_/g, " ");
}

function formatState(entity: HAState): string {
  const { state, attributes } = entity;
  const domain = getDomain(entity.entity_id);
  if (domain === "sensor") {
    const unit = attributes.unit_of_measurement || "";
    return `${state}${unit ? " " + unit : ""}`;
  }
  if (domain === "binary_sensor") return state === "on" ? "Detected" : "Clear";
  if (domain === "climate") {
    const current = attributes.current_temperature;
    const target = attributes.temperature;
    return `${state}${current ? ` • ${current}°` : ""}${target ? ` → ${target}°` : ""}`;
  }
  return state;
}

// ─── Domain config ─────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  light:               { icon: Lightbulb,   color: "text-yellow-500",  bg: "bg-yellow-50 dark:bg-yellow-400/10" },
  switch:              { icon: ToggleLeft,   color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-400/10" },
  sensor:              { icon: Activity,     color: "text-green-500",   bg: "bg-green-50 dark:bg-green-400/10" },
  binary_sensor:       { icon: Eye,          color: "text-purple-500",  bg: "bg-purple-50 dark:bg-purple-400/10" },
  climate:             { icon: Thermometer,  color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-400/10" },
  media_player:        { icon: Tv,           color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-400/10" },
  cover:               { icon: ChevronDown,  color: "text-sky-500",     bg: "bg-sky-50 dark:bg-sky-400/10" },
  fan:                 { icon: Fan,          color: "text-teal-500",    bg: "bg-teal-50 dark:bg-teal-400/10" },
  lock:                { icon: Lock,         color: "text-red-500",     bg: "bg-red-50 dark:bg-red-400/10" },
  alarm_control_panel: { icon: Bell,         color: "text-red-600",     bg: "bg-red-50 dark:bg-red-400/10" },
  automation:          { icon: Activity,     color: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-400/10" },
  weather:             { icon: Wind,         color: "text-slate-500",   bg: "bg-slate-50 dark:bg-slate-400/10" },
  sun:                 { icon: Sun,          color: "text-amber-400",   bg: "bg-amber-50 dark:bg-amber-400/10" },
};

function getDomainConfig(domain: string) {
  return DOMAIN_CONFIG[domain] ?? { icon: Home, color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-800" };
}

function primaryDomain(device: HADevice): string {
  const counts: Record<string, number> = {};
  for (const e of device.entities) {
    const d = getDomain(e.entity_id);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
}

// ─── Entity Row ────────────────────────────────────────────────────────────────

function EntityRow({
  entity,
  onToggle,
  onBrightness,
  loading,
  single,
}: {
  entity: HAState;
  onToggle: (e: HAState) => void;
  onBrightness: (e: HAState, v: number) => void;
  loading: boolean;
  single: boolean;
}) {
  const domain = getDomain(entity.entity_id);
  const label = entityLabel(entity);
  const stateStr = formatState(entity);
  const isOn = isOnState(entity.state);
  const controllable = isControllable(domain);
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";
  const brightness = entity.attributes.brightness
    ? Math.round((entity.attributes.brightness / 255) * 100)
    : null;

  return (
    <div className={unavailable ? "opacity-50" : ""}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {!single && (
            <p className="truncate text-xs font-medium capitalize text-gray-700 dark:text-gray-300">{label}</p>
          )}
          <Badge
            variant={unavailable ? "outline" : isOn ? "default" : "secondary"}
            className={`mt-0.5 text-[10px] px-1.5 py-0 ${
              isOn && !unavailable
                ? "bg-[#32AEAC]/15 text-[#32AEAC] border-[#32AEAC]/25 hover:bg-[#32AEAC]/15"
                : ""
            }`}
          >
            {stateStr}
          </Badge>
        </div>
        {controllable && !unavailable && (
          <div className="shrink-0">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <Switch
                checked={isOn}
                onCheckedChange={() => onToggle(entity)}
                className="scale-90"
              />
            )}
          </div>
        )}
      </div>

      {domain === "light" && isOn && brightness !== null && !unavailable && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Brightness</span>
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{brightness}%</span>
          </div>
          <Slider
            value={[brightness]}
            min={1}
            max={100}
            step={5}
            onValueCommit={([v]) => onBrightness(entity, Math.round((v / 100) * 255))}
            disabled={loading}
          />
        </div>
      )}

      {domain === "climate" && !unavailable && (
        <div className="mt-1 flex flex-wrap gap-2">
          {entity.attributes.current_temperature !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Thermometer className="h-3 w-3" />
              {entity.attributes.current_temperature}°C
            </span>
          )}
          {entity.attributes.humidity !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Droplets className="h-3 w-3" />
              {entity.attributes.humidity}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Device Card ───────────────────────────────────────────────────────────────

function DeviceCard({
  device,
  onToggle,
  onBrightness,
  toggling,
}: {
  device: HADevice;
  onToggle: (e: HAState) => void;
  onBrightness: (e: HAState, v: number) => void;
  toggling: Record<string, boolean>;
}) {
  const domain = primaryDomain(device);
  const { icon: Icon, color, bg } = getDomainConfig(domain);
  const anyOn = device.entities.some((e) => isOnState(e.state));
  const allUnavailable = device.entities.every(
    (e) => e.state === "unavailable" || e.state === "unknown"
  );
  const single = device.entities.length === 1;

  return (
    <div
      className={`bg-white dark:bg-card rounded-2xl border shadow-sm p-4 transition-all duration-200 flex flex-col gap-3 ${
        allUnavailable
          ? "opacity-50 border-gray-100 dark:border-border"
          : anyOn
          ? "border-[#32AEAC]/30 dark:border-[#32AEAC]/20"
          : "border-gray-100 dark:border-border"
      }`}
    >
      {/* Device header */}
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-xl p-2 ${anyOn && !allUnavailable ? bg : "bg-gray-50 dark:bg-gray-800"}`}>
          <Icon className={`h-4 w-4 ${anyOn && !allUnavailable ? color : "text-gray-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white leading-tight">{device.name}</p>
          {(device.manufacturer || device.model) && (
            <p className="truncate text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {[device.manufacturer, device.model].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5 uppercase tracking-wider">
            {domain}
          </p>
        </div>
      </div>

      {/* Entities */}
      <div className={`space-y-2 ${!single ? "border-t border-gray-50 dark:border-border pt-2" : ""}`}>
        {device.entities.map((entity) => (
          <EntityRow
            key={entity.entity_id}
            entity={entity}
            onToggle={onToggle}
            onBrightness={onBrightness}
            loading={!!toggling[entity.entity_id]}
            single={single}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Filter options ────────────────────────────────────────────────────────────

const DOMAIN_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "light", label: "Light" },
  { value: "switch", label: "Switch" },
  { value: "sensor", label: "Sensor" },
  { value: "binary_sensor", label: "Binary Sensor" },
  { value: "climate", label: "Climate" },
  { value: "media_player", label: "Media Player" },
  { value: "fan", label: "Fan" },
  { value: "cover", label: "Cover" },
  { value: "lock", label: "Lock" },
  { value: "automation", label: "Automation" },
  { value: "other", label: "Other" },
];

const KNOWN_DOMAINS = new Set(DOMAIN_FILTERS.map((f) => f.value));

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomeAssistantPage() {
  const [devices, setDevices] = useState<HADevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const [isListening, setIsListening] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [lastResponse, setLastResponse] = useState<{ text: string; type: "user" | "bot" } | null>(null);
  const recognitionRef = useRef<any>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/home-assistant/devices");
      const json = await res.json();
      if (json.success) {
        setDevices(json.data as HADevice[]);
        setConnected(true);
        setLastUpdated(new Date());
      } else {
        setConnected(false);
        if (!silent) showToast.error("Connection failed", json.error);
      }
    } catch {
      setConnected(false);
      if (!silent) showToast.error("Cannot reach Home Assistant");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => fetchDevices(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (entity: HAState) => {
    const domain = getDomain(entity.entity_id);
    const isOn = isOnState(entity.state);
    const service =
      domain === "lock" ? (isOn ? "lock" : "unlock") :
      domain === "cover" ? (isOn ? "close_cover" : "open_cover") :
      domain === "media_player" ? "media_play_pause" :
      isOn ? "turn_off" : "turn_on";

    setToggling((p) => ({ ...p, [entity.entity_id]: true }));
    try {
      const res = await fetch("/api/home-assistant/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, service, entity_id: entity.entity_id }),
      });
      const json = await res.json();
      if (json.success) {
        setDevices((prev) =>
          prev.map((d) => ({
            ...d,
            entities: d.entities.map((e) =>
              e.entity_id === entity.entity_id
                ? { ...e, state: isOn ? "off" : "on", last_updated: new Date().toISOString() }
                : e
            ),
          }))
        );
      } else {
        showToast.error("Failed to control device", json.error);
      }
    } catch {
      showToast.error("Failed to control device");
    } finally {
      setToggling((p) => ({ ...p, [entity.entity_id]: false }));
    }
  }, []);

  // ── Brightness ─────────────────────────────────────────────────────────────

  const handleBrightness = useCallback(async (entity: HAState, brightness: number) => {
    setToggling((p) => ({ ...p, [entity.entity_id]: true }));
    try {
      await fetch("/api/home-assistant/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "light", service: "turn_on",
          entity_id: entity.entity_id, data: { brightness },
        }),
      });
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          entities: d.entities.map((e) =>
            e.entity_id === entity.entity_id
              ? { ...e, attributes: { ...e.attributes, brightness } }
              : e
          ),
        }))
      );
    } catch {
      showToast.error("Failed to set brightness");
    } finally {
      setToggling((p) => ({ ...p, [entity.entity_id]: false }));
    }
  }, []);

  // ── Voice / Conversation ───────────────────────────────────────────────────

  const sendCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessingCommand(true);
    setLastResponse({ text, type: "user" });

    try {
      const res = await fetch("/api/home-assistant/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();

      if (json.success && json.data?.response?.speech?.plain?.speech) {
        const reply = json.data.response.speech.plain.speech;
        setLastResponse({ text: reply, type: "bot" });
        fetchDevices(true);
      } else if (json.error) {
        showToast.error("Command failed", json.error);
        setLastResponse(null);
      }
    } catch {
      showToast.error("Error processing command");
      setLastResponse(null);
    } finally {
      setIsProcessingCommand(false);
      setCommandText("");
    }
  }, [fetchDevices]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast.error("Speech recognition not supported by this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCommandText(transcript);
      sendCommand(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, sendCommand]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = devices.filter((device) => {
    const domain = primaryDomain(device);
    const nameMatch =
      !search ||
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.entities.some((e) => e.entity_id.toLowerCase().includes(search.toLowerCase()));
    const domainMatch =
      domainFilter === "all" ||
      (domainFilter === "other"
        ? !KNOWN_DOMAINS.has(domain) || domain === "other"
        : domain === domainFilter) ||
      device.entities.some((e) => getDomain(e.entity_id) === domainFilter);
    return nameMatch && domainMatch;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const allEntities = devices.flatMap((d) => d.entities);
  const stats = {
    devices: devices.length,
    active: devices.filter((d) => d.entities.some((e) => isOnState(e.state))).length,
    unavailable: devices.filter((d) =>
      d.entities.every((e) => e.state === "unavailable" || e.state === "unknown")
    ).length,
    entities: allEntities.length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
            Home Assistant
          </h1>
        </div>

        {/* Connection status + refresh */}
        <div className="flex items-center gap-3 mt-1 shrink-0">
          <div className="flex items-center gap-2 bg-white dark:bg-card border border-gray-100 dark:border-border rounded-xl px-3 py-1.5 shadow-sm">
            {connected === null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
            ) : connected ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-[#32AEAC]" />
                <span className="text-[11px] font-semibold text-[#32AEAC]">Connected</span>
              </>
            ) : (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold text-red-500">Disconnected</span>
              </>
            )}
            {lastUpdated && (
              <span className="text-[10px] text-gray-300 dark:text-gray-600 font-mono ml-1 border-l border-gray-100 dark:border-border pl-2">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDevices()}
            disabled={loading}
            className="border-gray-200 bg-white dark:bg-card dark:border-border text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 space-y-5 pb-10">

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Devices",     value: stats.devices,     color: TOKEN.navy },
            { label: "Active",      value: stats.active,      color: TOKEN.teal },
            { label: "Unavailable", value: stats.unavailable, color: "#EF4444" },
            { label: "Entities",    value: stats.entities,    color: TOKEN.orange },
          ].map(({ label, value, color }) => (
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
                  {value}
                </p>
              )}
              <div className="mt-3 h-[3px] rounded-full w-10" style={{ backgroundColor: color, opacity: 0.25 }} />
            </div>
          ))}
        </div>

        {/* Voice & Command Bar */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 dark:border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" style={{ color: TOKEN.teal }} />
              <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                Voice & Text Command
              </span>
            </div>
            {lastResponse && (
              <button
                onClick={() => setLastResponse(null)}
                className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">
            {lastResponse && (
              <div className={`flex flex-col gap-2 ${lastResponse.type === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] ${
                    lastResponse.type === "user"
                      ? "text-white rounded-tr-none"
                      : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-border text-gray-700 dark:text-gray-300 rounded-tl-none"
                  }`}
                  style={lastResponse.type === "user" ? { background: `linear-gradient(135deg, ${TOKEN.navy} 0%, #3d4a72 100%)` } : {}}
                >
                  {lastResponse.text}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Type a command (e.g. 'Turn on the lights')..."
                  value={commandText}
                  onChange={(e) => setCommandText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCommand(commandText)}
                  disabled={isProcessingCommand || isListening}
                  className="pr-10 h-10 rounded-xl border-gray-200 dark:border-border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                />
                <div className="absolute right-2 top-1.5">
                  {isProcessingCommand ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-1" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => sendCommand(commandText)}
                      disabled={!commandText.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={toggleListening}
                className={`h-10 w-10 shrink-0 rounded-xl border-gray-200 dark:border-border ${isListening ? "animate-pulse" : ""}`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-600">
              {isListening ? "Listening... Please speak" : "Tip: Use HA LLM integration for natural language commands."}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search devices or entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl border-gray-200 bg-white dark:bg-card dark:border-border text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 shadow-sm"
            />
          </div>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl border-gray-200 bg-white dark:bg-card dark:border-border text-gray-700 dark:text-gray-300 shadow-sm">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {DOMAIN_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0">
            {filtered.length} device{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Device grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              {connected === false ? (
                <WifiOff className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              ) : (
                <Home className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-500 dark:text-gray-400">
                {connected === false ? "Cannot connect to Home Assistant" : "No devices match your filter"}
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                {connected === false
                  ? "Check HA_URL and HA_TOKEN in your .env"
                  : "Try adjusting your search or filter"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                onToggle={handleToggle}
                onBrightness={handleBrightness}
                toggling={toggling}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
