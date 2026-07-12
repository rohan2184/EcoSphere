"""
Rewards & Redemption service — listing rewards and point-based redemptions.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.gamification import Reward, RewardRedemption
from app.services.notifications import create_notification


def list_rewards(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    include_out_of_stock: bool = False,
) -> list[Reward]:
    """
    Return available rewards.

    By default only rewards with stock > 0 are returned.
    Pass include_out_of_stock=True to include zero-stock rewards.
    Optionally filter by status string.
    """
    query = db.query(Reward)
    if status_filter is not None:
        query = query.filter(Reward.status == status_filter)
    if not include_out_of_stock:
        query = query.filter(Reward.stock > 0)
    return query.all()


def redeem_reward(
    db: Session,
    user_id: int,
    reward_id: int,
    settings: object = None,
) -> RewardRedemption:
    """
    Redeem a reward for the current user using their points balance.

    Business rules:
      • Reward must exist and have stock > 0.
      • User must have sufficient points_balance.
      • Decrements reward.stock and user.points_balance atomically.
      • Creates a RewardRedemption row and a Notification.

    IMPORTANT: Re-fetches the reward inside this function to minimise the
    race window between the stock/balance checks and the decrements.
    """
    # Re-fetch reward to get the freshest stock value
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if reward is None:
        raise ValueError("Reward not found")
    if (reward.stock or 0) <= 0:
        raise ValueError("Reward out of stock")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ValueError("User not found")
    if (user.points_balance or 0) < reward.points_required:
        raise ValueError("Insufficient points")

    # ── Decrement stock and balance as close together as possible ─────────
    reward.stock -= 1
    user.points_balance -= reward.points_required

    redemption = RewardRedemption(
        user_id=user_id,
        reward_id=reward_id,
        points_spent=reward.points_required,
    )
    db.add(redemption)

    create_notification(
        db,
        user_id=user_id,
        type="reward_redeemed",
        title=f"Reward redeemed: {reward.name}",
        message=(
            f"You redeemed \"{reward.name}\" for {reward.points_required} points. "
            f"Remaining balance: {user.points_balance} points."
        ),
        settings=settings,
    )

    db.commit()
    db.refresh(redemption)
    return redemption
