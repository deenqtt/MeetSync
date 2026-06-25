"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

export interface HAAssistConfig {
  title: string;
  language: string;
  tts: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: Partial<HAAssistConfig>;
  onSave: (config: HAAssistConfig) => void;
}

export function HomeAssistantAssistConfigModal({ isOpen, onClose, initialConfig, onSave }: Props) {
  const [title, setTitle] = useState(initialConfig?.title || "");
  const [language, setLanguage] = useState(initialConfig?.language || "id");
  const [tts, setTts] = useState(initialConfig?.tts !== false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialConfig?.title || "");
    setLanguage(initialConfig?.language || "id");
    setTts(initialConfig?.tts !== false);
  }, [isOpen]);

  function handleSave() {
    onSave({
      title: title.trim() || "HA Assist",
      language,
      tts,
    });
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Home Assistant Assist — Config
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Widget Title</Label>
            <Input
              placeholder="e.g. Smart Room Assist"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Bahasa</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Indonesia (id-ID)</SelectItem>
                <SelectItem value="en">English (en-US)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Digunakan untuk voice input dan TTS output.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">Text-to-Speech (TTS)</Label>
              <p className="text-[11px] text-muted-foreground">
                Bacakan respons HA lewat speaker browser.
              </p>
            </div>
            <Switch checked={tts} onCheckedChange={setTts} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
