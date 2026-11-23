#!/usr/bin/env python3
"""Prepare a bounded CNES sample; never imports or deploys anything."""
import argparse
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re
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
    if not 1 <= len(payload['estabelecimentos']) <= 20:
        raise ValueError('Amostra deve conter entre 1 e 20 estabelecimentos')
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
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'RedeGirassol-development/0.1'})
    with urllib.request.urlopen(req, timeout=30) as response:
        content = response.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise ValueError('Resposta excedeu 5 MiB')
    return json.loads(content)


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
    args = parser.parse_args()
    target = Path(args.output)
    metadata_target = target.with_suffix(target.suffix + '.metadata.json')
    if target.exists() or metadata_target.exists():
        parser.error('Arquivo de saída ou metadados já existe; escolha outro nome')
    if bool(args.input) != bool(args.municipalities):
        parser.error('--input e --municipalities devem ser usados juntos')
    if args.input and (args.state_code is not None or args.municipality is not None):
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
            url = CNES_URL + '?' + urllib.parse.urlencode(dict(codigo_uf=args.state_code, codigo_municipio=args.municipality, limit=args.limit, offset=0, status=1))
            ibge_url = IBGE_URL.format(uf=args.state_code)
            payload, municipalities = download(url), download(ibge_url)
            # Do not trust upstream filtering silently.
            for row in payload.get('estabelecimentos', []):
                if code(row.get('codigo_municipio'), 6, 'codigo_municipio') != args.municipality:
                    raise ValueError('A API retornou município diferente do solicitado')
            if len(payload.get('estabelecimentos', [])) > args.limit:
                raise ValueError('A API excedeu o limite solicitado')
            provenance = {'mode': 'download', 'cnes_url': url, 'ibge_url': ibge_url, 'requested_status': 1}
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
