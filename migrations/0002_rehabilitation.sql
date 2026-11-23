CREATE TABLE IF NOT EXISTS rehabilitation_services (
  id TEXT PRIMARY KEY,
  establishment_id TEXT NOT NULL,
  service_code TEXT NOT NULL CHECK (service_code = '135'),
  classification_code TEXT NOT NULL,
  classification_description TEXT NOT NULL,
  service_type TEXT NOT NULL,
  reference_month TEXT NOT NULL,
  source_establishment_name TEXT NOT NULL,
  source_city TEXT NOT NULL,
  source_state TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cnes-services' CHECK (source = 'cnes-services'),
  source_url TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (establishment_id, classification_code, service_type, reference_month),
  FOREIGN KEY (establishment_id) REFERENCES establishments(id)
);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_classification_month
  ON rehabilitation_services(classification_code, reference_month);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_place_classification_month
  ON rehabilitation_services(establishment_id, classification_code, service_type, reference_month);
