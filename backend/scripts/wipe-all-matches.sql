-- Remove every match and dependent rows (order respects FKs without CASCADE on player refs).
BEGIN;

DELETE FROM balls
WHERE innings_id IN (SELECT id FROM innings WHERE match_id IN (SELECT id FROM matches));

DELETE FROM batting_cards
WHERE innings_id IN (SELECT id FROM innings WHERE match_id IN (SELECT id FROM matches));

DELETE FROM bowling_cards
WHERE innings_id IN (SELECT id FROM innings WHERE match_id IN (SELECT id FROM matches));

UPDATE innings SET
  striker_id = NULL,
  non_striker_id = NULL,
  current_bowler_id = NULL,
  opening_striker_id = NULL,
  opening_non_striker_id = NULL,
  opening_bowler_id = NULL
WHERE match_id IN (SELECT id FROM matches);

DELETE FROM innings WHERE match_id IN (SELECT id FROM matches);

DELETE FROM players WHERE match_id IN (SELECT id FROM matches);

DELETE FROM teams WHERE match_id IN (SELECT id FROM matches);

DELETE FROM umpires WHERE match_id IN (SELECT id FROM matches);

DELETE FROM overlay_log WHERE match_id IN (SELECT id FROM matches);

-- Optional tables (LiveKit migration); skip if not migrated yet
DO $$
BEGIN
  DELETE FROM match_room_guests WHERE match_id IN (SELECT id FROM matches);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  DELETE FROM livekit_presence_log WHERE match_id IN (SELECT id FROM matches);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DELETE FROM matches;

COMMIT;
