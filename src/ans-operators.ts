import {pagination,readPage} from './pagination';
export const ANS_ACTIVE = 'https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv';
export const ANS_CANCELLED = 'https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_canceladas/Relatorio_cadop_canceladas.csv';
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const keys = ['ans_code','name','trade_name','modality','city','state','registered_on','cancelled_on','cancellation_reason','status'];
type Row = {ans_code:string;name:string;trade_name:string|null;modality:string;city:string;state:string;registered_on:string;cancelled_on:string|null;cancellation_reason:string|null;status:'active'|'cancelled'};
const isObject=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
const date=(v:unknown):v is string=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
const hash=(v:unknown):v is string=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
const canonical=(rows:Row[])=>JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a<b?-1:a>b?1:0))));
async function textHash(text:string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function recordsHash(rows:Row[]) {return textHash(canonical(rows));}
async function snapshot(db:D1Database,includeRecords=true):Promise<any> {
  const columns=includeRecords?'s.*':'s.id,s.records_sha256,s.active_source_date,s.cancelled_source_date,s.active_sha256,s.cancelled_sha256,s.prepared_at,s.record_count,s.active_count,s.cancelled_count,s.changes_json,s.imported_at,s.last_checked_at';
  return db.prepare(`SELECT ${columns} FROM ans_operator_state c JOIN ans_operator_snapshots s ON s.id=c.current_snapshot_id WHERE c.singleton=1`).first();
}
export async function ansState(db:D1Database) {
  try {const current=await snapshot(db,false);if(!current)return {status:200,body:{snapshot:null}};
    const {records_json,...metadata}=current;return {status:200,body:{snapshot:metadata}};
  } catch {return {status:503,body:{error:'ans_not_configured',message:'Execute migrations/0003_ans_operators.sql no D1.'}};}
}
export async function importAnsOperators(request:Request,db:D1Database) {
  const fail=(error:string,status=422)=>({status,body:{error}});
  let size=0;const chunks:Uint8Array[]=[];const reader=request.body?.getReader();
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();return fail('body_too_large',413);}chunks.push(value);}
  let payload:any;
  try{const bytes=new Uint8Array(size);let start=0;for(const c of chunks){bytes.set(c,start);start+=c.length;}payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('invalid_json',400);}
  if(!isObject(payload) || Object.keys(payload).some(k=>!['entity','source','records','metadata','expected_snapshot_id'].includes(k)) || payload.entity!=='ans_operators_snapshot' || payload.source!=='ans' || !Array.isArray(payload.records) || !payload.records.length || payload.records.length>10000 || !isObject(payload.metadata) || !(payload.expected_snapshot_id===null || typeof payload.expected_snapshot_id==='string'))return fail('invalid_snapshot');
  const m=payload.metadata as any;
  if(Object.keys(m).some(k=>!['active_source_date','cancelled_source_date','active_sha256','cancelled_sha256','records_sha256','prepared_at','active_count','cancelled_count'].includes(k)) || !date(m.active_source_date) || !date(m.cancelled_source_date) || !hash(m.active_sha256) || !hash(m.cancelled_sha256) || !hash(m.records_sha256) || typeof m.prepared_at!=='string' || !/^\d{4}-\d{2}-\d{2}T/.test(m.prepared_at) || !Number.isFinite(Date.parse(m.prepared_at)))return fail('invalid_metadata');
  const rows:Row[]=[];const seen=new Set<string>();
  for(const raw of payload.records){
    if(!isObject(raw) || Object.keys(raw).some(k=>!keys.includes(k)) || keys.some(k=>!(k in raw)))return fail('invalid_record');
    const limits:Record<string,number>={ans_code:6,name:300,trade_name:300,modality:150,city:150,state:2,cancellation_reason:300};
    for(const [key,max]of Object.entries(limits)){
      const val=raw[key];if(val===null && ['trade_name','cancellation_reason'].includes(key))continue;
      if(typeof val!=='string' || !val.trim() || val!==val.trim() || val.length>max || /[\u0000-\u001f\u007f]/.test(val))return fail('invalid_record');
    }
    if(!/^\d{6}$/.test(String(raw.ans_code)) || seen.has(String(raw.ans_code)) || !states.has(String(raw.state)) || !date(raw.registered_on) || !['active','cancelled'].includes(String(raw.status)))return fail('invalid_record');
    if(raw.status==='active' && (raw.cancelled_on!==null || raw.cancellation_reason!==null))return fail('invalid_record');
    if(raw.status==='cancelled' && (!date(raw.cancelled_on) || raw.cancelled_on<raw.registered_on))return fail('invalid_record');
    seen.add(String(raw.ans_code));rows.push(raw as Row);
  }
  rows.sort((a,b)=>a.ans_code.localeCompare(b.ans_code));
  if(m.active_source_date>new Date().toISOString().slice(0,10) || m.cancelled_source_date>new Date().toISOString().slice(0,10) || rows.some(r=>r.registered_on>(r.status==='active'?m.active_source_date:m.cancelled_source_date) || (r.cancelled_on && r.cancelled_on>m.cancelled_source_date)))return fail('invalid_source_dates');
  const jsonRows=canonical(rows);
  const active=rows.filter(r=>r.status==='active').length,cancelled=rows.length-active;
  if(!active || !cancelled || m.active_count!==active || m.cancelled_count!==cancelled || await textHash(jsonRows)!==m.records_sha256)return fail('snapshot_integrity_failed');
  let previous:any;try{previous=await snapshot(db);}catch{return fail('ans_not_configured',503);}
  if((previous?.id??null)!==payload.expected_snapshot_id)return fail('snapshot_conflict',409);
  if(previous && (m.active_source_date<previous.active_source_date || m.cancelled_source_date<previous.cancelled_source_date))return fail('older_source',409);
  const old:Row[]=previous?JSON.parse(previous.records_json):[];const prior=new Map(old.map(r=>[r.ans_code,r]));
  if(previous && (rows.length<previous.record_count*.9 || active<previous.active_count*.9 || cancelled<previous.cancelled_count*.9))return fail('unexpected_source_reduction',409);
  const changes={added:0,changed:0,status_changed:0,not_in_latest_source:old.filter(r=>!seen.has(r.ans_code)).length};
  for(const row of rows){const before=prior.get(row.ans_code);if(!before)changes.added++;else if(keys.some(key=>before[key as keyof Row]!==row[key as keyof Row])){changes.changed++;if(before.status!==row.status)changes.status_changed++;}}
  // Source dates/hashes matter even when normalized content is unchanged.
  const unchanged=previous && previous.records_sha256===m.records_sha256 && previous.active_sha256===m.active_sha256 && previous.cancelled_sha256===m.cancelled_sha256 && previous.active_source_date===m.active_source_date && previous.cancelled_source_date===m.cancelled_source_date;
  const id=crypto.randomUUID(),changesJson=JSON.stringify(changes);
  try {
    if(unchanged){
      await db.batch([db.prepare('UPDATE ans_operator_snapshots SET last_checked_at=CURRENT_TIMESTAMP WHERE id=?').bind(previous.id),
        db.prepare(`INSERT INTO import_runs(id,source,status,records_received,records_imported,completed_at,details) VALUES(?,'ans-operators','unchanged',?,0,CURRENT_TIMESTAMP,?)`).bind(id,rows.length,changesJson)]);
      return {status:200,body:{status:'unchanged',snapshot_id:previous.id,records_imported:0,record_count:rows.length,changes}};
    }
    // Optimistic lock inside the same transaction. If another snapshot won, the following
    // details INSERT references a missing snapshot and its FK aborts the entire batch.
    await db.batch([
      db.prepare(`INSERT INTO ans_operator_snapshots(id,records_sha256,records_json,active_source_date,cancelled_source_date,active_sha256,cancelled_sha256,prepared_at,record_count,active_count,cancelled_count,changes_json)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT current_snapshot_id FROM ans_operator_state WHERE singleton=1) IS ?`)
        .bind(id,m.records_sha256,jsonRows,m.active_source_date,m.cancelled_source_date,m.active_sha256,m.cancelled_sha256,m.prepared_at,rows.length,active,cancelled,changesJson,payload.expected_snapshot_id),
      db.prepare(`INSERT INTO operators(id,ans_code,name,status,source_updated_at)
        SELECT 'ans-'||json_extract(value,'$.ans_code'),json_extract(value,'$.ans_code'),json_extract(value,'$.name'),json_extract(value,'$.status'),
          CASE json_extract(value,'$.status') WHEN 'active' THEN ? ELSE ? END FROM json_each(?) WHERE 1
        ON CONFLICT(ans_code) DO UPDATE SET name=excluded.name,status=excluded.status,source_updated_at=excluded.source_updated_at,imported_at=CURRENT_TIMESTAMP`)
        .bind(m.active_source_date,m.cancelled_source_date,jsonRows),
      db.prepare(`INSERT INTO ans_operator_details(operator_id,ans_code,trade_name,modality,city,state,registered_on,cancelled_on,cancellation_reason,source_url,snapshot_id)
        SELECT o.id,o.ans_code,json_extract(n.value,'$.trade_name'),json_extract(n.value,'$.modality'),json_extract(n.value,'$.city'),json_extract(n.value,'$.state'),
          json_extract(n.value,'$.registered_on'),json_extract(n.value,'$.cancelled_on'),json_extract(n.value,'$.cancellation_reason'),
          CASE json_extract(n.value,'$.status') WHEN 'active' THEN ? ELSE ? END,? FROM json_each(?) n JOIN operators o ON o.ans_code=json_extract(n.value,'$.ans_code') WHERE 1
        ON CONFLICT(operator_id) DO UPDATE SET trade_name=excluded.trade_name,modality=excluded.modality,city=excluded.city,state=excluded.state,registered_on=excluded.registered_on,
          cancelled_on=excluded.cancelled_on,cancellation_reason=excluded.cancellation_reason,source_url=excluded.source_url,snapshot_id=excluded.snapshot_id`)
        .bind(ANS_ACTIVE,ANS_CANCELLED,id,jsonRows),
      db.prepare(`UPDATE operators SET status='not_in_latest_source' WHERE id IN (SELECT operator_id FROM ans_operator_details WHERE snapshot_id<>?) AND ans_code NOT IN (SELECT json_extract(value,'$.ans_code') FROM json_each(?))`).bind(id,jsonRows),
      db.prepare('UPDATE ans_operator_state SET current_snapshot_id=? WHERE singleton=1').bind(id),
      db.prepare(`INSERT INTO import_runs(id,source,status,records_received,records_imported,completed_at,details) VALUES(?,'ans-operators','completed',?,?,CURRENT_TIMESTAMP,?)`).bind(id,rows.length,rows.length,changesJson)
    ]);
    return {status:200,body:{status:'completed',snapshot_id:id,record_count:rows.length,records_imported:rows.length,changes}};
  }catch{return fail('snapshot_write_failed',409);}
}
export async function listAnsOperators(params:URLSearchParams,db:D1Database) {
  const page=pagination(params);if(!page)return {status:400,body:{error:'invalid_pagination',message:'Use limit de 1 a 100 e offset inteiro não negativo.'}};
  if(['q','city','state','status','ans_code'].some(k=>params.getAll(k).length>1))return {status:400,body:{error:'invalid_filters'}};
  const val=(k:string)=>(params.get(k)??'').trim();
  if((val('ans_code')&&!/^\d{6}$/.test(val('ans_code'))) || (val('status')&&!['active','cancelled','not_in_latest_source','unconfirmed'].includes(val('status'))))return {status:400,body:{error:'invalid_filters'}};
  let from=' FROM operators o LEFT JOIN ans_operator_details d ON d.operator_id=o.id WHERE 1=1';const values:string[]=[];
  for(const [key,col,like]of [['q','o.name',true],['city','d.city',true],['state','d.state',false],['status','o.status',false],['ans_code','o.ans_code',false]]as const){
    if(val(key)){from+=` AND ${col} ${like?'LIKE':'='} ?`;values.push(like?'%'+val(key)+'%':key==='state'?val(key).toUpperCase():val(key));}
  }
  try{const data=await readPage(db,`SELECT o.id,o.ans_code,o.name,o.status,o.source_updated_at,d.trade_name,d.modality,d.city,d.state,d.registered_on,d.cancelled_on,d.cancellation_reason,d.source_url,d.snapshot_id`+from,'SELECT COUNT(*) AS total'+from,' ORDER BY o.name,o.id',values,page,
    'Situação cadastral conforme arquivos ANS importados; município/UF são da sede, não cobertura. Não comprova rede credenciada ou disponibilidade de planos.');return {status:200,body:data};}
  catch {
    // Before migration the original public contract remains usable; extra filters need the new catalog.
    if(['city','state','status','ans_code'].some(k=>val(k)))return {status:503,body:{error:'ans_not_configured'}};
    return {status:200,body:await readPage(db,'SELECT id,ans_code,name,status,source_updated_at FROM operators WHERE name LIKE ?',
      'SELECT COUNT(*) AS total FROM operators WHERE name LIKE ?',' ORDER BY name,id',['%'+val('q')+'%'],page)};
  }
}
