import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app,{type Env} from '../src/index';
import {recordsHash} from '../src/ans-operators';
let sqlite:DatabaseSync;let env:Env;
function statement(sql:string,values:any[]=[]):any{return {bind:(...params:any[])=>statement(sql,params),first:async()=>sqlite.prepare(sql).get(...values)??null,
 execute:()=>/^SELECT/i.test(sql.trim())?{results:sqlite.prepare(sql).all(...values)}:sqlite.prepare(sql).run(...values)};}
const active={ans_code:'000001',name:'Operadora ativa fictícia',trade_name:null,modality:'Medicina de Grupo',city:'Curitiba',state:'PR',registered_on:'2020-01-01',cancelled_on:null,cancellation_reason:null,status:'active' as const};
const cancelled={...active,ans_code:'000002',name:'Operadora cancelada fictícia',status:'cancelled' as const,cancelled_on:'2025-01-01',cancellation_reason:'Pedido de cancelamento'};
async function payload(rows:any[]=[active,cancelled],expected:string|null=null){rows=[...rows].sort((a,b)=>a.ans_code.localeCompare(b.ans_code));return {entity:'ans_operators_snapshot',source:'ans',records:rows,expected_snapshot_id:expected,
 metadata:{active_source_date:'2026-11-24',cancelled_source_date:'2026-11-24',active_sha256:'a'.repeat(64),cancelled_sha256:'b'.repeat(64),records_sha256:await recordsHash(rows),prepared_at:'2026-11-24T10:00:00Z',active_count:rows.filter(r=>r.status==='active').length,cancelled_count:rows.filter(r=>r.status==='cancelled').length}};}
async function send(p:any,token='test-only'){const r=await app.fetch(new Request('https://example.test/admin/ans/operators/snapshot',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(p)}),env);return {status:r.status,body:await r.json() as any};}
async function get(path='/v1/operators'){const r=await app.fetch(new Request('https://example.test'+path,{headers:{authorization:'Bearer test-only'}}),env);return {status:r.status,body:await r.json() as any};}
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const path of ['migrations/0001_initial.sql','migrations/0003_ans_operators.sql'])sqlite.exec(readFileSync(path,'utf8'));
 env={IMPORT_TOKEN:'test-only',DB:{prepare:statement,batch:async(items:any[])=>{sqlite.exec('BEGIN');try{const result=items.map(i=>i.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}as unknown as D1Database};});
afterEach(()=>sqlite.close());
describe('ANS complete operator snapshots',()=>{
 it('imports active and cancelled records, retaining dates and original source without personal fields',async()=>{
  const r=await send(await payload());expect(r.status).toBe(200);expect(r.body.changes).toMatchObject({added:2,changed:0});
  const data=(await get()).body;expect(data.total).toBe(2);expect(data.results.find((r:any)=>r.ans_code==='000002')).toMatchObject({status:'cancelled',cancelled_on:'2025-01-01',source_updated_at:'2026-11-24'});
  expect((await get('/admin/ans/operators/state')).body.snapshot).toMatchObject({record_count:2,active_count:1,cancelled_count:1});
 });
 it('does not duplicate an identical snapshot and records an unchanged check',async()=>{
  const a=await send(await payload());const b=await send(await payload(undefined,a.body.snapshot_id));expect(b.body).toMatchObject({status:'unchanged',records_imported:0,snapshot_id:a.body.snapshot_id});
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM ans_operator_snapshots').get()?.n).toBe(1);expect(sqlite.prepare('SELECT COUNT(*) AS n FROM import_runs').get()?.n).toBe(2);
 });
 it('updates names, tracks status changes and preserves legacy IDs and product references',async()=>{
  sqlite.exec("INSERT INTO operators(id,ans_code,name) VALUES('legacy','000001','Old');INSERT INTO products(id,operator_id,name)VALUES('p','legacy','Product')");
  const first=await send(await payload());const next=[{...cancelled,ans_code:'000001'}, {...active,ans_code:'000002'}];
  const r=await send(await payload(next,first.body.snapshot_id));expect(r.body.changes).toMatchObject({status_changed:2,changed:2});
  expect(sqlite.prepare("SELECT id,status FROM operators WHERE ans_code='000001'").get()).toMatchObject({id:'legacy',status:'cancelled'});
 });
 it('marks missing managed records as unverified instead of cancellation or deletion',async()=>{
  const rows=[active,cancelled,...Array.from({length:20},(_,i)=>({...active,ans_code:String(i+10).padStart(6,'0')}))];
  const first=await send(await payload(rows));const next=rows.filter(r=>r.ans_code!=='000001');
  const r=await send(await payload(next,first.body.snapshot_id));expect(r.body.changes.not_in_latest_source).toBe(1);
  expect((await get('/v1/operators?ans_code=000001')).body.results[0]).toMatchObject({status:'not_in_latest_source',cancelled_on:null});
 });
 it('refuses a stale baseline, older source and sharp reduction without changing the base',async()=>{
  const first=await send(await payload());expect((await send(await payload())).status).toBe(409);
  const p=await payload(undefined,first.body.snapshot_id);p.metadata.active_source_date='2026-11-23';expect((await send(p)).body.error).toBe('older_source');
  const p2=await payload([active,{...cancelled,ans_code:'000003'}],first.body.snapshot_id);p2.metadata.records_sha256='c'.repeat(64);expect((await send(p2)).status).toBe(422);
  expect((await get()).body.total).toBe(2);
 });
 it('blocks a greater than 10 percent decline',async()=>{
  const rows=[active,cancelled,...Array.from({length:10},(_,i)=>({...active,ans_code:String(i+10).padStart(6,'0')}))];const first=await send(await payload(rows));
  expect((await send(await payload([active,cancelled],first.body.snapshot_id))).body.error).toBe('unexpected_source_reduction');expect((await get()).body.total).toBe(12);
 });
 it('rolls back the snapshot, operator updates and state when history fails',async()=>{
  sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON import_runs BEGIN SELECT RAISE(ABORT,'test'); END");
  expect((await send(await payload())).status).toBe(409);expect((await get()).body.total).toBe(0);expect((await get('/admin/ans/operators/state')).body.snapshot).toBeNull();
 });
 it('filters the headquarters location, status and ANS code and paginates consistently',async()=>{
  await send(await payload());expect((await get('/v1/operators?state=pr&city=curitiba&status=active')).body.total).toBe(1);
  const page=(await get('/v1/operators?limit=1')).body;expect(page).toMatchObject({total:2,count:1,pagination:{has_more:true,next_offset:1}});
  expect((await get('/v1/operators?limit=1&offset=1')).body.count).toBe(1);
  expect((await get('/v1/operators?status=wrong')).status).toBe(400);expect((await get('/v1/operators?ans_code=1')).status).toBe(400);
 });
 it.each([{...active,ans_code:1},{...active,representante:'Private'},{...active,state:'XX'},{...active,status:'cancelled'},{...active,registered_on:'2026-02-30'},{...active,cancelled_on:'2025-01-01'}])('rejects malformed and personal fields (%j)',async row=>{
  const p=await payload([row,cancelled]);expect((await send(p)).status).toBe(422);expect((await get()).body.total).toBe(0);
 });
 it('requires authentication and rejects malformed bodies, duplicates and unknown metadata',async()=>{
  expect((await send(await payload(),'wrong')).status).toBe(401);
  expect((await send(await payload([active,active,cancelled]))).status).toBe(422);
  const p:any=await payload();p.metadata.representante='No';expect((await send(p)).status).toBe(422);
 });
 it('bounds the streamed body even without a length header',async()=>{
  const response=await app.fetch(new Request('https://example.test/admin/ans/operators/snapshot',{method:'POST',headers:{authorization:'Bearer test-only'},body:'x'.repeat(2*1024*1024+1)}),env);
  expect(response.status).toBe(413);expect((await get()).body.total).toBe(0);
 });
 it('announces operator readiness only after a complete committed snapshot',async()=>{
  expect((await get('/sources')).body.sources.find((s:any)=>s.id==='ans')).toMatchObject({operators_ready:false,integration_status:'mapping_pending'});
  await send(await payload());
  expect((await get('/sources')).body.sources.find((s:any)=>s.id==='ans')).toMatchObject({operators_ready:true,integration_status:'partial',active_source_date:'2026-11-24'});
  env.RAPIDAPI_PROXY_SECRET='gateway-test-only';
  const response=await app.fetch(new Request('https://example.test/rapidapi/v1/operators?status=active',{headers:{'x-rapidapi-proxy-secret':'gateway-test-only'}}),env);
  expect(response.status).toBe(200);expect((await response.json() as any).total).toBe(1);
 });
 it('aborts the entire batch if the baseline changes between validation and commit',async()=>{
  const first=await send(await payload());
  const original=env.DB.batch.bind(env.DB);let interfere=true;
  env.DB.batch=(async(items:any[])=>{
   if(interfere){interfere=false;
    sqlite.prepare(`INSERT INTO ans_operator_snapshots SELECT 'competing',records_sha256,records_json,active_source_date,cancelled_source_date,active_sha256,cancelled_sha256,prepared_at,record_count,active_count,cancelled_count,changes_json,imported_at,last_checked_at FROM ans_operator_snapshots WHERE id=?`).run(first.body.snapshot_id);
    sqlite.exec("UPDATE ans_operator_state SET current_snapshot_id='competing'");
   }
   return original(items);
  }) as typeof env.DB.batch;
  const r=await send(await payload([{...active,name:'Should roll back'},cancelled],first.body.snapshot_id));
  expect(r.status).toBe(409);expect(sqlite.prepare("SELECT name FROM operators WHERE ans_code='000001'").get()?.name).toBe(active.name);
  expect((await get('/admin/ans/operators/state')).body.snapshot.id).toBe('competing');
 });
 it('applies migration idempotently and reports unavailable configuration before migration',async()=>{
  sqlite.exec(readFileSync('migrations/0003_ans_operators.sql','utf8'));sqlite.exec('DROP TABLE ans_operator_details;DROP TABLE ans_operator_state;DROP TABLE ans_operator_snapshots;');
  expect((await get('/admin/ans/operators/state')).status).toBe(503);expect((await get()).status).toBe(200);expect((await get('/v1/operators?state=PR')).status).toBe(503);
 });
});
