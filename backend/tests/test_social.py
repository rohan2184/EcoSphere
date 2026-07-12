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


from app.schemas.social import DiversityMetricCreate, DiversityMetricUpdate
from app.services.social import (
    create_diversity_metric, list_diversity_metrics, update_diversity_metric
)
from app.models.core import Department

class TestDiversityMetrics:
    def test_create_and_duplicate_raises(self, db):
        dept = Department(name="Test Dept", code="TEST01")
        db.add(dept)
        db.commit()
        db.refresh(dept)
        
        data = DiversityMetricCreate(department_id=dept.id, period="2026-Q1", gender_ratio=45.0, avg_training_hours=12.5, training_completion_pct=90.0)
        metric = create_diversity_metric(db, data)
        assert metric.id is not None
        assert metric.period == "2026-Q1"
        
        with pytest.raises(ValueError, match="already exists"):
            create_diversity_metric(db, data)
            
    def test_update_and_list_filtering(self, db):
        dept1 = Department(name="Dept A", code="DEPTA")
        dept2 = Department(name="Dept B", code="DEPTB")
        db.add_all([dept1, dept2])
        db.commit()
        db.refresh(dept1)
        db.refresh(dept2)
        
        create_diversity_metric(db, DiversityMetricCreate(department_id=dept1.id, period="2026-Q1", gender_ratio=50.0))
        m2 = create_diversity_metric(db, DiversityMetricCreate(department_id=dept2.id, period="2026-Q1", gender_ratio=60.0))
        create_diversity_metric(db, DiversityMetricCreate(department_id=dept2.id, period="2026-Q2", gender_ratio=65.0))
        
        metrics = list_diversity_metrics(db, department_id=dept2.id)
        assert len(metrics) == 2
        
        metrics = list_diversity_metrics(db, period="2026-Q1")
        assert len(metrics) == 2
        
        metrics = list_diversity_metrics(db, department_id=dept2.id, period="2026-Q1")
        assert len(metrics) == 1
        
        updated = update_diversity_metric(db, m2.id, DiversityMetricUpdate(gender_ratio=55.0))
        assert updated.gender_ratio == 55.0
