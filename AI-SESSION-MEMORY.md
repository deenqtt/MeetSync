# AI Session Memory / Handoff — nexabrick-internal

> **Baca ini dulu** sebelum kerja. File ini meneruskan konteks dari session yang membangun app ini (dari folder `~/Documents/dev/meeting-module-export`). Memory `~/.claude/...` tidak ikut pindah antar folder, jadi semua yang perlu diketahui dirangkum di sini.

## Siapa user & cara kerja
- User berbahasa **Indonesia** — balas dalam Bahasa Indonesia.
- Email: vio.intelligent@gmail.com.
- Tanggal acuan terakhir: 2026-06-25.

## ATURAN PENTING (jangan dilanggar)
- **JANGAN run script/test/server tanpa izin eksplisit.** Jangan `npm run dev`, `prisma migrate`, `npm run seed`, `curl`, dll. sampai user bilang "jalankan/test/coba". Setelah buat/edit file → **berhenti & lapor**, tunggu perintah. (User sudah pernah menegur soal ini.)
- Aksi destruktif (drop tabel, hapus file yang bukan kamu buat) → **konfirmasi dulu**.

## Apa app ini
Aplikasi **standalone internal-only** hasil ekstraksi 3 modul dari NexaBrick core (`~/Documents/dev/NexaBrick-WebApps`), supaya core kembali murni IoT building/DCIM. 3 modul:
- **Meeting / Smart Room** — dashboard meeting, scheduler transisi status, trigger MQTT recording + AI pipeline (transcript/summary), data dari external API (iotech.my.id) + in-memory cache (TANPA tabel Prisma).
- **CCTV / RTSP direct** — surveillance (Shinobi + RTSP via AI service), zone editor, widget stream/snapshot/statistics, trash detection. **Satu-satunya modul yang punya tabel Prisma** (`Cctv`).
- **Home Assistant** — kontrol device HA via REST + widget assist (TANPA tabel Prisma).

Sumber kode asli + dokumen analisis lengkap ada di folder **`~/Documents/dev/meeting-module-export`** (README.md = mapping 45 file, EXECUTION-PLAN.md = rencana Fase 0–6, TASK-*.md = analisis). Lihat sana kalau perlu konteks granular.

## Status (per 2026-06-25)
- **Fase 0–5 SELESAI.** App sudah jalan di tingkat build:
  - `npx tsc --noEmit` → **0 error**
  - `npx prisma generate` → ok
  - `npm run build` → **sukses, 26 route + middleware**
- **BELUM dites runtime** — perlu Postgres + env asli (lihat Runbook).
- **Fase 6 (cleanup core) DITUNDA** atas keputusan user. Core repo `NexaBrick-WebApps` masih punya ~50 perubahan uncommitted di branch `ml-update`; jangan cleanup core sampai (a) WIP itu beres, dan (b) app ini terbukti jalan runtime.

## Keputusan terkunci (jangan ditawar ulang)
| Aspek | Keputusan |
|---|---|
| Auth | **Single-login** (jose HS256 cookie), TANPA RBAC/MenuContext |
| Database | **Postgres + Prisma sendiri**: model `Cctv` + `User` minimal |
| Stack | **Next 15.5 + Tailwind v3 + shadcn** — sengaja diselaraskan ke core, BUKAN default create-next-app (Next 16 / Tailwind v4). Jangan upgrade tanpa alasan kuat; kode ported mengandalkan v3/shadcn. |
| TrashDetection | **IKUT dibawa** ke app ini (dari core) |

## Implementasi penting (gampang salah kalau tak tahu)
- **`lib/auth.ts`** — single-login. `guardPermission(req, resource, action)` dipertahankan signature-nya (dipakai verbatim di 37 call-site API route) tapi **abaikan resource/action** (no RBAC): cukup cek session cookie valid → return payload, else `NextResponse 401`. Juga ekspor `signSession/verifySession/getAuthFromRequest`. Secret dari `AUTH_SECRET`.
- **`middleware.ts`** — gate semua route kecuali `/login`, `/api/auth/*`, asset. API tanpa session → 401 JSON; page → redirect `/login`. Edge-safe (jose).
- **`contexts/MenuContext.tsx`** — STUB no-RBAC (`canView:true`, `loading:false`). Dibuat supaya 2 page ported (cctv, home-assistant) tetap verbatim. Bukan RBAC sungguhan.
- **`lib/mqtt-env-bus.ts`** — versi SLIM (core punya versi besar). Cuma `publishEnv(topic, payload, opts?)` + `warmMqtt()`. 2 topic: `meetily/recording/command`, `meetily/scheduler/probe`.
- **`instrumentation.ts`** — start background services saat boot (Node runtime): `warmMqtt()` + `meetingScheduler.start()`. **Skip saat build phase** (`NEXT_PHASE==='phase-production-build'`) dan kalau `DEV_SKIP_BG_SERVICES=1`. (Tanpa skip build-phase, `next build` gagal `PageNotFoundError`.)
- **Bug fix dari export asli**: `id` dulu di-destructure di dalam `try` tapi dipakai di `catch` → diperbaiki jadi `let id=""` di-hoist di 3 route: `app/api/cctv/[id]/{snapshot,stream,videos}/route.ts`.
- Shared infra disalin verbatim dari core (self-contained): `lib/{crypto,prisma,utils,api-utils,logger,toast-utils}.ts`, `hooks/{use-sort-table,use-mobile}.tsx`, 21 `components/ui/*`. `lib/validations.ts` di-slim jadi hanya `cctvSchema`.
- Warning build `jose` + Edge runtime (CompressionStream) → **non-fatal**, kita hanya pakai JWS sign/verify.

## Runbook (jalankan HANYA setelah user minta)
```bash
# 1. Edit .env (dari .env.example): DATABASE_URL (Postgres asli), AUTH_SECRET,
#    ENCRYPTION_KEY, APP_LOGIN_USER/PASSWORD, MQTT_BROKER_URL,
#    HA_URL/HA_TOKEN, NEXT_PUBLIC_AI_SERVICE_HOST/PORT, MEETING_EXTERNAL_API_URL.
npx prisma migrate dev --name init   # buat tabel Cctv + User
npm run seed                         # user single-login + sample Cctv
npm run dev                          # login → /meetings, /security/surveillance-cctv, /devices/home-assistant
```
Verifikasi end-to-end: SSE `/api/meetings/stream`; log boot "Meeting Scheduler started"; MQTT publish `meetily/recording/command` saat meeting UPCOMING→ONGOING; CRUD CCTV + stream RTSP→MJPEG (`/api/cctv/:id/stream`, butuh `ffmpeg` di host); status HA (butuh `HA_URL`+`HA_TOKEN`).

## Sisa pekerjaan
1. **Runtime smoke-test** app ini (butuh DB + env asli + service eksternal).
2. **Fase 6 — cleanup core** (HELD). Lakukan di `~/Documents/dev/NexaBrick-WebApps`, branch terisolasi, hanya setelah app ini terbukti jalan. Hapus modul meeting/cctv/ha dari core: `lib/init-services.ts`, `components/widgets/WidgetRenderer.tsx` (import + 9 case), `lib/widget-data.ts`, pages & API routes terkait, lib files, `scripts/seed-menu.js`/`seed-cctv.js`/`presets/meeting-preset.js`, `cctvSchema` di `lib/validations.ts`. **Drop tabel Prisma (`Cctv`/`Meeting`/`MeetingParticipant`) = destruktif → konfirmasi user dulu.** Detail langkah ada di `~/Documents/dev/meeting-module-export/EXECUTION-PLAN.md` §Fase 6.
