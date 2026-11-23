import contextlib
from http.client import IncompleteRead
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_cnes_sample import download

URL = 'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos'


def response(payload):
    return io.BytesIO(json.dumps(payload).encode())


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.open_patch = patch('prepare_cnes_sample.urllib.request.urlopen')
        self.open = self.open_patch.start()
        self.sleep_patch = patch('prepare_cnes_sample.time.sleep')
        self.sleep = self.sleep_patch.start()
        self.logs = io.StringIO()
        self.stderr = contextlib.redirect_stderr(self.logs)
        self.stderr.__enter__()
        self.addCleanup(self.stderr.__exit__, None, None, None)
        self.addCleanup(self.sleep_patch.stop)
        self.addCleanup(self.open_patch.stop)

    def test_success_has_no_delay(self):
        self.open.return_value = response({'estabelecimentos': []})
        self.assertEqual(download(URL), {'estabelecimentos': []})
        self.assertEqual(self.open.call_args.kwargs['timeout'], 30)
        self.sleep.assert_not_called()

    def test_retries_connection_timeout_then_succeeds(self):
        self.open.side_effect = [TimeoutError('timeout'), response({'ok': True})]
        self.assertEqual(download(URL), {'ok': True})
        self.assertEqual(self.open.call_count, 2)
        self.sleep.assert_called_once_with(1)
        self.assertIn('apidadosabertos.saude.gov.br: tentativa 2/3', self.logs.getvalue())

    def test_retries_timeout_while_reading(self):
        from unittest.mock import MagicMock
        first = MagicMock()
        first.__enter__.return_value.read.side_effect = TimeoutError('The read operation timed out')
        self.open.side_effect = [first, response({'ok': True})]
        self.assertEqual(download(URL), {'ok': True})
        self.assertEqual(self.open.call_count, 2)
        first.__exit__.assert_called_once()

    def test_retries_transient_http_statuses(self):
        for status in [429, 500, 502, 503, 504]:
            with self.subTest(status=status):
                self.open.side_effect = [urllib.error.HTTPError(URL, status, '', {}, None), response({'ok': True})]
                self.assertEqual(download(URL), {'ok': True})

    def test_retries_url_errors_and_incomplete_reads(self):
        self.open.side_effect = [urllib.error.URLError('timeout'), IncompleteRead(b'{'), response({'ok': True})]
        self.assertEqual(download(URL), {'ok': True})
        self.assertEqual(self.open.call_count, 3)

    def test_stops_after_three_failures_and_identifies_source(self):
        self.open.side_effect = TimeoutError('timeout')
        with self.assertRaisesRegex(ValueError, 'apidadosabertos.saude.gov.br: consulta falhou após 3 tentativas'):
            download(URL)
        self.assertEqual(self.open.call_count, 3)
        self.assertEqual([call.args[0] for call in self.sleep.call_args_list], [1, 2])

    def test_does_not_retry_permanent_http_errors(self):
        for status in [400, 401, 403, 404]:
            with self.subTest(status=status):
                self.open.reset_mock()
                self.open.side_effect = urllib.error.HTTPError(URL, status, '', {}, None)
                with self.assertRaisesRegex(ValueError, f'HTTP {status}'):
                    download(URL)
                self.assertEqual(self.open.call_count, 1)
        self.sleep.assert_not_called()

    def test_does_not_retry_invalid_json_or_excessive_body(self):
        for body in [b'not JSON', b'x' * (5 * 1024 * 1024 + 1)]:
            with self.subTest(size=len(body)):
                self.open.reset_mock()
                self.open.return_value = io.BytesIO(body)
                with self.assertRaises(ValueError):
                    download(URL)
                self.assertEqual(self.open.call_count, 1)
        self.sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()
