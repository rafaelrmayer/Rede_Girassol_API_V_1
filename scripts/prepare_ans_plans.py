#!/usr/bin/env python3
"""Prepare the complete national ANS products catalog, retaining source identities and dates."""
import argparse
import csv
from datetime import datetime,timezone
from email.utils import parsedate_to_datetime
import hashlib
import io
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request
import http.client
from prepare_ans_operators import digest,day,text

SOURCE='https://dadosabertos.ans.gov.br/FTP/PDA/caracteristicas_produtos_saude_suplementar-008/pda-008-caracteristicas_produtos_saude_suplementar.csv'
DICTIONARY=SOURCE.rsplit('/',1)[0]+'/dicionario-pda-008-caracteristicas_produtos_saude_suplementar.ods'
MAX_BYTES=128*1024*1024
CHUNK_SIZE=250
MAX_RECORDS=250000
FIELDS={'ID_PLANO','CD_PLANO','NM_PLANO','REGISTRO_OPERADORA','SITUACAO_PLANO','CONTRATACAO','SGMT_ASSISTENCIAL','ABRANGENCIA_COBERTURA','ACOMODACAO_HOSPITALAR','FATOR_MODERADOR','DT_REGISTRO_PLANO','DT_SITUACAO','DT_ATUALIZACAO'}
STATUS={'Ativo':'active','Suspenso':'suspended','Cancelado':'cancelled','Transferido':'transferred'}


def download():
    for attempt in range(3):
        try:
            req=urllib.request.Request(SOURCE,headers={'User-Agent':'RedeGirassol-ANS-Importer/0.1','Accept':'text/csv'})
            with urllib.request.urlopen(req,timeout=60) as res:
                raw=res.read(MAX_BYTES+1)
                if len(raw)>MAX_BYTES:raise ValueError('Arquivo ANS excedeu 128 MiB')
                if res.headers.get('Content-Length') and len(raw)!=int(res.headers['Content-Length']):raise ValueError('Arquivo incompleto')
                if not res.headers.get('Last-Modified'):raise ValueError('Fonte sem Last-Modified')
                file_date=parsedate_to_datetime(res.headers['Last-Modified']).astimezone(timezone.utc).date().isoformat()
            return raw,file_date
        except urllib.error.HTTPError as exc:
            code=exc.code;exc.close()
            if code not in {429,500,502,503,504}:raise ValueError(f'ANS HTTP {code}') from exc
        except (urllib.error.URLError,TimeoutError,ConnectionError,http.client.IncompleteRead):pass
        if attempt==2:raise ValueError('Fonte indisponível após três tentativas')
        time.sleep(attempt+1)


def prepare(raw,file_date):
    day(file_date,'Last-Modified')
    if file_date>datetime.now(timezone.utc).date().isoformat():raise ValueError('Fonte no futuro')
    if len(raw)>MAX_BYTES:raise ValueError('Arquivo excessivo')
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')),delimiter=';',strict=True)
    if not FIELDS.issubset(reader.fieldnames or []) or len(set(reader.fieldnames))!=len(reader.fieldnames):raise ValueError('Cabeçalho ANS mudou')
    rows=[];seen=set();dates=set()
    for source in reader:
        if None in source or any(value is None for value in source.values()):raise ValueError('Linha truncada ou com colunas extras')
        plan_id=text(source['ID_PLANO'],'ID_PLANO',8)
        if not re.fullmatch(r'[1-9][0-9]{0,7}',plan_id) or plan_id in seen:raise ValueError('ID_PLANO inválido ou repetido')
        seen.add(plan_id)
        code=text(source['REGISTRO_OPERADORA'],'REGISTRO_OPERADORA',6)
        # The dictionary declares a numeric six-digit CADOP key; preserve zeroes.
        if not code.isascii() or not code.isdigit():raise ValueError('Registro de operadora inválido')
        code=code.zfill(6)
        updated=day(source['DT_ATUALIZACAO'],'DT_ATUALIZACAO');dates.add(updated)
        changed=day(source['DT_SITUACAO'],'DT_SITUACAO')
        registered=day(source['DT_REGISTRO_PLANO'],'DT_REGISTRO_PLANO') if source['DT_REGISTRO_PLANO'] else None
        if updated>file_date or changed>updated or (registered and registered>updated):raise ValueError('Cronologia da fonte inválida')
        if source['SITUACAO_PLANO'] not in STATUS:raise ValueError('Situação de plano desconhecida')
        row=dict(plan_id=plan_id,registration_code=text(source['CD_PLANO'],'CD_PLANO',30),name=text(re.sub(r'[\x00-\x1f\x7f]+',' ',source['NM_PLANO']),'NM_PLANO',300),ans_code=code,
                 status=STATUS[source['SITUACAO_PLANO']],contracting_type=text(source['CONTRATACAO'],'CONTRATACAO',140),
                 segmentation=text(source['SGMT_ASSISTENCIAL'],'SGMT_ASSISTENCIAL',140),coverage_scope=text(source['ABRANGENCIA_COBERTURA'],'ABRANGENCIA_COBERTURA',50),
                 accommodation=text(source['ACOMODACAO_HOSPITALAR'],'ACOMODACAO_HOSPITALAR',50),cost_sharing=text(source['FATOR_MODERADOR'],'FATOR_MODERADOR',50),
                 registered_on=registered,status_changed_on=changed,source_updated_at=updated)
        rows.append(row)
        if len(rows)>MAX_RECORDS:raise ValueError('Mais de 250 mil planos: revisar capacidade')
    if not rows or len(dates)!=1:raise ValueError('Fonte vazia ou com competências divergentes')
    rows.sort(key=lambda r:int(r['plan_id']))
    chunks=[rows[i:i+CHUNK_SIZE] for i in range(0,len(rows),CHUNK_SIZE)]
    manifest=dict(entity='ans_plans_snapshot',scope='national',source_date=dates.pop(),file_date=file_date,file_sha256=hashlib.sha256(raw).hexdigest(),record_count=len(rows),
                  chunks=[dict(sha256=digest(chunk),record_count=len(chunk)) for chunk in chunks])
    return dict(snapshot_id=digest(manifest),manifest=manifest,chunks=chunks)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file');parser.add_argument('--file-date');parser.add_argument('--output',required=True)
    args=parser.parse_args()
    try:
        target=Path(args.output)
        if target.exists():raise ValueError('Saída já existe')
        if args.file:
            if not args.file_date:raise ValueError('Informe a data Last-Modified do arquivo local')
            raw,file_date=Path(args.file).read_bytes(),args.file_date
        else:raw,file_date=download()
        payload=prepare(raw,file_date)
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('x',encoding='utf-8') as out:json.dump(payload,out,ensure_ascii=False,separators=(',',':'))
        print(f'Preparados {payload["manifest"]["record_count"]} planos nacionais; {len(payload["chunks"])} partes. Nenhuma gravação remota.')
    except (ValueError,OSError,csv.Error,KeyError,TypeError) as exc:parser.exit(1,f'Preparação interrompida: {exc}\n')


if __name__=='__main__':main()
