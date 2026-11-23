import csv
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import prepare_rehabilitation as prepare
import publish_rehabilitation as publish
from publish_cnes_sample import PublicationError
from prepare_cnes_sample import digest


def source(**changes):
    return dict(COMPETENCIA='202607', UF='PR', IBGE='410690', MUNICIPIO='CURITIBA', CNES='0015466',
                NOME_FANTASIA='Unidade fictícia', SERVICO='135 - REABILITACAO', CLASSIFICACAO='002 - INTELECTUAL',
                TIPO_SERVICO='PROPRIO', **changes)


def csv_data(rows):
    handle = io.StringIO()
    writer = csv.DictWriter(handle, fieldnames=sorted(prepare.REQUIRED), delimiter=';')
    writer.writeheader()
    writer.writerows(rows)
    handle.seek(0)
    return handle


class PreparationTests(unittest.TestCase):
    def select(self, rows, **kw):
        return prepare.select_rows(csv_data(rows), 'PR', '410690', '202607', **kw)

    def test_normalization_preserves_zeroes_and_utf8(self):
        payload, meta = self.select([source()])
        self.assertEqual(payload['records'][0]['cnes_code'], '0015466')
        self.assertEqual(payload['records'][0]['establishment_name'], 'Unidade fictícia')
        self.assertTrue(meta['source_scan_complete'])
        self.assertNotIn('autism_care_verification', payload['records'][0])

    def test_filters_and_duplicate_collapse(self):
        other = source(); other['SERVICO'] = '121 - OUTRO'
        payload, meta = self.select([other, source(), source()], classification='002')
        self.assertEqual(len(payload['records']), 1)
        self.assertEqual(meta['duplicates_collapsed'], 1)

    def test_service_types_remain_distinct(self):
        third = source(); third['TIPO_SERVICO'] = 'TERCEIRO'
        payload, _ = self.select([source(), third])
        self.assertEqual(len(payload['records']), 2)

    def test_conflicting_duplicates_fail(self):
        changed = source(); changed['NOME_FANTASIA'] = 'Outro nome'
        with self.assertRaises(ValueError): self.select([source(), changed])

    def test_limit_does_not_claim_full_scan(self):
        _, meta = self.select([source()], limit=1)
        self.assertFalse(meta['source_scan_complete'])

    def test_wrong_month_and_empty_results_fail(self):
        row = source(); row['COMPETENCIA'] = '202606'
        with self.assertRaises(ValueError): self.select([row])
        with self.assertRaises(ValueError): self.select([], classification='002')

    def test_invalid_filters(self):
        for args in [('PR','355030','202607','002',20), ('PR','410690','202613','002',20), ('PR','410690','202607','2',20), ('PR','410690','202607','002',101)]:
            with self.subTest(args=args), self.assertRaises(ValueError): prepare.validate_filters(*args)

    def test_zip_selects_exact_month_and_rejects_missing_month(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('cnes_servicos_espec_cadastrados_jul_2026.csv', csv_data([source()]).getvalue())
            payload, _ = prepare.prepare_zip(path, 'PR','410690','202607')
            self.assertEqual(len(payload['records']), 1)
            with self.assertRaises(ValueError): prepare.prepare_zip(path,'PR','410690','202606')


class Response(io.BytesIO):
    status = 200
    def __init__(self, value): super().__init__(json.dumps(value).encode())


class Opener:
    def __init__(self, responses): self.responses, self.requests = iter(responses), []
    def open(self, request, timeout):
        self.requests.append(request)
        value = next(self.responses)
        if isinstance(value, Exception): raise value
        return Response(value)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.payload, _ = prepare.select_rows(csv_data([source()]),'PR','410690','202607')
        self.meta = {'records':1,'normalized_sha256':digest(self.payload)}

    def test_public_verification_does_not_send_secret(self):
        actual = dict(self.payload['records'][0]); actual['name'] = actual.pop('establishment_name')
        actual['autism_care_verification'] = 'not_verified'
        opener = Opener([{'status':'completed','import_id':'test','records_imported':1}, {'results':[actual]}])
        result = publish.publish(self.payload,self.meta,'test-only',opener)
        self.assertEqual(result['records_verified'],1)
        self.assertEqual(opener.requests[0].get_header('Authorization'),'Bearer test-only')
        self.assertIsNone(opener.requests[1].get_header('Authorization'))
        self.assertIn('RedeGirassol',opener.requests[0].get_header('User-agent'))

    def test_hash_mismatch_is_rejected_before_network(self):
        opener = Opener([])
        with self.assertRaises(PublicationError): publish.publish(self.payload,{},'test-only',opener)
        self.assertEqual(opener.requests,[])

    def test_divergent_verification_never_repeats_post(self):
        opener = Opener([{'status':'completed','import_id':'test','records_imported':1},{'results':[]}])
        with self.assertRaises(PublicationError): publish.publish(self.payload,self.meta,'test-only',opener)
        self.assertEqual([r.get_method() for r in opener.requests],['POST','GET'])

    def test_missing_migration_produces_actionable_error(self):
        opener = Opener([{},urllib.error.HTTPError('https://example.test',503,'unavailable',{},None)])
        with self.assertRaisesRegex(PublicationError,'0002_rehabilitation.sql'): publish.preflight('test-only',opener)
        self.assertIsNone(opener.requests[1].get_header('Authorization'))

    def test_missing_token_is_rejected(self):
        with self.assertRaises(PublicationError): publish.preflight('')


if __name__ == '__main__': unittest.main()
