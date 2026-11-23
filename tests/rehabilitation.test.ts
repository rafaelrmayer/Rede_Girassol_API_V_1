import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app, { type Env } from '../src/index';
import { autismEvidence } from '../src/autism-support';
import registry from '../autism-support-sources.json';

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
const record = {cnes_code: '0000123', establishment_name: 'Unidade fictícia', city: 'CURITIBA', state: 'PR',
  service_code: '135', classification_code: '002', classification_description: '002 - REABILITACAO INTELECTUAL',
  service_type: 'PROPRIO', reference_month: '202607'};
async function send(records: unknown = [record], token = 'test-only') {
  return app.fetch(new Request('https://example.test/admin/import', {method:'POST',headers:{authorization:'Bearer '+token},
    body: JSON.stringify({entity:'rehabilitation_services',source:'cnes-services',records})}), env);
}
async function get(path = '/v1/rehabilitation') {
  const response = await app.fetch(new Request('https://example.test'+path),env);
  return {status:response.status,body:await response.json() as any};
}
beforeEach(() => {
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
  sqlite = new DatabaseSync(':memory:');
  for (const path of ['migrations/0001_initial.sql','migrations/0002_rehabilitation.sql']) sqlite.exec(readFileSync(path,'utf8'));
  env={IMPORT_TOKEN:'test-only',DB:{prepare:statement,batch:async(items:any[])=>{
    sqlite.exec('BEGIN');
    try {const results=items.map(item=>item.execute());sqlite.exec('COMMIT');return results;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }} as unknown as D1Database};
});
afterEach(()=>{sqlite.close();vi.useRealTimers();});

describe('rehabilitation observations',()=>{
  it('creates linked institutions, preserves the monthly reference and does not infer TEA from code 002',async()=>{
    expect((await send()).status).toBe(200);
    const result=await get();
    expect(result.body).toMatchObject({total:1,count:1});
    expect(result.body.results[0]).toMatchObject({cnes_code:'0000123',service_code:'135',classification_code:'002',
      classification_name:'Reabilitação Intelectual',reference_month:'202607',autism_care_verification:'not_verified',autism_evidence:null});
    const parent=await get('/v1/places/0000123');
    expect(parent.body.result).toMatchObject({id:'cnes-0000123',source:'cnes-services',source_updated_at:null});
    expect(sqlite.prepare('SELECT records_imported FROM import_runs').get()?.records_imported).toBe(1);
  });
  it('preserves existing profile ID, name, address and reference date',async()=>{
    sqlite.prepare("INSERT INTO establishments(id,cnes_code,name,address,city,state,source,source_updated_at) VALUES(?,?,?,?,?,?,'cnes',?)")
      .run('legacy-id','0000123','Nome do perfil','Endereço institucional','Londrina','PR','2026-11-01');
    await send();
    const profile=(await get('/v1/places/0000123')).body.result;
    expect(profile).toMatchObject({id:'legacy-id',name:'Nome do perfil',address:'Endereço institucional',city:'Londrina',source_updated_at:'2026-11-01'});
    expect((await get()).body.results[0]).toMatchObject({establishment_id:'legacy-id',name:'Unidade fictícia',city:'CURITIBA',current_establishment_name:'Nome do perfil'});
  });
  it('reimports without duplicates and retains historical months; defaults to newest observation per class and type',async()=>{
    await send([record,{...record,reference_month:'202606'}, {...record,classification_code:'003',reference_month:'202605'}]);
    await send([record]);
    expect((await get()).body.total).toBe(2);
    const history=await get('/v1/rehabilitation?reference_month=202606');
    expect(history.body).toMatchObject({total:1});
    expect(history.body.results[0].reference_month).toBe('202606');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM rehabilitation_services').get()?.n).toBe(3);
  });
  it('keeps distinct own and third-party registrations and applies pagination and region filters',async()=>{
    await send([record,{...record,service_type:'TERCEIRO'}, {...record,cnes_code:'0000124',city:'LONDRINA'}]);
    const page=await get('/v1/rehabilitation?city=Curitiba&state=pr&classification_code=002&limit=1');
    expect(page.body).toMatchObject({count:1,total:2,pagination:{has_more:true,next_offset:1}});
    expect((await get('/v1/rehabilitation?city=Curitiba&service_type=terceiro')).body.total).toBe(1);
  });
  it('preserves unknown source classification descriptions without assigning autism care',async()=>{
    await send([{...record,classification_code:'999',classification_description:'999 - Classificação da fonte'}]);
    expect((await get()).body.results[0]).toMatchObject({classification_name:'999 - Classificação da fonte',autism_care_verification:'not_verified'});
  });
  it.each([
    {...record,service_code:'121'}, {...record,cnes_code:123}, {...record,classification_code:'2'},
    {...record,reference_month:'202613'}, {...record,reference_month:'2026-07'}, {...record,state:'XX'},
    {...record,autism_care_verification:'documented'}, {...record,cpf:'not accepted'}, {...record,establishment_name:''}
  ])('rejects invalid or unsupported fields before writing (%j)',async invalid=>{
    expect((await send([record,invalid])).status).toBe(422);
    expect((await get()).body.total).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM establishments').get()?.n).toBe(0);
  });
  it('rejects duplicate observations and oversized imports',async()=>{
    expect((await send([record,record])).status).toBe(422);
    expect((await send(Array(101).fill(record))).status).toBe(413);
  });
  it('protects import authorization',async()=>{
    expect((await send([record],'wrong')).status).toBe(401);
    expect((await get()).body.total).toBe(0);
  });
  it('atomically imports 100 observations with related institutions',async()=>{
    const records=Array.from({length:100},(_,i)=>({...record,cnes_code:String(i+1).padStart(7,'0')}));
    expect((await send(records)).status).toBe(200);
    expect((await send(records)).status).toBe(200);
    expect((await get()).body.total).toBe(100);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM establishments').get()?.n).toBe(100);
  });
  it('rolls back parents and observations on history failure',async()=>{
    sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON import_runs BEGIN SELECT RAISE(ABORT,'test failure'); END");
    expect((await send()).status).toBe(500);
    expect((await get()).body.total).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM establishments').get()?.n).toBe(0);
  });
  it('keeps the migration idempotent and explains unavailable service catalogs',async()=>{
    sqlite.exec(readFileSync('migrations/0002_rehabilitation.sql','utf8'));
    sqlite.exec('DROP TABLE rehabilitation_services');
    expect(await get()).toMatchObject({status:503,body:{error:'rehabilitation_unavailable'}});
    expect((await get('/v1/places')).status).toBe(200);
  });
  it.each(['classification_code=2','reference_month=202613','cnes_code=123','classification_code=002&classification_code=003','limit=0'])
    ('rejects invalid query filters %s',async query=>{
      expect((await get('/v1/rehabilitation?'+query)).status).toBe(400);
    });
});

describe('documented autism support search',()=>{
  it('does not use an autism-like name or intellectual rehabilitation as proof',async()=>{
    await send([{...record,establishment_name:'Clínica autismo fictícia'}]);
    expect((await get('/v1/autism-support')).body.total).toBe(0);
  });
  it('returns only a CNES linked to explicit curated evidence, with publication/review dates and audience',async()=>{
    await send([record,{...record,cnes_code:'0015466',establishment_name:'CENTRO DE ESPECIALIDADES MEDICAS ENCANTAR'}]);
    const result=await get('/v1/autism-support?city=curitiba&state=pr&limit=1');
    expect(result.body).toMatchObject({count:1,total:1});
    expect(result.body.results[0]).toMatchObject({cnes_code:'0015466',autism_care_verification:'documented',autism_evidence:{
      published_on:'2026-03-30',reviewed_on:'2026-11-23',review_due_on:'2027-02-21',scope:expect.stringContaining('crianças e adolescentes')
    }});
    expect((await get('/v1/rehabilitation?cnes_code=0015466')).body.results[0].autism_care_verification).toBe('documented');
    expect((await get('/v1/autism-support?city=Londrina')).body.total).toBe(0);
  });
  it('lists the six reviewed institutions, paginates and preserves unverified rehabilitation records',async()=>{
    await send([...registry.entries.map(entry=>({...record,cnes_code:entry.cnes_code,establishment_name:entry.establishment_name})),record]);
    const first=await get('/v1/autism-support?city=Curitiba&state=PR&limit=3');
    const second=await get('/v1/autism-support?city=Curitiba&state=PR&limit=3&offset=3');
    expect(first.body).toMatchObject({count:3,total:6,pagination:{has_more:true,next_offset:3}});
    expect(second.body).toMatchObject({count:3,total:6,pagination:{has_more:false,next_offset:null}});
    const rows=[...first.body.results,...second.body.results];
    expect(new Set(rows.map(row=>row.cnes_code))).toEqual(new Set(registry.entries.map(entry=>entry.cnes_code)));
    expect(rows.every(row=>row.autism_evidence.scope.includes('crianças e adolescentes'))).toBe(true);
    expect((await get('/v1/autism-support?q=FEPE')).body.results[0].cnes_code).toBe('2774925');
    expect((await get('/v1/rehabilitation')).body.total).toBe(7);
    expect((await get('/v1/rehabilitation?cnes_code='+record.cnes_code)).body.results[0].autism_care_verification).toBe('not_verified');
    vi.setSystemTime(new Date('2027-02-22T12:00:00Z'));
    expect((await get('/v1/autism-support')).body.total).toBe(0);
  });
  it('works with institution profiles even before monthly services are imported',async()=>{
    sqlite.exec("INSERT INTO establishments(id,cnes_code,name,city,state) VALUES('known','0015466','Encantar','Curitiba','PR')");
    expect((await get('/v1/autism-support')).body.total).toBe(1);
  });
  it('withdraws evidence after the review deadline and never describes it as confirmed availability',async()=>{
    await send([{...record,cnes_code:'0015466'}]);
    vi.setSystemTime(new Date('2027-02-22T12:00:00Z'));
    expect((await get('/v1/autism-support')).body.total).toBe(0);
    expect((await get('/v1/rehabilitation')).body.results[0]).toMatchObject({autism_care_verification:'not_verified',autism_evidence:null});
  });
  it('has a unique institutional identity and official URLs for each reviewed evidence entry',()=>{
    expect(new Set(registry.entries.map(entry=>entry.cnes_code)).size).toBe(registry.entries.length);
    for(const entry of registry.entries){
      expect(entry.cnes_code).toMatch(/^[0-9]{7}$/);
      expect(autismEvidence(entry.cnes_code,'2026-11-23')).not.toBeNull();
      for(const url of [entry.url,entry.identity_source_url,entry.access_source_url])expect(new URL(url).hostname.endsWith('.gov.br')).toBe(true);
      expect(autismEvidence(entry.cnes_code,'2026-11-22')).toBeNull();
      expect(autismEvidence(entry.cnes_code,'2027-02-22')).toBeNull();
    }
  });
});
