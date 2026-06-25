// lib/services/meeting-scheduler.ts
// Meeting Scheduler — deteksi transisi status meeting (UPCOMING→ONGOING→COMPLETED)
// berdasarkan data dari external API (tidak ada tabel Meeting di Prisma).
// Saat transisi → emit SSE event + publish MQTT ke RPi untuk start/stop recording.

import { getAiServiceBaseUrl } from "@/lib/utils/ai-service";
import { loggers } from "@/lib/logger";
import { meetingEvents, MeetingStatusEvent } from "@/lib/meeting-events";
import {
    fetchSmartRoomMeetings,
    getCachedSmartRoomMeetings,
    NexaBrickMeeting,
} from "@/lib/meeting-external";
import { MeetingDataUpdatedEvent } from "@/lib/meeting-events";
// MQTT publishes go through lib/mqtt-env-bus.ts (singleton). The direct
// `mqtt`/`fs`/`path` imports are no longer needed here.

const MEETILY_TOPIC = "meetily/recording/command";

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Jakarta";

// Was: own mqtt.connect() singleton. Now uses the shared env-bus
// (lib/mqtt-env-bus.ts), so meeting-scheduler shares the same persistent
// MQTT connection as the access-controller routes and any other Bus A
// consumer. The first publishEnv() call lazy-initialises the connection.

function toLocalDate(date: Date): Date {
    return new Date(date.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
}

function getTodayStr(): string {
    const local = toLocalDate(new Date());
    return [
        local.getFullYear(),
        String(local.getMonth() + 1).padStart(2, "0"),
        String(local.getDate()).padStart(2, "0"),
    ].join("-");
}

class MeetingSchedulerService {
    private static instance: MeetingSchedulerService;
    private isRunning = false;
    private nextCheckTimeoutId: NodeJS.Timeout | null = null;
    private fallbackIntervalId: NodeJS.Timeout | null = null;
    private fetchIntervalId: NodeJS.Timeout | null = null;

    private readonly FALLBACK_INTERVAL = 2 * 60 * 1000; // 2 menit
    private readonly FETCH_INTERVAL = 2 * 60 * 1000; // 2 menit

    // In-memory status tracker: meetingId → status terakhir yang sudah di-emit
    private statusMap = new Map<string, "UPCOMING" | "ONGOING" | "COMPLETED">();

    // Data meeting terbaru (dipakai untuk schedule precise timeout)
    private meetingsData: NexaBrickMeeting[] = [];

    // Set ID meeting yang sudah diketahui — untuk deteksi meeting baru
    private knownMeetingIds = new Set<string>();

    private constructor() { }

    static getInstance(): MeetingSchedulerService {
        if (!MeetingSchedulerService.instance) {
            MeetingSchedulerService.instance = new MeetingSchedulerService();
        }
        return MeetingSchedulerService.instance;
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        // Pre-warm env-bus MQTT connection so the first meeting publish
        // doesn't pay the connect handshake on the critical path. Fire-and-
        // forget — the start() signature stays sync to match existing callers.
        import("@/lib/mqtt-env-bus")
            .then(({ publishEnv }) =>
                publishEnv(
                    "meetily/scheduler/probe",
                    { ping: Date.now() },
                    { qos: 0 },
                ).catch(() => {}),
            )
            .catch(() => {
                /* retry on first real publish */
            });

        // Wire cache-updated callback — saat API route fetch fresh data, langsung cek transisi
        global.__onMeetingCacheUpdated = () => {
            // console.log(
            //     "[MeetingScheduler] 🔄 Cache diperbarui — re-check transisi segera",
            // );
            this.checkAndUpdateStatuses();
        };

        // Cek langsung saat start
        this.checkAndUpdateStatuses();

        // Fallback interval — jaga-jaga kalau precise timeout miss
        this.fallbackIntervalId = setInterval(
            () => this.checkAndUpdateStatuses(),
            this.FALLBACK_INTERVAL,
        );

        // Refresh data meeting tiap 5 menit agar selalu sinkron dengan external API
        this.fetchIntervalId = setInterval(
            () => this.refreshMeetingData(),
            this.FETCH_INTERVAL,
        );

        loggers.service.info(
            `✅ Meeting Scheduler started (timezone: ${APP_TIMEZONE})`,
        );
    }

    stop(): void {
        if (this.nextCheckTimeoutId) clearTimeout(this.nextCheckTimeoutId);
        if (this.fallbackIntervalId) clearInterval(this.fallbackIntervalId);
        if (this.fetchIntervalId) clearInterval(this.fetchIntervalId);
        this.nextCheckTimeoutId = null;
        this.fallbackIntervalId = null;
        this.fetchIntervalId = null;
        this.isRunning = false;
        global.__onMeetingCacheUpdated = undefined;

        // env-bus connection is shared — don't disconnect it here. Process
        // shutdown handlers in lib/mqtt-env-bus.ts handle final cleanup.
        loggers.service.info("Meeting Scheduler stopped.");
    }

    // ── Ambil data meeting: selalu force fetch (bypass cache) tiap interval ───
    private async refreshMeetingData(): Promise<NexaBrickMeeting[]> {
        try {
            // Matikan sementara callback agar fetch ini tidak trigger dirinya sendiri
            const savedCallback = global.__onMeetingCacheUpdated;
            global.__onMeetingCacheUpdated = undefined;
            const fresh = await fetchSmartRoomMeetings(true);
            global.__onMeetingCacheUpdated = savedCallback;
            this.meetingsData = fresh;

            // Deteksi meeting baru yang belum diketahui sebelumnya
            if (this.knownMeetingIds.size > 0) {
                const newMeetings = fresh.filter((m) => !this.knownMeetingIds.has(m.id));
                if (newMeetings.length > 0) {
                    loggers.meeting.info(`🆕 ${newMeetings.length} meeting new detected — emit data-updated`);
                    const event: MeetingDataUpdatedEvent = { type: "data-updated", newCount: newMeetings.length };
                    meetingEvents.emit("data-updated", event);
                }
            }

            // Update known IDs
            for (const m of fresh) this.knownMeetingIds.add(m.id);

            return fresh;
        } catch (err) {
            loggers.meeting.warn("Fetch failed, using last cached data:", err);
            return this.meetingsData;
        }
    }

    // ── Publish MQTT ke RPi ───────────────────────────────────────────────────
    private async publishRecordingCommand(
        action: "start" | "stop",
        meeting: { id: string; title: string; startTime: string; endTime: string },
    ): Promise<void> {
        try {
            const { publishEnv } = await import("@/lib/mqtt-env-bus");
            await publishEnv(
                MEETILY_TOPIC,
                {
                    action,
                    meetingId: meeting.id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                    timestamp: new Date().toISOString(),
                },
                { qos: 1, retain: false },
            );
            loggers.meeting.info(`📡 MQTT ✓ ${action.toUpperCase()} "${meeting.title}"`,
            );
        } catch (err: any) {
            loggers.meeting.warn(`📡 MQTT publish FAILED (${action}):`,
                err?.message ?? err,
            );
        }
    }

    // ── Trigger AI Pipeline via HTTP (stream diatur dari widget, bukan scheduler) ──
    private async triggerAiPipeline(
        action: "start" | "stop",
        meeting: { id: string; title: string; startTime: string; endTime: string; participants?: { name: string }[] },
    ): Promise<void> {
        const baseUrl = getAiServiceBaseUrl();

        try {
            if (action === "start") {
                loggers.meeting.info(`🧠 Starting AI pipeline for meeting "${meeting.title}"...`);
                const res = await fetch(`${baseUrl}/ai/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        meeting_id: meeting.id,
                        meeting_name: meeting.title,
                        participants: meeting.participants?.map((p) => p.name) ?? [],
                    }),
                    signal: AbortSignal.timeout(15000),
                });
                if (res.ok) {
                    const data = await res.json();
                    loggers.meeting.info(`🧠 AI Pipeline Started ✓ status: ${data.status}`);
                } else {
                    loggers.meeting.warn(`🧠 AI Pipeline Start FAILED (${res.status}) — may be already running`);
                }

            } else if (action === "stop") {
                loggers.meeting.info(`🧠 Stopping AI pipeline for meeting "${meeting.title}"...`);
                const res = await fetch(`${baseUrl}/ai/stop`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ meeting_id: meeting.id }),
                    signal: AbortSignal.timeout(15000),
                });
                if (res.ok) {
                    const data = await res.json();
                    loggers.meeting.info(`🧠 AI Pipeline Stopped ✓ status: ${data.status}`);

                    // Trigger immediate trash scan to check for leftover items
                    await this.triggerTrashScan();
                } else {
                    loggers.meeting.warn(`🧠 AI Pipeline Stop FAILED (${res.status})`);
                }
            }
        } catch (err) {
            loggers.meeting.warn(`🧠 AI Pipeline ${action.toUpperCase()} Error:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    // ── Control Trash Scanner (activate / deactivate) ─────────────────────────
    private async controlTrashScanner(action: "activate" | "deactivate"): Promise<void> {
        const baseUrl = getAiServiceBaseUrl();

        try {
            loggers.meeting.info(`🗑️ Trash scanner → ${action.toUpperCase()}...`);
            const res = await fetch(`${baseUrl}/api/trash/${action}`, {
                method: "POST",
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
                loggers.meeting.info(`🗑️ Trash scanner ${action.toUpperCase()} ✓`);
            } else {
                loggers.meeting.warn(`🗑️ Trash scanner ${action} FAILED (${res.status})`);
            }
        } catch (err) {
            loggers.meeting.warn(`🗑️ Trash scanner ${action} Error:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    // ── Trigger Trash Detection Scan (one-time, bypass cooldown) ──────────────
    private async triggerTrashScan(): Promise<void> {
        const baseUrl = getAiServiceBaseUrl();

        try {
            loggers.meeting.info(`🗑️ Triggering post-meeting Trash Scan...`);
            const res = await fetch(`${baseUrl}/api/trash/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}), // Scan all cameras
                signal: AbortSignal.timeout(30000), // Longer timeout for multi-camera scan
            });

            if (res.ok) {
                const data = await res.json();
                loggers.meeting.info(`🗑️ Trash Scan Triggered ✓ cameras: ${data.cameras_scanned}, alerts: ${data.alerts_generated}`);
            } else {
                loggers.meeting.warn(`🗑️ Trash Scan Trigger FAILED (${res.status})`);
            }
        } catch (err) {
            loggers.meeting.warn(`🗑️ Trash Scan Error:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    // ── Set timeout tepat di waktu meeting berikutnya mulai/selesai ──────────
    private scheduleNextPreciseCheck(meetings: NexaBrickMeeting[]): void {
        if (!this.isRunning) return;
        if (this.nextCheckTimeoutId) {
            clearTimeout(this.nextCheckTimeoutId);
            this.nextCheckTimeoutId = null;
        }

        const nowLocal = toLocalDate(new Date());
        const nowSecs =
            nowLocal.getHours() * 3600 +
            nowLocal.getMinutes() * 60 +
            nowLocal.getSeconds();

        const candidates: number[] = [];

        for (const m of meetings) {
            if (m.status === "UPCOMING") {
                const [sh, sm] = m.startTime.split(":").map(Number);
                const startSecs = sh * 3600 + sm * 60;
                if (startSecs > nowSecs) candidates.push(startSecs);
            } else if (m.status === "ONGOING") {
                const [eh, em] = m.endTime.split(":").map(Number);
                const endSecs = eh * 3600 + em * 60;
                if (endSecs > nowSecs) candidates.push(endSecs);
            }
        }

        if (candidates.length === 0) return;

        const nextSecs = Math.min(...candidates);
        const msUntil = (nextSecs - nowSecs) * 1000;

        if (msUntil <= 0) return;

        // console.log(
        //     `[MeetingScheduler] ⏱ Precise check in ${(msUntil / 1000).toFixed(1)}s`,
        // );
        // +500ms buffer agar cek tepat setelah menit berganti
        this.nextCheckTimeoutId = setTimeout(
            () => this.checkAndUpdateStatuses(),
            msUntil + 500,
        );
    }

    // ── Main: cek transisi status dan kirim event ─────────────────────────────
    private async checkAndUpdateStatuses(): Promise<void> {
        if (!this.isRunning) return;

        try {
            const meetings = await this.refreshMeetingData();
            const today = getTodayStr();
            const todayMeetings = meetings.filter((m) => m.date === today);

            const nowLocal = toLocalDate(new Date());
            const hh = String(nowLocal.getHours()).padStart(2, "0");
            const mm = String(nowLocal.getMinutes()).padStart(2, "0");

            // console.log(
            //     `[MeetingScheduler] ⏰ Tick ${today} ${hh}:${mm} — ${todayMeetings.length} meeting hari ini`,
            // );

            let ongoingCount = 0;
            let completedCount = 0;

            for (const meeting of todayMeetings) {
                const currentStatus = meeting.status; // sudah dihitung deriveStatus() di transformMeeting()
                const prevStatus = this.statusMap.get(meeting.id);

                // Pertama kali lihat meeting ini → simpan status, jangan emit
                // (hindari double-trigger kalau server restart saat meeting sedang berlangsung)
                if (prevStatus === undefined) {
                    this.statusMap.set(meeting.id, currentStatus);
                    continue;
                }

                // Tidak ada perubahan → skip
                if (prevStatus === currentStatus) continue;

                // Status berubah → update map
                this.statusMap.set(meeting.id, currentStatus);

                const baseEvent = {
                    type: "status-change" as const,
                    meetingId: meeting.id,
                    title: meeting.title,
                    startTime: meeting.startTime,
                    endTime: meeting.endTime,
                };

                if (currentStatus === "ONGOING" && prevStatus === "UPCOMING") {
                    // ── UPCOMING → ONGOING ──────────────────────────────────────────
                    ongoingCount++;
                    loggers.meeting.info(`🟢 → ONGOING: "${meeting.title}" (${meeting.startTime}–${meeting.endTime})`,
                    );
                    const event: MeetingStatusEvent = { ...baseEvent, status: "ONGOING" };
                    meetingEvents.emit("status-change", event);
                    this.publishRecordingCommand("start", meeting);
                    this.triggerAiPipeline("start", meeting);
                    this.controlTrashScanner("deactivate"); // Matikan trash scanner selama meeting
                    loggers.service.info(
                        `[MeetingScheduler] → ONGOING: "${meeting.title}" (${meeting.startTime}–${meeting.endTime})`,
                    );
                } else if (currentStatus === "COMPLETED") {
                    // ── → COMPLETED ─────────────────────────────────────────────────
                    completedCount++;
                    loggers.meeting.info(`⬛ → COMPLETED: "${meeting.title}" (prevStatus: ${prevStatus})`,
                    );
                    const event: MeetingStatusEvent = {
                        ...baseEvent,
                        status: "COMPLETED",
                    };
                    meetingEvents.emit("status-change", event);

                    // Kirim MQTT stop hanya kalau sebelumnya ONGOING (ada recording aktif)
                    if (prevStatus === "ONGOING") {
                        this.publishRecordingCommand("stop", meeting);
                        this.triggerAiPipeline("stop", meeting); // Di dalamnya sudah memanggil triggerTrashScan()
                        this.controlTrashScanner("activate"); // Aktifkan kembali trash scanner setelah meeting
                    }
                    loggers.service.info(
                        `[MeetingScheduler] → COMPLETED: "${meeting.title}"`,
                    );
                }
            }

            if (ongoingCount > 0 || completedCount > 0) {
                loggers.meeting.info(`✅ ${ongoingCount} → ONGOING, ${completedCount} → COMPLETED`,
                );
            }

            // Jadwalkan cek berikutnya tepat di waktu event terdekat
            this.scheduleNextPreciseCheck(todayMeetings);
        } catch (err) {
            loggers.meeting.error("❌ Error:", err);
            loggers.service.error("[MeetingScheduler] Error:", err);
        }
    }
}

export const meetingScheduler = MeetingSchedulerService.getInstance();
