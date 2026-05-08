# CricCast

Cricket live scoring and streaming demo: dual **HLS** and **WebRTC (WHEP)** playback via **MediaMTX**, a **React** viewer with score overlays, and a **Node.js** API backed by **PostgreSQL** and **Redis**.

---

## Features

- **Match setup wizard** — teams, toss, stream URL / key, go live  
- **Scoring / admin** — ball-by-ball with overlay events  
- **Viewer** — side-by-side **HLS** (TCP 8888) and **WebRTC** (WHEP on 8889 + UDP ICE)  
- **Playback telemetry** — live latency and transport stats in a card below the players  
- **Live chat** — prefers **WebRTC DataChannel** (browser ↔ Node relay with `@roamhq/wrtc`); **WebSocket + Redis** fallback when the channel is not ready  
- **Realtime** — WebSocket + Redis fan-out for scores and overlays  

---

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | Vite + React app (`npm run dev` → usually `http://localhost:5173`) |
| `backend/` | Express + `ws` API (`PORT` default `3001`) |
| `mediamtx.yml` | Example MediaMTX config (RTMP ingest, HLS, WebRTC/WHEP) |

---

## Prerequisites

- **Node.js** ≥ 18  
- **PostgreSQL** and **Redis** (local or Docker)  
- **MediaMTX** (binary or Docker) for real video — not started by this repo’s backend compose alone  
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

Edit `backend/.env` if your Postgres/Redis URLs differ.

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API listens on **`http://localhost:3001`** (default). WebSocket path: **`ws://localhost:3001/ws`**.

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # if you don’t have .env yet
npm install
npm run dev
```

Open **`http://localhost:5173`**.

### 4. MediaMTX (video)

From the **repo root** (same folder as `mediamtx.yml`), after editing `webrtcAdditionalHosts` to **your machine’s LAN IP**:

```bash
docker run --rm \
  -p 1935:1935 \
  -p 8888:8888 \
  -p 8889:8889 \
  -p 8189:8189/udp \
  -v "$PWD/mediamtx.yml:/mediamtx.yml:ro" \
  bluenviron/mediamtx:latest
```

- **Publish (Larix):** `rtmp://<LAN_IP>:1935/live/<streamKey>`  
- **WHEP (viewer):** `http://<LAN_IP>:8889/live/<streamKey>/whep`  
- **HLS:** `http://<LAN_IP>:8888/live/<streamKey>/index.m3u8`  

Paste WHEP (and stream key) into match setup / stream settings in the app.

---

## Environment variables

### Backend (`backend/.env`)

See **`backend/.env.example`**. Main keys:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL |
| `ADMIN_SECRET` | Secret for admin/scoring routes (must match frontend) |
| `CORS_ORIGIN` | Comma-separated browser origins allowed for API |

### Frontend (`frontend/.env`)

See **`frontend/.env.example`**.

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | REST API base URL |
| `VITE_WS_URL` | WebSocket URL (e.g. `ws://localhost:3001/ws`) |
| `VITE_ADMIN_SECRET` | Same value as backend `ADMIN_SECRET` for gated admin UI |
| `VITE_WEBRTC_ASSUMED_LATENCY_S` | Fallback overlay delay before RTC stats are available |

**Do not commit** real `.env` files or production secrets.

---

## Useful routes

| URL | Purpose |
|-----|---------|
| `/` | Home — live / recent matches |
| `/setup` | Create match + stream setup |
| `/match/:matchId` | **Public viewer** (HLS + WebRTC + chat + overlays) |
| `/admin/:matchId` | **Scoring** (admin gate; uses `VITE_ADMIN_SECRET`) |

---

## Docker (API + DB)

`backend/docker-compose.yml` can run **Postgres**, **Redis**, and optionally the **backend** container. It does **not** run MediaMTX or the Vite frontend.

```bash
cd backend
docker compose up -d postgres redis
# optional full stack with API image:
# docker compose up -d
```

**Note:** `@roamhq/wrtc` (WebRTC chat relay) may need a **glibc-based** Node image in Docker; if the backend container fails on native bindings, run the API with `npm run dev` on the host.

---

## Chat (simple mental model)

- **Preferred:** small **WebRTC DataChannel** per viewer to the Node server; server relays to others.  
- **Fallback:** same **WebSocket** used for scores; messages go through **Redis** and fan out.  
- **Not** the same connection as MediaMTX video (WHEP is only for A/V).

---

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run dev` | API with file watch |
| `backend/` | `npm start` | API production mode |
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build → `frontend/dist` |

---

## Publishing to GitHub

Replace `YOUR_USER` / `YOUR_REPO` with your GitHub username and repository name.

### 1. Create an empty repo on GitHub

On [github.com/new](https://github.com/new): create a repository (e.g. `CricketCast`), **without** adding a README (this repo already has one).

### 2. Initialize git and push (first time)

From the **CricketCast** project root:

```bash
cd /path/to/CricketCast

git init
git add .
git commit -m "Initial commit: CricCast cricket streaming and scoring platform"

git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 3. SSH remote (optional)

```bash
git remote set-url origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 4. Later updates

```bash
git add .
git status
git commit -m "Describe your change in a short sentence."
git push
```

---

## Suggested GitHub repository description

**Short (for the GitHub “Description” field):**

> Cricket live scoring + dual HLS/WebRTC viewer (MediaMTX), React, Node, Postgres, Redis — with WebRTC chat demo and WS fallback.

**Topics / tags to add on GitHub:** `cricket`, `streaming`, `webrtc`, `hls`, `mediamtx`, `react`, `nodejs`, `redis`, `postgresql`, `live-sports`

---

## License

Add a `LICENSE` file if you want to open-source under a specific license (e.g. MIT).
