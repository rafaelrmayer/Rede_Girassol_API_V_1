import registry from '../autism-support-sources.json';
import { pagination, readPage } from './pagination';

function officialUrl(raw: string) {
  try {const url = new URL(raw); return url.protocol === 'https:' && url.hostname.endsWith('.gov.br') && !url.username && !url.password;}
  catch {return false;}
}
function validDate(value: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function autismEvidence(cnes: string, today = new Date().toISOString().slice(0, 10)) {
  return registry.entries.find(entry => entry.cnes_code === cnes &&
    [entry.published_on, entry.reviewed_on, entry.review_due_on, entry.access_source_published_on].every(validDate) &&
    officialUrl(entry.url) && officialUrl(entry.identity_source_url) && officialUrl(entry.access_source_url) &&
    entry.reviewed_on <= today && entry.review_due_on >= today && entry.published_on <= entry.reviewed_on &&
    entry.access_source_published_on <= entry.reviewed_on &&
    Date.parse(entry.review_due_on) - Date.parse(entry.reviewed_on) > 0 &&
    Date.parse(entry.review_due_on) - Date.parse(entry.reviewed_on) <= 90 * 86400000) ?? null;
}

export async function listAutismSupport(params: URLSearchParams, db: D1Database) {
  const page = pagination(params);
  if (!page) return {status: 400, body: {error: 'invalid_pagination', message: 'Use limit de 1 a 100 e offset inteiro não negativo, sem repetir parâmetros.'}};
  if (['q','city','state'].some(key => params.getAll(key).length > 1)) return {status: 400, body: {error: 'invalid_filters'}};
  const eligible = registry.entries.filter(entry => autismEvidence(entry.cnes_code)).map(entry => entry.cnes_code);
  let from = ' FROM establishments e WHERE ' + (eligible.length ? 'e.cnes_code IN (' + eligible.map(() => '?').join(',') + ')' : '1=0');
  const values = [...eligible];
  for (const [key, column, like] of [['q','e.name',true],['city','e.city',true],['state','e.state',false]] as const) {
    const value = (params.get(key) ?? '').trim();
    if (value) {from += ` AND ${column} ${like ? 'LIKE' : '='} ?`; values.push(like ? `%${value}%` : value.toUpperCase());}
  }
  const result = await readPage(db, 'SELECT e.id,e.cnes_code,e.name,e.city,e.state' + from,
    'SELECT COUNT(*) AS total' + from, ' ORDER BY e.name,e.id', values, page, registry.policy);
  return {status: 200, body: {...result, results: result.results.map(row => ({...row,
    autism_care_verification: 'documented', autism_evidence: autismEvidence(String(row.cnes_code))}))}};
}
