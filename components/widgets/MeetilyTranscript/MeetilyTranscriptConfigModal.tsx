// components/widgets/MeetilyTranscript/MeetilyTranscriptConfigModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Settings } from "lucide-react";
import { showToast } from "@/lib/toast-utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig?: {
    widgetTitle: string;
  };
}

export const MeetilyTranscriptConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}: Props) => {
  const [widgetTitle, setWidgetTitle] = useState("Meeting Transcript");

  useEffect(() => {
    if (isOpen && initialConfig) {
      setWidgetTitle(initialConfig.widgetTitle || "Meeting Transcript");
    } else if (isOpen) {
      setWidgetTitle("Meeting Transcript");
    }
  }, [isOpen, initialConfig]);

  const handleSave = () => {
    if (!widgetTitle.trim()) {
      showToast.error("Widget title is required.");
      return;
    }
    onSave({ widgetTitle: widgetTitle.trim() });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-violet-500" />
            {initialConfig ? "Edit" : "Configure"} Meeting Transcript Widget
          </DialogTitle>
          <DialogDescription>
            Tampilkan real-time transcript dari Meetily yang direkam oleh Raspberry Pi di Smart Room.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Settings className="w-4 h-4" />
            Settings
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="widgetTitle">Widget Title *</Label>
              <Input
                id="widgetTitle"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
                placeholder="e.g., Meeting Transcript"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-2">Cara Kerja</p>
            <div className="space-y-1 text-xs">
              <p>1. NexaBrick Scheduler deteksi meeting mulai → kirim MQTT ke RPi</p>
              <p>2. RPi mulai rekam mic → kirim audio ke <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">POST /api/meetily/transcript</code></p>
              <p>3. NexaBrick forward ke Meetily Whisper → dapat teks</p>
              <p>4. Widget ini terima teks via SSE secara real-time</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            {initialConfig ? "Update" : "Create"} Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
