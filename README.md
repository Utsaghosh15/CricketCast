# CricCast

Cricket live scoring and streaming: dual **HLS** and **WebRTC (WHEP)** playback via **MediaMTX**, a **React** viewer with score overlays, optional **LiveKit** fan cam and room guests, and a **Node.js** API backed by **PostgreSQL** and **Redis**.

**Repository:** [github.com/Utsaghosh15/CricketCast](https://github.com/Utsaghosh15/CricketCast)

---

## Features

- **Match setup wizard** — teams, toss, stream URL / key, go live
- **Scoring / admin** — ball-by-ball with overlay events; JWT admin login (`admin` / `criccast` by default)
- **Viewer** — `/watch/:matchId` with HLS + WebRTC (WHEP), overlays, and live chat
- **Playback telemetry** — live latency and transport stats below the players
- **Live chat** — LiveKit data packets when connected; **WebRTC DataChannel** or **WebSocket + Redis** fallback otherwise
- **LiveKit (optional)** — room guest invites, viewer login, fan cam PiP, admin live feed — see [`backend/LIVEKIT.md`](backend/LIVEKIT.md)
- **Realtime** — WebSocket + Redis fan-out for scores and overlays

---

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React app (`npm run dev` → `http://localhost:5173`) |
| `backend/` | Express + `ws` API (`PORT` default `3001`) |
| `mediamtx.yml` | Example MediaMTX config (RTMP ingest, HLS, WebRTC/WHEP) |
| `backend/LIVEKIT.md` | LiveKit Cloud setup, migrations, API flow |

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** and **Redis** (local or Docker via `backend/docker-compose.yml`)
- **MediaMTX** (Docker or binary) for RTMP/HLS/WHEP video — not started by backend compose alone
- Optional: **LiveKit Cloud** project for fan cam / room guests
- Optional: **Larix Broadcaster** (or any RTMP publisher) to push to MediaMTX

---

## Quick start (local)

### 1. Database & Redis

From `backend/`:

```bash
docker compose up -d postgres redis
```

Copy env template:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` if your Postgres/Redis URLs differ. Default Postgres: `postgresql://criccast:criccast@localhost:5432/criccast`.

**Inspect tables (optional):**

```bash
cd backend
psql "$DATABASE_URL" -c "\dt"
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API: **`http://localhost:3001`**. WebSocket: **`ws://localhost:3001/ws`**.

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # optional in dev — Vite proxies /api and /ws
npm install
npm run dev
```

Open **`http://localhost:5173`**.

### 4. MediaMTX (video)

From the **repo root**, set `webrtcAdditionalHosts` in `mediamtx.yml` to your machine’s **LAN IP**, then:

```bash
docker run --rm \
  -p 1935:1935 \
  -p 8888:8888 \
  -p 8889:8889 \
  -p 8189:8189/udp \
  -v "$PWD/mediamtx.yml:/mediamtx.yml:ro" \
  bluenviron/mediamtx:latest
```

| Use | URL |
|-----|-----|
| Publish (Larix) | `rtmp://<LAN_IP>:1935/live/<streamKey>` |
| WHEP (viewer) | `http://<LAN_IP>:8889/live/<streamKey>/whep` |
| HLS | `http://<LAN_IP>:8888/live/<streamKey>/index.m3u8` |

Paste WHEP and stream key into match setup / stream settings in the app.

### 5. LiveKit (optional)

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io).
2. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `backend/.env`.
3. If Postgres was created before room-guest tables existed:

```bash
cd backend
psql "$DATABASE_URL" -f src/db/migrations/002_match_room_guests.sql
```

Full flow and webhook setup: **`backend/LIVEKIT.md`**.

---

## Environment variables

### Backend (`backend/.env`)

See **`backend/.env.example`**.

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Scorer login (defaults `admin` / `criccast`) |
| `ADMIN_SECRET` | Signs admin JWTs — change in production |
| `VIEWER_JWT_SECRET` | Signs viewer JWTs (defaults to `ADMIN_SECRET`) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud (optional) |
| `LIVEKIT_WEBHOOK_SECRET` | Webhook signing (optional; defaults to API secret) |
| `CORS_ORIGIN` | Comma-separated browser origins |
| `PUBLIC_APP_URL` | Base URL for invite links (e.g. `http://localhost:5173`) |
| `SMTP_*`, `INVITE_EMAIL_FROM` | Optional email for room-guest invites |

### Frontend (`frontend/.env`)

See **`frontend/.env.example`**.

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | REST API base (omit in dev — Vite proxy) |
| `VITE_WS_URL` | WebSocket URL (omit in dev — Vite proxy) |
| `VITE_ADMIN_SECRET` | _(Optional)_ legacy `X-Admin-Secret` header only |
| `VITE_WEBRTC_ASSUMED_LATENCY_S` | Fallback overlay delay before RTC stats |

**Do not commit** real `.env` files or production secrets.

---

## Useful routes

| URL | Purpose |
|-----|---------|
| `/` | Home — live / recent matches |
| `/setup` | Create match + stream setup |
| `/watch/:matchId` | Viewer (HLS + WebRTC + chat + overlays); `/match/:id` redirects here |
| `/admin/:matchId` | Scoring — sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` |

---

## Docker (API + DB)

`backend/docker-compose.yml` runs **Postgres** and **Redis** (and optionally the API image). It does **not** run MediaMTX or the Vite frontend.

```bash
cd backend
docker compose up -d postgres redis
```

**Note:** `@roamhq/wrtc` (WebRTC chat relay) may need a glibc-based Node image in Docker; if the backend container fails on native bindings, run `npm run dev` on the host.

---

## Chat (simple mental model)

- **With LiveKit:** chat uses LiveKit **data** packets in the match room.
- **Without LiveKit:** small **WebRTC DataChannel** per viewer to Node, or **WebSocket + Redis** fallback.
- MediaMTX **WHEP** is only for main broadcast A/V, not fan cam or chat.

---

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run dev` | API with file watch |
| `backend/` | `npm start` | API production mode |
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build → `frontend/dist` |

---

## Contributing / pushing updates

```bash
git add .
git commit -m "Describe your change."
git push origin main
```

---

## Suggested GitHub description

> Cricket live scoring + dual HLS/WebRTC viewer (MediaMTX), React, Node, Postgres, Redis — LiveKit fan cam, room guests, and realtime overlays.

**Topics:** `cricket`, `streaming`, `webrtc`, `hls`, `mediamtx`, `livekit`, `react`, `nodejs`, `redis`, `postgresql`, `live-sports`

---

## License

Add a `LICENSE` file if you want to open-source under a specific license (e.g. MIT).
