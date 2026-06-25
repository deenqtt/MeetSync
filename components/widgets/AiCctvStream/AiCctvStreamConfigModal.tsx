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
import { Video, Settings, Camera, Globe, Loader2, RefreshCw } from "lucide-react";
import { showToast } from "@/lib/toast-utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: any) => void;
    initialConfig?: {
        widgetTitle: string;
        streamType?: "manual" | "ai";
        streamUrl: string;
        cameraId?: string;
    };
}

export const AiCctvStreamConfigModal = ({
    isOpen,
    onClose,
    onSave,
    initialConfig,
}: Props) => {
    const [widgetTitle, setWidgetTitle] = useState(initialConfig?.widgetTitle || "");
    const [streamType, setStreamType] = useState<"manual" | "ai">(initialConfig?.streamType || "manual");
    const [streamUrl, setStreamUrl] = useState(initialConfig?.streamUrl || "");
    const [cameraId, setCameraId] = useState(initialConfig?.cameraId || "");
    const [aiCameras, setAiCameras] = useState<any[]>([]);
    const [isLoadingCameras, setIsLoadingCameras] = useState(false);

    const getAiHost = () => {
        const host = process.env.NEXT_PUBLIC_AI_SERVICE_HOST;
        const port = process.env.NEXT_PUBLIC_AI_SERVICE_PORT || "8567";

        if (host) return `${host}:${port}`;
        if (typeof window !== "undefined") {
            return `${window.location.hostname}:${port}`;
        }
        return `10.8.0.82:${port}`;
    };

    useEffect(() => {
        if (isOpen) {
            if (initialConfig) {
                setWidgetTitle(initialConfig.widgetTitle);
                setStreamType(initialConfig.streamType || "manual");
                setStreamUrl(initialConfig.streamUrl);
                setCameraId(initialConfig.cameraId || "");
            } else {
                setWidgetTitle("AI CCTV Stream");
                setStreamType("manual");
                setStreamUrl("");
                setCameraId("");
            }

            if (streamType === "ai" || !initialConfig) {
                fetchAiCameras();
            }
        }
    }, [isOpen, initialConfig]);

    const fetchAiCameras = async () => {
        setIsLoadingCameras(true);
        try {
            const host = getAiHost();
            const response = await fetch(`http://${host}/api/cameras`);
            if (response.ok) {
                const data = await response.json();
                setAiCameras(data.cameras || []);
            } else {
                console.warn("Failed to fetch AI cameras");
            }
        } catch (error) {
            console.error("Error fetching AI cameras:", error);
        } finally {
            setIsLoadingCameras(false);
        }
    };

    const handleSave = () => {
        if (!widgetTitle.trim()) {
            showToast.warning("Validation Error", "Widget title is required");
            return;
        }

        if (streamType === "manual" && !streamUrl.trim()) {
            showToast.warning("Validation Error", "Stream URL is required for manual mode");
            return;
        }

        if (streamType === "ai" && !cameraId) {
            showToast.warning("Validation Error", "Please select an AI camera");
            return;
        }

        const finalStreamUrl = streamType === "ai"
            ? `http://${getAiHost()}/api/cameras/${cameraId}/snapshot`
            : streamUrl.trim();

        onSave({
            widgetTitle: widgetTitle.trim(),
            streamType,
            streamUrl: finalStreamUrl,
            cameraId: streamType === "ai" ? cameraId : undefined,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Configure AI Stream Widget
                    </DialogTitle>
                    <DialogDescription>
                        Enter the custom name and the AI Stream URL for this widget.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="widgetTitle">Widget Name</Label>
                        <Input
                            id="widgetTitle"
                            value={widgetTitle}
                            onChange={(e) => setWidgetTitle(e.target.value)}
                            placeholder="e.g., AI Detection Room 1"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Stream Source</Label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setStreamType("manual")}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${streamType === "manual"
                                    ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                            >
                                <Globe className="h-3.5 w-3.5" />
                                Manual URL
                            </button>
                            <button
                                onClick={() => {
                                    setStreamType("ai");
                                    fetchAiCameras();
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${streamType === "ai"
                                    ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                            >
                                <Camera className="h-3.5 w-3.5" />
                                AI Service
                            </button>
                        </div>
                    </div>

                    {streamType === "manual" ? (
                        <div className="grid gap-2">
                            <Label htmlFor="streamUrl">MJPEG URL</Label>
                            <Input
                                id="streamUrl"
                                value={streamUrl}
                                onChange={(e) => setStreamUrl(e.target.value)}
                                placeholder="http://192.168.x.x:5173/api/v1/stream?url=..."
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Use a direct MJPEG stream or a proxy URL.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="aiCamera">Select AI Camera</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={fetchAiCameras}
                                    disabled={isLoadingCameras}
                                >
                                    {isLoadingCameras ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                    )}
                                    Refresh
                                </Button>
                            </div>
                            <Select value={cameraId} onValueChange={setCameraId}>
                                <SelectTrigger id="aiCamera">
                                    <SelectValue placeholder={isLoadingCameras ? "Loading cameras..." : "Select a camera"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {aiCameras.length > 0 ? (
                                        aiCameras.map((cam) => (
                                            <SelectItem key={cam.id} value={cam.id}>
                                                <div className="flex flex-col">
                                                    <span>{cam.camera_name}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate opacity-70">
                                                        {cam.rtsp_url}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>
                                            No cameras found
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Video className="h-3 w-3" />
                                Fetched from AI System port 8567
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        <Video className="h-4 w-4 mr-2" />
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
