#!/usr/bin/env python3
"""Generate a public consultation-only pilot spec, excluding pending ANS routes."""
import argparse
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'/v1/operators', '/v1/plans'}


def prepare(document):
    result = copy.deepcopy(document)
    result['paths'] = {path: item for path, item in result['paths'].items() if path not in EXCLUDED}
    result['info']['title'] = 'Rede Girassol API — piloto de consultas'
    result['info']['description'] = ('Catálogo parcial de estabelecimentos e observações históricas de reabilitação, '
        'atendimento a TEA documentado, contatos publicados e orientações experimentais de acesso. '
        'Cobertura inicial limitada a cargas de Curitiba/PR; não confirma vagas, rede credenciada ou atendimento a todas as idades. '
        'Operadoras e planos ANS não integram este piloto. Os resumos não usam geração por IA.')
    # Retain only referenced component definitions, including transitive refs.
    needed = set()
    def visit(value):
        if isinstance(value, dict):
            ref = value.get('$ref', '')
            if ref.startswith('#/components/') and ref not in needed:
                needed.add(ref)
                _, _, kind, name = ref.split('/')
                visit(result['components'][kind][name])
            for item in value.values(): visit(item)
        elif isinstance(value, list):
            for item in value: visit(item)
    visit(result['paths'])
    result['components'] = {kind: {name: value for name, value in items.items()
        if '#/components/'+kind+'/'+name in needed} for kind, items in result['components'].items()}
    result['components'] = {kind: items for kind, items in result['components'].items() if items}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(prepare(json.loads((ROOT/'openapi.json').read_text(encoding='utf-8'))),ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
    print('Definição de sete consultas do piloto preparada. Nenhuma publicação realizada.')


if __name__ == '__main__': main()
