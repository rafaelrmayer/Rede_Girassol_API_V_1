-- Staging is never public. A complete, verified snapshot becomes visible by one pointer update.
CREATE TABLE IF NOT EXISTS ans_plan_snapshots (
  id TEXT PRIMARY KEY,
  manifest_json TEXT NOT NULL,
  expected_snapshot_id TEXT,
  source_date TEXT NOT NULL,
  file_date TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','completed')),
  changes_json TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ans_plan_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  current_snapshot_id TEXT REFERENCES ans_plan_snapshots(id)
);
INSERT OR IGNORE INTO ans_plan_state VALUES(1,NULL);
CREATE TABLE IF NOT EXISTS ans_plan_chunks (
  snapshot_id TEXT NOT NULL REFERENCES ans_plan_snapshots(id),
  chunk_index INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  PRIMARY KEY(snapshot_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS ans_plan_records (
  snapshot_id TEXT NOT NULL REFERENCES ans_plan_snapshots(id),
  plan_id TEXT NOT NULL,
  ans_code TEXT NOT NULL,
  name TEXT NOT NULL,
  registration_code TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  PRIMARY KEY(snapshot_id,plan_id)
);
CREATE INDEX IF NOT EXISTS idx_ans_plan_operator ON ans_plan_records(snapshot_id,ans_code);
CREATE TABLE IF NOT EXISTS ans_plan_publications (
  snapshot_id TEXT PRIMARY KEY REFERENCES ans_plan_snapshots(id)
);
-- Conservative import-only budget; account-wide usage by other applications remains separate.
CREATE TABLE IF NOT EXISTS ans_plan_write_budget (
  day TEXT PRIMARY KEY,
  record_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ans_plan_name ON ans_plan_records(snapshot_id,name,plan_id);
