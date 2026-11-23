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
    execute: () => /^SELECT/i.test(sql.trim()) ? {results: sqlite.prepare(sql).all(...values)} : sqlite.prepare(sql).run(...values)
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


describe('paginated public collections', () => {
  function seed() {
    for (let i = 0; i < 6; i++) {
      sqlite.prepare("INSERT INTO establishments (id,cnes_code,name,city,state) VALUES (?,?,?,?,?)")
        .run(`id-${i}`, String(i).padStart(7, '0'), 'Mesmo nome', i < 4 ? 'Curitiba' : 'Londrina', 'PR');
    }
  }
  it('keeps count compatible, returns filtered totals and visits stable pages without duplicates', async () => {
    seed();
    const first = await get('/v1/places?state=pr&city=Curitiba&limit=2');
    expect(first).toMatchObject({count: 2, total: 4, pagination: {limit: 2, offset: 0, has_more: true, next_offset: 2}});
    const second = await get('/v1/places?state=PR&city=Curitiba&limit=2&offset=2');
    expect(second).toMatchObject({count: 2, total: 4, pagination: {has_more: false, next_offset: null}});
    expect([...first.results, ...second.results].map(row => row.id)).toEqual(['id-0','id-1','id-2','id-3']);
  });
  it('handles empty filters and offsets beyond the last row', async () => {
    seed();
    expect(await get('/v1/places?limit=2&offset=30')).toMatchObject({count: 0, total: 6, pagination: {has_more: false, next_offset: null}});
    expect(await get('/v1/places?q=absent')).toMatchObject({count: 0, total: 0});
    expect(await get('/v1/places?q=%27%20OR%201%3D1--')).toMatchObject({count: 0, total: 0});
  });
  it('preserves default limit 100 and offset zero for existing clients', async () => {
    seed();
    expect(await get('/v1/places')).toMatchObject({count: 6, total: 6, pagination: {limit: 100, offset: 0}});
  });
  it.each(['limit=0','limit=101','limit=-1','limit=2.5','limit=x','limit=', 'limit=1&limit=2',
    'offset=-1','offset=2.5','offset=1e2','offset=','offset=9007199254740991','offset=0&offset=1'])
    ('rejects invalid pagination (%s) on every public collection', async query => {
      for (const path of ['places','operators','plans']) {
        const response = await app.fetch(new Request(`https://example.test/v1/${path}?${query}`), env);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({error: 'invalid_pagination'});
      }
    });
  it('paginates operator and product results with their own filters and totals', async () => {
    for (let i = 0; i < 3; i++) {
      sqlite.prepare('INSERT INTO operators (id,name) VALUES (?,?)').run(`op-${i}`, 'Operadora fictícia');
      sqlite.prepare('INSERT INTO products (id,operator_id,name) VALUES (?,?,?)').run(`plan-${i}`, `op-${i}`, 'Produto fictício');
    }
    for (const path of ['operators','plans']) {
      const page = await get(`/v1/${path}?q=fict&limit=2&offset=2`);
      expect(page).toMatchObject({total: 3, count: 1, pagination: {has_more: false, next_offset: null}});
    }
  });
});

describe('100-record atomic import', () => {
  const records = Array.from({length: 100}, (_, i) => ({...record, cnes_code: String(i + 1).padStart(7, '0')}));
  it('persists 100 records and can reimport them without duplicates', async () => {
    expect((await send(records)).status).toBe(200);
    expect((await send(records)).status).toBe(200);
    expect(await get('/v1/places?limit=20')).toMatchObject({count: 20, total: 100});
    expect((await get('/admin/imports')).imports).toHaveLength(2);
  });
  it('rolls back earlier chunks if a later record fails', async () => {
    sqlite.exec("CREATE TRIGGER fail_late BEFORE INSERT ON establishments WHEN NEW.cnes_code='0000099' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    expect((await send(records)).status).toBe(500);
    expect((await get('/v1/places')).total).toBe(0);
    expect((await get('/admin/imports')).imports).toEqual([]);
  });
});
