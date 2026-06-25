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
import { Trash2, Settings, List } from "lucide-react";
import { showToast } from "@/lib/toast-utils";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: any) => void;
    initialConfig?: {
        widgetTitle: string;
        limit?: number;
    };
}

export const TrashDetectionConfigModal = ({
    isOpen,
    onClose,
    onSave,
    initialConfig,
}: Props) => {
    const [widgetTitle, setWidgetTitle] = useState(
        initialConfig?.widgetTitle || "Trash Detection Alerts"
    );
    const [limit, setLimit] = useState<number>(initialConfig?.limit || 20);

    useEffect(() => {
        if (isOpen) {
            setWidgetTitle(initialConfig?.widgetTitle || "Trash Detection Alerts");
            setLimit(initialConfig?.limit || 20);
        }
    }, [isOpen, initialConfig]);

    const handleSave = () => {
        if (!widgetTitle.trim()) {
            showToast.error("Widget Title is required.");
            return;
        }
        onSave({
            widgetTitle: widgetTitle.trim(),
            limit: Number(limit)
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Trash2 className="h-5 w-5 text-red-500" />
                        Configure Trash Alerts
                    </DialogTitle>
                    <DialogDescription>
                        Atur tampilan list deteksi sampah di dashboard.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="widgetTitle">Widget Title</Label>
                        <Input
                            id="widgetTitle"
                            value={widgetTitle}
                            onChange={(e) => setWidgetTitle(e.target.value)}
                            placeholder="e.g. Trash Detection Gallery"
                        />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="limit">Alert Limit</Label>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                                {limit} items
                            </span>
                        </div>
                        <Input
                            id="limit"
                            type="number"
                            min={1}
                            max={100}
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
                        />
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <List className="h-3 w-3" />
                            Jumlah riwayat deteksi sampah yang akan ditampilkan.
                        </p>
                    </div>
                </div>

                <DialogFooter className="sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSave}>
                        <Settings className="h-4 w-4 mr-2" />
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
