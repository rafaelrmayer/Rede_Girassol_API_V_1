#!/usr/bin/env python3
"""Prepare institutional CNES rehabilitation observations from an official monthly CSV."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

from prepare_cnes_sample import STATES, code, digest, text

CATALOG = json.loads((Path(__file__).resolve().parents[1] / 'rehabilitation-classifications.json').read_text(encoding='utf-8'))
MONTHS = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
MAX_BYTES = 512 * 1024 * 1024
REQUIRED = {'COMPETENCIA', 'UF', 'IBGE', 'MUNICIPIO', 'CNES', 'NOME_FANTASIA', 'SERVICO', 'CLASSIFICACAO', 'TIPO_SERVICO'}


def valid_month(value):
    return isinstance(value, str) and re.fullmatch(r'20[0-9]{2}(0[1-9]|1[0-2])', value) is not None


def archive_url(reference_month):
    if not valid_month(reference_month):
        raise ValueError('Use competência AAAAMM válida')
    return f'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/saes/drac/CNES_Servico_Espec/csv/cnes_servicos_espec_cadastrados_{reference_month[:4]}_csv.zip'


def download_archive(reference_month, target):
    url = archive_url(reference_month)
    for attempt in range(1, 4):
        print(f'Baixando arquivo oficial CNES: tentativa {attempt}/3.', flush=True)
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'RedeGirassol-Rehabilitation/0.1'})
            checksum, size = hashlib.sha256(), 0
            with urllib.request.urlopen(request, timeout=30) as response, Path(target).open('wb') as output:
                if int(response.headers.get('Content-Length', '0')) > MAX_BYTES:
                    raise ValueError('Arquivo oficial excedeu o limite de 512 MiB')
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ValueError('Arquivo oficial excedeu o limite de 512 MiB')
                    checksum.update(chunk)
                    output.write(chunk)
                modified = response.headers.get('Last-Modified')
            return dict(source_archive_url=url, archive_sha256=checksum.hexdigest(), archive_bytes=size, archive_last_modified=modified)
        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.close()
            if status not in {429, 500, 502, 503, 504}:
                raise ValueError(f'Arquivo oficial CNES retornou HTTP {status}') from exc
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        if attempt == 3:
            raise ValueError('Não foi possível baixar o arquivo oficial CNES após três tentativas')
        time.sleep(attempt)


def validate_filters(state, municipality, reference_month, classification='', limit=20):
    if state not in STATES.values() or not re.fullmatch(r'[0-9]{6}', municipality) or not municipality.startswith(str(next(key for key, value in STATES.items() if value == state))):
        raise ValueError('Município e UF incompatíveis')
    if not valid_month(reference_month) or not 1 <= limit <= 100 or (classification and not re.fullmatch(r'[0-9]{3}', classification)):
        raise ValueError('Competência, classificação ou limite inválidos')


def select_rows(handle, state, municipality, reference_month, classification='', limit=20):
    validate_filters(state, municipality, reference_month, classification, limit)
    reader = csv.DictReader(handle, delimiter=';', strict=True)
    if not REQUIRED.issubset(reader.fieldnames or []):
        raise ValueError('CSV oficial sem os campos esperados')
    records, seen, scanned, duplicates, complete = [], {}, 0, 0, True
    for scanned, row in enumerate(reader, 1):
        if (row.get('IBGE') or '').strip() != municipality:
            continue
        if (row.get('UF') or '').strip() != state or (row.get('COMPETENCIA') or '').strip() != reference_month:
            raise ValueError(f'Linha {scanned}: UF ou competência diferente da solicitada')
        if not re.match(r'^135(?:\s*-|$)', (row.get('SERVICO') or '').strip()):
            continue
        match = re.fullmatch(r'([0-9]{3})(?:\s*-\s*.*)?', (row.get('CLASSIFICACAO') or '').strip())
        if not match:
            raise ValueError(f'Linha {scanned}: classificação CNES inválida')
        cls = match.group(1)
        if classification and cls != classification:
            continue
        record = dict(cnes_code=code(row.get('CNES'), 7, 'CNES'),
                      establishment_name=text(row.get('NOME_FANTASIA'), 'NOME_FANTASIA', 300, True),
                      city=text(row.get('MUNICIPIO'), 'MUNICIPIO', 150, True), state=state,
                      service_code='135', classification_code=cls,
                      classification_description=text(row.get('CLASSIFICACAO'), 'CLASSIFICACAO', 300, True),
                      service_type=text(row.get('TIPO_SERVICO'), 'TIPO_SERVICO', 40, True).upper(),
                      reference_month=reference_month)
        key = (record['cnes_code'], cls, record['service_type'], reference_month)
        if key in seen:
            if record != seen[key]:
                raise ValueError(f'Linha {scanned}: observações conflitantes para o mesmo cadastro')
            duplicates += 1
            continue
        seen[key] = record
        records.append(record)
        if len(records) == limit:
            complete = False
            break
    if not records:
        raise ValueError('Nenhum cadastro 135 foi encontrado para os filtros. Isso não comprova ausência de atendimento no município.')
    return dict(entity='rehabilitation_services', source='cnes-services', records=records), dict(
        source_rows_scanned=scanned, duplicates_collapsed=duplicates, source_scan_complete=complete,
        selection_limit_reached=not complete, reference_month=reference_month, municipality=municipality, state=state,
        classification_filter=classification or None, selection_limit=limit)


def prepare_zip(path, state, municipality, reference_month, classification='', limit=20):
    validate_filters(state, municipality, reference_month, classification, limit)
    member = f'cnes_servicos_espec_cadastrados_{MONTHS[int(reference_month[4:])]}_{reference_month[:4]}.csv'
    with zipfile.ZipFile(path) as archive:
        try:
            entry = archive.getinfo(member)
        except KeyError as exc:
            raise ValueError(f'A competência {reference_month} não está no arquivo oficial. Consulte os meses disponíveis na fonte.') from exc
        if entry.file_size > MAX_BYTES:
            raise ValueError('CSV mensal excedeu o limite de 512 MiB')
        with archive.open(entry) as source, io.TextIOWrapper(source, encoding='utf-8-sig', newline='') as handle:
            payload, metadata = select_rows(handle, state, municipality, reference_month, classification, limit)
    metadata['source_member'] = member
    return payload, metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', required=True, choices=sorted(STATES.values()))
    parser.add_argument('--municipality', required=True)
    parser.add_argument('--reference-month', required=True)
    parser.add_argument('--classification', default='002')
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--archive', help='ZIP local; omitido, baixa o arquivo anual oficial')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    target = Path(args.output)
    metadata_target = target.with_suffix(target.suffix + '.metadata.json')
    if target.exists() or metadata_target.exists():
        parser.error('Saída já existe; escolha outro nome')
    if not valid_month(args.reference_month) or not 1 <= args.limit <= 100:
        parser.error('Informe competência AAAAMM e limite de 1 a 100')
    try:
        validate_filters(args.state, args.municipality, args.reference_month, args.classification, args.limit)
        with tempfile.TemporaryDirectory(prefix='cnes-rehabilitation-') as directory:
            archive_path = Path(args.archive) if args.archive else Path(directory) / 'source.zip'
            provenance = dict(mode='local_archive', archive_name=archive_path.name) if args.archive else download_archive(args.reference_month, archive_path)
            payload, metadata = prepare_zip(archive_path, args.state, args.municipality, args.reference_month, args.classification, args.limit)
            metadata.update(provenance, source_url=CATALOG['source_url'], records=len(payload['records']),
                            normalized_sha256=digest(payload), prepared_at=datetime.now(timezone.utc).isoformat(),
                            autism_care_verification='not_verified', note=CATALOG['note'])
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x', encoding='utf-8') as output:
            json.dump(payload, output, ensure_ascii=False, indent=2)
            output.write('\n')
        with metadata_target.open('x', encoding='utf-8') as output:
            json.dump(metadata, output, ensure_ascii=False, indent=2)
            output.write('\n')
        print(f'{len(payload["records"])} observações de reabilitação preparadas; competência {args.reference_month}. Nenhuma importação realizada.')
    except (OSError, ValueError, KeyError, TypeError, csv.Error, zipfile.BadZipFile) as exc:
        parser.exit(1, f'Não foi possível preparar os serviços: {exc}\n')


if __name__ == '__main__':
    main()
