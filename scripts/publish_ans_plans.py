#!/usr/bin/env python3
"""Resume verified parts of one frozen national ANS catalog; publish only when complete."""
import argparse
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
from prepare_ans_operators import digest
from prepare_ans_plans import CHUNK_SIZE,MAX_RECORDS
from publish_ans_operators import request
from publish_cnes_sample import API_URL,NoRedirect,PublicationError


def preflight(token,opener=None,api_url=API_URL):
    if not token or not token.strip():raise PublicationError('Configure o segredo de importação existente')
    opener=opener or urllib.request.build_opener(NoRedirect())
    status,data=request(opener,'/admin/ans/plans/state',token,api_url=api_url)
    if status!=200 or not isinstance(data,dict) or 'snapshot' not in data:raise PublicationError('Confira deploy e migração 0004')
    return data['snapshot']


def validate(payload):
    if not isinstance(payload,dict) or set(payload)!={'snapshot_id','manifest','chunks'}:raise PublicationError('Pacote de planos inválido')
    m=payload['manifest'];chunks=payload['chunks']
    if not isinstance(m,dict) or m.get('entity')!='ans_plans_snapshot' or m.get('scope')!='national' or digest(m)!=payload['snapshot_id']:raise PublicationError('Manifesto nacional divergiu')
    if not isinstance(chunks,list) or len(chunks)!=len(m['chunks']) or not 1<=m['record_count']<=MAX_RECORDS:raise PublicationError('Quantidade de partes inválida')
    seen=set()
    for part,expected in zip(chunks,m['chunks']):
        if not isinstance(part,list) or not 1<=len(part)<=CHUNK_SIZE or expected!={'sha256':digest(part),'record_count':len(part)}:raise PublicationError('Hash ou contagem da parte divergiu')
        for record in part:
            key=record['plan_id']
            if key in seen:raise PublicationError('Plano repetido entre partes')
            seen.add(key)
    if len(seen)!=m['record_count']:raise PublicationError('Total do manifesto divergiu')


def publish(payload,token,opener=None,api_url=API_URL):
    validate(payload)
    opener=opener or urllib.request.build_opener(NoRedirect())
    previous=preflight(token,opener,api_url);m=payload['manifest'];snapshot_id=payload['snapshot_id']
    status,begun=request(opener,'/admin/ans/plans/begin',token,dict(snapshot_id=snapshot_id,manifest=m,expected_snapshot_id=previous['id'] if previous else None),api_url)
    if status!=200 or begun.get('snapshot_id')!=snapshot_id or begun.get('status') not in {'unchanged','staging'}:raise PublicationError('Início da carga não confirmado')
    if begun['status']=='unchanged':result=begun
    else:
        received={r['chunk_index']:r for r in begun['received']}
        for i,part in enumerate(payload['chunks']):
            if i in received:
                if received[i]['sha256']!=m['chunks'][i]['sha256'] or received[i]['record_count']!=len(part):raise PublicationError('Parte já recebida divergiu')
                continue
            status,answer=request(opener,'/admin/ans/plans/chunk',token,dict(snapshot_id=snapshot_id,chunk_index=i,records=part),api_url)
            if status!=200 or answer.get('status') not in {'received','already_received'} or answer.get('chunk_index')!=i:raise PublicationError('Recebimento da parte não confirmado')
            if (i+1)%20==0 or i+1==len(payload['chunks']):print(f'Partes conferidas: {i+1}/{len(payload["chunks"])}',flush=True)
        status,result=request(opener,'/admin/ans/plans/commit',token,dict(snapshot_id=snapshot_id),api_url)
        if status!=200 or result.get('status')!='completed' or result.get('snapshot_id')!=snapshot_id:raise PublicationError('Publicação não confirmada; confira o estado antes de repetir')
    current=preflight(token,opener,api_url)
    if not current or current['id']!=snapshot_id or current['record_count']!=m['record_count'] or current['file_sha256']!=m['file_sha256'] or current['source_date']!=m['source_date']:raise PublicationError('Conferência final divergiu; não houve repetição do POST')
    # Public query must expose the completed snapshot, not merely administrative metadata.
    status,page=request(opener,'/v1/plans?limit=1',token,api_url=api_url)
    if status!=200 or page.get('total')!=m['record_count'] or len(page.get('results',[]))!=1 or page['results'][0].get('snapshot_id')!=snapshot_id:raise PublicationError('Publicação concluída, mas consulta pública divergiu; confira antes de repetir')
    return {**result,'records_verified':m['record_count'],'source_date':m['source_date'],'file_sha256':m['file_sha256']}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only',action='store_true');parser.add_argument('--file');parser.add_argument('--output')
    args=parser.parse_args()
    try:
        token=os.environ.get('IMPORT_TOKEN')
        if args.check_only:preflight(token);print('Autenticação e migração de planos conferidas.');return
        if not args.file or not args.output:parser.error('Informe --file e --output')
        target=Path(args.output)
        if target.exists():raise PublicationError('Comprovante já existe')
        receipt=publish(json.loads(Path(args.file).read_text(encoding='utf-8')),token)
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('x',encoding='utf-8') as out:json.dump(receipt,out,ensure_ascii=False,indent=2)
        print(f'Catálogo {receipt["status"]}: {receipt["records_verified"]} planos conferidos.')
    except urllib.error.HTTPError as exc:
        try:reason=json.loads(exc.read(2048)).get('error')
        except (ValueError,AttributeError):reason=None
        if exc.code==429 and reason=='daily_plan_import_budget_reached':
            parser.exit(1,'Limite diário desta importação atingido. As partes conferidas estão salvas e não ficaram públicas. Retome após 00h UTC usando o mesmo artifact/prepared_run_id. Não aumente o teto sem conferir a capacidade da conta.\n')
        parser.exit(1,f'HTTP {exc.code}. Carga interrompida; não repetimos o POST. Confira logs/estado. Para retomar, use o mesmo artifact preparado e o mesmo run_id.\n')
    except (PublicationError,OSError,ValueError,KeyError,TypeError) as exc:parser.exit(1,f'{exc}\nCarga interrompida. Confira o estado antes de repetir; retome com o mesmo artifact.\n')


if __name__=='__main__':main()
