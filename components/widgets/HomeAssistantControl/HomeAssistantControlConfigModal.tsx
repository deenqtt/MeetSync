"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home, Loader2, WifiOff } from "lucide-react";

interface HADevice {
  device_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  entities: { entity_id: string; state: string; attributes: Record<string, any> }[];
}

export interface HAControlConfig {
  title: string;
  deviceId: string;       // device_id dari /api/home-assistant/devices
  deviceName: string;     // untuk display
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: Partial<HAControlConfig>;
  onSave: (config: HAControlConfig) => void;
}

const CONTROLLABLE = ["light", "switch", "input_boolean", "fan", "cover", "lock", "automation", "media_player"];

export function HomeAssistantControlConfigModal({ isOpen, onClose, initialConfig, onSave }: Props) {
  const [title, setTitle] = useState(initialConfig?.title || "");
  const [deviceId, setDeviceId] = useState(initialConfig?.deviceId || "");
  const [devices, setDevices] = useState<HADevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialConfig?.title || "");
    setDeviceId(initialConfig?.deviceId || "");
    setLoading(true);
    setError("");
    fetch("/api/home-assistant/devices")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          // Hanya tampilkan device yang punya entity controllable
          const controllable = (json.data as HADevice[]).filter((d) =>
            d.entities.some((e) => CONTROLLABLE.includes(e.entity_id.split(".")[0]))
          );
          setDevices(controllable);
        } else {
          setError(json.error || "Gagal fetch devices");
        }
      })
      .catch(() => setError("Tidak bisa reach Home Assistant"))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = devices.find((d) => d.device_id === deviceId);

  function handleSave() {
    if (!deviceId) return;
    onSave({
      title: title.trim() || selected?.name || deviceId,
      deviceId,
      deviceName: selected?.name || deviceId,
    });
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Home Assistant Control — Config
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Widget Title</Label>
            <Input
              placeholder="e.g. Lampu Ruang Tamu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Device select */}
          <div className="space-y-1.5">
            <Label>Pilih Device</Label>
            {loading ? (
              <Skeleton className="h-9 w-full" />
            ) : error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <WifiOff className="h-4 w-4" /> {error}
              </div>
            ) : (
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih device HA..." />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.device_id} value={d.device_id}>
                      <span className="font-medium">{d.name}</span>
                      {d.manufacturer && (
                        <span className="ml-1 text-muted-foreground text-xs">· {d.manufacturer}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Preview entities */}
          {selected && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Entities ({selected.entities.length})</Label>
              <div className="rounded-md border p-2 space-y-1">
                {selected.entities.map((e) => {
                  const domain = e.entity_id.split(".")[0];
                  const label = e.attributes.friendly_name || e.entity_id;
                  return (
                    <div key={e.entity_id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1">{domain}</Badge>
                        <Badge
                          variant={e.state === "on" ? "default" : "secondary"}
                          className="text-[10px] px-1"
                        >
                          {e.state}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={!deviceId || loading}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
