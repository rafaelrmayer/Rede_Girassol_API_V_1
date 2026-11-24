#!/usr/bin/env python3
"""Publish one complete ANS operator snapshot after checking its baseline and verify its hash."""
import argparse
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
from prepare_ans_operators import digest
from publish_cnes_sample import API_URL,NoRedirect,PublicationError,USER_AGENT


def request(opener,path,token,payload=None,api_url=API_URL):
    headers={'Accept':'application/json','User-Agent':USER_AGENT,'Authorization':'Bearer '+token}
    if payload is not None:headers['Content-Type']='application/json'
    req=urllib.request.Request(api_url+path,headers=headers,data=None if payload is None else json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode())
    with opener.open(req,timeout=60) as response:return response.status,json.load(response)


def preflight(token,opener=None,api_url=API_URL):
    if not token or not token.strip():raise PublicationError('Configure REDE_GIRASSOL_IMPORT_TOKEN no GitHub e IMPORT_TOKEN no Worker')
    opener=opener or urllib.request.build_opener(NoRedirect())
    status,data=request(opener,'/admin/ans/operators/state',token,api_url=api_url)
    if status!=200 or not isinstance(data,dict) or 'snapshot' not in data:raise PublicationError('A API ANS não está pronta; confira deploy e migração 0003')
    return data['snapshot']


def publish(payload,token,opener=None,api_url=API_URL):
    if not isinstance(payload,dict) or payload.get('entity')!='ans_operators_snapshot' or payload.get('source')!='ans':raise PublicationError('Esperado snapshot ANS completo')
    rows=payload.get('records');metadata=payload.get('metadata',{})
    if not isinstance(rows,list) or not rows or metadata.get('records_sha256')!=digest(rows):raise PublicationError('Hash do snapshot preparado divergiu')
    opener=opener or urllib.request.build_opener(NoRedirect())
    previous=preflight(token,opener,api_url)
    if previous:
        if metadata['active_source_date']<previous['active_source_date'] or metadata['cancelled_source_date']<previous['cancelled_source_date']:raise PublicationError('Fonte mais antiga que a base publicada: não importar')
        if len(rows)<previous['record_count']*.9 or metadata['active_count']<previous['active_count']*.9 or metadata['cancelled_count']<previous['cancelled_count']*.9:raise PublicationError('Redução superior a 10%: revisar a fonte antes de substituir a base')
    outgoing={**payload,'expected_snapshot_id':previous['id'] if previous else None}
    status,result=request(opener,'/admin/ans/operators/snapshot',token,outgoing,api_url)
    if status!=200 or result.get('status') not in ['completed','unchanged'] or not result.get('snapshot_id'):raise PublicationError('Importação não confirmada; confira histórico antes de repetir')
    current=preflight(token,opener,api_url)
    if not current or current['id']!=result['snapshot_id'] or current['records_sha256']!=metadata['records_sha256'] or current['record_count']!=len(rows):raise PublicationError('Envio realizado, mas conferência divergiu. Verifique histórico antes de repetir')
    return {**result,'records_verified':current['record_count'],'records_sha256':current['records_sha256'],
            'active_count':current['active_count'],'cancelled_count':current['cancelled_count'],
            'active_source_date':current['active_source_date'],'cancelled_source_date':current['cancelled_source_date']}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only',action='store_true');parser.add_argument('--file');parser.add_argument('--output')
    args=parser.parse_args()
    try:
        token=os.environ.get('IMPORT_TOKEN')
        if args.check_only:preflight(token);print('Deploy, migração ANS e autenticação conferidos.');return
        if not args.file or not args.output:parser.error('Informe --file e --output')
        target=Path(args.output)
        if target.exists():raise PublicationError('Saída já existe')
        receipt=publish(json.loads(Path(args.file).read_text(encoding='utf-8')),token)
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('x',encoding='utf-8') as output:json.dump(receipt,output,ensure_ascii=False,indent=2)
        print(f'Snapshot {receipt["status"]}: {receipt["record_count"]} registros conferidos. Alterações: {receipt["changes"]}')
    except urllib.error.HTTPError as exc:
        hint='Aplique migrations/0003_ans_operators.sql ou confira deploy.' if exc.code==503 else 'Confira token, estado e histórico; não houve repetição do POST.'
        parser.exit(1,f'API retornou HTTP {exc.code}. {hint}\n')
    except PublicationError as exc:parser.exit(1,str(exc)+'\n')
    except (OSError,ValueError,TypeError,KeyError):parser.exit(1,'Falha de arquivo, conexão ou resposta. Confira o histórico antes de repetir.\n')


if __name__=='__main__':main()
