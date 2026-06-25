"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, WifiOff, Activity, Lightbulb, ToggleLeft,
  Thermometer, Tv, Fan, Lock, Eye, Wind,
  ChevronDown, Bell, Sun, Home, Radio, ChevronRight,
} from "lucide-react";

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

export interface HAStatusConfig {
  title: string;
  entityIds: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: Partial<HAStatusConfig>;
  onSave: (config: HAStatusConfig) => void;
}

const STATUS_DOMAINS = [
  "sensor", "binary_sensor", "climate", "weather",
  "alarm_control_panel", "lock", "cover",
  "switch", "light", "fan", "media_player",
  "input_boolean", "input_number", "input_select", "sun",
];

const DOMAIN_LABELS: Record<string, string> = {
  sensor: "Sensor", binary_sensor: "Binary Sensor", climate: "Climate",
  weather: "Weather", alarm_control_panel: "Alarm Panel", sun: "Sun",
  lock: "Lock", cover: "Cover / Blind", switch: "Switch",
  light: "Light", fan: "Fan", media_player: "Media Player",
  input_boolean: "Input Boolean", input_number: "Input Number", input_select: "Input Select",
};

const DOMAIN_ICON: Record<string, React.ElementType> = {
  sensor: Activity, binary_sensor: Eye, climate: Thermometer,
  weather: Wind, alarm_control_panel: Bell, sun: Sun,
  lock: Lock, cover: ChevronDown, switch: ToggleLeft,
  light: Lightbulb, fan: Fan, media_player: Tv,
  input_boolean: ToggleLeft, input_number: Activity, input_select: Radio,
};

const DOMAIN_COLOR: Record<string, string> = {
  sensor: "text-emerald-500 bg-emerald-500/10",
  binary_sensor: "text-violet-500 bg-violet-500/10",
  climate: "text-orange-500 bg-orange-500/10",
  weather: "text-sky-500 bg-sky-500/10",
  alarm_control_panel: "text-red-500 bg-red-500/10",
  lock: "text-red-400 bg-red-400/10",
  cover: "text-cyan-500 bg-cyan-500/10",
  switch: "text-blue-500 bg-blue-500/10",
  light: "text-yellow-400 bg-yellow-400/10",
  fan: "text-teal-500 bg-teal-500/10",
  media_player: "text-pink-500 bg-pink-500/10",
  sun: "text-amber-400 bg-amber-400/10",
};

function getDomain(entityId: string) { return entityId.split(".")[0]; }
function entityLabel(e: HAState) {
  return e.attributes.friendly_name || e.entity_id.split(".")[1].replace(/_/g, " ");
}
function formatValue(e: HAState) {
  const unit = e.attributes.unit_of_measurement;
  return unit ? `${e.state} ${unit}` : e.state;
}

export function HomeAssistantStatusConfigModal({ isOpen, onClose, initialConfig, onSave }: Props) {
  const [title, setTitle] = useState(initialConfig?.title || "");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialConfig?.entityIds || []));
  const [entities, setEntities] = useState<HAState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialConfig?.title || "");
    setSelected(new Set(initialConfig?.entityIds || []));
    setSearch("");
    setLoading(true);
    setError("");
    fetch("/api/home-assistant/entities")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const filtered = (json.data as HAState[]).filter((e) =>
            STATUS_DOMAINS.includes(getDomain(e.entity_id))
          );
          setEntities(filtered);
        } else {
          setError(json.error || "Gagal fetch entities");
        }
      })
      .catch(() => setError("Tidak bisa reach Home Assistant"))
      .finally(() => setLoading(false));
  }, [isOpen]);

  function toggle(entityId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  }

  function toggleDomain(domain: string) {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function selectAllInDomain(domain: string, domainEntities: HAState[]) {
    const allSelected = domainEntities.every((e) => selected.has(e.entity_id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        domainEntities.forEach((e) => next.delete(e.entity_id));
      } else {
        domainEntities.forEach((e) => next.add(e.entity_id));
      }
      return next;
    });
  }

  function handleSave() {
    if (selected.size === 0) return;
    onSave({
      title: title.trim() || "HA Status",
      entityIds: Array.from(selected),
    });
    onClose();
  }

  // Group by domain, filtered by search
  const searchLower = search.toLowerCase();
  const grouped: Record<string, HAState[]> = {};
  for (const e of entities) {
    const domain = getDomain(e.entity_id);
    const label = entityLabel(e).toLowerCase();
    if (search && !label.includes(searchLower) && !e.entity_id.toLowerCase().includes(searchLower)) continue;
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(e);
  }

  // Order domains: sensor & binary_sensor first, then rest alphabetically
  const PRIORITY = ["sensor", "binary_sensor", "climate", "light", "switch"];
  const orderedDomains = Object.keys(grouped).sort((a, b) => {
    const pa = PRIORITY.indexOf(a);
    const pb = PRIORITY.indexOf(b);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.localeCompare(b);
  });

  const totalFiltered = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Home Assistant Status — Config
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 py-1">
          {/* Title */}
          <div className="space-y-1 shrink-0">
            <Label className="text-xs">Widget Title</Label>
            <Input
              placeholder="e.g. Sensor Ruang Tamu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Selected summary */}
          <div className="flex items-center justify-between shrink-0 text-xs">
            <span className="text-muted-foreground">
              {selected.size > 0
                ? <span className="font-medium text-foreground">{selected.size} dipilih</span>
                : <span className="text-muted-foreground">Belum ada yang dipilih</span>
              }
              {search && ` · ${totalFiltered} hasil`}
            </span>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-destructive hover:underline text-xs">
                Hapus semua
              </button>
            )}
          </div>

          {/* Entity list grouped by domain */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive py-2">
                <WifiOff className="h-4 w-4" /> {error}
              </div>
            ) : totalFiltered === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                {search ? "Tidak ada entity ditemukan" : "Tidak ada entity dari HA"}
              </p>
            ) : (
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-1">
                  {orderedDomains.map((domain) => {
                    const domainEntities = grouped[domain];
                    const Icon = DOMAIN_ICON[domain] ?? Home;
                    const colorClass = DOMAIN_COLOR[domain] ?? "text-gray-400 bg-muted";
                    const [iconColor, bgColor] = colorClass.split(" ");
                    const collapsed = collapsedDomains.has(domain);
                    const allInDomainSelected = domainEntities.every((e) => selected.has(e.entity_id));
                    const someInDomainSelected = domainEntities.some((e) => selected.has(e.entity_id));

                    return (
                      <div key={domain} className="mb-1">
                        {/* Domain header */}
                        <div className="flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50">
                          <Checkbox
                            checked={allInDomainSelected}
                            data-state={someInDomainSelected && !allInDomainSelected ? "indeterminate" : undefined}
                            onCheckedChange={() => selectAllInDomain(domain, domainEntities)}
                            className="shrink-0 h-3.5 w-3.5"
                          />
                          <button
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                            onClick={() => toggleDomain(domain)}
                          >
                            <div className={`rounded p-0.5 shrink-0 ${bgColor}`}>
                              <Icon className={`h-3 w-3 ${iconColor}`} />
                            </div>
                            <span className="text-xs font-semibold flex-1 truncate">
                              {DOMAIN_LABELS[domain] || domain}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {someInDomainSelected ? `${domainEntities.filter(e => selected.has(e.entity_id)).length}/` : ""}{domainEntities.length}
                            </span>
                            <ChevronRight className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`} />
                          </button>
                        </div>

                        {/* Entities */}
                        {!collapsed && (
                          <div className="ml-5 space-y-0.5">
                            {domainEntities.map((e) => {
                              const label = entityLabel(e);
                              const val = formatValue(e);
                              const isChecked = selected.has(e.entity_id);
                              return (
                                <label
                                  key={e.entity_id}
                                  className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors ${isChecked ? "bg-primary/5" : ""}`}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggle(e.entity_id)}
                                    className="shrink-0 h-3.5 w-3.5"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate capitalize">{label}</p>
                                    <p className="text-[10px] text-muted-foreground/60 truncate">{e.entity_id}</p>
                                  </div>
                                  <Badge
                                    variant={e.state === "on" || e.state === "open" ? "default" : "secondary"}
                                    className="text-[9px] px-1 py-0 shrink-0 max-w-[56px] truncate"
                                  >
                                    {val}
                                  </Badge>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={selected.size === 0 || loading}>
            Simpan {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
