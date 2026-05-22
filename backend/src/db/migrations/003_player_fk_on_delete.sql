-- So `DELETE FROM matches` cascades cleanly: cards/balls no longer block player removal.
-- Run once if your DB was created before this migration:
--   psql "$DATABASE_URL" -f src/db/migrations/003_player_fk_on_delete.sql

ALTER TABLE batting_cards
  DROP CONSTRAINT IF EXISTS batting_cards_player_id_fkey,
  ADD CONSTRAINT batting_cards_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE bowling_cards
  DROP CONSTRAINT IF EXISTS bowling_cards_player_id_fkey,
  ADD CONSTRAINT bowling_cards_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
