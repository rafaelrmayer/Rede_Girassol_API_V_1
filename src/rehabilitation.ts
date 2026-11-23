import { autismEvidence } from './autism-support';
import catalog from '../rehabilitation-classifications.json';
import { pagination, readPage } from './pagination';

const keys = new Set(['cnes_code', 'establishment_name', 'city', 'state', 'service_code', 'classification_code', 'classification_description', 'service_type', 'reference_month']);
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const monthPattern = /^20[0-9]{2}(0[1-9]|1[0-2])$/;
const names = new Map(catalog.classifications.map(item => [item.code, item.name]));
type Result = {status: number; body: unknown};

export async function importRehabilitation(payload: Record<string, unknown>, db: D1Database): Promise<Result> {
  if (payload.source !== 'cnes-services' || Object.keys(payload).some(key => !['entity','source','records'].includes(key)) || !Array.isArray(payload.records) || !payload.records.length)
    return {status: 422, body: {error: 'invalid_batch', message: 'Informe source cnes-services e de 1 a 100 observações normalizadas.'}};
  if (payload.records.length > 100) return {status: 413, body: {error: 'batch_too_large', max_records: 100}};
  const errors: {index: number; field: string}[] = [];
  const seen = new Set<string>();
  const records = payload.records.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {errors.push({index, field: 'record'}); return null;}
    const row = raw as Record<string, unknown>;
    for (const key of Object.keys(row)) if (!keys.has(key)) errors.push({index, field: key});
    const text = (key: string, max: number) => {
      const value = row[key];
      if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {errors.push({index, field: key}); return '';}
      return value.trim();
    };
    const cnes = text('cnes_code', 7), name = text('establishment_name', 300), city = text('city', 150);
    const state = text('state', 2).toUpperCase(), service = text('service_code', 3), cls = text('classification_code', 3);
    const description = text('classification_description', 300), type = text('service_type', 40).toUpperCase(), month = text('reference_month', 6);
    if (!/^[0-9]{7}$/.test(cnes)) errors.push({index, field: 'cnes_code'});
    if (service !== '135') errors.push({index, field: 'service_code'});
    if (!/^[0-9]{3}$/.test(cls)) errors.push({index, field: 'classification_code'});
    if (!states.has(state)) errors.push({index, field: 'state'});
    if (!monthPattern.test(month)) errors.push({index, field: 'reference_month'});
    const key = JSON.stringify([cnes, cls, type, month]);
    if (seen.has(key)) errors.push({index, field: 'record'});
    seen.add(key);
    return {cnes, name, city, state, cls, description, type, month};
  });
  if (errors.length) return {status: 422, body: {error: 'invalid_records', errors}};
  const rows = records.filter((row): row is NonNullable<typeof row> => row !== null);
  const parents = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!parents.has(row.cnes) || parents.get(row.cnes)!.month < row.month) parents.set(row.cnes, row);
  const statements: D1PreparedStatement[] = [];
  const parentRows = [...parents.values()];
  for (let start = 0; start < parentRows.length; start += 10) {
    const chunk = parentRows.slice(start, start + 10);
    statements.push(db.prepare(`INSERT INTO establishments (id,cnes_code,name,city,state,source)
      VALUES ${chunk.map(() => "(?,?,?,?,?,'cnes-services')").join(',')} ON CONFLICT(cnes_code) DO NOTHING`)
      .bind(...chunk.flatMap(row => [`cnes-${row.cnes}`, row.cnes, row.name, row.city, row.state])));
  }
  for (let start = 0; start < rows.length; start += 8) {
    const chunk = rows.slice(start, start + 8);
    statements.push(db.prepare(`INSERT INTO rehabilitation_services
      (id,establishment_id,service_code,classification_code,classification_description,service_type,reference_month,
       source_establishment_name,source_city,source_state,source,source_url)
      VALUES ${chunk.map(() => "(?,(SELECT id FROM establishments WHERE cnes_code=?),'135',?,?,?,?,?,?,?,'cnes-services',?)").join(',')}
      ON CONFLICT(establishment_id,classification_code,service_type,reference_month) DO UPDATE SET
        classification_description=excluded.classification_description,source_establishment_name=excluded.source_establishment_name,
        source_city=excluded.source_city,source_state=excluded.source_state,source_url=excluded.source_url,imported_at=CURRENT_TIMESTAMP`)
      .bind(...chunk.flatMap(row => [
        `rehab-${row.cnes}-${row.cls}-${row.month}-${encodeURIComponent(row.type)}`, row.cnes, row.cls, row.description,
        row.type, row.month, row.name, row.city, row.state, catalog.source_url
      ])));
  }
  const id = crypto.randomUUID();
  statements.push(db.prepare(`INSERT INTO import_runs (id,source,status,records_received,records_imported,completed_at,details)
    VALUES (?,'cnes-services','completed',?,?,CURRENT_TIMESTAMP,?)`).bind(id, rows.length, rows.length,
      'Observações mensais do serviço 135; atendimento específico a TEA não verificado. Perfis existentes preservados.'));
  try {await db.batch(statements);}
  catch {return {status: 500, body: {error: 'import_failed', message: 'O lote não foi gravado. Confira se o catálogo de reabilitação foi configurado.'}};}
  return {status: 200, body: {import_id: id, entity: 'rehabilitation_services', source: 'cnes-services', status: 'completed', records_imported: rows.length, records_received: rows.length, note: catalog.note}};
}

export async function listRehabilitation(params: URLSearchParams, db: D1Database): Promise<Result> {
  const page = pagination(params);
  if (!page) return {status: 400, body: {error: 'invalid_pagination', message: 'Use limit de 1 a 100 e offset inteiro não negativo, sem repetir parâmetros.'}};
  const filters = ['q','city','state','classification_code','reference_month','cnes_code','service_type'];
  if (filters.some(key => params.getAll(key).length > 1)) return {status: 400, body: {error: 'invalid_filters'}};
  const value = (key: string) => (params.get(key) ?? '').trim();
  const cls = value('classification_code'), month = value('reference_month'), cnes = value('cnes_code');
  if ((cls && !/^[0-9]{3}$/.test(cls)) || (month && !monthPattern.test(month)) || (cnes && !/^[0-9]{7}$/.test(cnes)))
    return {status: 400, body: {error: 'invalid_filters', message: 'Use classificação de três dígitos, competência AAAAMM válida e CNES de sete dígitos.'}};
  let from = ' FROM rehabilitation_services r JOIN establishments e ON e.id=r.establishment_id WHERE 1=1';
  const values: string[] = [];
  for (const [key, column, like, upper] of [
    ['q','r.source_establishment_name',true,false], ['city','r.source_city',true,false], ['state','r.source_state',false,true],
    ['classification_code','r.classification_code',false,false], ['reference_month','r.reference_month',false,false],
    ['cnes_code','e.cnes_code',false,false], ['service_type','r.service_type',false,true]
  ] as const) {
    const raw = value(key);
    if (raw) {from += ` AND ${column} ${like ? 'LIKE' : '='} ?`; const v = upper ? raw.toUpperCase() : raw; values.push(like ? `%${v}%` : v);}
  }
  if (!month) from += ` AND NOT EXISTS (SELECT 1 FROM rehabilitation_services newer
    WHERE newer.establishment_id=r.establishment_id AND newer.classification_code=r.classification_code
      AND newer.service_type=r.service_type AND newer.reference_month>r.reference_month)`;
  try {
    const result = await readPage(db, `SELECT r.id,e.id AS establishment_id,e.cnes_code,r.source_establishment_name AS name,
      e.name AS current_establishment_name,r.source_city AS city,r.source_state AS state,r.service_code,r.classification_code,
      r.classification_description,r.service_type,r.reference_month,r.source,r.source_url,r.imported_at` + from,
      'SELECT COUNT(*) AS total' + from, ' ORDER BY r.source_establishment_name,e.cnes_code,r.classification_code,r.service_type,r.reference_month,r.id', values, page, catalog.note);
    return {status: 200, body: {...result, classifications: catalog.classifications, classification_reference_url: catalog.reference_url,
      results: result.results.map(row => ({...row,
        classification_name: names.get(String(row.classification_code)) ?? String(row.classification_description),
        autism_care_verification: autismEvidence(String(row.cnes_code)) ? 'documented' : 'not_verified',
        autism_evidence: autismEvidence(String(row.cnes_code))}))}};
  } catch {return {status: 503, body: {error: 'rehabilitation_unavailable', message: 'O catálogo de reabilitação ainda não está disponível.'}};}
}
