CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handicap REAL NOT NULL,
  quota_override REAL,
  team TEXT NOT NULL
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  par INTEGER NOT NULL
);
CREATE TABLE holes (
  course_id TEXT NOT NULL REFERENCES courses(id),
  number INTEGER NOT NULL,
  par INTEGER NOT NULL,
  stroke_index INTEGER NOT NULL,
  PRIMARY KEY (course_id, number)
);
CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  label TEXT NOT NULL,
  day TEXT NOT NULL,
  tee_time TEXT NOT NULL,
  counts INTEGER NOT NULL DEFAULT 1,
  double_points INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tee_assignments (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  group_no INTEGER NOT NULL,
  PRIMARY KEY (round_id, player_id)
);
CREATE TABLE scores (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  hole INTEGER NOT NULL,
  gross INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, player_id, hole)
);
CREATE TABLE props (
  id TEXT PRIMARY KEY, creator TEXT NOT NULL, subject TEXT NOT NULL,
  description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  locks_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE prop_options (
  id TEXT PRIMARY KEY, prop_id TEXT NOT NULL REFERENCES props(id),
  label TEXT NOT NULL, odds INTEGER NOT NULL, is_winner INTEGER
);
CREATE TABLE wagers (
  id TEXT PRIMARY KEY, option_id TEXT NOT NULL REFERENCES prop_options(id),
  bettor TEXT NOT NULL REFERENCES players(id),
  stake INTEGER NOT NULL, payout INTEGER, placed_at INTEGER NOT NULL
);
CREATE INDEX idx_scores_round ON scores(round_id);
CREATE INDEX idx_tee_round ON tee_assignments(round_id);
CREATE INDEX idx_wagers_option ON wagers(option_id);
