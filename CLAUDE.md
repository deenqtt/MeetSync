# CLAUDE.md — nexabrick-internal

> **WAJIB: baca [AI-SESSION-MEMORY.md](AI-SESSION-MEMORY.md) dulu** sebelum kerja apa pun. Itu handoff lengkap (status, arsitektur, keputusan, runbook, sisa pekerjaan).

## Ringkas
- Aplikasi **standalone internal** (Next 15.5 + Tailwind v3 + shadcn, App Router, TS, Prisma/Postgres) hasil ekstraksi 3 modul dari NexaBrick core: **Meeting**, **CCTV/RTSP**, **Home Assistant**.
- **Status**: Fase 0–5 selesai, lolos `tsc`/`prisma generate`/`npm run build`. **Belum dites runtime** (perlu DB + env asli). Fase 6 (cleanup core) DITUNDA.
- Auth = **single-login** (`lib/auth.ts`, jose), TANPA RBAC.

## Aturan kerja (penting)
- Balas dalam **Bahasa Indonesia**.
- **JANGAN run apa pun yang mengeksekusi** (dev/build/migrate/seed/curl) tanpa izin eksplisit user. Setelah edit/buat file → berhenti & lapor.
- Aksi destruktif (drop tabel, hapus file yang bukan kamu buat) → konfirmasi dulu.
- Jangan upgrade ke Next 16 / Tailwind v4 — stack sengaja v15/v3 agar kode ported jalan.

## Konteks tambahan
Sumber kode asli + dokumen analisis: `~/Documents/dev/meeting-module-export` (README.md, EXECUTION-PLAN.md). Core repo: `~/Documents/dev/NexaBrick-WebApps`.
