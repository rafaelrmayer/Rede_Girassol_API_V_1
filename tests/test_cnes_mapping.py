import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_cnes_sample import normalize


class CNESMappingTests(unittest.TestCase):
    def setUp(self):
        # Synthetic records using the field names observed in the official API.
        self.row = dict(codigo_cnes=123, nome_fantasia='Unidade fictícia', nome_razao_social='Entidade fictícia',
                        codigo_uf=41, codigo_municipio=410690, endereco_estabelecimento='Rua fictícia',
                        numero_estabelecimento='10', bairro_estabelecimento='Bairro fictício',
                        data_atualizacao='2026-11-01', numero_cnpj='not copied', endereco_email_estabelecimento='not copied')
        self.cities = [dict(id=4106902, nome='Curitiba')]

    def convert(self, row=None):
        return normalize({'estabelecimentos': [self.row if row is None else row]}, self.cities)['records'][0]

    def test_maps_only_allowed_fields_and_preserves_zeroes(self):
        self.assertEqual(self.convert(), dict(cnes_code='0000123', name='Unidade fictícia', city='Curitiba', state='PR',
                          address='Rua fictícia, 10, Bairro fictício', source='cnes', source_updated_at='2026-11-01'))

    def test_falls_back_to_legal_name(self):
        self.row['nome_fantasia'] = ' '
        self.assertEqual(self.convert()['name'], 'Entidade fictícia')

    def test_optional_values_are_null_not_download_date(self):
        for key in ['data_atualizacao', 'endereco_estabelecimento', 'numero_estabelecimento', 'bairro_estabelecimento']:
            self.row[key] = None
        self.assertIsNone(self.convert()['source_updated_at'])
        self.assertIsNone(self.convert()['address'])

    def test_rejects_bad_fields(self):
        for field, value in [('codigo_cnes', True), ('codigo_cnes', 12.3), ('codigo_cnes', '12345678'),
                             ('codigo_cnes', '-1'), ('codigo_uf', 99), ('codigo_municipio', 355030),
                             ('codigo_municipio', 410999), ('data_atualizacao', '2026-02-30'),
                             ('data_atualizacao', '2026-1-01'), ('nome_fantasia', 'x' * 301)]:
            with self.subTest(field=field, value=value):
                row = copy.deepcopy(self.row)
                row[field] = value
                with self.assertRaises(ValueError):
                    self.convert(row)

    def test_rejects_missing_names(self):
        self.row['nome_fantasia'] = self.row['nome_razao_social'] = None
        with self.assertRaises(ValueError):
            self.convert()

    def test_rejects_duplicate_cnes(self):
        with self.assertRaises(ValueError):
            normalize({'estabelecimentos': [self.row, self.row]}, self.cities)

    def test_rejects_missing_or_oversized_envelope(self):
        for payload in [[], {}, {'estabelecimentos': []}, {'estabelecimentos': [self.row] * 101}]:
            with self.subTest(payload=type(payload).__name__), self.assertRaises(ValueError):
                normalize(payload, self.cities)

    def test_offline_cli_writes_normalized_file_and_metadata_without_overwriting(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'input.json').write_text(json.dumps({'estabelecimentos': [self.row]}))
            (root / 'cities.json').write_text(json.dumps(self.cities))
            cmd = [sys.executable, 'scripts/prepare_cnes_sample.py', '--input', str(root / 'input.json'),
                   '--municipalities', str(root / 'cities.json'), '--output', str(root / 'output.json')]
            result = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            output = json.loads((root / 'output.json').read_text())
            self.assertEqual(output['records'][0]['cnes_code'], '0000123')
            metadata = json.loads((root / 'output.json.metadata.json').read_text())
            self.assertEqual(metadata['mode'], 'offline')
            self.assertEqual(len(metadata['normalized_sha256']), 64)
            self.assertNotEqual(subprocess.run(cmd, capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
