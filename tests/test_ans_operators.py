import csv
import io
import json
from pathlib import Path
import sys
import unittest
import urllib.error
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare_ans_operators as prep
import publish_ans_operators as publisher
from publish_cnes_sample import PublicationError


def row(code='000001',cancelled=False):
    data=dict(REGISTRO_OPERADORA=code,RAZAO_SOCIAL='Operadora fictícia',NOME_FANTASIA='',MODALIDADE='Medicina de Grupo',CIDADE='Curitiba',UF='PR',DATA_REGISTRO_ANS='2020-01-01')
    if cancelled:data.update(DATA_DESCREDENCIAMENTO='2025-01-01',MOTIVO_DO_DESCREDENCIAMENTO='Pedido de cancelamento')
    return data


def encoded(rows,fields=None):
    stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=fields or list(rows[0]),delimiter=';');writer.writeheader();writer.writerows(rows)
    return stream.getvalue().encode('utf-8-sig')


def payload():return prep.prepare(encoded([row()]),encoded([row('000002',True)]),'2026-11-24','2026-11-24')


class PreparationTests(unittest.TestCase):
    def test_preserves_identifiers_dates_unicode_and_status(self):
        data=payload();self.assertEqual(data['metadata']['active_count'],1);self.assertEqual(data['metadata']['cancelled_count'],1)
        self.assertEqual(data['records'][0]['ans_code'],'000001');self.assertEqual(data['records'][1]['cancelled_on'],'2025-01-01')
        self.assertEqual(data['metadata']['records_sha256'],prep.digest(data['records']))

    def test_never_copies_representative_cnpj_or_private_email(self):
        raw=row();raw.update(REPRESENTANTE='Do not copy',CNPJ='12345678900000',ENDERECO_ELETRONICO='person@example.test')
        result=prep.parse(encoded([raw]),'active','2026-11-24')[0]
        self.assertNotIn('Do not copy',json.dumps(result));self.assertNotIn('person@example.test',json.dumps(result));self.assertNotIn('CNPJ',result)

    def test_duplicate_conflicting_sources_and_empty_files_fail(self):
        with self.assertRaises(ValueError):prep.parse(encoded([row(),row()]),'active','2026-11-24')
        with self.assertRaises(ValueError):prep.prepare(encoded([row()]),encoded([row('000001',True)]),'2026-11-24','2026-11-24')
        with self.assertRaises(ValueError):prep.parse(encoded([],list(prep.REQUIRED)),'active','2026-11-24')

    def test_changed_header_and_invalid_encoding_fail(self):
        with self.assertRaises(ValueError):prep.parse(b'code;name\n000001;Unknown','active','2026-11-24')
        with self.assertRaises(UnicodeDecodeError):prep.parse(b'\xff','active','2026-11-24')

    def test_download_retries_transient_reads_and_preserves_last_modified_date(self):
        response=io.BytesIO(b'content');response.headers={'Content-Length':'7','Last-Modified':'Tue, 24 Nov 2026 10:00:06 GMT'}
        with patch.object(prep.urllib.request,'urlopen',side_effect=[TimeoutError(),response]) as call,patch.object(prep.time,'sleep'):
            raw,reference=prep.download('active')
        self.assertEqual(raw,b'content');self.assertEqual(reference,'2026-11-24');self.assertEqual(call.call_count,2)

    def test_download_refuses_missing_reference_or_truncated_content(self):
        for headers in [{'Content-Length':'7'},{'Content-Length':'8','Last-Modified':'Tue, 24 Nov 2026 10:00:06 GMT'}]:
            response=io.BytesIO(b'content');response.headers=headers
            with patch.object(prep.urllib.request,'urlopen',return_value=response),self.assertRaises(ValueError):prep.download('active')

    def test_invalid_identity_date_state_and_cancel_chronology_fail(self):
        for change in [dict(REGISTRO_OPERADORA='123'),dict(UF='XX'),dict(DATA_REGISTRO_ANS='2020-02-30'),dict(DATA_REGISTRO_ANS='2030-01-01')]:
            invalid={**row(),**change}
            with self.subTest(change=change),self.assertRaises(ValueError):prep.parse(encoded([invalid]),'active','2026-11-24')
        invalid=row('000002',True);invalid['DATA_DESCREDENCIAMENTO']='2019-01-01'
        with self.assertRaises(ValueError):prep.parse(encoded([invalid]),'cancelled','2026-11-24')


class Response(io.BytesIO):
    status=200
    def __init__(self,data):super().__init__(json.dumps(data).encode())


class Opener:
    def __init__(self,values):self.values=iter(values);self.requests=[]
    def open(self,request,timeout):
        self.requests.append(request);value=next(self.values)
        if isinstance(value,Exception):raise value
        return Response(value)


class PublicationTests(unittest.TestCase):
    def test_publish_uses_baseline_and_verifies_snapshot_hash(self):
        data=payload();meta=data['metadata'];opener=Opener([{'snapshot':None},{'status':'completed','snapshot_id':'s1','record_count':2,'changes':{'added':2}},
            {'snapshot':dict(id='s1',record_count=2,**meta)}])
        receipt=publisher.publish(data,'test-only',opener)
        self.assertEqual(receipt['records_verified'],2)
        self.assertEqual(json.loads(opener.requests[1].data)['expected_snapshot_id'],None)
        self.assertTrue(all(r.get_header('Authorization')=='Bearer test-only' for r in opener.requests))
        self.assertEqual([r.get_method() for r in opener.requests],['GET','POST','GET'])

    def test_tampering_and_missing_token_never_publish(self):
        data=payload();data['records'][0]['name']='tampered';opener=Opener([])
        with self.assertRaises(PublicationError):publisher.publish(data,'test-only',opener)
        with self.assertRaises(PublicationError):publisher.preflight('',opener)
        self.assertEqual(opener.requests,[])

    def test_http_failure_and_post_verification_failure_do_not_repeat(self):
        data=payload();opener=Opener([{'snapshot':None},urllib.error.HTTPError('https://example.test',409,'conflict',{},None)])
        with self.assertRaises(urllib.error.HTTPError):publisher.publish(data,'test-only',opener)
        self.assertEqual(len(opener.requests),2)
        opener=Opener([{'snapshot':None},{'status':'completed','snapshot_id':'s1'}, {'snapshot':None}])
        with self.assertRaises(PublicationError):publisher.publish(data,'test-only',opener)
        self.assertEqual(len(opener.requests),3)

    def test_decline_or_older_source_is_blocked_before_post(self):
        data=payload()
        for previous in [dict(id='old',record_count=100,active_count=50,cancelled_count=50,active_source_date='2026-11-24',cancelled_source_date='2026-11-24'),
                         dict(id='old',record_count=2,active_count=1,cancelled_count=1,active_source_date='2026-11-25',cancelled_source_date='2026-11-25')]:
            opener=Opener([{'snapshot':previous}])
            with self.assertRaises(PublicationError):publisher.publish(data,'test-only',opener)
            self.assertEqual(len(opener.requests),1)


if __name__=='__main__':unittest.main()
