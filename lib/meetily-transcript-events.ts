// lib/meetily-transcript-events.ts
// Global EventEmitter untuk transcript Meetily — shared antara API route dan SSE endpoint.
// Pakai global variable agar tidak di-reset saat Next.js hot reload di dev mode.

import { EventEmitter } from "events"

export interface TranscriptEntry {
  meetingId: string
  text: string
  timestamp: string
}

export interface TranscriptStopEvent {
  meetingId: string
  timestamp: string
}

export interface SummaryEntry {
  meetingId: string
  summary: string
  timestamp: string
}

declare global {
  // eslint-disable-next-line no-var
  var __meetilyTranscriptEvents: EventEmitter | undefined
  // eslint-disable-next-line no-var
  var __meetilySummaryEvents: EventEmitter | undefined
  // eslint-disable-next-line no-var
  var __meetilyTranscriptStore: Map<string, string[]> | undefined
  // eslint-disable-next-line no-var
  var __meetilySummaryStore: Map<string, SummaryEntry> | undefined
}

if (!global.__meetilyTranscriptEvents) {
  global.__meetilyTranscriptEvents = new EventEmitter()
  global.__meetilyTranscriptEvents.setMaxListeners(100)
}

if (!global.__meetilySummaryEvents) {
  global.__meetilySummaryEvents = new EventEmitter()
  global.__meetilySummaryEvents.setMaxListeners(100)
}

if (!global.__meetilyTranscriptStore) {
  global.__meetilyTranscriptStore = new Map()
}

if (!global.__meetilySummaryStore) {
  global.__meetilySummaryStore = new Map()
}

export const transcriptEvents = global.__meetilyTranscriptEvents
export const summaryEvents    = global.__meetilySummaryEvents

// ─── Transcript accumulator helpers ──────────────────────────────────────────

export function appendTranscript(meetingId: string, text: string) {
  const store = global.__meetilyTranscriptStore!
  if (!store.has(meetingId)) store.set(meetingId, [])
  store.get(meetingId)!.push(text)
}

export function getTranscriptLines(meetingId: string): string[] {
  return global.__meetilyTranscriptStore?.get(meetingId) ?? []
}

export function clearTranscript(meetingId: string) {
  global.__meetilyTranscriptStore?.delete(meetingId)
}

// ─── Summary store helpers ────────────────────────────────────────────────────

export function storeSummary(entry: SummaryEntry) {
  global.__meetilySummaryStore?.set(entry.meetingId, entry)
  // Also keep a "latest" key for easy retrieval
  global.__meetilySummaryStore?.set("__latest__", entry)
}

export function getLatestSummary(): SummaryEntry | undefined {
  return global.__meetilySummaryStore?.get("__latest__")
}

export function getSummary(meetingId: string): SummaryEntry | undefined {
  return global.__meetilySummaryStore?.get(meetingId)
}
