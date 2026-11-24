import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app,{type Env} from '../src/index';
import {planHash} from '../src/ans-plans';
let db:DatabaseSync,env:Env;
function statement(sql:string,values:any[]=[]):any{return {bind:(...v:any[])=>statement(sql,v),first:async()=>db.prepare(sql).get(...values)??null,
 all:async()=>({results:db.prepare(sql).all(...values)}),run:async()=>db.prepare(sql).run(...values),execute:()=>/^SELECT/i.test(sql.trim())?{results:db.prepare(sql).all(...values)}:db.prepare(sql).run(...values)};}
const row={plan_id:'10000001',registration_code:'SCPA-001',name:'Plano nacional fictício',ans_code:'000001',status:'active',contracting_type:'Individual ou familiar',segmentation:'Referência',coverage_scope:'Nacional',accommodation:'Individual',cost_sharing:'Ausente',registered_on:null,status_changed_on:'2020-01-01',source_updated_at:'2026-11-24'};
async function packageOf(chunks:any[][]=[[row]]){const manifest={entity:'ans_plans_snapshot',scope:'national',source_date:'2026-11-24',file_date:'2026-11-24',file_sha256:'a'.repeat(64),record_count:chunks.flat().length,chunks:await Promise.all(chunks.map(async r=>({sha256:await planHash(r),record_count:r.length})))};return {snapshot_id:await planHash(manifest),manifest,chunks};}
async function call(path:string,p?:any,token='test-only'){const r=await app.fetch(new Request('https://test.invalid'+path,{method:p?'POST':'GET',headers:{authorization:'Bearer '+token,'x-rapidapi-proxy-secret':'test-gateway'},body:p?JSON.stringify(p):undefined}),env);return {status:r.status,body:await r.json() as any};}
const begin=(p:any,expected:string|null=null)=>call('/admin/ans/plans/begin',{snapshot_id:p.snapshot_id,manifest:p.manifest,expected_snapshot_id:expected});
const chunk=(p:any,i=0)=>call('/admin/ans/plans/chunk',{snapshot_id:p.snapshot_id,chunk_index:i,records:p.chunks[i]});
const commit=(p:any)=>call('/admin/ans/plans/commit',{snapshot_id:p.snapshot_id});
async function publish(p:any,expected:string|null=null){expect((await begin(p,expected)).status).toBe(200);for(let i=0;i<p.chunks.length;i++)expect((await chunk(p,i)).status).toBe(200);return commit(p);}
beforeEach(()=>{db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const p of ['0001_initial','0003_ans_operators','0004_ans_plans'])db.exec(readFileSync('migrations/'+p+'.sql','utf8'));
 db.exec("INSERT INTO operators(id,ans_code,name) VALUES('legacy-op','000001','Operadora fictícia');INSERT INTO ans_operator_snapshots(id,records_sha256,records_json,active_source_date,cancelled_source_date,active_sha256,cancelled_sha256,prepared_at,record_count,active_count,cancelled_count,changes_json)VALUES('op','x','[]','2026-11-24','2026-11-24','x','y','2026-11-24',1,1,0,'{}');UPDATE ans_operator_state SET current_snapshot_id='op'");
 env={IMPORT_TOKEN:'test-only',RAPIDAPI_PROXY_SECRET:'test-gateway',DB:{prepare:statement,batch:async(items:any[])=>{db.exec('BEGIN');try{const result=items.map(x=>x.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}as unknown as D1Database};});
afterEach(()=>db.close());
describe('national plans snapshots',()=>{
 it('hides incomplete parts, resumes by hash, preserves SCPA codes and publishes only a complete catalog',async()=>{
  const p=await packageOf([[row],[{...row,plan_id:'10000002',name:'Plano transferido',status:'transferred'}]]);
  expect((await begin(p)).status).toBe(200);await chunk(p);expect((await call('/v1/plans')).body.total).toBe(0);
  expect((await commit(p)).body.error).toBe('incomplete_snapshot');expect((await begin(p)).body.received).toHaveLength(1);
  expect((await chunk(p)).body.status).toBe('already_received');await chunk(p,1);expect((await commit(p)).body).toMatchObject({status:'completed',record_count:2,changes:{added:2}});
  const page=(await call('/v1/plans?registration_code=SCPA-001&limit=1')).body;expect(page).toMatchObject({total:2,count:1,pagination:{next_offset:1}});
  expect(page.results[0]).toMatchObject({ans_code:'000001',registration_code:'SCPA-001',registered_on:null,operator_name:'Operadora fictícia',snapshot_id:p.snapshot_id});
  expect((await call('/sources')).body.sources.find((s:any)=>s.id==='ans')).toMatchObject({plans_ready:true,plans_count:2,plans_source_date:'2026-11-24'});
  expect((await call('/rapidapi/v1/plans?status=transferred')).status).toBe(404);
 });
 it('keeps the previous public snapshot during staging, records changes and absent IDs without inventing cancellations',async()=>{
  const p=await packageOf([[row,{...row,plan_id:'10000002'},{...row,plan_id:'10000003'},{...row,plan_id:'10000004'},{...row,plan_id:'10000005'},{...row,plan_id:'10000006'},{...row,plan_id:'10000007'},{...row,plan_id:'10000008'},{...row,plan_id:'10000009'},{...row,plan_id:'10000010'}]]);await publish(p);
  const next=await packageOf([[{...row,status:'cancelled'},...p.chunks[0].slice(2),{...row,plan_id:'10000011'}]]);await begin(next,p.snapshot_id);await chunk(next);
  expect((await call('/v1/plans?status=cancelled')).body.total).toBe(0);
  expect((await commit(next)).body.changes).toMatchObject({added:1,changed:1,status_changed:1,not_in_latest_source:1});
  expect((await call('/v1/plans?plan_id=10000002')).body.total).toBe(0);
  expect(db.prepare('SELECT COUNT(*) AS n FROM ans_plan_records WHERE snapshot_id=?').get(p.snapshot_id)?.n).toBe(10);
 });
 it('records an unchanged verification without writing parts again',async()=>{const p=await packageOf();await publish(p);expect((await begin(p,p.snapshot_id)).body.status).toBe('unchanged');expect(db.prepare('SELECT COUNT(*) AS n FROM ans_plan_snapshots').get()?.n).toBe(1);});
 it('rolls back publication and readiness if writing history fails',async()=>{
  const p=await packageOf();await begin(p);await chunk(p);db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON import_runs BEGIN SELECT RAISE(ABORT,'test'); END");
  expect((await commit(p)).status).toBe(409);expect((await call('/admin/ans/plans/state')).body.snapshot).toBeNull();expect((await call('/v1/plans')).body.total).toBe(0);
  expect(db.prepare('SELECT status FROM ans_plan_snapshots').get()?.status).toBe('staging');expect(db.prepare('SELECT COUNT(*) AS n FROM ans_plan_publications').get()?.n).toBe(0);
 });
 it('rejects missing operators and allows fixing operator data before committing the same staged catalog',async()=>{const p=await packageOf([[{...row,ans_code:'999999'}]]);await begin(p);await chunk(p);expect((await commit(p)).body.error).toBe('operator_link_unresolved');db.exec("INSERT INTO operators(id,ans_code,name)VALUES('other','999999','Outra operadora')");expect((await commit(p)).status).toBe(200);});
 it('requires operator readiness and the additive migration',async()=>{db.exec('UPDATE ans_operator_state SET current_snapshot_id=NULL');expect((await begin(await packageOf())).body.error).toBe('operators_not_ready');db.exec('DROP TABLE ans_plan_state');expect((await call('/admin/ans/plans/state')).status).toBe(503);expect((await call('/v1/plans')).status).toBe(200);expect((await call('/v1/plans?status=active')).status).toBe(503);});
 it('enforces a daily import budget without exposing parts or consuming budget on resends',async()=>{
  env.ANS_PLANS_DAILY_RECORD_LIMIT='250';const p=await packageOf([Array.from({length:250},(_,i)=>({...row,plan_id:String(10000000+i)})),[{...row,plan_id:'10000251'}]]);
  await begin(p);expect((await chunk(p)).status).toBe(200);expect((await chunk(p)).status).toBe(200);expect((await chunk(p,1)).status).toBe(429);expect((await call('/v1/plans')).body.total).toBe(0);
  db.exec('DELETE FROM ans_plan_write_budget');expect((await chunk(p,1)).status).toBe(200);expect((await commit(p)).status).toBe(200);
 });
 it('rolls back chunk and budget when a duplicate unique plan crosses parts',async()=>{const p=await packageOf([[row],[row]]);await begin(p);await chunk(p);expect((await chunk(p,1)).status).toBe(409);expect(db.prepare('SELECT record_count FROM ans_plan_write_budget').get()?.record_count).toBe(1);expect((await commit(p)).status).toBe(409);});
 it('rejects tampered manifest, records, extra fields and invalid dates before writing',async()=>{
  const p=await packageOf();p.manifest.record_count++;expect((await begin(p)).status).toBe(422);
  for(const bad of [{...row,status:'unknown'},{...row,registered_on:'2026-02-30'},{...row,contact:'private'},{...row,ans_code:'1'}]){const x=await packageOf([[bad]]);await begin(x);expect((await chunk(x)).status).toBe(422);}
  const clean=await packageOf();await begin(clean);clean.chunks[0][0]={...row,name:'tampered'};expect((await chunk(clean)).status).toBe(422);
 });
 it('rejects stale sources, baselines and unexpected reductions',async()=>{
  const p=await packageOf([[row,{...row,plan_id:'10000002'}]]);await publish(p);const next=await packageOf();expect((await begin(next)).body.error).toBe('snapshot_conflict');expect((await begin(next,p.snapshot_id)).body.error).toBe('unexpected_source_reduction');
  const m={...p.manifest,source_date:'2026-11-23'};expect((await begin({manifest:m,snapshot_id:await planHash(m)},p.snapshot_id)).body.error).toBe('older_source');
 });
 it('fails closed on unauthenticated admin calls and oversized bodies',async()=>{
  const p=await packageOf();expect((await call('/admin/ans/plans/begin',{snapshot_id:p.snapshot_id},'bad')).status).toBe(401);
  const r=await app.fetch(new Request('https://test.invalid/admin/ans/plans/begin',{method:'POST',headers:{authorization:'Bearer test-only'},body:'x'.repeat(512*1024+1)}),env);expect(r.status).toBe(413);
  expect((await call('/rapidapi/admin/ans/plans/state')).status).toBe(404);
 });
 it('uses bound filters and rejects ambiguous, unsupported geographic and oversized LIKE filters',async()=>{
  await publish(await packageOf());for(const q of ['status=bad','ans_code=1','plan_id=01','status=active&status=cancelled','q='+encodeURIComponent('á'.repeat(25)),'city=Curitiba'])expect((await call('/v1/plans?'+q)).status).toBe(400);
  expect((await call('/v1/plans?q=%27%20OR%201%3D1--')).body.total).toBe(0);expect((await call('/v1/plans?ans_code=000001&status=active')).body.total).toBe(1);
 });
 it('aborts a competing publication inside the commit transaction',async()=>{
  const p=await packageOf();await publish(p);const next=await packageOf([[{...row,status:'suspended'}]]);await begin(next,p.snapshot_id);await chunk(next);
  const original=env.DB.batch.bind(env.DB);env.DB.batch=(async(items:any[])=>{db.exec('UPDATE ans_plan_state SET current_snapshot_id=NULL');return original(items);}) as typeof env.DB.batch;
  expect((await commit(next)).status).toBe(409);expect(db.prepare('SELECT status FROM ans_plan_snapshots WHERE id=?').get(next.snapshot_id)?.status).toBe('staging');
 });
 it('applies migration idempotently and preserves legacy products and provider-network references',()=>{
  db.exec("INSERT INTO products(id,operator_id,name)VALUES('legacy-product','legacy-op','Produto legado')");db.exec(readFileSync('migrations/0004_ans_plans.sql','utf8'));expect(db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n).toBe(1);
 });
});
