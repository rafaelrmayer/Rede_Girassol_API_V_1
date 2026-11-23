import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app, { type Env } from '../src/index';

// Execute the real migration and SQL with SQLite. The adapter models D1 batch transactions.
let sqlite: DatabaseSync;
let env: Env;
function statement(sql: string, values: any[] = []): any {
  return {
    bind: (...params: any[]) => statement(sql, params),
    run: async () => sqlite.prepare(sql).run(...values),
    all: async () => ({results: sqlite.prepare(sql).all(...values)}),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    execute: () => sqlite.prepare(sql).run(...values)
  };
}
const record = {cnes_code: '0000001', name: 'Unidade de teste', city: 'Curitiba', state: 'PR'};
async function send(records: unknown = [record], source = 'sample', token = 'test-only') {
  return app.fetch(new Request('https://example.test/admin/import', {
    method: 'POST', headers: {authorization: `Bearer ${token}`},
    body: JSON.stringify({source, entity: 'establishments', records})
  }), env);
}
async function get(path: string) { return (await app.fetch(new Request(`https://example.test${path}`, {headers: {authorization: 'Bearer test-only'}}), env)).json() as Promise<any>; }
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  env = {IMPORT_TOKEN: 'test-only', DB: {
    prepare: statement,
    batch: async (items: any[]) => {
      sqlite.exec('BEGIN');
      try { const result = items.map(item => item.execute()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  } as unknown as D1Database};
});
afterEach(() => sqlite.close());
describe('normalized establishment imports', () => {
  it('persists records accessible by filters and CNES, with completed history', async () => {
    expect((await send()).status).toBe(200);
    const places = await get('/v1/places?city=Curitiba&state=pr&q=Unidade');
    expect(places.count).toBe(1);
    expect(places.results[0]).toMatchObject({...record, source: 'sample', id: 'cnes-0000001'});
    expect((await get('/v1/places/0000001')).result.cnes_code).toBe('0000001');
    expect((await get('/admin/imports')).imports[0]).toMatchObject({status: 'completed', records_received: 1, records_imported: 1, completed_at: expect.any(String)});
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM provider_network').get()?.n).toBe(0);
  });
  it('reimports without duplicates and preserves existing identity', async () => {
    await send();
    sqlite.exec("UPDATE establishments SET id='legacy-id'");
    expect((await send([{...record, name: 'Nome atualizado'}])).status).toBe(200);
    const places = await get('/v1/places');
    expect(places.count).toBe(1);
    expect(places.results[0]).toMatchObject({id: 'legacy-id', name: 'Nome atualizado'});
  });
  it.each([
    [], null, [{...record, cnes_code: 1}], [{...record, state: 'XX'}],
    [{...record, name: ' '}], [{...record, source_updated_at: '2026-02-30'}],
    [{...record, source: 'cnes'}], [record, record],
    [record, {...record, cnes_code: '0000002', unexpected: true}]
  ].map(records => [records]))('rejects invalid batches without any writes (%j)', async records => {
    expect((await send(records)).status).toBe(422);
    expect((await get('/v1/places')).count).toBe(0);
    expect((await get('/admin/imports')).imports).toEqual([]);
  });
  it('rejects ANS and oversized batches', async () => {
    expect((await send([record], 'ans')).status).toBe(422);
    expect((await send(Array(101).fill(record))).status).toBe(413);
  });
  it('rejects missing or incorrect authorization before writes', async () => {
    expect((await send([record], 'sample', 'wrong')).status).toBe(401);
    delete env.IMPORT_TOKEN;
    expect((await send()).status).toBe(401);
  });
  it('rejects malformed JSON and limits actual request bytes', async () => {
    for (const [body, status] of [['{', 400], ['x'.repeat(262145), 413]] as const) {
      const response = await app.fetch(new Request('https://example.test/admin/import', {method: 'POST', headers: {authorization: 'Bearer test-only'}, body}), env);
      expect(response.status).toBe(status);
    }
  });
  it('rolls back records if the history write fails', async () => {
    sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON import_runs BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    expect((await send()).status).toBe(500);
    expect((await get('/v1/places')).count).toBe(0);
  });
});
