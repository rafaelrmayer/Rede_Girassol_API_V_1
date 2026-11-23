#!/usr/bin/env python3
"""Publish a prepared CNES sample to the configured API and verify every record."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

from prepare_cnes_sample import digest

API_URL = 'https://rede-girassol-api-v-1.rafael10mayer.workers.dev'
USER_AGENT = 'RedeGirassol-CNES-Importer/0.1 (+https://github.com/rafaelrmayer/Rede_Girassol_API_V_1)'
FIELDS = ('cnes_code', 'name', 'city', 'state', 'address', 'source', 'source_updated_at')


class PublicationError(ValueError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the administrative token to another URL.
        return None


def checked_sample(payload, metadata):
    if not isinstance(payload, dict) or payload.get('source') != 'cnes' or payload.get('entity') != 'establishments':
        raise PublicationError('Esperada amostra CNES normalizada de estabelecimentos')
    records = payload.get('records')
    if not isinstance(records, list) or not 1 <= len(records) <= 20:
        raise PublicationError('A amostra deve conter de 1 a 20 registros')
    if not isinstance(metadata, dict) or metadata.get('normalized_sha256') != digest(payload) or metadata.get('records') != len(records):
        raise PublicationError('Amostra não corresponde aos metadados de preparação')
    seen = set()
    for row in records:
        if not isinstance(row, dict):
            raise PublicationError('Registro inválido')
        cnes = row.get('cnes_code')
        if not isinstance(cnes, str) or len(cnes) != 7 or not cnes.isascii() or not cnes.isdecimal() or cnes in seen:
            raise PublicationError('CNES inválido ou repetido')
        if row.get('source') != 'cnes':
            raise PublicationError('Origem do registro incompatível')
        seen.add(cnes)
    return records


def publish(payload, metadata, token, opener=None, api_url=API_URL):
    records = checked_sample(payload, metadata)
    if not token or not token.strip():
        raise PublicationError('Configure REDE_GIRASSOL_IMPORT_TOKEN nos secrets do GitHub e IMPORT_TOKEN no Worker com o mesmo valor')
    opener = opener or urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(api_url + '/admin/import', data=json.dumps(payload).encode('utf-8'),
                                     headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': USER_AGENT, 'Authorization': f'Bearer {token}'}, method='POST')
    with opener.open(request, timeout=30) as response:
        result = json.load(response)
        if response.status != 200 or not isinstance(result, dict) or result.get('status') != 'completed' or not result.get('import_id') or result.get('records_imported') != len(records):
            raise PublicationError('A API não confirmou a conclusão do lote; confira o histórico antes de repetir')
    # Public reads deliberately carry no administrative token.
    for row in records:
        request = urllib.request.Request(api_url + '/v1/places/' + row['cnes_code'], headers={'Accept': 'application/json', 'User-Agent': USER_AGENT})
        with opener.open(request, timeout=30) as response:
            actual = json.load(response).get('result')
            if response.status != 200 or not isinstance(actual, dict) or any(actual.get(key) != row.get(key) for key in FIELDS):
                raise PublicationError('O lote foi enviado, mas a conferência pública divergiu. Confira o painel e o histórico antes de repetir')
    return dict(import_id=result['import_id'], status='completed', records_imported=len(records), records_verified=len(records),
                normalized_sha256=metadata['normalized_sha256'], api_url=api_url, verified_at=datetime.now(timezone.utc).isoformat())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True)
    parser.add_argument('--metadata', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        output = Path(args.output)
        if output.exists():
            raise PublicationError('O arquivo de resultado já existe')
        payload = json.loads(Path(args.file).read_text(encoding='utf-8'))
        metadata = json.loads(Path(args.metadata).read_text(encoding='utf-8'))
        receipt = publish(payload, metadata, os.environ.get('IMPORT_TOKEN'))
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('x', encoding='utf-8') as handle:
            json.dump(receipt, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
        print(f'{receipt["records_imported"]} estabelecimentos importados e conferidos na API pública.')
    except urllib.error.HTTPError as exc:
        # Do not echo remote response bodies, credentials, or request headers.
        parser.exit(1, f'API retornou HTTP {exc.code}. Confira o token, a disponibilidade e o histórico da API; não houve repetição automática.\n')
    except PublicationError as exc:
        parser.exit(1, str(exc) + '\n')
    except (OSError, ValueError, TypeError):
        parser.exit(1, 'Falha de arquivo, resposta ou conexão. Confira o histórico antes de repetir.\n')


if __name__ == '__main__':
    main()
