"""
Tests for rewards redemption logic in app.services.rewards.
"""

import pytest

from app.models.gamification import RewardRedemption
from app.services.rewards import redeem_reward
from tests.conftest import FakeSettings, make_reward, make_user


class TestRewardsRedemption:
    """Points-based reward redemptions."""

    def test_redeem_success_decrements_stock_and_points(self, db):
        """Redeeming creates row, lowers stock by 1, lowers user points."""
        user = make_user(db, points_balance=500)
        reward = make_reward(db, points_required=200, stock=5)
        settings = FakeSettings()

        redemption = redeem_reward(db, user.id, reward.id, settings)

        assert redemption.points_spent == 200
        assert db.query(RewardRedemption).count() == 1
        
        # DB session needs a refresh for these objects, but we can check via query
        # or directly since they are attached to the session.
        db.refresh(user)
        db.refresh(reward)
        assert user.points_balance == 300
        assert reward.stock == 4

    def test_redeem_out_of_stock_raises(self, db):
        """Stock == 0 → ValueError."""
        user = make_user(db, points_balance=500)
        reward = make_reward(db, points_required=200, stock=0)
        settings = FakeSettings()

        with pytest.raises(ValueError, match="out of stock"):
            redeem_reward(db, user.id, reward.id, settings)

    def test_redeem_insufficient_points_raises(self, db):
        """Points balance < points_required → ValueError."""
        user = make_user(db, points_balance=100)
        reward = make_reward(db, points_required=200, stock=5)
        settings = FakeSettings()

        with pytest.raises(ValueError, match="Insufficient points"):
            redeem_reward(db, user.id, reward.id, settings)

    def test_sequential_redemption_stock_exhaustion(self, db):
        """Two redemptions on stock=1: first works, second fails."""
        user = make_user(db, points_balance=1000)
        reward = make_reward(db, points_required=100, stock=1)
        settings = FakeSettings()

        # First one works
        redeem_reward(db, user.id, reward.id, settings)
        
        # Second one fails
        with pytest.raises(ValueError, match="out of stock"):
            redeem_reward(db, user.id, reward.id, settings)
