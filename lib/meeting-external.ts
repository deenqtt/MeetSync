// lib/meeting-external.ts
// Fetch + transform data from external meeting API (read-only).
// The endpoint is already filtered for Smart Room on the server side - no additional filtering needed here.

const BASE_URL =
  process.env.MEETING_EXTERNAL_API_URL ?? "https://meeting-backend.iotech.my.id"

// Dedicated Smart Room endpoint - change via env var if needed
const SMART_ROOM_ENDPOINT =
  process.env.MEETING_SMART_ROOM_ENDPOINT ?? "/meetings/byroom/Smart%20Room"

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Jakarta"

// ── External API types ────────────────────────────────────────────────────────

export interface ExternalMeeting {
  id: number
  name: string
  date: string   // "YYYY-MM-DD"
  start: number  // seconds since midnight
  end: number    // seconds since midnight
  status: string // "OUTSTANDING" | "APPROVED" | "DONE"
  online: boolean
  meetingLink: string
  meetingSummary: string
  meetingParticipants: Array<{
    id: number
    extUserId: number
    rsvpStatus: string
    actualRsvpStatus: string
  }>
  meetingAgendas: Array<{
    id: number
    agenda: string
    sequenceNumber: number
  }>
  place: { id: number; name: string } | null
  room: { id: number; name: string } | null
  createdAt: string
  updatedAt: string
}

interface ExtUser {
  id: number
  name: string
  email: string
  departmentName: string
}

// ── NexaBrick-facing types ────────────────────────────────────────────────────────

export interface NexaBrickParticipant {
  extUserId: number
  name: string
  email?: string
  department?: string
  rsvpStatus: string
  actualRsvpStatus: string
}

export interface NexaBrickMeeting {
  id: string
  title: string
  type: "VIRTUAL" | "PHYSICAL"
  status: "UPCOMING" | "ONGOING" | "COMPLETED"
  meetingLink?: string | null
  location?: string | null   // room.name ?? place.name
  date: string               // "YYYY-MM-DD"
  startTime: string          // "HH:mm"
  endTime: string            // "HH:mm"
  agenda?: string | null
  summary?: string | null
  participantCount: number
  participants: NexaBrickParticipant[]
  createdAt: string
  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function secsToTime(s: number): string {
  if (!s || s <= 0) return "00:00"
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function getNowJakarta(): { dateStr: string; totalSecs: number } {
  const now = new Date()
  const local = new Date(now.toLocaleString("en-US", { timeZone: APP_TIMEZONE }))
  const dateStr = [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, "0"),
    String(local.getDate()).padStart(2, "0"),
  ].join("-")
  const totalSecs = local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds()
  return { dateStr, totalSecs }
}

export function deriveStatus(
  date: string,
  start: number,
  end: number
): "UPCOMING" | "ONGOING" | "COMPLETED" {
  const { dateStr, totalSecs } = getNowJakarta()
  if (date < dateStr) return "COMPLETED"
  if (date > dateStr) return "UPCOMING"
  // same day
  if (end > 0 && end <= totalSecs) return "COMPLETED"
  if (start > 0 && start <= totalSecs) return "ONGOING"
  return "UPCOMING"
}

export function transformMeeting(
  ext: ExternalMeeting,
  userMap: Map<number, ExtUser>
): NexaBrickMeeting {
  const agenda = ext.meetingAgendas
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map((a) => a.agenda)
    .filter(Boolean)
    .join("\n") || null

  const participants: NexaBrickParticipant[] = ext.meetingParticipants.map((p) => {
    const user = userMap.get(p.extUserId)
    return {
      extUserId: p.extUserId,
      name: user?.name ?? `User #${p.extUserId}`,
      email: user?.email?.trim() || undefined,
      department: user?.departmentName || undefined,
      rsvpStatus: p.rsvpStatus,
      actualRsvpStatus: p.actualRsvpStatus,
    }
  })

  return {
    id: String(ext.id),
    title: ext.name,
    type: ext.online ? "VIRTUAL" : "PHYSICAL",
    status: deriveStatus(ext.date, ext.start, ext.end),
    meetingLink: ext.online && ext.meetingLink ? ext.meetingLink : null,
    location: ext.room?.name ?? ext.place?.name ?? null,
    date: ext.date,
    startTime: secsToTime(ext.start),
    endTime: secsToTime(ext.end),
    agenda,
    summary: ext.meetingSummary || null,
    participantCount: ext.meetingParticipants.length,
    participants,
    createdAt: ext.createdAt,
    updatedAt: ext.updatedAt,
  }
}

// ── Cache (module-level, survives hot reload via global) ──────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __meetingCache: { data: ExternalMeeting[]; ts: number } | undefined
  // eslint-disable-next-line no-var
  var __extUsersCache: { data: Map<number, ExtUser>; ts: number } | undefined
  // eslint-disable-next-line no-var
  var __onMeetingCacheUpdated: (() => void) | undefined
}

const CACHE_TTL = 5 * 60 * 1000 // 5 menit

/** Clear meetings + ext-users cache to trigger fresh fetch to external API. */
export function clearMeetingCache(): void {
  global.__meetingCache = undefined
  global.__extUsersCache = undefined
}

async function fetchRawMeetings(force = false): Promise<ExternalMeeting[]> {
  const now = Date.now()
  if (!force && global.__meetingCache && now - global.__meetingCache.ts < CACHE_TTL) {
    return global.__meetingCache.data
  }
  const res = await fetch(`${BASE_URL}${SMART_ROOM_ENDPOINT}`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Meeting API error: ${res.status}`)
  const data: ExternalMeeting[] = await res.json()
  global.__meetingCache = { data, ts: now }
  // Inform scheduler that cache was just updated - re-check transitions immediately
  setTimeout(() => global.__onMeetingCacheUpdated?.(), 0)
  return data
}

async function fetchExtUsers(force = false): Promise<Map<number, ExtUser>> {
  const now = Date.now()
  if (!force && global.__extUsersCache && now - global.__extUsersCache.ts < CACHE_TTL) {
    return global.__extUsersCache.data
  }
  const res = await fetch(`${BASE_URL}/ext-users/`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Ext-users API error: ${res.status}`)
  const users: ExtUser[] = await res.json()
  const map = new Map<number, ExtUser>()
  for (const u of users) {
    if (u.id) map.set(u.id, u)
  }
  global.__extUsersCache = { data: map, ts: now }
  return map
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Baca meetings HANYA dari cache tanpa trigger fetch ke external API.
 * Returns null jika cache kosong atau expired.
 * Used by the scheduler to avoid timeouts if the external API is slow.
 */
export function getCachedSmartRoomMeetings(): NexaBrickMeeting[] | null {
  const now = Date.now()
  if (!global.__meetingCache || now - global.__meetingCache.ts >= CACHE_TTL) return null
  if (!global.__extUsersCache || now - global.__extUsersCache.ts >= CACHE_TTL) return null
  return global.__meetingCache.data
    .map((m) => transformMeeting(m, global.__extUsersCache!.data))
}

/**
 * Fetch meetings dari dedicated Smart Room endpoint, transform + participant resolved.
 * Data is cached for 5 minutes (for API routes / web requests).
 * Pass force=true to bypass cache and hit external API directly.
 */
export async function fetchSmartRoomMeetings(force = false): Promise<NexaBrickMeeting[]> {
  const [raw, userMap] = await Promise.all([fetchRawMeetings(force), fetchExtUsers(force)])
  return raw.map((m) => transformMeeting(m, userMap))
}

/**
 * Fetch a single meeting by ID from external API.
 */
export async function fetchSmartRoomMeetingById(id: string): Promise<NexaBrickMeeting | null> {
  const [res, userMap] = await Promise.all([
    fetch(`${BASE_URL}/meetings/${id}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }),
    fetchExtUsers(),
  ])
  if (res.status === 404 || !res.ok) return null
  const ext: ExternalMeeting = await res.json()
  return transformMeeting(ext, userMap)
}
