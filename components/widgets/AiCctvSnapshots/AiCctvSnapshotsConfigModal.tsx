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
import { showToast } from "@/lib/toast-utils";
import { LayoutList, CalendarClock } from "lucide-react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: any) => void;
    initialConfig?: {
        widgetTitle: string;
        clipMode?: "all" | "by-meeting";
    };
}

export const AiCctvSnapshotsConfigModal = ({
    isOpen,
    onClose,
    onSave,
    initialConfig,
}: Props) => {
    const [widgetTitle, setWidgetTitle] = useState(
        initialConfig?.widgetTitle || "AI CCTV Snapshots"
    );
    const [clipMode, setClipMode] = useState<"all" | "by-meeting">(
        initialConfig?.clipMode || "by-meeting"
    );

    useEffect(() => {
        if (isOpen) {
            setWidgetTitle(initialConfig?.widgetTitle || "AI CCTV Snapshots");
            setClipMode(initialConfig?.clipMode || "by-meeting");
        }
    }, [isOpen, initialConfig]);

    const handleSave = () => {
        if (!widgetTitle) {
            showToast.error("Widget Title is required.");
            return;
        }
        onSave({ widgetTitle, clipMode });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="text-xl">
                        Configure AI CCTV Snapshots
                    </DialogTitle>
                    <DialogDescription>
                        Atur tampilan dan mode pengambilan clip behavior.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 p-6">
                    <div className="grid gap-2">
                        <Label>Widget Title</Label>
                        <Input
                            value={widgetTitle}
                            onChange={(e) => setWidgetTitle(e.target.value)}
                            placeholder="e.g. AI CCTV Behavior Clips"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Clip Mode</Label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setClipMode("by-meeting")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                                    clipMode === "by-meeting"
                                        ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                <CalendarClock className="h-3.5 w-3.5" />
                                By Meeting
                            </button>
                            <button
                                onClick={() => setClipMode("all")}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                                    clipMode === "all"
                                        ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                <LayoutList className="h-3.5 w-3.5" />
                                All Clips
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            {clipMode === "by-meeting"
                                ? "Otomatis filter clips berdasarkan meeting yang sedang berlangsung."
                                : "Tampilkan semua clips dari semua meeting tanpa filter."}
                        </p>
                    </div>
                </div>
                <DialogFooter className="px-6 pb-6 sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSave} disabled={!widgetTitle}>
                        Save Widget
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
