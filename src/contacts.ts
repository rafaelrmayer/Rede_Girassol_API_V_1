import registry from '../institutional-contacts.json';

export function institutionalContact(cnes: unknown, today = new Date().toISOString().slice(0,10)) {
  const entry = registry.entries.find(item => item.cnes_code === cnes && item.reviewed_on <= today && item.review_due_on >= today);
  if (!entry) return {status: 'not_verified', phones: [], email: null, website: null, source_url: null,
    source_kind: null, source_updated_on: null, reviewed_on: null, review_due_on: null, note: 'Contato não confirmado.'};
  const {cnes_code: _, ...contact} = entry;
  return {status: 'published', ...contact};
}
export function withContacts<T extends Record<string, unknown>>(row: T) {
  return {...row, contact: institutionalContact(row.cnes_code)};
}
