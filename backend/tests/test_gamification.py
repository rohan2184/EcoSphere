"""
Tests for Challenge lifecycle and participation logic
in app.services.gamification.
"""

import pytest

from app.services.gamification import (
    VALID_TRANSITIONS,
    approve_challenge_participation,
    submit_challenge_participation,
    transition_challenge_status,
)
from tests.conftest import FakeSettings, make_challenge, make_user


# ── Challenge lifecycle status transitions ───────────────────────────────────

class TestChallengeStatusTransitions:
    """Every valid transition succeeds; invalid ones raise ValueError."""

    @pytest.mark.parametrize(
        "from_status,to_status",
        [
            (from_s, to_s)
            for from_s, targets in VALID_TRANSITIONS.items()
            for to_s in targets
        ],
    )
    def test_valid_transition_succeeds(self, db, from_status, to_status):
        """Each edge in VALID_TRANSITIONS should transition cleanly."""
        ch = make_challenge(db, status=from_status)
        result = transition_challenge_status(db, ch.id, to_status)
        current = result.status
        actual = current.value if hasattr(current, "value") else str(current)
        assert actual == to_status

    def test_draft_to_completed_is_invalid(self, db):
        ch = make_challenge(db, status="draft")
        with pytest.raises(ValueError):
            transition_challenge_status(db, ch.id, "completed")

    def test_archived_to_active_is_invalid(self, db):
        ch = make_challenge(db, status="archived")
        with pytest.raises(ValueError):
            transition_challenge_status(db, ch.id, "active")

    def test_completed_to_draft_is_invalid(self, db):
        ch = make_challenge(db, status="completed")
        with pytest.raises(ValueError):
            transition_challenge_status(db, ch.id, "draft")


# ── Challenge Participation ──────────────────────────────────────────────────

class TestChallengeParticipation:
    """Joining and approving challenge participations."""

    def test_submit_participation_when_not_active_raises(self, db):
        """Can only join a challenge whose status is 'active'."""
        user = make_user(db)
        ch = make_challenge(db, status="draft")

        with pytest.raises(ValueError, match="not active"):
            submit_challenge_participation(db, user.id, ch.id)

    def test_approve_with_evidence_required_and_no_proof_raises(self, db):
        """evidence_required=True + no proof → ValueError on approval."""
        user = make_user(db)
        ch = make_challenge(db, xp=300, evidence_required=True)
        part = submit_challenge_participation(db, user.id, ch.id, proof_file=None)

        settings = FakeSettings(evidence_required=False)  # per-challenge flag is True
        with pytest.raises(ValueError, match="Proof file required"):
            approve_challenge_participation(db, part.id, "approved", settings)

    def test_approve_sets_xp_awarded(self, db):
        """Approved participation should set xp_awarded = challenge.xp."""
        user = make_user(db)
        ch = make_challenge(db, xp=500)
        part = submit_challenge_participation(
            db, user.id, ch.id, proof_file="/proof.pdf"
        )

        settings = FakeSettings(evidence_required=False)
        result = approve_challenge_participation(db, part.id, "approved", settings)

        assert result.approval_status.value == "approved"
        assert result.xp_awarded == 500

    def test_reject_leaves_xp_at_zero(self, db):
        """Rejected participation should keep xp_awarded at 0."""
        user = make_user(db)
        ch = make_challenge(db, xp=500)
        part = submit_challenge_participation(db, user.id, ch.id)

        settings = FakeSettings()
        result = approve_challenge_participation(db, part.id, "rejected", settings)

        assert result.approval_status.value == "rejected"
        assert result.xp_awarded == 0
