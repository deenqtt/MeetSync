// lib/meetily-ws-handler.ts
// WebSocket audio handler: terima raw PCM dari RPi, buffer, kirim ke Whisper, emit transcript.

import type { WebSocket, RawData } from "ws";
import type { IncomingMessage } from "http";
import {
  transcriptEvents,
  appendTranscript,
  TranscriptEntry,
} from "./meetily-transcript-events";

// ─── Audio constants ──────────────────────────────────────────────────────────
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BUFFER_SECONDS = 5;
// 5s × 16000 Hz × 1 ch × 2 bytes/sample = 160,000 bytes
const BUFFER_BYTES =
  BUFFER_SECONDS * SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);

// RMS threshold untuk deteksi silence — Int16 range 0–32767
// Silence biasanya RMS < 300, suara bicara biasanya > 800–2000
const SILENCE_RMS_THRESHOLD = 500;

// Filter hallucination Whisper yang sering muncul saat silence
const HALLUCINATION_PHRASES = [
  "terima kasih",
  "thank you",
  "thanks for watching",
  "sampai jumpa",
  "semoga bermanfaat",
  "subtitle",
  "subtitel",
];

// Lazy — dihitung saat dipanggil agar env sudah ter-load oleh Next.js
// Whisper service host. Decoupled from MQTT — used to reuse
// NEXT_PUBLIC_MQTT_HOST, which made env config confusing.
const getWhisperUrl = () =>
  `http://${process.env.NEXT_PUBLIC_MEETILY_HOST ?? "localhost"}:8178`;
const getNexaBrickSelfUrl = () =>
  `http://localhost:${process.env.PORT ?? "3500"}`;

// ─── Silence detection ────────────────────────────────────────────────────────

/** Hitung RMS energy dari buffer PCM Int16. Return true jika ada suara (bukan silence). */
function hasVoiceActivity(pcm: Buffer): boolean {
  if (pcm.length < 2) return false;
  let sumSq = 0;
  const samples = pcm.length / 2;
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const s = pcm.readInt16LE(i);
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / samples);
  return rms >= SILENCE_RMS_THRESHOLD;
}

/** Cek apakah teks adalah hallucination Whisper yang umum. */
function isHallucination(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Teks sangat pendek dan hanya satu kata / frasa common → skip
  if (lower.length < 3) return true;
  return HALLUCINATION_PHRASES.some(
    (p) => lower === p || lower === p + "." || lower === p + "!",
  );
}

// ─── WAV builder ─────────────────────────────────────────────────────────────

function buildWavBuffer(pcm: Buffer): Buffer {
  const byteRate = SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = CHANNELS * (BITS_PER_SAMPLE / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(dataSize + 36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format: PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

// ─── Whisper inference ────────────────────────────────────────────────────────

async function sendToWhisper(pcm: Buffer, meetingId: string): Promise<string> {
  if (pcm.length === 0) return "";

  const wavBuf = buildWavBuffer(pcm);
  const blob = new Blob([new Uint8Array(wavBuf)], { type: "audio/wav" });
  const form = new FormData();
  form.append("file", blob, "chunk.wav");
  form.append("language", "id");
  form.append("response_format", "json");
  form.append("temperature", "0.0");

  try {
    const res = await fetch(`${getWhisperUrl()}/inference`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(
        `[WS-Handler] Whisper ${res.status} for meetingId=${meetingId}`,
      );
      return "";
    }

    const data = (await res.json()) as { text?: string };
    return data.text?.trim() ?? "";
  } catch (err) {
    console.error(
      `[WS-Handler] Whisper fetch error (meetingId=${meetingId}):`,
      err,
    );
    return "";
  }
}

// ─── Per-connection handler ───────────────────────────────────────────────────

export function handleMeetilyWs(ws: WebSocket, _req: IncomingMessage) {
  let meetingId = "unknown";
  let started = false;
  let pcmBuffer = Buffer.alloc(0);

  console.log("[WS-Handler] New client connected");
  ws.send(JSON.stringify({ type: "connected" }));

  // Flush buffer ke Whisper, emit transcript
  async function flushBuffer() {
    if (pcmBuffer.length === 0) return;

    const chunk = pcmBuffer;
    pcmBuffer = Buffer.alloc(0);

    // ── VAD: skip jika buffer mostly silence ────────────────────────────────
    if (!hasVoiceActivity(chunk)) {
      console.log(`[WS-Handler] Skip silence chunk (meetingId=${meetingId})`);
      return;
    }

    console.log(
      `[WS-Handler] Flush ${chunk.length} bytes → meetingId=${meetingId}`,
    );

    const text = await sendToWhisper(chunk, meetingId);

    // ── Filter hallucination Whisper ────────────────────────────────────────
    if (!text || isHallucination(text)) {
      if (text) console.log(`[WS-Handler] Filter hallucination: "${text}"`);
      return;
    }

    const entry: TranscriptEntry = {
      meetingId,
      text,
      timestamp: new Date().toISOString(),
    };
    transcriptEvents.emit("transcript", entry);
    appendTranscript(meetingId, text);
    console.log(`[WS-Handler] Transcript: "${text.slice(0, 80)}..."`);
  }

  // Trigger stop + summary via internal POST ke route yang sudah ada
  async function handleStop() {
    await flushBuffer();

    console.log(
      `[WS-Handler] Triggering stop + summary for meetingId=${meetingId}`,
    );

    const params = new URLSearchParams();
    params.append("action", "stop");
    params.append("meetingId", meetingId);

    try {
      await fetch(`${getNexaBrickSelfUrl()}/api/meetily/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error("[WS-Handler] Failed to trigger summary:", err);
    }
  }

  ws.on("message", (data: RawData, isBinary: boolean) => {
    // ── Binary: raw PCM bytes dari mic ──────────────────────────────────────
    if (isBinary) {
      if (!started) return;

      const chunk = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);
      pcmBuffer = Buffer.concat([pcmBuffer, chunk]);

      // Flush setiap kali buffer sudah cukup besar
      if (pcmBuffer.length >= BUFFER_BYTES) {
        flushBuffer().catch((err) =>
          console.error("[WS-Handler] Flush error:", err),
        );
      }
      return;
    }

    // ── Text: JSON control message ───────────────────────────────────────────
    try {
      const msg = JSON.parse(data.toString()) as Record<string, string>;

      if (msg.type === "start") {
        meetingId = msg.meetingId ?? "unknown";
        started = true;
        pcmBuffer = Buffer.alloc(0);
        console.log(
          `[WS-Handler] START meetingId=${meetingId}, title="${msg.title ?? "Meeting"}"`,
        );
        return;
      }

      if (msg.type === "stop") {
        console.log(`[WS-Handler] STOP meetingId=${meetingId}`);
        handleStop().catch((err) =>
          console.error("[WS-Handler] Stop error:", err),
        );
        return;
      }
    } catch {
      // bukan JSON valid, abaikan
    }
  });

  ws.on("close", () => {
    console.log(`[WS-Handler] Disconnected meetingId=${meetingId}`);
    // Flush sisa buffer jika masih ada saat koneksi putus tiba-tiba
    if (started && pcmBuffer.length > 0) {
      flushBuffer().catch((err) =>
        console.error("[WS-Handler] Close-flush error:", err),
      );
    }
  });

  ws.on("error", (err) => {
    console.error(`[WS-Handler] Error (meetingId=${meetingId}):`, err);
  });
}
