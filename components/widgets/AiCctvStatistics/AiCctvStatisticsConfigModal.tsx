"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface Config {
  widgetTitle: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Config) => void;
  initialConfig?: Config;
}

export const AiCctvStatisticsConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}: Props) => {
  const [widgetTitle, setWidgetTitle] = useState("Smart Room Stats");

  useEffect(() => {
    if (initialConfig) {
      setWidgetTitle(initialConfig.widgetTitle || "Smart Room Stats");
    }
  }, [initialConfig]);

  const handleSave = () => {
    onSave({
      widgetTitle: widgetTitle.trim() || "Smart Room Stats",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Configure Smart Room Stats</DialogTitle>
          <DialogDescription>
            Real-time stats dari AI service via WebSocket{" "}
            <code className="text-xs bg-muted px-1 rounded">/ws/frontend</code>.
            Menampilkan semua event dari meeting yang sedang aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label htmlFor="widgetTitle" className="text-right text-sm">
              Title
            </Label>
            <Input
              id="widgetTitle"
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.target.value)}
              placeholder="Smart Room Stats"
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Widget</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
