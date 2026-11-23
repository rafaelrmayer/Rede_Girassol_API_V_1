const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const recordKeys = new Set(['id', 'cnes_code', 'name', 'city', 'state', 'address', 'source', 'source_updated_at']);
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export async function importPlaces(request: Request, db: D1Database): Promise<{status: number; body: unknown}> {
  // Bound the actual body, including requests without Content-Length.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) { await reader.cancel(); return {status: 413, body: {error: 'body_too_large'}}; }
      chunks.push(value);
    }
  }
  let payload: unknown;
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return {status: 400, body: {error: 'invalid_json'}}; }
  if (!object(payload) || typeof payload.source !== 'string' || !['cnes', 'manual', 'sample'].includes(payload.source) ||
      (payload.entity !== undefined && payload.entity !== 'establishments') ||
      Object.keys(payload).some(key => !['source', 'entity', 'records'].includes(key)) ||
      !Array.isArray(payload.records) || payload.records.length === 0) {
    return {status: 422, body: {error: 'invalid_batch', message: 'Informe source (cnes, manual ou sample), entity establishments e de 1 a 100 registros normalizados.'}};
  }
  if (payload.records.length > 100) return {status: 413, body: {error: 'batch_too_large', max_records: 100}};
  const source = payload.source as string;
  const errors: {index: number; field: string}[] = [];
  const seen = new Set<string>();
  const records = payload.records.map((raw: unknown, index: number) => {
    if (!object(raw)) { errors.push({index, field: 'record'}); return null; }
    for (const key of Object.keys(raw)) if (!recordKeys.has(key)) errors.push({index, field: key});
    const field = (key: string, max: number, required = false): string | null => {
      const value = raw[key];
      if (value === undefined || value === null) { if (required) errors.push({index, field: key}); return null; }
      if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
        errors.push({index, field: key}); return null;
      }
      return value.trim();
    };
    const cnes = field('cnes_code', 7, true);
    if (cnes && !/^\d{7}$/.test(cnes)) errors.push({index, field: 'cnes_code'});
    if (cnes && seen.has(cnes)) errors.push({index, field: 'cnes_code'});
    if (cnes) seen.add(cnes);
    // CNES is the stable identity; caller IDs are accepted only for legacy fixtures.
    field('id', 128);
    if (raw.source !== undefined && raw.source !== source) errors.push({index, field: 'source'});
    const name = field('name', 300, true);
    const city = field('city', 150);
    const state = field('state', 2)?.toUpperCase() ?? null;
    if (state && !states.has(state)) errors.push({index, field: 'state'});
    const address = field('address', 500);
    const updated = field('source_updated_at', 10);
    if (updated && (!/^\d{4}-\d{2}-\d{2}$/.test(updated) || !Number.isFinite(Date.parse(updated)) || new Date(updated).toISOString().slice(0, 10) !== updated)) errors.push({index, field: 'source_updated_at'});
    return {cnes, name, city, state, address, updated};
  });
  if (errors.length) return {status: 422, body: {error: 'invalid_records', errors}};
  const id = crypto.randomUUID();
  const statements = records.map(record => {
    const r = record!;
    return db.prepare(`INSERT INTO establishments (id,cnes_code,name,city,state,address,source,source_updated_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(cnes_code) DO UPDATE SET
      name=excluded.name,city=excluded.city,state=excluded.state,address=excluded.address,
      source=excluded.source,source_updated_at=excluded.source_updated_at,imported_at=CURRENT_TIMESTAMP`)
      .bind(`cnes-${r.cnes}`, r.cnes, r.name, r.city, r.state, r.address, source, r.updated);
  });
  statements.push(db.prepare(`INSERT INTO import_runs (id,source,status,records_received,records_imported,completed_at,details)
    VALUES (?,?,'completed',?,?,CURRENT_TIMESTAMP,?)`).bind(id, source, records.length, records.length,
      'Estabelecimentos normalizados gravados por CNES; origem declarada pelo importador, sem confirmação de rede credenciada.'));
  try { await db.batch(statements); }
  catch { return {status: 500, body: {error: 'import_failed', message: 'O lote não foi gravado. Confira o banco e tente novamente.'}}; }
  return {status: 200, body: {import_id: id, source, entity: 'establishments', status: 'completed', records_received: records.length,
    records_imported: records.length, note: 'Registros inseridos ou atualizados por CNES. Não comprova atendimento por plano de saúde.'}};
}
