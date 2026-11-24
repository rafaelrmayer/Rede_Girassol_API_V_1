import {pagination,readPage} from './pagination';
export const ANS_PLANS='https://dadosabertos.ans.gov.br/FTP/PDA/caracteristicas_produtos_saude_suplementar-008/pda-008-caracteristicas_produtos_saude_suplementar.csv';
const statuses=['active','suspended','cancelled','transferred'];
const recordKeys=['plan_id','registration_code','name','ans_code','status','contracting_type','segmentation','coverage_scope','accommodation','cost_sharing','registered_on','status_changed_on','source_updated_at'];
const object=(v:any)=>!!v && typeof v==='object' && !Array.isArray(v);
const only=(v:any,keys:string[])=>object(v) && Object.keys(v).length===keys.length && keys.every(k=>k in v);
const hash=(v:any)=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
const date=(v:any)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
function canonical(v:any):string {return JSON.stringify(sort(v));}
function sort(v:any):any {return Array.isArray(v)?v.map(sort):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
export async function planHash(v:any) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const fail=(error:string,status=422)=>({status,body:{error}});
async function current(db:D1Database):Promise<any> {return db.prepare('SELECT s.id,s.source_date,s.file_date,s.file_sha256,s.record_count,s.chunk_count,s.imported_at,s.last_checked_at,s.changes_json FROM ans_plan_state c JOIN ans_plan_snapshots s ON s.id=c.current_snapshot_id WHERE c.singleton=1').first();}
export async function plansState(db:D1Database) {
  try{return {status:200,body:{snapshot:await current(db)}};}catch{return {status:503,body:{error:'plans_not_configured',message:'Execute migrations/0004_ans_plans.sql no D1.'}};}
}
async function readBody(request:Request):Promise<any> {
  const chunks:Uint8Array[]=[];let size=0;const reader=request.body?.getReader();
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw 413;}chunks.push(value);}
  const all=new Uint8Array(size);let start=0;for(const chunk of chunks){all.set(chunk,start);start+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(all));}catch{throw 400;}
}
function validRecord(r:any,sourceDate:string) {
  if(!only(r,recordKeys))return false;
  for(const [k,max]of Object.entries({plan_id:8,registration_code:30,name:300,ans_code:6,status:20,contracting_type:140,segmentation:140,coverage_scope:50,accommodation:50,cost_sharing:50})){
    if(typeof r[k]!=='string' || !r[k].trim() || r[k]!==r[k].trim() || r[k].length>max || /[\u0000-\u001f\u007f]/.test(r[k]))return false;
  }
  return /^[1-9][0-9]{0,7}$/.test(r.plan_id) && /^\d{6}$/.test(r.ans_code) && statuses.includes(r.status)
    && (r.registered_on===null || date(r.registered_on) && r.registered_on<=sourceDate)
    && date(r.status_changed_on) && r.status_changed_on<=sourceDate && r.source_updated_at===sourceDate;
}
export async function importAnsPlans(request:Request,db:D1Database,action:string,dailyLimit=15000) {
  let p:any;try{p=await readBody(request);}catch(code){return fail(code===413?'body_too_large':'invalid_json',Number(code));}
  try {
    if(action==='begin') {
      if(!only(p,['snapshot_id','manifest','expected_snapshot_id']) || !hash(p.snapshot_id) || !(p.expected_snapshot_id===null || hash(p.expected_snapshot_id)))return fail('invalid_manifest');
      const m=p.manifest;
      if(!only(m,['entity','scope','source_date','file_date','file_sha256','record_count','chunks']) || m.entity!=='ans_plans_snapshot' || m.scope!=='national'
        || !date(m.source_date) || !date(m.file_date) || m.source_date>m.file_date || m.file_date>new Date().toISOString().slice(0,10) || !hash(m.file_sha256)
        || !Number.isInteger(m.record_count) || m.record_count<1 || m.record_count>250000 || !Array.isArray(m.chunks) || !m.chunks.length || m.chunks.length>1000
        || m.chunks.some((c:any)=>!only(c,['sha256','record_count']) || !hash(c.sha256) || !Number.isInteger(c.record_count) || c.record_count<1 || c.record_count>250)
        || m.chunks.reduce((n:number,c:any)=>n+c.record_count,0)!==m.record_count || await planHash(m)!==p.snapshot_id)return fail('invalid_manifest');
      const before=await current(db);
      if(before?.id===p.snapshot_id) {
        await db.batch([db.prepare('UPDATE ans_plan_snapshots SET last_checked_at=CURRENT_TIMESTAMP WHERE id=?').bind(p.snapshot_id),
          db.prepare("INSERT INTO import_runs(id,source,status,records_received,records_imported,completed_at,details) VALUES(?,'ans-plans','unchanged',?,0,CURRENT_TIMESTAMP,?)").bind(crypto.randomUUID(),m.record_count,p.snapshot_id)]);
        return {status:200,body:{status:'unchanged',snapshot_id:p.snapshot_id,record_count:m.record_count}};
      }
      if((before?.id??null)!==p.expected_snapshot_id)return fail('snapshot_conflict',409);
      if(before && (m.source_date<before.source_date || m.file_date<before.file_date))return fail('older_source',409);
      if(before && m.record_count<before.record_count*.9)return fail('unexpected_source_reduction',409);
      const operator=await db.prepare('SELECT current_snapshot_id FROM ans_operator_state WHERE singleton=1').first<any>();
      if(!operator?.current_snapshot_id)return fail('operators_not_ready',409);
      const existing=await db.prepare('SELECT expected_snapshot_id,status FROM ans_plan_snapshots WHERE id=?').bind(p.snapshot_id).first<any>();
      if(existing && (existing.status!=='staging' || existing.expected_snapshot_id!==p.expected_snapshot_id))return fail('snapshot_conflict',409);
      if(!existing)await db.prepare('INSERT INTO ans_plan_snapshots(id,manifest_json,expected_snapshot_id,source_date,file_date,file_sha256,record_count,chunk_count) VALUES(?,?,?,?,?,?,?,?)')
        .bind(p.snapshot_id,canonical(m),p.expected_snapshot_id,m.source_date,m.file_date,m.file_sha256,m.record_count,m.chunks.length).run();
      const chunks=await db.prepare('SELECT chunk_index,sha256,record_count FROM ans_plan_chunks WHERE snapshot_id=? ORDER BY chunk_index').bind(p.snapshot_id).all();
      return {status:200,body:{status:'staging',snapshot_id:p.snapshot_id,received:chunks.results??[]}};
    }
    if(!object(p) || !hash(p.snapshot_id))return fail('invalid_snapshot');
    const s=await db.prepare('SELECT * FROM ans_plan_snapshots WHERE id=?').bind(p.snapshot_id).first<any>();
    if(!s)return fail('snapshot_not_found',404);
    if(action==='chunk') {
      if(!only(p,['snapshot_id','chunk_index','records']) || s.status!=='staging' || !Number.isInteger(p.chunk_index) || p.chunk_index<0 || p.chunk_index>=s.chunk_count || !Array.isArray(p.records))return fail('invalid_chunk');
      const m=JSON.parse(s.manifest_json),expected=m.chunks[p.chunk_index];
      if(p.records.length!==expected.record_count || p.records.some((r:any)=>!validRecord(r,s.source_date)) || new Set(p.records.map((r:any)=>r.plan_id)).size!==p.records.length || await planHash(p.records)!==expected.sha256)return fail('chunk_integrity_failed');
      const existing=await db.prepare('SELECT sha256 FROM ans_plan_chunks WHERE snapshot_id=? AND chunk_index=?').bind(s.id,p.chunk_index).first<any>();
      if(existing)return {status:200,body:{status:'already_received',chunk_index:p.chunk_index}};
      const day=new Date().toISOString().slice(0,10);
      const budget=await db.prepare('SELECT record_count FROM ans_plan_write_budget WHERE day=?').bind(day).first<any>();
      if((budget?.record_count??0)+p.records.length>dailyLimit)return fail('daily_plan_import_budget_reached',429);
      await db.batch([
        db.prepare('INSERT INTO ans_plan_write_budget(day,record_count) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET record_count=record_count+excluded.record_count WHERE record_count+excluded.record_count<=?').bind(day,p.records.length,dailyLimit),
        db.prepare("INSERT INTO ans_plan_chunks(snapshot_id,chunk_index,sha256,record_count) SELECT CASE WHEN changes()=1 THEN ? ELSE 'invalid-budget' END,?,?,?").bind(s.id,p.chunk_index,expected.sha256,p.records.length),
        db.prepare(`INSERT INTO ans_plan_records(snapshot_id,plan_id,ans_code,name,registration_code,status,record_json)
          SELECT ?,json_extract(value,'$.plan_id'),json_extract(value,'$.ans_code'),json_extract(value,'$.name'),json_extract(value,'$.registration_code'),json_extract(value,'$.status'),json(value) FROM json_each(?)`)
          .bind(s.id,canonical(p.records))
      ]);
      return {status:200,body:{status:'received',chunk_index:p.chunk_index}};
    }
    if(action!=='commit' || !only(p,['snapshot_id']))return fail('invalid_action');
    const before=await current(db);
    if(before?.id===s.id)return {status:200,body:{status:'completed',snapshot_id:s.id,record_count:s.record_count}};
    if(s.status!=='staging' || (before?.id??null)!==s.expected_snapshot_id)return fail('snapshot_conflict',409);
    const received=await db.prepare('SELECT COUNT(*) AS n,COALESCE(SUM(record_count),0) AS records FROM ans_plan_chunks WHERE snapshot_id=?').bind(s.id).first<any>();
    if(received.n!==s.chunk_count || received.records!==s.record_count)return fail('incomplete_snapshot',409);
    const counts=await db.prepare(`SELECT COUNT(*) AS n,SUM(CASE WHEN o.id IS NULL THEN 1 ELSE 0 END) AS unknown_operators FROM ans_plan_records p LEFT JOIN operators o ON o.ans_code=p.ans_code WHERE p.snapshot_id=?`).bind(s.id).first<any>();
    if(counts.n!==s.record_count || counts.unknown_operators)return fail('operator_link_unresolved',409);
    const changes=await db.prepare(`SELECT
      SUM(CASE WHEN old.plan_id IS NULL THEN 1 ELSE 0 END) AS added,
      SUM(CASE WHEN old.plan_id IS NOT NULL AND json_remove(old.record_json,'$.source_updated_at')<>json_remove(n.record_json,'$.source_updated_at') THEN 1 ELSE 0 END) AS changed,
      SUM(CASE WHEN old.plan_id IS NOT NULL AND old.status<>n.status THEN 1 ELSE 0 END) AS status_changed
      FROM ans_plan_records n LEFT JOIN ans_plan_records old ON old.snapshot_id=? AND old.plan_id=n.plan_id WHERE n.snapshot_id=?`).bind(s.expected_snapshot_id,s.id).first<any>();
    const missing=await db.prepare('SELECT COUNT(*) AS n FROM ans_plan_records old WHERE snapshot_id=? AND NOT EXISTS(SELECT 1 FROM ans_plan_records n WHERE n.snapshot_id=? AND n.plan_id=old.plan_id)').bind(s.expected_snapshot_id,s.id).first<any>();
    const details=JSON.stringify({...changes,not_in_latest_source:missing.n});
    await db.batch([
      // Invalid FK deliberately aborts the entire transaction if a concurrent import changed the baseline.
      db.prepare("INSERT INTO ans_plan_publications(snapshot_id) SELECT CASE WHEN (SELECT current_snapshot_id FROM ans_plan_state WHERE singleton=1) IS ? THEN ? ELSE 'invalid-baseline' END").bind(s.expected_snapshot_id,s.id),
      db.prepare("UPDATE ans_plan_snapshots SET status='completed',changes_json=?,last_checked_at=CURRENT_TIMESTAMP WHERE id=?").bind(details,s.id),
      db.prepare('UPDATE ans_plan_state SET current_snapshot_id=? WHERE singleton=1').bind(s.id),
      db.prepare("INSERT INTO import_runs(id,source,status,records_received,records_imported,completed_at,details) VALUES(?,'ans-plans','completed',?,?,CURRENT_TIMESTAMP,?)").bind(crypto.randomUUID(),s.record_count,s.record_count,details)
    ]);
    return {status:200,body:{status:'completed',snapshot_id:s.id,record_count:s.record_count,changes:JSON.parse(details)}};
  }catch{return fail('plans_write_failed',409);}
}
export async function listAnsPlans(params:URLSearchParams,db:D1Database) {
  const page=pagination(params);if(!page)return {status:400,body:{error:'invalid_pagination',message:'Use limit de 1 a 100 e offset inteiro não negativo, sem repetir parâmetros.'}};
  const keys=['q','ans_code','registration_code','plan_id','status'];const v=(k:string)=>(params.get(k)??'').trim();
  if([...params.keys()].some(k=>![...keys,'limit','offset'].includes(k)) || new TextEncoder().encode(v('q')).length>48 || keys.some(k=>params.getAll(k).length>1 || v(k).length>(k==='q'?48:30)) || v('ans_code')&&!/^\d{6}$/.test(v('ans_code')) || v('plan_id')&&!/^[1-9][0-9]{0,7}$/.test(v('plan_id')) || v('status')&&!statuses.includes(v('status')))return {status:400,body:{error:'invalid_filters',message:'Confira os filtros documentados. q aceita até 48 bytes UTF-8; não há filtro de cobertura por cidade/UF.'}};
  let ready:any;try{ready=await current(db);}catch{}
  if(!ready) {
    if(keys.slice(1).some(k=>v(k)))return fail('plans_not_ready',503);
    return {status:200,body:await readPage(db,'SELECT p.id,p.name,p.registration_code,p.status,o.name AS operator_name FROM products p LEFT JOIN operators o ON o.id=p.operator_id WHERE p.name LIKE ?',
      'SELECT COUNT(*) AS total FROM products p WHERE p.name LIKE ?',' ORDER BY p.name,p.id',['%'+v('q')+'%'],page,'Catálogo nacional ANS ainda não carregado. Não comprova rede credenciada.')};
  }
  let from=' FROM ans_plan_records p LEFT JOIN operators o ON o.ans_code=p.ans_code WHERE p.snapshot_id=?';const values:any[]=[ready.id];
  for(const k of keys)if(v(k)){from+=` AND p.${k==='q'?'name':k} ${k==='q'?'LIKE':'='} ?`;values.push(k==='q'?'%'+v(k)+'%':v(k));}
  const data=await readPage(db,'SELECT p.record_json,o.name AS operator_name'+from,'SELECT COUNT(*) AS total'+from,' ORDER BY p.name,p.plan_id',values,page,
    'Características cadastrais nacionais conforme arquivo ANS. Ativo não garante comercialização, atendimento a TEA, prestador, vaga ou cobertura de procedimento. Abrangência é a categoria da fonte; municípios e rede credenciada não foram integrados.');
  return {status:200,body:{...data,results:data.results.map((r:any)=>{const p=JSON.parse(r.record_json);return {id:'ans-plan-'+p.plan_id,...p,operator_name:r.operator_name,source_url:ANS_PLANS,snapshot_id:ready.id};})}};
}
