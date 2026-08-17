#!/usr/bin/env python3
"""Tests for keys_manager.py Merlin compliance (ISSUE-1122)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from keys_manager import KeysManager  # noqa: E402


class MerlinComplianceTest(unittest.TestCase):
    """Merlin readiness must be evidence-based and fail closed."""

    def setUp(self):
        self.manager = KeysManager()

    def _full_evidence(self):
        return {
            'master_owner_confirmed': True,
            'territory_confirmed': True,
            'no_existing_admin_obligations': True,
            'no_samples_or_loops': True,
            'content_policy_clean': True,
            'no_takedown_or_claim_conflicts': True,
            'supporting_documents_uploaded': True,
        }

    def test_missing_exclusive_rights_defaults_to_not_ready(self):
        """A catalog with no exclusive_rights field must NOT be READY."""
        report = self.manager.check_merlin_compliance({
            'total_tracks': 100,
            'has_isrcs': True,
            'has_upcs': True,
            # exclusive_rights intentionally absent — must not default to True
            'rights_evidence': self._full_evidence(),
        })
        self.assertEqual(report['status'], 'NOT_READY')
        self.assertIn('Exclusive rights NOT verified (no explicit proof)', report['checks'])
        self.assertNotIn('Exclusive rights confirmed', ' '.join(report['checks']))

    def test_explicit_true_without_evidence_is_not_ready(self):
        """exclusive_rights=true with missing evidence items must NOT be READY."""
        report = self.manager.check_merlin_compliance({
            'total_tracks': 100,
            'has_isrcs': True,
            'has_upcs': True,
            'exclusive_rights': True,
            'rights_evidence': {
                'master_owner_confirmed': True,
                # all other evidence items missing
            },
        })
        self.assertEqual(report['status'], 'NOT_READY')
        # master_owner_confirmed was provided; every other item is missing
        self.assertNotIn('master_owner_confirmed', ' '.join(report['missing_rights_evidence']))
        self.assertIn('territory_confirmed', ' '.join(report['missing_rights_evidence']))
        self.assertIn('no_samples_or_loops', ' '.join(report['missing_rights_evidence']))
        # No points for an unproven rights claim
        self.assertLess(report['score'], 100)

    def test_explicit_true_with_full_evidence_is_ready(self):
        """Only explicit exclusive_rights=true AND complete evidence can be READY."""
        report = self.manager.check_merlin_compliance({
            'total_tracks': 100,
            'has_isrcs': True,
            'has_upcs': True,
            'exclusive_rights': True,
            'rights_evidence': self._full_evidence(),
        })
        self.assertEqual(report['status'], 'READY')
        self.assertEqual(report['missing_rights_evidence'], [])
        self.assertTrue(any('Exclusive rights confirmed' in c for c in report['checks']))

    def test_failed_checks_list_every_missing_proof_item(self):
        """Acceptance: catalog with no rights evidence lists every missing item."""
        report = self.manager.check_merlin_compliance({
            'total_tracks': 10,
            'has_isrcs': False,
            'has_upcs': False,
            'rights_evidence': {},
        })
        self.assertEqual(report['status'], 'NOT_READY')
        missing = ' '.join(report['failed_checks'])
        for key in [
            'master_owner_confirmed',
            'territory_confirmed',
            'no_existing_admin_obligations',
            'no_samples_or_loops',
            'content_policy_clean',
            'no_takedown_or_claim_conflicts',
            'supporting_documents_uploaded',
        ]:
            self.assertIn(key, missing, f'missing proof item {key} not listed')

    def test_empty_catalog_never_readily_passes(self):
        """An empty track list must not vacuous-true its way to exclusive rights."""
        report = self.manager.check_merlin_compliance({
            'total_tracks': 0,
            'has_isrcs': False,
            'has_upcs': False,
            'exclusive_rights': False,
        })
        self.assertEqual(report['status'], 'NOT_READY')


if __name__ == '__main__':
    unittest.main()
