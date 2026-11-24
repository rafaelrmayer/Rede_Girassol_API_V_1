CREATE TABLE IF NOT EXISTS ans_operator_snapshots (
  id TEXT PRIMARY KEY,
  records_sha256 TEXT NOT NULL,
  records_json TEXT NOT NULL,
  active_source_date TEXT NOT NULL,
  cancelled_source_date TEXT NOT NULL,
  active_sha256 TEXT NOT NULL,
  cancelled_sha256 TEXT NOT NULL,
  prepared_at TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  active_count INTEGER NOT NULL,
  cancelled_count INTEGER NOT NULL,
  changes_json TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ans_operator_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  current_snapshot_id TEXT,
  FOREIGN KEY (current_snapshot_id) REFERENCES ans_operator_snapshots(id)
);
INSERT OR IGNORE INTO ans_operator_state(singleton,current_snapshot_id) VALUES(1,NULL);
CREATE TABLE IF NOT EXISTS ans_operator_details (
  operator_id TEXT PRIMARY KEY,
  ans_code TEXT NOT NULL UNIQUE,
  trade_name TEXT,
  modality TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  registered_on TEXT NOT NULL,
  cancelled_on TEXT,
  cancellation_reason TEXT,
  source_url TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  FOREIGN KEY (operator_id) REFERENCES operators(id),
  FOREIGN KEY (snapshot_id) REFERENCES ans_operator_snapshots(id)
);
CREATE INDEX IF NOT EXISTS idx_ans_operator_location ON ans_operator_details(state,city);
