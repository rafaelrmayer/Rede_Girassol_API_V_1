#!/usr/bin/env python3
"""Publish a monthly institutional rehabilitation batch and verify its observations."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

from prepare_cnes_sample import digest
from publish_cnes_sample import API_URL, USER_AGENT, NoRedirect, PublicationError


def checked_payload(payload, metadata):
    if not isinstance(payload, dict) or payload.get('entity') != 'rehabilitation_services' or payload.get('source') != 'cnes-services':
        raise PublicationError('Esperado lote de serviços de reabilitação CNES')
    rows = payload.get('records')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
        raise PublicationError('Informe de 1 a 100 observações')
    if not isinstance(metadata, dict) or metadata.get('records') != len(rows) or metadata.get('normalized_sha256') != digest(payload):
        raise PublicationError('Lote diferente dos metadados de preparação')
    return rows


def request_json(opener, path, token=None, payload=None, api_url=API_URL):
    headers = {'Accept': 'application/json', 'User-Agent': USER_AGENT}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(api_url + path, data=None if payload is None else json.dumps(payload).encode(), headers=headers)
    with opener.open(request, timeout=30) as response:
        return response.status, json.load(response)


def preflight(token, opener=None, api_url=API_URL):
    if not token or not token.strip():
        raise PublicationError('Configure o secret REDE_GIRASSOL_IMPORT_TOKEN')
    opener = opener or urllib.request.build_opener(NoRedirect())
    status, _ = request_json(opener, '/admin/imports', token, api_url=api_url)
    if status != 200:
        raise PublicationError('A API não confirmou acesso administrativo')
    try:
        status, data = request_json(opener, '/v1/rehabilitation?limit=1', api_url=api_url)
    except urllib.error.HTTPError as exc:
        if exc.code == 503:
            raise PublicationError('Aplique migrations/0002_rehabilitation.sql no Console do D1 antes de importar') from exc
        raise
    if status != 200 or not isinstance(data, dict) or 'pagination' not in data:
        raise PublicationError('Aguarde o deploy da API com o catálogo de reabilitação')


def publish(payload, metadata, token, opener=None, api_url=API_URL):
    rows = checked_payload(payload, metadata)
    if not token or not token.strip():
        raise PublicationError('Configure o secret REDE_GIRASSOL_IMPORT_TOKEN')
    opener = opener or urllib.request.build_opener(NoRedirect())
    status, result = request_json(opener, '/admin/import', token, payload, api_url)
    if status != 200 or not isinstance(result, dict) or result.get('status') != 'completed' or not result.get('import_id') or result.get('records_imported') != len(rows):
        raise PublicationError('O lote não foi confirmado. Confira o histórico antes de repetir')
    fields = dict(cnes_code='cnes_code', establishment_name='name', city='city', state='state', service_code='service_code',
                  classification_code='classification_code', classification_description='classification_description',
                  service_type='service_type', reference_month='reference_month')
    for row in rows:
        params = urllib.parse.urlencode({key: row[key] for key in ['cnes_code','classification_code','reference_month','service_type']})
        status, data = request_json(opener, '/v1/rehabilitation?limit=100&' + params, api_url=api_url)
        matches = data.get('results', []) if isinstance(data, dict) else []
        if status != 200 or not any(all(actual.get(target) == row[source] for source, target in fields.items()) and
                                   actual.get('autism_care_verification') in ['not_verified','documented'] for actual in matches):
            raise PublicationError('Lote enviado, mas a conferência divergiu. Confira os registros e o histórico antes de repetir')
    return dict(import_id=result['import_id'], status='completed', records_imported=len(rows), records_verified=len(rows),
                establishments_seen=len({row['cnes_code'] for row in rows}), api_url=api_url,
                normalized_sha256=metadata['normalized_sha256'], verified_at=datetime.now(timezone.utc).isoformat())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--file')
    parser.add_argument('--metadata')
    parser.add_argument('--output')
    args = parser.parse_args()
    try:
        token = os.environ.get('IMPORT_TOKEN')
        if args.check_only:
            preflight(token)
            print('API e catálogo de reabilitação prontos para a importação.')
            return
        if not args.file or not args.metadata or not args.output:
            parser.error('Informe --file, --metadata e --output')
        target = Path(args.output)
        if target.exists():
            raise PublicationError('Saída já existe; escolha outro nome')
        receipt = publish(json.loads(Path(args.file).read_text(encoding='utf-8')),
                          json.loads(Path(args.metadata).read_text(encoding='utf-8')), token)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x', encoding='utf-8') as output:
            json.dump(receipt, output, ensure_ascii=False, indent=2)
            output.write('\n')
        print(f'{receipt["records_imported"]} observações importadas e conferidas; {receipt["establishments_seen"]} estabelecimentos.')
    except PublicationError as exc:
        parser.exit(1, str(exc) + '\n')
    except urllib.error.HTTPError as exc:
        parser.exit(1, f'API retornou HTTP {exc.code}. Confira disponibilidade, token e histórico; não houve repetição automática.\n')
    except (OSError, ValueError, TypeError, KeyError):
        parser.exit(1, 'Falha de arquivo, resposta ou conexão. Confira o histórico antes de repetir.\n')


if __name__ == '__main__':
    main()
