"""
Schemas for Social and Gamification reporting.
"""

from typing import List
from pydantic import BaseModel


class CSRActivityBreakdown(BaseModel):
    activity_title: str
    participant_count: int
    approval_rate: float

    model_config = {"from_attributes": True}


class DiversitySummaryOut(BaseModel):
    departments_reported: int
    average_training_completion_pct: float
    average_gender_ratio: float

    model_config = {"from_attributes": True}


class SocialReportOut(BaseModel):
    total_csr_activities: int
    total_participations: int
    approved_participations: int
    pending_participations: int
    rejected_participations: int
    total_points_awarded: int
    participation_rate: float
    activities: List[CSRActivityBreakdown]
    diversity_summary: DiversitySummaryOut

    model_config = {"from_attributes": True}


class ChallengeBreakdown(BaseModel):
    title: str
    participant_count: int
    completion_rate: float
    avg_progress: float

    model_config = {"from_attributes": True}


class GamificationReportOut(BaseModel):
    total_challenges: int
    active_challenges: int
    completed_challenges: int
    total_participations: int
    total_xp_awarded: int
    total_badges_unlocked: int
    total_rewards_redeemed: int
    total_points_spent_on_rewards: int
    challenges: List[ChallengeBreakdown]

    model_config = {"from_attributes": True}
