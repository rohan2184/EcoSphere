"""
Tests for badge auto-award rules in app.services.badges.
"""

import pytest

from app.models.gamification import UserBadge, Notification
from app.services.badges import check_badge_unlocks
from app.services.gamification import submit_challenge_participation, approve_challenge_participation
from tests.conftest import FakeSettings, make_badge, make_challenge, make_user


class TestBadgeAutoAward:
    """Badge unlocks driven by XP and challenges completed."""

    def test_xp_threshold_not_met_does_not_unlock(self, db):
        """User below threshold → no unlock, no UserBadge, no Notification."""
        user = make_user(db, xp_balance=50)
        make_badge(db, rule_type="xp", threshold=100)

        settings = FakeSettings(badge_auto_award=True)
        new_badges = check_badge_unlocks(db, user.id, settings)

        assert len(new_badges) == 0
        assert db.query(UserBadge).filter_by(user_id=user.id).count() == 0
        assert db.query(Notification).filter_by(user_id=user.id).count() == 0

    def test_xp_threshold_met_unlocks_badge(self, db):
        """User at threshold → unlocked, UserBadge created, Notification created."""
        user = make_user(db, xp_balance=100)
        badge = make_badge(db, rule_type="xp", threshold=100)

        settings = FakeSettings(badge_auto_award=True)
        new_badges = check_badge_unlocks(db, user.id, settings)

        assert len(new_badges) == 1
        assert new_badges[0].id == badge.id
        assert db.query(UserBadge).filter_by(user_id=user.id, badge_id=badge.id).count() == 1
        assert db.query(Notification).filter_by(user_id=user.id, type="badge_unlocked").count() == 1

    def test_duplicate_unlock_prevented(self, db):
        """Second check doesn't re-award the same badge."""
        user = make_user(db, xp_balance=200)
        make_badge(db, rule_type="xp", threshold=100)
        settings = FakeSettings(badge_auto_award=True)

        # First pass
        first_badges = check_badge_unlocks(db, user.id, settings)
        assert len(first_badges) == 1
        
        # Second pass
        second_badges = check_badge_unlocks(db, user.id, settings)
        assert len(second_badges) == 0

    def test_auto_award_disabled_in_settings(self, db):
        """If settings.badge_auto_award=False, nothing happens even if eligible."""
        user = make_user(db, xp_balance=500)
        make_badge(db, rule_type="xp", threshold=100)

        settings = FakeSettings(badge_auto_award=False)
        new_badges = check_badge_unlocks(db, user.id, settings)

        assert len(new_badges) == 0
        assert db.query(UserBadge).count() == 0

    def test_challenges_completed_rule(self, db):
        """challenges_completed unlocks based on approved participations, not XP."""
        user = make_user(db, xp_balance=0)  # zero XP
        badge = make_badge(db, rule_type="challenges_completed", threshold=1)
        ch = make_challenge(db, xp=0)
        
        # Join and approve
        part = submit_challenge_participation(db, user.id, ch.id)
        settings = FakeSettings(badge_auto_award=True)
        
        # We manually trigger check_badge_unlocks here as we want to assert its return,
        # but approve_challenge_participation also triggers it internally. We'll check the DB.
        approve_challenge_participation(db, part.id, "approved", settings)
        
        # Check DB directly since it was triggered internally
        assert db.query(UserBadge).filter_by(user_id=user.id, badge_id=badge.id).count() == 1
