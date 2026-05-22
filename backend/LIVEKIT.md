# LiveKit Cloud integration

## What was added

- **Postgres**: `match_room_guests` (invite email + bcrypt temp password, `can_publish` for camera/screen), `livekit_presence_log` (webhook audit).
- **API**
  - `POST /api/auth/viewer-login` — `{ matchId, email, password }` → `{ data: { token, guest } }` (JWT for viewer session).
  - `GET /api/match/:id/livekit/token` — `Authorization: Bearer <viewer JWT>` → LiveKit URL + token + `canPublish`.
  - `POST /api/livekit/webhook` — raw body; configure this URL in LiveKit Cloud (see env).
  - `GET|POST|PATCH /api/match/:id/room-guests` — admin only: `Authorization: Bearer <admin JWT>` from `POST /api/auth/admin-login`, or legacy header `X-Admin-Secret: <ADMIN_SECRET>`.

## Existing database

If Postgres already ran an older `schema.sql`, apply:

```bash
psql "$DATABASE_URL" -f src/db/migrations/002_match_room_guests.sql
```

## LiveKit Cloud dashboard

1. Create a project → copy **WebSocket URL**, **API Key**, **API Secret**.
2. **Webhooks**: add URL `https://<your-public-api-host>/api/livekit/webhook` (use ngrok/Cloudflare Tunnel for local dev).
3. Webhook signing: if Cloud shows a separate **webhook signing secret**, set `LIVEKIT_WEBHOOK_SECRET`; otherwise the API secret is used.

## Flow

1. Scorer unlocks admin → **Room guests** panel → invite emails → API returns **temp passwords** (once). If `SMTP_HOST` and `INVITE_EMAIL_FROM` are set in `backend/.env`, the server emails each guest; otherwise copy passwords from the scorer UI.
2. Viewer opens `/watch/:id` (legacy `/match/:id` redirects) → logs in → stream + overlays load; LiveKit connects → **chat** uses LiveKit **data** packets; **overlays/score** use WebSocket + Redis after sign-in.
