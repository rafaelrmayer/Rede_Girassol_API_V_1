import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from prepare_rapidapi import prepare
ROOT=Path(__file__).resolve().parents[1]
class RapidSpecTests(unittest.TestCase):
    def test_distribution_matches_canonical_spec_without_pending_ans(self):
        canonical=json.loads((ROOT/'openapi.json').read_text())
        prepared=prepare(canonical)
        self.assertEqual(prepared,json.loads((ROOT/'rapidapi.openapi.json').read_text()))
        self.assertEqual(len(prepared['paths']),8)
        self.assertIn('/v1/operators',prepared['paths'])
        self.assertNotIn('/v1/plans',prepared['paths'])
        self.assertTrue(all(set(item)=={'get'} and not path.startswith('/admin/') for path,item in prepared['paths'].items()))
        self.assertIn('Operator',prepared['components']['schemas'])
        self.assertIn('/v1/operators',canonical['paths'])
if __name__=='__main__':unittest.main()
