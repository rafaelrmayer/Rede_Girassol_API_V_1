import copy
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_cnes_sample import digest
from publish_cnes_sample import NoRedirect, USER_AGENT, publish


def response(body, status=200):
    stream = io.BytesIO(json.dumps(body).encode())
    stream.status = status
    return stream


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.row = dict(cnes_code='0000123', name='Unidade fictícia', city='Curitiba', state='PR',
                        address=None, source='cnes', source_updated_at=None)
        self.payload = dict(entity='establishments', source='cnes', records=[self.row])
        self.metadata = dict(records=1, normalized_sha256=digest(self.payload))
        self.result = dict(status='completed', import_id='test-id', records_imported=1)
        self.opener = Mock()

    def test_posts_then_checks_public_record_without_token(self):
        self.opener.open.side_effect = [response(self.result), response({'result': self.row})]
        receipt = publish(self.payload, self.metadata, 'test-only', self.opener)
        self.assertEqual(receipt['records_verified'], 1)
        self.assertEqual(receipt['import_id'], 'test-id')
        post, get = [call.args[0] for call in self.opener.open.call_args_list]
        self.assertEqual(post.get_header('Authorization'), 'Bearer test-only')
        self.assertIsNone(get.get_header('Authorization'))
        for request in (post, get):
            self.assertEqual(request.get_header('User-agent'), USER_AGENT)
            self.assertEqual(request.get_header('Accept'), 'application/json')
        self.assertEqual(json.loads(post.data), self.payload)
        self.assertTrue(get.full_url.endswith('/v1/places/0000123'))
        self.assertNotIn('test-only', json.dumps(receipt))

    def test_verifies_each_record(self):
        second = dict(self.row, cnes_code='0000124')
        self.payload['records'].append(second)
        metadata = dict(records=2, normalized_sha256=digest(self.payload))
        self.opener.open.side_effect = [response(dict(self.result, records_imported=2)),
                                       response({'result': self.row}), response({'result': second})]
        self.assertEqual(publish(self.payload, metadata, 'test-only', self.opener)['records_verified'], 2)

    def test_missing_token_does_not_send(self):
        with self.assertRaises(ValueError):
            publish(self.payload, self.metadata, '', self.opener)
        self.opener.open.assert_not_called()

    def test_modified_sample_does_not_send(self):
        self.payload['records'][0]['name'] = 'Alterado'
        with self.assertRaises(ValueError):
            publish(self.payload, self.metadata, 'test-only', self.opener)
        self.opener.open.assert_not_called()

    def test_rejects_duplicate_or_invalid_codes(self):
        for code in ['123', 'abcdefg', '１２３４５６７']:
            with self.subTest(code=code):
                payload = copy.deepcopy(self.payload)
                payload['records'][0]['cnes_code'] = code
                with self.assertRaises(ValueError):
                    publish(payload, dict(records=1, normalized_sha256=digest(payload)), 'test-only', self.opener)
        payload = copy.deepcopy(self.payload)
        payload['records'].append(payload['records'][0])
        with self.assertRaises(ValueError):
            publish(payload, dict(records=2, normalized_sha256=digest(payload)), 'test-only', self.opener)
        self.opener.open.assert_not_called()

    def test_does_not_accept_received_only_or_wrong_count(self):
        for result in [dict(self.result, status='received'), dict(self.result, records_imported=0), []]:
            self.opener.reset_mock()
            self.opener.open.side_effect = [response(result)]
            with self.assertRaises(ValueError):
                publish(self.payload, self.metadata, 'test-only', self.opener)
            self.assertEqual(self.opener.open.call_count, 1)

    def test_verification_mismatch_is_failure_after_one_post(self):
        self.opener.open.side_effect = [response(self.result), response({'result': dict(self.row, name='Diferente')})]
        with self.assertRaisesRegex(ValueError, 'lote foi enviado'):
            publish(self.payload, self.metadata, 'test-only', self.opener)
        self.assertEqual(self.opener.open.call_count, 2)

    def test_unauthorized_is_not_retried(self):
        self.opener.open.side_effect = urllib.error.HTTPError('https://example.test', 401, 'Unauthorized', {}, None)
        with self.assertRaises(urllib.error.HTTPError):
            publish(self.payload, self.metadata, 'test-only', self.opener)
        self.assertEqual(self.opener.open.call_count, 1)

    def test_does_not_follow_redirects(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test'))


if __name__ == '__main__':
    unittest.main()
