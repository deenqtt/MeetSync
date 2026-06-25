<h1 align="center">
  <img src="public/icon-light.svg" width="48" alt="MeetSync Logo" /><br/>
  MeetSync — Internal Platform
</h1>

<p align="center">
  Platform internal berbasis web untuk manajemen rapat, pengawasan CCTV, dan kontrol perangkat rumah pintar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5-black?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" />
</p>

---

## 📋 Tentang Proyek

**MeetSync** adalah aplikasi internal standalone yang diekstrak dari platform NexaBrick. Menggabungkan tiga modul utama dalam satu antarmuka yang terintegrasi:

- 🗓️ **Meeting Management** — jadwal, transkripsi, dan ringkasan rapat otomatis
- 📹 **CCTV Surveillance** — manajemen kamera, streaming RTSP, deteksi zona
- 🏠 **Home Assistant** — kontrol perangkat IoT, monitoring status, asisten suara

Dibangun dengan stack modern dan dirancang untuk deployment self-hosted di jaringan lokal.

---

## 🧩 Fitur Utama

### 🗓️ Meeting Management
- Lihat jadwal rapat (integrasi API eksternal)
- Live transcript rapat via widget dashboard
- Ringkasan otomatis dengan distribusi ke WhatsApp / Email / Telegram
- Statistik kehadiran dan perilaku peserta

### 📹 CCTV & Surveillance
- Manajemen kamera RTSP (simpan konfigurasi IP, port, kredensial di DB lokal)
- Live stream kamera via MJPEG / HLS
- Deteksi zona polygonal pada canvas (integrasi AI service)
- Snapshot dan riwayat klip perilaku
- Deteksi sampah real-time via WebSocket

### 🏠 Home Assistant
- Kontrol perangkat (lampu, AC, sensor) via Home Assistant API
- Monitoring status entity secara real-time
- Asisten suara terintegrasi

### 📊 Customizable Dashboard
- Drag & resize widget (react-grid-layout)
- 9 widget tersedia: Transcript, Summary, CCTV Stream, CCTV Snapshots, CCTV Statistics, Trash Detection, HA Control, HA Status, HA Assist
- Layout tersimpan per tipe dashboard (Meetings / Home Assistant)
- Mode manage untuk kustomisasi tata letak

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|---|---|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Database | PostgreSQL + Prisma ORM |
| Auth | Custom JWT (jose), single-login |
| Real-time | WebSocket (ws), MQTT, Server-Sent Events |
| Dashboard | react-grid-layout v2 |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions → GHCR |

---

## 🚀 Quick Start (Development)

### Prasyarat
- Node.js 18+
- PostgreSQL (running)
- npm

### Setup

```bash
# 1. Clone repo
git clone https://github.com/GSPETech/MeetSync.git
cd MeetSync

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env sesuai kebutuhan (lihat bagian Environment Variables)

# 4. Generate Prisma client + migrasi DB
npx prisma migrate dev
npx prisma generate

# 5. (Opsional) Seed data awal
node scripts/seed.js

# 6. Jalankan dev server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## ⚙️ Environment Variables

Buat file `.env` di root project. **Jangan gunakan tanda kutip** pada nilai variabel (Docker Compose v5 tidak mendukungnya).

```env
# App
NODE_ENV=production
PORT=4000
HOSTNAME=0.0.0.0

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME

# Auth — gunakan random string min 32 karakter
AUTH_SECRET=your-secret-here
COOKIE_SECURE=false          # true hanya jika akses via HTTPS

# Login credentials (single-user)
APP_LOGIN_USER=admin
APP_LOGIN_PASSWORD=your-password

# Enkripsi password kamera CCTV
ENCRYPTION_KEY=your-32-char-encryption-key

# Meeting API eksternal
MEETING_EXTERNAL_API_URL=https://your-meeting-api.example.com
MEETING_SMART_ROOM_ENDPOINT=/meetings/byroom/Smart%20Room
APP_TIMEZONE=Asia/Jakarta

# AI Service — untuk streaming RTSP & deteksi zona (opsional)
NEXT_PUBLIC_AI_SERVICE_HOST=localhost
NEXT_PUBLIC_AI_SERVICE_PORT=8567

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883

# Home Assistant
HA_URL=http://homeassistant.local:8123
HA_TOKEN=your-long-lived-access-token
```

---

## 🐳 Deployment (Production)

Aplikasi dikemas dalam Docker image dan dipublikasikan ke GitHub Container Registry (GHCR) secara otomatis via CI/CD.

### Alur CI/CD

```
git push → GitHub Actions → Docker build → push ghcr.io/gspetech/meetsync:latest → GitHub Release
```

### Deploy Manual di Server

```bash
# 1. Login ke GHCR (sekali saja)
echo YOUR_GITHUB_PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 2. Buat folder
mkdir -p ~/meetsync && cd ~/meetsync

# 3. Buat .env (tanpa tanda kutip pada nilai)
nano .env

# 4. Buat docker-compose.prod.yml
nano docker-compose.prod.yml
```

`docker-compose.prod.yml`:
```yaml
services:
  meetsync:
    image: ghcr.io/gspetech/meetsync:latest
    network_mode: host
    env_file: .env
    restart: unless-stopped
```

```bash
# 5. Pull dan jalankan
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 6. Cek log
docker compose -f docker-compose.prod.yml logs -f
```

> **`network_mode: host`** — container berbagi network dengan host. `localhost` di dalam container = host machine. Diperlukan agar container bisa mengakses PostgreSQL dan AI service yang berjalan di host.

> **Prisma migrate** dijalankan otomatis saat container start via `entrypoint.sh`.

---

## 🏗️ Struktur Proyek

```
meetsync/
├── app/
│   ├── (dashboard)/                  # Halaman utama (auth-gated)
│   │   ├── page.tsx                  # Dashboard utama
│   │   ├── meetings/                 # Manajemen rapat
│   │   ├── security/
│   │   │   └── surveillance-cctv/   # CCTV list + Manage Zone
│   │   ├── devices/
│   │   │   └── home-assistant/       # Kontrol perangkat HA
│   │   └── dashboard/manage/         # Kustomisasi widget
│   ├── api/
│   │   ├── auth/                     # Login, logout, me
│   │   ├── cctv/                     # CRUD kamera (Postgres)
│   │   ├── dashboard/                # Layout dashboard
│   │   ├── meetings/                 # Proxy meeting API eksternal
│   │   ├── ai-proxy/[...path]/       # Proxy ke AI service (CORS-safe)
│   │   └── home-assistant/           # Proxy ke HA
│   └── login/
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── widgets/                      # 9 widget komponen
│   │   ├── AiCctvStream/             # Live RTSP stream viewer
│   │   ├── AiCctvSnapshots/          # Riwayat klip perilaku
│   │   ├── AiCctvStatistics/         # Statistik deteksi
│   │   ├── TrashDetection/           # Deteksi sampah real-time
│   │   ├── MeetilyTranscript/        # Live transcript rapat
│   │   ├── MeetilySummary/           # Ringkasan + distribusi
│   │   ├── HomeAssistantControl/     # Kontrol perangkat
│   │   ├── HomeAssistantStatus/      # Status entity
│   │   └── HomeAssistantAssist/      # Asisten suara
│   ├── manage-zone/                  # Zone editor (canvas + polygon)
│   └── AppSidebar.tsx
├── lib/
│   ├── auth.ts                       # JWT session (jose)
│   ├── prisma.ts                     # Prisma client singleton
│   ├── validations.ts                # Zod schemas
│   ├── crypto.ts                     # Enkripsi password kamera
│   └── utils/ai-service.ts           # AI service URL helpers
├── prisma/
│   └── schema.prisma                 # DB schema
├── Dockerfile                        # Multi-stage build
├── entrypoint.sh                     # Prisma migrate + start server
├── docker-compose.prod.yml           # Production deployment
└── .github/workflows/deploy.yml      # CI/CD pipeline
```

---

## 🔌 Arsitektur API

```
Browser
  │
  ├── /api/cctv/*            → Postgres  (camera config, standalone)
  ├── /api/dashboard/*       → Postgres  (widget layout)
  ├── /api/meetings/*        → External Meeting API  (proxy)
  ├── /api/home-assistant/*  → Home Assistant API    (proxy)
  └── /api/ai-proxy/*        → AI Service :8567      (proxy, CORS-safe)
                                  ├── /api/cameras             (daftar kamera AI)
                                  ├── /api/cameras/:id/zones   (zona deteksi)
                                  ├── /api/cameras/:id/snapshot
                                  └── /api/clips               (riwayat klip)

WebSocket (langsung dari browser — tidak bisa di-proxy via HTTP route):
  ws://[server-ip]:8567/ws/stream     → Live RTSP stream
  ws://[server-ip]:8567/ws/frontend   → Trash detection events
```

> **AI Service bersifat opsional.** Fitur CRUD kamera dan dashboard tetap berjalan tanpa AI service. Streaming, deteksi zona, dan snapshot memerlukan AI service aktif di port 8567.

---

## 🔐 Autentikasi

Single-login — satu akun untuk seluruh aplikasi (tidak ada RBAC / multi-user).

- Login via `/login` dengan kredensial dari env (`APP_LOGIN_USER`, `APP_LOGIN_PASSWORD`)
- Session disimpan sebagai JWT cookie `nb_session` (signed `AUTH_SECRET`, expire 7 hari)
- Cookie `secure` flag dikontrol via `COOKIE_SECURE=true` — aktifkan hanya saat HTTPS

---

## 🎨 Design System

| Token | Hex | Penggunaan |
|---|---|---|
| Navy | `#2D3250` | Primary button, active state |
| Teal | `#32AEAC` | Accent, badge, indikator |
| Orange | `#FA9464` | Eyebrow label, highlight |
| Background | `#F7F7F5` | Page background (light mode) |

Font: **Plus Jakarta Sans** (display) + **Inter** (body)

---

## 📄 Lisensi

Internal use only — GSPETech / NexaBrick.
