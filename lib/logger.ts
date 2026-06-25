// Centralized logger.
//
// Output format (deliberately compact + uniform across every emit):
//   2026-05-21T14:32:01.234Z INFO  [MQTT] Initializing clients
//   2026-05-21T14:32:01.998Z WARN  [SCHEDULER] No logging configurations found
//   2026-05-21T14:32:02.111Z ERROR [AUTH.LOGIN] Token verification failed
//
// Rules enforced here:
//   - No emoji in production logs (gated by NODE_ENV; dev keeps them so
//     local devs can still scan output by eye).
//   - No double-namespace (a single namespace per logger; nest with dot:
//     loggers.scheduler.info("[OEE] ...") becomes a namespace string).
//   - No language mixing — system logs are English-only. UI messages can
//     stay localised; that's a separate concern not handled here.
//   - Optional throttle helper — used by middleware/access log to drop
//     identical repeat lines within a window (kills polling spam).

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LEVEL_LABEL: Record<number, string> = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN ",
  [LogLevel.INFO]: "INFO ",
  [LogLevel.DEBUG]: "DEBUG",
};

// Always strip emoji from log lines (set LOG_KEEP_EMOJI=1 to bypass).
// Operators reading prod logs through Loki / Datadog / kubectl logs almost
// never want emoji in the stream; local devs who do can opt in via env.
const STRIP_EMOJI = process.env.LOG_KEEP_EMOJI !== "1";
// Unicode emoji range. Best-effort; covers BMP emoji + extended pictographs.
const EMOJI_RE =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}☀-➿⌀-⏿]/gu;

function sanitise(msg: string): string {
  if (!STRIP_EMOJI) return msg;
  return msg.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

export class Logger {
  private prefix: string;
  // Read each emit so runtime env overrides take effect without restart.
  // Cheap — a single env lookup + integer compare.
  private get effectiveLevel(): LogLevel {
    return currentLevel;
  }

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private emit(level: LogLevel, sink: (m: string, ...a: any[]) => void, msg: string, args: any[]) {
    if (this.effectiveLevel < level) return;
    const ts = new Date().toISOString();
    const line = `${ts} ${LEVEL_LABEL[level]} [${this.prefix}] ${sanitise(msg)}`;
    sink(line, ...args);
  }

  error(message: string, ...args: any[]) {
    this.emit(LogLevel.ERROR, console.error, message, args);
  }
  warn(message: string, ...args: any[]) {
    this.emit(LogLevel.WARN, console.warn, message, args);
  }
  info(message: string, ...args: any[]) {
    this.emit(LogLevel.INFO, console.log, message, args);
  }
  debug(message: string, ...args: any[]) {
    this.emit(LogLevel.DEBUG, console.log, message, args);
  }
}

// Pre-configured loggers per domain. Namespace strings are stable so
// log-grep across releases stays consistent.
export const loggers = {
  app: new Logger("APP"),
  mqtt: new Logger("MQTT"),
  service: new Logger("SERVICE"),
  scheduler: new Logger("SCHEDULER"),
  database: new Logger("DATABASE"),
  api: new Logger("API"),
  user: new Logger("USER"),
  device: new Logger("DEVICE"),
  alarm: new Logger("ALARM"),
  cleanup: new Logger("CLEANUP"),
  thermal: new Logger("THERMAL"),
  zigbee: new Logger("ZIGBEE"),
  lora: new Logger("LORA"),
  bill: new Logger("BILL"),
  calculation: new Logger("CALCULATION"),
  health: new Logger("HEALTH"),
  stats: new Logger("STATS"),
  gateway: new Logger("GATEWAY"),
  external: new Logger("EXTERNAL"),
  location: new Logger("LOCATION"),
  ruleChain: new Logger("RULE-CHAIN"),
  whatsapp: new Logger("WHATSAPP"),
  cctv: new Logger("CCTV"),
  meeting: new Logger("MEETING"),
  backup: new Logger("BACKUP"),
  oee: new Logger("OEE"),
  envBus: new Logger("ENV-BUS"),
};

// ─── Runtime log level ─────────────────────────────────────────────────────
function parseLevel(raw: string | undefined, fallback: LogLevel): LogLevel {
  if (!raw) return fallback;
  const key = raw.toUpperCase() as keyof typeof LogLevel;
  return LogLevel[key] ?? fallback;
}

const isProduction = process.env.NODE_ENV === "production";
let currentLevel: LogLevel = parseLevel(
  process.env.LOG_LEVEL,
  isProduction ? LogLevel.INFO : LogLevel.INFO,
);

/** Override the global log level at runtime (e.g. from /api/debug/log-level). */
export function setLogLevel(level: LogLevel | keyof typeof LogLevel) {
  currentLevel = typeof level === "string" ? LogLevel[level] : level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

// ─── Throttling helper ─────────────────────────────────────────────────────
//
// Used by access-log / polling endpoints that would otherwise flood the
// console with identical lines (e.g. GET /api/mqtt-config?active=false
// every 5 seconds from a widget). Returns true if the caller should emit
// the log, false if a duplicate within `windowMs` has already been emitted.
const throttleCache = new Map<string, number>();
export function shouldLog(key: string, windowMs = 60_000): boolean {
  const now = Date.now();
  const last = throttleCache.get(key);
  if (last && now - last < windowMs) return false;
  throttleCache.set(key, now);
  // Opportunistic GC so the cache doesn't grow unbounded.
  if (throttleCache.size > 1000) {
    for (const [k, t] of throttleCache) {
      if (now - t > windowMs * 2) throttleCache.delete(k);
    }
  }
  return true;
}

// ─── Global console scrubber ───────────────────────────────────────────────
//
// Monkey-patches console.{log,warn,error,info,debug} so EVERY log emitted
// by the process — including third-party libraries and code that hasn't
// migrated to the unified logger yet — passes through the same emoji-strip
// filter. Call `installConsoleScrubber()` once at process startup
// (instrumentation.ts). Idempotent.
let scrubberInstalled = false;

function scrubArg(a: any): any {
  if (typeof a !== "string") return a;
  if (!STRIP_EMOJI) return a;
  return a.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ");
}

// Repeat-line throttle for noisy callers (Next.js dev server access log,
// polling endpoints, etc.). The first occurrence within a window passes
// through; identical follow-ups within DUPE_WINDOW_MS are suppressed and
// a count summary is emitted once the window closes.
const DUPE_WINDOW_MS = 30_000;
interface DupeEntry { count: number; firstSeen: number; lastSink: Function; lastArgs: any[]; }
const dupeCache = new Map<string, DupeEntry>();

// Normalize a log line so functionally-identical messages collapse:
//   "GET /api/mqtt-config?active=false 200 in 75ms"
//   "GET /api/mqtt-config?active=false 200 in 88ms"
//                                              ↑ different but really the same line
function fingerprintArgs(args: any[]): string {
  const joined = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
  return joined
    // Collapse "in 75ms" / "in 1.2s" timing tails
    .replace(/\bin \d+(?:\.\d+)?\s*m?s\b/g, "in Xms")
    // Collapse anything that looks like an ISO timestamp
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z+-]+/g, "TS")
    // Collapse hex IDs / port numbers in some logs
    .replace(/:\d{4,5}\b/g, ":PORT");
}

function emitSummary(fp: string, entry: DupeEntry) {
  if (entry.count > 1) {
    const span = ((Date.now() - entry.firstSeen) / 1000).toFixed(0);
    entry.lastSink(`… (${entry.count - 1} more identical lines suppressed over ${span}s)`);
  }
  dupeCache.delete(fp);
}

function maybeSuppress(args: any[], sink: Function): boolean {
  const fp = fingerprintArgs(args);
  if (!fp.trim()) return false; // empty / non-string — never throttle
  const now = Date.now();
  const existing = dupeCache.get(fp);
  if (existing && now - existing.firstSeen < DUPE_WINDOW_MS) {
    existing.count++;
    existing.lastSink = sink;
    existing.lastArgs = args;
    return true; // suppress
  }
  if (existing) emitSummary(fp, existing); // window closed; flush
  dupeCache.set(fp, { count: 1, firstSeen: now, lastSink: sink, lastArgs: args });
  return false;
}

// Periodic flusher — push out suppression summaries for cache entries that
// went quiet (no new dupes) so the count doesn't sit silent forever.
setInterval(() => {
  const now = Date.now();
  for (const [fp, entry] of dupeCache) {
    if (now - entry.firstSeen >= DUPE_WINDOW_MS) {
      emitSummary(fp, entry);
    }
  }
}, DUPE_WINDOW_MS).unref?.();

export function installConsoleScrubber(): void {
  if (scrubberInstalled) return;
  scrubberInstalled = true;
  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };
  const wrap = (sink: Function) => (...args: any[]) => {
    if (maybeSuppress(args, sink)) return;
    sink(...args.map(scrubArg));
  };
  console.log = wrap(orig.log);
  console.warn = wrap(orig.warn);
  console.info = wrap(orig.info);
  console.debug = wrap(orig.debug);
  // Errors NEVER get throttled — every error matters.
  console.error = (...args: any[]) => orig.error(...args.map(scrubArg));
}

export default loggers.app;
