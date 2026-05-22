-- Run manually if your database was created before LiveKit guest tables existed:
--   psql "$DATABASE_URL" -f src/db/migrations/002_match_room_guests.sql

CREATE TABLE IF NOT EXISTS match_room_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(80),
  can_publish BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, email)
);

CREATE INDEX IF NOT EXISTS idx_room_guests_match ON match_room_guests(match_id);

CREATE TABLE IF NOT EXISTS livekit_presence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_identity VARCHAR(255) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livekit_presence_match ON livekit_presence_log(match_id, created_at DESC);
