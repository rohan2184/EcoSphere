"""
Tests for CSR / evidence rule logic in app.services.social.
"""

import pytest

from app.services.social import approve_participation, submit_participation
from tests.conftest import FakeSettings, make_csr_activity, make_user


class TestApproveParticipation_EvidenceRules:
    """CSR participation approval — evidence_required behaviour."""

    def test_approve_with_evidence_required_but_no_proof_raises(self, db):
        """evidence_required=True + no proof_file → ValueError."""
        user = make_user(db)
        activity = make_csr_activity(db, points_value=150)
        part = submit_participation(db, user.id, activity.id, proof_file=None)

        settings = FakeSettings(evidence_required=True)

        with pytest.raises(ValueError, match="Proof file required"):
            approve_participation(db, part.id, "approved", settings)

    def test_approve_with_evidence_required_and_proof_succeeds(self, db):
        """evidence_required=True + proof_file present → approved, points set."""
        user = make_user(db)
        activity = make_csr_activity(db, points_value=150)
        part = submit_participation(
            db, user.id, activity.id, proof_file="/uploads/proof.pdf"
        )

        settings = FakeSettings(evidence_required=True)
        result = approve_participation(db, part.id, "approved", settings)

        assert result.approval_status.value == "approved"
        assert result.points_earned == 150

    def test_approve_without_evidence_required_succeeds_without_proof(self, db):
        """evidence_required=False → approval works even without proof_file."""
        user = make_user(db)
        activity = make_csr_activity(db, points_value=75)
        part = submit_participation(db, user.id, activity.id, proof_file=None)

        settings = FakeSettings(evidence_required=False)
        result = approve_participation(db, part.id, "approved", settings)

        assert result.approval_status.value == "approved"
        assert result.points_earned == 75

    def test_reject_never_sets_points_earned(self, db):
        """Rejecting a participation always leaves points_earned at 0."""
        user = make_user(db)
        activity = make_csr_activity(db, points_value=200)
        part = submit_participation(
            db, user.id, activity.id, proof_file="/uploads/proof.pdf"
        )

        # Try with both evidence settings — rejection should never award points
        for evidence_flag in (True, False):
            settings = FakeSettings(evidence_required=evidence_flag)
            result = approve_participation(db, part.id, "rejected", settings)

            assert result.approval_status.value == "rejected"
            assert result.points_earned == 0
