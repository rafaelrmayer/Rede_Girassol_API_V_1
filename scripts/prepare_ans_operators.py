#!/usr/bin/env python3
"""Prepare a complete institutional CADOP snapshot from the two official ANS CSVs."""
import argparse
import csv
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import http.client
import io
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request
def digest(rows):
    return hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

BASE='https://dadosabertos.ans.gov.br/FTP/PDA/'
SOURCES={'active':BASE+'operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv',
         'cancelled':BASE+'operadoras_de_plano_de_saude_canceladas/Relatorio_cadop_canceladas.csv'}
MAX_BYTES=8*1024*1024
STATES=set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split())
REQUIRED={'REGISTRO_OPERADORA','RAZAO_SOCIAL','NOME_FANTASIA','MODALIDADE','CIDADE','UF','DATA_REGISTRO_ANS'}


def download(kind):
    for attempt in range(3):
        try:
            request=urllib.request.Request(SOURCES[kind],headers={'User-Agent':'RedeGirassol-ANS-Importer/0.1','Accept':'text/csv'})
            with urllib.request.urlopen(request,timeout=30) as response:
                raw=response.read(MAX_BYTES+1)
                if len(raw)>MAX_BYTES: raise ValueError('Arquivo ANS excedeu 8 MiB')
                declared=response.headers.get('Content-Length')
                if declared and len(raw)!=int(declared): raise ValueError('Download ANS incompleto')
                modified=response.headers.get('Last-Modified')
                if not modified: raise ValueError('A fonte ANS não informou Last-Modified; não substituir por data de download')
                reference=parsedate_to_datetime(modified).astimezone(timezone.utc).date().isoformat()
            return raw,reference
        except urllib.error.HTTPError as exc:
            code=exc.code;exc.close()
            if code not in {429,500,502,503,504}: raise ValueError(f'Fonte ANS retornou HTTP {code}') from exc
        except (urllib.error.URLError,TimeoutError,ConnectionError,http.client.IncompleteRead): pass
        if attempt==2: raise ValueError('Fonte ANS indisponível após três tentativas')
        time.sleep(attempt+1)


def text(value,field,limit,optional=False):
    value=(value or '').strip()
    if not value and optional:return None
    if not value or len(value)>limit or re.search(r'[\x00-\x1f\x7f]',value):raise ValueError(f'Campo institucional inválido: {field}')
    return value


def day(value,field):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):raise ValueError(f'Data inválida: {field}')
    date.fromisoformat(value)
    return value


def parse(raw,kind,source_date):
    day(source_date,'source_date')
    if source_date>datetime.now(timezone.utc).date().isoformat():raise ValueError('Data da fonte no futuro')
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')),delimiter=';',strict=True)
    required=REQUIRED|({'DATA_DESCREDENCIAMENTO','MOTIVO_DO_DESCREDENCIAMENTO'} if kind=='cancelled' else set())
    if not required.issubset(reader.fieldnames or []):raise ValueError('Cabeçalho ANS mudou: não atualizar a base')
    rows=[];seen=set()
    for row in reader:
        code=row.get('REGISTRO_OPERADORA','').strip()
        if not re.fullmatch(r'\d{6}',code) or code in seen:raise ValueError('Registro ANS inválido ou repetido')
        seen.add(code)
        state=text(row.get('UF'),'UF',2)
        if state not in STATES:raise ValueError('UF inválida')
        registered=day(row.get('DATA_REGISTRO_ANS'),'DATA_REGISTRO_ANS')
        cancelled=day(row.get('DATA_DESCREDENCIAMENTO'),'DATA_DESCREDENCIAMENTO') if kind=='cancelled' else None
        if registered>source_date or (cancelled and not registered<=cancelled<=source_date):raise ValueError('Cronologia ANS inválida')
        rows.append(dict(ans_code=code,name=text(row.get('RAZAO_SOCIAL'),'RAZAO_SOCIAL',300),
                         trade_name=text(row.get('NOME_FANTASIA'),'NOME_FANTASIA',300,True),
                         modality=text(row.get('MODALIDADE'),'MODALIDADE',150),city=text(row.get('CIDADE'),'CIDADE',150),state=state,
                         registered_on=registered,cancelled_on=cancelled,
                         cancellation_reason=text(row.get('MOTIVO_DO_DESCREDENCIAMENTO'),'MOTIVO_DO_DESCREDENCIAMENTO',300,True) if kind=='cancelled' else None,status=kind))
    if not rows:raise ValueError('Fonte ANS vazia: não atualizar a base')
    return rows


def prepare(active,cancelled,active_date,cancelled_date):
    active_rows=parse(active,'active',active_date);cancelled_rows=parse(cancelled,'cancelled',cancelled_date)
    rows=sorted(active_rows+cancelled_rows,key=lambda row:row['ans_code'])
    if len({r['ans_code'] for r in rows})!=len(rows):raise ValueError('Registro presente nas duas fontes ANS: conferir antes de atualizar')
    metadata=dict(active_source_date=active_date,cancelled_source_date=cancelled_date,
                  active_sha256=hashlib.sha256(active).hexdigest(),cancelled_sha256=hashlib.sha256(cancelled).hexdigest(),
                  records_sha256=digest(rows),prepared_at=datetime.now(timezone.utc).isoformat(),active_count=len(active_rows),cancelled_count=len(cancelled_rows))
    return dict(entity='ans_operators_snapshot',source='ans',records=rows,metadata=metadata)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--active-file');parser.add_argument('--cancelled-file')
    parser.add_argument('--active-date');parser.add_argument('--cancelled-date')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    try:
        target=Path(args.output)
        if target.exists():raise ValueError('Saída já existe')
        if args.active_file or args.cancelled_file:
            if not all([args.active_file,args.cancelled_file,args.active_date,args.cancelled_date]):raise ValueError('Modo local exige os dois CSVs e suas datas de referência')
            active,active_date=Path(args.active_file).read_bytes(),args.active_date
            cancelled,cancelled_date=Path(args.cancelled_file).read_bytes(),args.cancelled_date
        else:active,active_date=download('active');cancelled,cancelled_date=download('cancelled')
        payload=prepare(active,cancelled,active_date,cancelled_date)
        if len(payload['records'])>10000:raise ValueError('Mais de 10 mil registros: revisar capacidade antes de importar')
        target.parent.mkdir(parents=True,exist_ok=True)
        encoded=json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n'
        if len(encoded.encode())>2*1024*1024-1024:raise ValueError('Snapshot excedeu o limite: revisar importação')
        with target.open('x',encoding='utf-8') as output:output.write(encoded)
        m=payload['metadata'];print(f'Preparadas {m["active_count"]} ativas e {m["cancelled_count"]} canceladas. Nenhuma gravação em banco.')
    except (ValueError,OSError,KeyError,TypeError,csv.Error) as exc:parser.exit(1,f'Não foi possível preparar a fonte ANS: {exc}\n')


if __name__=='__main__':main()
