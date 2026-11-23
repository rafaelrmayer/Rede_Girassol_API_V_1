#!/usr/bin/env python3
"""Prepare a bounded CNES sample; never imports or deploys anything."""
import argparse
from datetime import date, datetime, timezone
from http.client import IncompleteRead
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CNES_URL = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos'
IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios'
STATES = dict(zip(
    [11,12,13,14,15,16,17,21,22,23,24,25,26,27,28,29,31,32,33,35,41,42,43,50,51,52,53],
    'RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF'.split()))


def code(value, width, field):
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ValueError(f'{field}: informe código inteiro ou texto numérico')
    text = str(value).strip()
    if not re.fullmatch(r'[0-9]{1,' + str(width) + '}', text):
        raise ValueError(f'{field}: código inválido')
    return text.zfill(width)


def text(value, field, maximum, required=False):
    if value is None or value == '':
        if required:
            raise ValueError(f'{field}: campo obrigatório')
        return None
    if not isinstance(value, str):
        raise ValueError(f'{field}: esperado texto')
    value = value.strip()
    if not value:
        if required:
            raise ValueError(f'{field}: campo obrigatório')
        return None
    if len(value) > maximum or any(ord(c) < 32 for c in value):
        raise ValueError(f'{field}: tamanho ou caracteres inválidos')
    return value


def normalize(payload, municipalities):
    if not isinstance(payload, dict) or not isinstance(payload.get('estabelecimentos'), list):
        raise ValueError('Esperada resposta CNES com lista estabelecimentos')
    if not 1 <= len(payload['estabelecimentos']) <= 100:
        raise ValueError('Carga deve conter entre 1 e 100 estabelecimentos')
    if not isinstance(municipalities, list):
        raise ValueError('Esperada lista de municípios IBGE')
    cities = {}
    for city in municipalities:
        key = code(city['id'], 7, 'IBGE.id')
        name = text(city['nome'], 'IBGE.nome', 150, True)
        if key[:6] in cities:
            raise ValueError('Município IBGE duplicado')
        cities[key[:6]] = name
    result, seen = [], set()
    for index, raw in enumerate(payload['estabelecimentos']):
        try:
            if not isinstance(raw, dict):
                raise ValueError('registro deve ser objeto')
            cnes = code(raw.get('codigo_cnes'), 7, 'codigo_cnes')
            if cnes in seen:
                raise ValueError('CNES repetido na amostra')
            seen.add(cnes)
            uf_code = int(code(raw.get('codigo_uf'), 2, 'codigo_uf'))
            if uf_code not in STATES:
                raise ValueError('UF desconhecida')
            municipality = code(raw.get('codigo_municipio'), 6, 'codigo_municipio')
            if municipality[:2] != str(uf_code) or municipality not in cities:
                raise ValueError('Município sem correspondência IBGE ou incompatível com UF')
            name = text(raw.get('nome_fantasia'), 'nome_fantasia', 300)
            name = name or text(raw.get('nome_razao_social'), 'nome_razao_social', 300, True)
            address_parts = [text(raw.get(key), key, 500) for key in
                             ['endereco_estabelecimento', 'numero_estabelecimento', 'bairro_estabelecimento']]
            address = text(', '.join(part for part in address_parts if part), 'address', 500)
            updated = text(raw.get('data_atualizacao'), 'data_atualizacao', 10)
            if updated and (not re.fullmatch(r'\d{4}-\d{2}-\d{2}', updated) or date.fromisoformat(updated).isoformat() != updated):
                raise ValueError('Data de atualização inválida')
            result.append(dict(cnes_code=cnes, name=name, city=cities[municipality],
                               state=STATES[uf_code], address=address, source='cnes', source_updated_at=updated))
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f'Registro {index + 1}: {exc}') from exc
    return {'entity': 'establishments', 'source': 'cnes', 'records': result}


def download(url):
    source = urllib.parse.urlparse(url).hostname or 'fonte oficial'
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'RedeGirassol-development/0.1'})
    for attempt in range(1, 4):
        print(f'Consultando {source}: tentativa {attempt}/3.', file=sys.stderr, flush=True)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                content = response.read(5 * 1024 * 1024 + 1)
            if len(content) > 5 * 1024 * 1024:
                raise ValueError(f'{source}: resposta excedeu 5 MiB')
            try:
                return json.loads(content)
            except (ValueError, UnicodeError) as exc:
                raise ValueError(f'{source}: resposta não contém JSON válido') from exc
        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.close()
            if status not in {429, 500, 502, 503, 504}:
                raise ValueError(f'{source}: HTTP {status}; consulta interrompida') from exc
            reason = f'HTTP {status}'
        except (urllib.error.URLError, TimeoutError, ConnectionError, IncompleteRead):
            reason = 'timeout ou falha de conexão/leitura'
        if attempt == 3:
            raise ValueError(f'{source}: consulta falhou após 3 tentativas ({reason}). Nenhum lote preparado nesta execução foi enviado ao banco.')
        time.sleep(attempt)


def fetch_pages(uf, municipality, limit=20, pages=1, start_page=0):
    if uf not in STATES or not re.fullmatch(r'[0-9]{6}', municipality) or not municipality.startswith(str(uf)):
        raise ValueError('Município ou UF inválido')
    if not 1 <= limit <= 20 or not 1 <= pages <= 5 or not 0 <= start_page <= 10000:
        raise ValueError('Use de 1 a 20 registros por página, de 1 a 5 páginas e página inicial de 0 a 10000')
    records, consulted = [], []
    exhausted = False
    for page in range(start_page, start_page + pages):
        url = CNES_URL + '?' + urllib.parse.urlencode(dict(codigo_uf=uf, codigo_municipio=municipality, limit=limit, offset=page, status=1))
        payload = download(url)
        rows = payload.get('estabelecimentos') if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            raise ValueError('CNES: resposta sem lista estabelecimentos')
        if len(rows) > limit:
            raise ValueError('CNES: a fonte excedeu o limite solicitado')
        for row in rows:
            if not isinstance(row, dict) or code(row.get('codigo_municipio'), 6, 'codigo_municipio') != municipality:
                raise ValueError('CNES: registro de outro município ou formato inválido')
        consulted.append(dict(page=page, url=url, records=len(rows), sha256=digest(payload)))
        records.extend(rows)
        if len(rows) < limit:
            exhausted = True
            break
    if not records:
        raise ValueError('CNES: nenhuma unidade retornada na página inicial; nenhum lote foi preparado')
    return {'estabelecimentos': records}, dict(
        mode='download', cnes_url=consulted[0]['url'], source_pages=consulted,
        source_page_size=limit, start_page=start_page, requested_pages=pages,
        next_source_page=None if exhausted else start_page + len(consulted),
        source_exhausted=exhausted, requested_status=1)


def digest(payload):
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='Novo arquivo JSON normalizado (não sobrescreve)')
    parser.add_argument('--input', help='Resposta CNES local para conversão offline')
    parser.add_argument('--municipalities', help='Lista IBGE local, obrigatória com --input')
    parser.add_argument('--state-code', type=int, choices=sorted(STATES), help='Código IBGE da UF; PR=41')
    parser.add_argument('--municipality', help='Código do município no CNES, com seis dígitos; Curitiba=410690')
    parser.add_argument('--limit', type=int, default=3, choices=range(1,21))
    parser.add_argument('--pages', type=int, default=1, choices=range(1,6), help='Páginas CNES a consultar, até 5')
    parser.add_argument('--start-page', type=int, default=0, help='Página inicial CNES (0 a 10000)')
    args = parser.parse_args()
    if not 0 <= args.start_page <= 10000:
        parser.error('--start-page deve estar entre 0 e 10000')
    target = Path(args.output)
    metadata_target = target.with_suffix(target.suffix + '.metadata.json')
    if target.exists() or metadata_target.exists():
        parser.error('Arquivo de saída ou metadados já existe; escolha outro nome')
    if bool(args.input) != bool(args.municipalities):
        parser.error('--input e --municipalities devem ser usados juntos')
    if args.input and (args.state_code is not None or args.municipality is not None or args.pages != 1 or args.start_page != 0):
        parser.error('Use arquivos offline ou filtros para download, sem misturá-los')
    try:
        if args.input:
            payload = json.loads(Path(args.input).read_text(encoding='utf-8'))
            municipalities = json.loads(Path(args.municipalities).read_text(encoding='utf-8'))
            provenance = {'mode': 'offline', 'cnes_input': str(Path(args.input).name), 'ibge_input': str(Path(args.municipalities).name)}
        else:
            if args.state_code is None or not args.municipality or not re.fullmatch(r'[0-9]{6}', args.municipality):
                parser.error('Para download, informe --state-code e --municipality (seis dígitos)')
            if not args.municipality.startswith(str(args.state_code)):
                parser.error('Código do município incompatível com a UF')
            payload, provenance = fetch_pages(args.state_code, args.municipality, args.limit, args.pages, args.start_page)
            ibge_url = IBGE_URL.format(uf=args.state_code)
            municipalities = download(ibge_url)
            provenance['ibge_url'] = ibge_url
        normalized = normalize(payload, municipalities)
        metadata = dict(provenance, prepared_at=datetime.now(timezone.utc).isoformat(),
                        cnes_response_sha256=digest(payload), ibge_response_sha256=digest(municipalities),
                        normalized_sha256=digest(normalized), records=len(normalized['records']),
                        note='Hashes do JSON canônico, não dos bytes HTTP. Preparação não importa dados. A data do cadastro vem de data_atualizacao, não do download.')
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x', encoding='utf-8') as f:
            json.dump(normalized, f, ensure_ascii=False, indent=2)
            f.write('\n')
        with metadata_target.open('x', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'{len(normalized["records"])} estabelecimentos preparados em {target}. Nenhuma importação realizada.')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f'Não foi possível preparar a amostra: {exc}\n')


if __name__ == '__main__':
    main()
