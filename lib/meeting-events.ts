// lib/meeting-events.ts
// Global EventEmitter singleton — shared antara scheduler dan SSE endpoint.
// Pakai global variable agar tidak di-reset saat Next.js hot reload di dev mode.

import { EventEmitter } from "events";

export interface MeetingStatusEvent {
  type: "status-change";
  meetingId: string;
  title: string;
  status: "ONGOING" | "COMPLETED";
  startTime: string;
  endTime: string;
}

export interface MeetingDataUpdatedEvent {
  type: "data-updated";
  newCount: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __meetingEvents: EventEmitter | undefined;
}

if (!global.__meetingEvents) {
  global.__meetingEvents = new EventEmitter();
  global.__meetingEvents.setMaxListeners(200);
}

export const meetingEvents = global.__meetingEvents;
