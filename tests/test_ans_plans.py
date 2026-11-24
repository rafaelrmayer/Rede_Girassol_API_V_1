import csv
import io
import json
from pathlib import Path
import sys
import unittest
import urllib.error
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare_ans_plans as prep
import publish_ans_plans as publisher
from prepare_ans_operators import digest
from publish_cnes_sample import PublicationError
from test_ans_operators import Opener


def row(plan_id='10000001'):
    return dict(ID_PLANO=plan_id,CD_PLANO='SCPA-001',NM_PLANO='Plano fictício',REGISTRO_OPERADORA='000001',SITUACAO_PLANO='Ativo',CONTRATACAO='Individual ou familiar',SGMT_ASSISTENCIAL='Referência',ABRANGENCIA_COBERTURA='Nacional',ACOMODACAO_HOSPITALAR='Individual',FATOR_MODERADOR='Ausente',DT_REGISTRO_PLANO='',DT_SITUACAO='2020-01-01',DT_ATUALIZACAO='2026-11-24')


def raw(rows):
    out=io.StringIO();writer=csv.DictWriter(out,fieldnames=list(row()),delimiter=';');writer.writeheader();writer.writerows(rows)
    return out.getvalue().encode('utf-8-sig')


def package(rows=None):return prep.prepare(raw(rows or [row()]),'2026-11-24')


def snapshot(p):return dict(id=p['snapshot_id'],**{k:p['manifest'][k] for k in ['record_count','source_date','file_sha256']})


def public(p):return dict(total=p['manifest']['record_count'],results=[dict(snapshot_id=p['snapshot_id'])])


class PlanPreparationTests(unittest.TestCase):
    def test_identity_is_id_plano_not_repeated_scpa_code_and_all_statuses_are_preserved(self):
        rows=[{**row(str(10000000+i)), 'SITUACAO_PLANO':s} for i,s in enumerate(prep.STATUS)]
        p=package(rows);self.assertEqual(p['manifest']['record_count'],4)
        self.assertEqual([r['status'] for r in p['chunks'][0]],list(prep.STATUS.values()))
        self.assertTrue(all(r['ans_code']=='000001' and r['registration_code']=='SCPA-001' and r['registered_on'] is None for r in p['chunks'][0]))
        self.assertEqual(p['snapshot_id'],digest(p['manifest']))

    def test_control_characters_are_removed_from_display_name_without_dropping_rows(self):
        p=package([{**row(),'NM_PLANO':'Plano\x1f+\t'}]);self.assertEqual(p['chunks'][0][0]['name'],'Plano +')

    def test_changed_header_duplicates_missing_dates_and_unknown_status_fail_closed(self):
        with self.assertRaises(ValueError):prep.prepare(b'id;name\n1;wrong','2026-11-24')
        with self.assertRaises(ValueError):package([row(),row()])
        with self.assertRaises(ValueError):prep.prepare(raw([]),'2026-11-24')
        for change in [dict(SITUACAO_PLANO='Outro'),dict(ID_PLANO='0001'),dict(DT_SITUACAO='2026-02-30'),dict(DT_ATUALIZACAO='2026-11-25'),dict(REGISTRO_OPERADORA='A12345')]:
            with self.subTest(change=change),self.assertRaises(ValueError):package([{**row(),**change}])

    def test_different_source_dates_and_truncated_rows_fail(self):
        with self.assertRaises(ValueError):package([row(),{**row('10000002'),'DT_ATUALIZACAO':'2026-11-23'}])
        with self.assertRaises(ValueError):prep.prepare(raw([row()]).rsplit(b';',1)[0],'2026-11-24')

    def test_parts_are_bounded_and_independently_hashed(self):
        p=package([row(str(10000000+i)) for i in range(251)])
        self.assertEqual([len(c) for c in p['chunks']],[250,1])
        self.assertEqual(p['manifest']['chunks'][0]['sha256'],digest(p['chunks'][0]))
        publisher.validate(p)


class PlanPublicationTests(unittest.TestCase):
    def test_resumes_received_parts_then_verifies_commit_and_public_catalog(self):
        p=package([row(str(10000000+i)) for i in range(251)])
        seen=dict(chunk_index=0,**p['manifest']['chunks'][0])
        opener=Opener([{'snapshot':None},dict(status='staging',snapshot_id=p['snapshot_id'],received=[seen]),dict(status='received',chunk_index=1),dict(status='completed',snapshot_id=p['snapshot_id']),{'snapshot':snapshot(p)},public(p)])
        result=publisher.publish(p,'test-only',opener)
        self.assertEqual(result['records_verified'],251)
        self.assertEqual([r.get_method() for r in opener.requests],['GET','POST','POST','POST','GET','GET'])
        self.assertEqual(json.loads(opener.requests[2].data)['chunk_index'],1)

    def test_unchanged_catalog_does_not_upload_or_commit_again(self):
        p=package();opener=Opener([{'snapshot':snapshot(p)},dict(status='unchanged',snapshot_id=p['snapshot_id']),{'snapshot':snapshot(p)},public(p)])
        self.assertEqual(publisher.publish(p,'test-only',opener)['status'],'unchanged')
        self.assertEqual(sum(r.get_method()=='POST' for r in opener.requests),1)

    def test_tampering_and_cross_part_duplicates_never_reach_remote(self):
        p=package();p['chunks'][0][0]['name']='tampered';opener=Opener([])
        with self.assertRaises(PublicationError):publisher.publish(p,'test-only',opener)
        self.assertEqual(opener.requests,[])
        p=package();p['chunks']*=2;p['manifest']['chunks']*=2;p['manifest']['record_count']=2;p['snapshot_id']=digest(p['manifest'])
        with self.assertRaises(PublicationError):publisher.validate(p)

    def test_quota_or_timeout_stops_without_repeating_post(self):
        p=package();opener=Opener([{'snapshot':None},dict(status='staging',snapshot_id=p['snapshot_id'],received=[]),urllib.error.HTTPError('https://test.invalid',429,'budget',{},None)])
        with self.assertRaises(urllib.error.HTTPError):publisher.publish(p,'test-only',opener)
        self.assertEqual(len(opener.requests),3)

    def test_final_public_read_must_match_the_completed_snapshot(self):
        p=package();opener=Opener([{'snapshot':None},dict(status='staging',snapshot_id=p['snapshot_id'],received=[]),dict(status='received',chunk_index=0),dict(status='completed',snapshot_id=p['snapshot_id']),{'snapshot':snapshot(p)},dict(total=0,results=[])])
        with self.assertRaises(PublicationError):publisher.publish(p,'test-only',opener)
        self.assertEqual(len(opener.requests),6)


if __name__=='__main__':unittest.main()
