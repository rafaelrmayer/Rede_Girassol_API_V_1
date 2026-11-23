import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import openapi from '../openapi.json';
import app, { type Env } from '../src/index';

let sqlite: DatabaseSync;
let env: Env;
let resolved: any;
const ajv = new Ajv({strict: false, allErrors: true});
addFormats(ajv);
const validators = new Map<string, ValidateFunction>();
function validateResponse(path: string, status: number, body: unknown) {
  const key = path + ':' + status;
  let validate = validators.get(key);
  if (!validate) {
    const schema = resolved.paths[path].get.responses[String(status)].content['application/json'].schema;
    validate = ajv.compile(schema);
    validators.set(key, validate);
  }
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}
function statement(sql: string, values: any[] = []): any {
  return {
    bind: (...params: any[]) => statement(sql, params),
    all: async () => ({results: sqlite.prepare(sql).all(...values)}),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    execute: () => ({results: sqlite.prepare(sql).all(...values)})
  };
}
async function get(path: string) {
  const response = await app.fetch(new Request('https://example.test' + path), env);
  return {status: response.status, body: await response.json()};
}
beforeAll(async () => {
  resolved = await SwaggerParser.validate(JSON.parse(JSON.stringify(openapi)));
});
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_rehabilitation.sql', 'utf8'));
  env = {APP_ENV: 'test', DB: {
    prepare: statement,
    batch: async (items: any[]) => items.map(item => item.execute())
  } as unknown as D1Database};
});
afterEach(() => sqlite.close());

describe('public OpenAPI contract', () => {
  it('serves the canonical, valid document without a database binding', async () => {
    const response = await app.fetch(new Request('https://example.test/openapi.json'), {} as Env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(openapi);
    expect(openapi.openapi).toBe('3.0.2');
  });
  it('contains eight unique public GET operations and no administrative credentials', () => {
    const entries = Object.entries(openapi.paths);
    expect(entries).toHaveLength(8);
    expect(entries.every(([path, value]) => !path.startsWith('/admin/') && Object.keys(value).join() === 'get')).toBe(true);
    expect(new Set(entries.map(([, value]) => value.get.operationId)).size).toBe(8);
    expect(openapi.security).toEqual([]);
    expect(JSON.stringify(openapi)).not.toContain('IMPORT_TOKEN');
  });
  it('validates every documented response example against its schema', () => {
    for (const [path, item] of Object.entries(resolved.paths) as Array<[string, any]>) {
      for (const [status, response] of Object.entries(item.get.responses) as Array<[string, any]>) {
        for (const example of Object.values(response.content?.['application/json']?.examples ?? {}) as any[]) {
          validateResponse(path, Number(status), example.value);
        }
      }
    }
  });
  it.each(['/health', '/sources', '/v1/places', '/v1/operators', '/v1/plans', '/v1/rehabilitation', '/v1/autism-support'])
    ('matches the real empty-database response for %s', async path => {
      const result = await get(path);
      expect(result.status).toBe(200);
      validateResponse(path, result.status, result.body);
    });
  it('validates populated rehabilitation and autism evidence responses', async () => {
    sqlite.prepare('INSERT INTO establishments (id,cnes_code,name,city,state,source) VALUES (?,?,?,?,?,?)')
      .run('encantar','0015466','CENTRO DE ESPECIALIDADES MEDICAS ENCANTAR','Curitiba','PR','sample');
    sqlite.prepare(`INSERT INTO rehabilitation_services
      (id,establishment_id,service_code,classification_code,classification_description,service_type,reference_month,
       source_establishment_name,source_city,source_state,source_url)
      VALUES ('observation','encantar','135','002','002 - INTELECTUAL','PROPRIO','202607','ENCANTAR','CURITIBA','PR','https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados')`).run();
    for (const path of ['/v1/autism-support','/v1/rehabilitation']) {
      const result = await get(path);
      expect(result.status).toBe(200);
      validateResponse(path, result.status, result.body);
    }
  });
  it('keeps the spec version aligned with the health endpoint', async () => {
    expect((await get('/health')).body).toMatchObject({version: openapi.info.version});
  });
  it('matches populated and nullable database fields for all collections and place detail', async () => {
    sqlite.prepare('INSERT INTO establishments (id,cnes_code,name,source,city,state) VALUES (?,?,?,?,?,?)')
      .run('cnes-0000123', '0000123', 'Unidade fictícia', 'sample', 'Curitiba', 'PR');
    sqlite.prepare('INSERT INTO operators (id,name) VALUES (?,?)').run('op-1', 'Operadora fictícia');
    sqlite.prepare('INSERT INTO products (id,name,operator_id) VALUES (?,?,?)').run('plan-1', 'Produto fictício', 'op-1');
    sqlite.prepare('INSERT INTO products (id,name) VALUES (?,?)').run('plan-2', 'Produto sem operadora');
    for (const [path, contractPath] of [
      ['/v1/places?limit=1&offset=0', '/v1/places'], ['/v1/places/0000123', '/v1/places/{place_id}'],
      ['/v1/operators?limit=1', '/v1/operators'], ['/v1/plans?limit=2', '/v1/plans']
    ]) {
      const result = await get(path);
      expect(result.status).toBe(200);
      validateResponse(contractPath, result.status, result.body);
    }
  });
  it('matches an empty page beyond the end and the parameter boundaries', async () => {
    const result = await get('/v1/places?offset=9007199254740891&limit=100');
    validateResponse('/v1/places', result.status, result.body);
    expect(result.body).toMatchObject({count: 0, total: 0, pagination: {next_offset: null}});
  });
  it.each(['/v1/places','/v1/operators','/v1/plans'])
    ('matches the invalid pagination response for %s', async path => {
      const result = await get(path + '?limit=0');
      expect(result.status).toBe(400);
      validateResponse(path, result.status, result.body);
    });
  it('matches the missing establishment response', async () => {
    const result = await get('/v1/places/0000001');
    expect(result.status).toBe(404);
    validateResponse('/v1/places/{place_id}', result.status, result.body);
  });
  it.each(['/docs','/docs/'])('serves the interactive documentation at %s', async path => {
    const response = await app.fetch(new Request('https://example.test' + path), {} as Env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('Baixar OpenAPI JSON');
    expect(html).toContain('/openapi.json');
  });
});
