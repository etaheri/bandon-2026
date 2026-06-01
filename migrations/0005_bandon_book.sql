-- The Bandon Book: replace the unused odds/money tables with a pick-a-side model.
-- These tables have never held data, so dropping is safe.
-- Two intentional behavior changes from 0001:
--   (a) props.creator now has REFERENCES players(id) (it had no FK in 0001).
--   (b) dropping wagers also drops its index idx_wagers_option (SQLite auto-drops table indexes).
DROP TABLE wagers;
DROP TABLE prop_options;
DROP TABLE props;

CREATE TABLE props (
  id TEXT PRIMARY KEY,
  creator TEXT NOT NULL REFERENCES players(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'locked' | 'resolved'
  winning_option_id TEXT,
  created_at INTEGER NOT NULL,
  locked_at INTEGER,
  resolved_at INTEGER
);

CREATE TABLE prop_options (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE picks (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  option_id TEXT NOT NULL REFERENCES prop_options(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  UNIQUE (prop_id, player_id)
);

CREATE INDEX idx_prop_options_prop ON prop_options(prop_id);
CREATE INDEX idx_picks_prop ON picks(prop_id);
