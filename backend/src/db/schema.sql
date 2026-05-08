CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  format VARCHAR(20) NOT NULL,
  total_overs INTEGER,
  venue VARCHAR(255),
  match_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'SETUP',
  current_innings INTEGER DEFAULT 1,
  target INTEGER,
  toss_winner VARCHAR(10),
  toss_elected VARCHAR(10),
  stream_url TEXT,
  stream_key TEXT,
  result_text TEXT,
  man_of_match_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, team_number)
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  jersey_number VARCHAR(10),
  role VARCHAR(50),
  batting_order INTEGER,
  is_captain BOOLEAN DEFAULT FALSE,
  is_wicketkeeper BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE umpires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL
);

CREATE TABLE innings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_number INTEGER NOT NULL,
  batting_team_id UUID REFERENCES teams(id),
  bowling_team_id UUID REFERENCES teams(id),
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  overs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  extras_wide INTEGER DEFAULT 0,
  extras_noball INTEGER DEFAULT 0,
  extras_bye INTEGER DEFAULT 0,
  extras_legbye INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  striker_id UUID REFERENCES players(id),
  non_striker_id UUID REFERENCES players(id),
  current_bowler_id UUID REFERENCES players(id),
  opening_striker_id UUID REFERENCES players(id),
  opening_non_striker_id UUID REFERENCES players(id),
  opening_bowler_id UUID REFERENCES players(id),
  pending_over_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, innings_number)
);

CREATE TABLE balls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL,
  delivery_number INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  runs_off_bat INTEGER DEFAULT 0,
  extra_runs INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  batsman_id UUID REFERENCES players(id),
  bowler_id UUID REFERENCES players(id),
  fielder_id UUID REFERENCES players(id),
  dismissal_type VARCHAR(50),
  dismissed_player_id UUID REFERENCES players(id),
  new_batsman_id UUID REFERENCES players(id),
  commentary TEXT,
  post_striker_id UUID REFERENCES players(id),
  post_non_striker_id UUID REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE batting_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  how_out VARCHAR(100),
  bowler_id UUID REFERENCES players(id),
  fielder_id UUID REFERENCES players(id),
  status VARCHAR(20) DEFAULT 'BATTING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (innings_id, player_id)
);

CREATE TABLE bowling_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  overs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (innings_id, player_id)
);

CREATE TABLE overlay_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balls_innings_delivery ON balls(innings_id, delivery_number DESC);
CREATE INDEX idx_balls_innings_over ON balls(innings_id, over_number, ball_number);
CREATE INDEX idx_players_match ON players(match_id);
CREATE INDEX idx_innings_match ON innings(match_id);
