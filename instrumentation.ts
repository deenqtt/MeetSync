// Boot-time background services for the standalone app (Node runtime only).
// Next.js calls register() once per server process at startup.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Never start background services during `next build` page-data collection.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Opt-out for local dev where you don't want the scheduler/MQTT running.
  if (process.env.DEV_SKIP_BG_SERVICES === "1") {
    console.log("[instrumentation] DEV_SKIP_BG_SERVICES=1 — background services skipped");
    return;
  }

  const { loggers } = await import("@/lib/logger");

  try {
    // Pre-warm the MQTT connection so the first meeting publish is fast.
    const { warmMqtt } = await import("@/lib/mqtt-env-bus");
    void warmMqtt();

    // Start the meeting scheduler (status transitions → MQTT/AI triggers).
    const { meetingScheduler } = await import("@/lib/services/meeting-scheduler");
    meetingScheduler.start();

    loggers.app.info("Background services started (MQTT warm + meeting scheduler)");
  } catch (err) {
    loggers.app.error(`Failed to start background services: ${(err as Error).message}`);
  }
}
