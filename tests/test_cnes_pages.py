import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_cnes_sample import fetch_pages, normalize, digest
from publish_cnes_sample import checked_sample


def row(i):
    return dict(codigo_cnes=i, codigo_municipio=410690, codigo_uf=41, nome_fantasia='Unidade fictícia')


class SourcePaginationTests(unittest.TestCase):
    def setUp(self):
        self.mock_patch = patch('prepare_cnes_sample.download')
        self.download = self.mock_patch.start()
        self.addCleanup(self.mock_patch.stop)

    def test_collects_five_distinct_pages_and_prepares_publishable_100_row_batch(self):
        self.download.side_effect = [{'estabelecimentos': [row(i) for i in range(start, start + 20)]} for start in range(1, 101, 20)]
        payload, metadata = fetch_pages(41, '410690', 20, 5, 2)
        self.assertEqual(len(payload['estabelecimentos']), 100)
        queries = [parse_qs(urlparse(call.args[0]).query) for call in self.download.call_args_list]
        self.assertEqual([q['offset'] for q in queries], [['2'],['3'],['4'],['5'],['6']])
        self.assertTrue(all(q['limit'] == ['20'] for q in queries))
        self.assertEqual(metadata['next_source_page'], 7)
        self.assertFalse(metadata['source_exhausted'])
        normalized = normalize(payload, [{'id': 4106902, 'nome': 'Curitiba'}])
        self.assertEqual(len(checked_sample(normalized, dict(records=100, normalized_sha256=digest(normalized)))), 100)

    def test_stops_on_short_page(self):
        self.download.side_effect = [{'estabelecimentos': [row(1), row(2)]}, {'estabelecimentos': [row(3)]}]
        payload, metadata = fetch_pages(41, '410690', 2, 5)
        self.assertEqual(len(payload['estabelecimentos']), 3)
        self.assertEqual(self.download.call_count, 2)
        self.assertTrue(metadata['source_exhausted'])
        self.assertIsNone(metadata['next_source_page'])

    def test_empty_page_after_full_page_preserves_previous_rows(self):
        self.download.side_effect = [{'estabelecimentos': [row(1)]}, {'estabelecimentos': []}]
        payload, metadata = fetch_pages(41, '410690', 1, 5)
        self.assertEqual(len(payload['estabelecimentos']), 1)
        self.assertTrue(metadata['source_exhausted'])
        self.assertEqual(len(metadata['source_pages']), 2)

    def test_empty_first_page_does_not_prepare_empty_batch(self):
        self.download.return_value = {'estabelecimentos': []}
        with self.assertRaisesRegex(ValueError, 'nenhuma unidade'):
            fetch_pages(41, '410690')

    def test_rejects_source_shape_size_and_municipality_mismatch(self):
        for payload in [[], {}, {'estabelecimentos': [row(i) for i in range(21)]},
                        {'estabelecimentos': [dict(row(1), codigo_municipio=355030)]}]:
            with self.subTest(payload=type(payload).__name__):
                self.download.return_value = payload
                with self.assertRaises(ValueError):
                    fetch_pages(41, '410690')

    def test_repeated_rows_between_source_pages_fail_normalization(self):
        self.download.return_value = {'estabelecimentos': [row(1)]}
        payload, _ = fetch_pages(41, '410690', 1, 2)
        with self.assertRaisesRegex(ValueError, 'CNES repetido'):
            normalize(payload, [{'id': 4106902, 'nome': 'Curitiba'}])

    def test_invalid_bounds_fail_before_download(self):
        for kwargs in [dict(pages=0), dict(pages=6), dict(limit=21), dict(start_page=-1), dict(start_page=10001)]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                fetch_pages(41, '410690', **kwargs)
        self.download.assert_not_called()

    def test_source_failure_does_not_return_partial_batch(self):
        self.download.side_effect = [{'estabelecimentos': [row(1)]}, ValueError('source unavailable')]
        with self.assertRaisesRegex(ValueError, 'source unavailable'):
            fetch_pages(41, '410690', 1, 2)

    def test_publisher_rejects_more_than_100(self):
        payload = {'entity': 'establishments', 'source': 'cnes', 'records': [{'cnes_code': str(i).zfill(7), 'source': 'cnes'} for i in range(101)]}
        with self.assertRaises(ValueError):
            checked_sample(payload, dict(records=101, normalized_sha256=digest(payload)))


if __name__ == '__main__':
    unittest.main()
