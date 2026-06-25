// components/widgets/MeetilySummary/MeetilySummaryConfigModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Mail, Send } from "lucide-react";

export interface MeetilySummaryConfig {
  widgetTitle: string;
  sendWhatsapp: boolean;
  sendEmail: boolean;
  sendTelegram: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: MeetilySummaryConfig) => void;
  initialConfig?: Partial<MeetilySummaryConfig>;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}

function ToggleRow({ icon, label, description, checked, onChange, color }: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
        checked
          ? `border-${color}-200 bg-${color}-50 dark:border-${color}-800 dark:bg-${color}-900/20`
          : "border-border bg-muted/30"
      }`}
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        <div className={`${checked ? `text-${color}-600 dark:text-${color}-400` : "text-muted-foreground"}`}>
          {icon}
        </div>
        <div>
          <p className={`text-sm font-medium ${checked ? `text-${color}-700 dark:text-${color}-300` : "text-foreground"}`}>
            {label}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {/* Custom toggle */}
      <div
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          checked ? `bg-${color}-500` : "bg-muted-foreground/30"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

export const MeetilySummaryConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}: Props) => {
  const [widgetTitle, setWidgetTitle] = useState("Meeting Summary");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendTelegram, setSendTelegram] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWidgetTitle(initialConfig?.widgetTitle ?? "Meeting Summary");
      setSendWhatsapp(initialConfig?.sendWhatsapp ?? false);
      setSendEmail(initialConfig?.sendEmail ?? false);
      setSendTelegram(initialConfig?.sendTelegram ?? false);
    }
  }, [isOpen, initialConfig]);

  const handleSave = () => {
    onSave({
      widgetTitle: widgetTitle.trim() || "Meeting Summary",
      sendWhatsapp,
      sendEmail,
      sendTelegram,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Meeting Summary</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Widget Title */}
          <div className="space-y-1.5">
            <Label htmlFor="widgetTitle">Widget Title</Label>
            <Input
              id="widgetTitle"
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.target.value)}
              placeholder="Meeting Summary"
            />
          </div>

          {/* Notification Section */}
          <div className="space-y-2">
            <Label>Kirim Ringkasan ke Peserta</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Setelah ringkasan AI selesai dibuat, otomatis dikirim ke semua peserta rapat.
            </p>
            <div className="space-y-2 pt-1">
              <ToggleRow
                icon={<MessageCircle className="w-4 h-4" />}
                label="WhatsApp"
                description="Kirim via WhatsApp ke nomor peserta"
                checked={sendWhatsapp}
                onChange={setSendWhatsapp}
                color="green"
              />
              <ToggleRow
                icon={<Mail className="w-4 h-4" />}
                label="Email"
                description="Kirim ringkasan ke email peserta"
                checked={sendEmail}
                onChange={setSendEmail}
                color="blue"
              />
              <ToggleRow
                icon={<Send className="w-4 h-4" />}
                label="Telegram"
                description="Kirim notifikasi via Telegram"
                checked={sendTelegram}
                onChange={setSendTelegram}
                color="violet"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Ringkasan dibuat otomatis menggunakan Groq LLM setelah rekaman dihentikan.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
