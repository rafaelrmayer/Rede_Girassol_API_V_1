CREATE TABLE IF NOT EXISTS establishments (
  id TEXT PRIMARY KEY,
  cnes_code TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  address TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  source_updated_at TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  ans_code TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  source_updated_at TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  operator_id TEXT,
  name TEXT NOT NULL,
  registration_code TEXT,
  status TEXT NOT NULL DEFAULT 'unconfirmed',
  source_updated_at TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operator_id) REFERENCES operators(id)
);

CREATE TABLE IF NOT EXISTS provider_network (
  id TEXT PRIMARY KEY,
  establishment_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (verification_status IN ('confirmed', 'unconfirmed', 'not_accepted', 'outdated')),
  evidence_source TEXT,
  evidence_date TEXT,
  checked_at TEXT,
  notes TEXT,
  FOREIGN KEY (establishment_id) REFERENCES establishments(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  records_received INTEGER NOT NULL DEFAULT 0,
  records_imported INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_establishments_name ON establishments(name);
CREATE INDEX IF NOT EXISTS idx_establishments_city_state ON establishments(city, state);
CREATE INDEX IF NOT EXISTS idx_operators_name ON operators(name);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
