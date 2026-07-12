"""
Standalone seed script for the EcoSphere Social + Gamification module.

Can be run standalone: python -m app.seed_social_gamification
Or imported and called by the team's main seed.py.
"""

from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.core import Category
from app.models.social import CSRActivity, EmployeeParticipation, ApprovalStatus
from app.models.gamification import Challenge, ChallengeParticipation, Badge, Reward, ChallengeStatus
from app.services.badges import check_badge_unlocks
from app.core.deps import get_settings_stub

try:
    from app.models.auth import User
    CORE_MODELS_AVAILABLE = True
except ImportError:
    CORE_MODELS_AVAILABLE = False


def seed_social_and_gamification(db: Session):
    """
    Creates master data (categories, activities, challenges, badges, rewards).
    If User models are available, also creates fake users and participations
    to populate leaderboards and test auto-awarding of badges.
    """
    # ── Check if already seeded ───────────────────────────────────────────
    existing = db.query(CSRActivity).first()
    if existing:
        print("Social/Gamification module already seeded, skipping.")
        return

    stats = {
        "Categories": 0,
        "CSRActivities": 0,
        "Challenges": 0,
        "Badges": 0,
        "Rewards": 0,
        "Users": 0,
        "EmployeeParticipations": 0,
        "ChallengeParticipations": 0,
    }

    print("Seeding Social & Gamification module...")

    # ── 1. Categories ────────────────────────────────────────────────────
    csr_cats = ["Environment", "Community", "Wellness"]
    challenge_cats = ["Energy Saving", "Waste Reduction", "Team Wellness"]
    
    category_objs = {}
    for name in csr_cats:
        c = Category(name=name, type="csr_activity")
        db.add(c)
        category_objs[name] = c
        stats["Categories"] += 1

    for name in challenge_cats:
        c = Category(name=name, type="challenge")
        db.add(c)
        category_objs[name] = c
        stats["Categories"] += 1
        
    db.flush()

    # ── 2. CSR Activities ────────────────────────────────────────────────
    csr_activities_data = [
        {"title": "Beach Cleanup", "category": "Environment", "points_value": 150, "status": "active"},
        {"title": "Soup Kitchen Volunteer", "category": "Community", "points_value": 100, "status": "active"},
        {"title": "Tree Planting Drive", "category": "Environment", "points_value": 200, "status": "draft"},
        {"title": "Mental Health Seminar", "category": "Wellness", "points_value": 50, "status": "active"},
        {"title": "Local School Tutoring", "category": "Community", "points_value": 120, "status": "archived"},
    ]
    
    csr_objs = []
    for data in csr_activities_data:
        c = CSRActivity(
            title=data["title"],
            category_id=category_objs[data["category"]].id,
            description=f"Participate in the {data['title']}.",
            date=date.today() + timedelta(days=7),
            location="City Center",
            points_value=data["points_value"],
            status=data["status"],
        )
        db.add(c)
        csr_objs.append(c)
        stats["CSRActivities"] += 1

    # ── 3. Challenges ────────────────────────────────────────────────────
    challenges_data = [
        {"title": "Zero Waste Week", "category": "Waste Reduction", "xp": 300, "diff": "medium", "status": "active"},
        {"title": "Bike to Work Month", "category": "Team Wellness", "xp": 500, "diff": "hard", "status": "active"},
        {"title": "Turn Off Monitors", "category": "Energy Saving", "xp": 100, "diff": "easy", "status": "active"},
        {"title": "Recycling Champion", "category": "Waste Reduction", "xp": 250, "diff": "medium", "status": "draft"},
        {"title": "Meatless Mondays", "category": "Team Wellness", "xp": 150, "diff": "easy", "status": "under_review"},
        {"title": "Unplug Appliances", "category": "Energy Saving", "xp": 200, "diff": "medium", "status": "completed"},
    ]
    
    challenge_objs = []
    for data in challenges_data:
        c = Challenge(
            title=data["title"],
            category_id=category_objs[data["category"]].id,
            description=f"Complete the {data['title']} challenge.",
            xp=data["xp"],
            difficulty=data["diff"],
            evidence_required=True,
            deadline=date.today() + timedelta(days=30),
            status=data["status"],
        )
        db.add(c)
        challenge_objs.append(c)
        stats["Challenges"] += 1

    # ── 4. Badges ────────────────────────────────────────────────────────
    badges_data = [
        {"name": "Eco Starter", "rule": {"type": "xp", "threshold": 100}, "icon": "🌱"},
        {"name": "Eco Warrior", "rule": {"type": "xp", "threshold": 500}, "icon": "⚔️"},
        {"name": "First Challenge", "rule": {"type": "challenges_completed", "threshold": 1}, "icon": "🏅"},
        {"name": "Challenge Master", "rule": {"type": "challenges_completed", "threshold": 5}, "icon": "👑"},
        {"name": "Earth Savior", "rule": {"type": "xp", "threshold": 1000}, "icon": "🌍"}, # Nothing hits this yet
    ]
    for data in badges_data:
        b = Badge(
            name=data["name"],
            description=f"Earned by reaching {data['rule']['threshold']} {data['rule']['type']}.",
            unlock_rule=data["rule"],
            icon=data["icon"],
        )
        db.add(b)
        stats["Badges"] += 1

    # ── 5. Rewards ───────────────────────────────────────────────────────
    rewards_data = [
        {"name": "$10 Coffee Shop Gift Card", "points": 100, "stock": 50},
        {"name": "Company Swag Bag", "points": 250, "stock": 10},
        {"name": "Extra PTO Day", "points": 500, "stock": 2},
        {"name": "VIP Parking Spot", "points": 300, "stock": 0}, # Out of stock to test UI
    ]
    for data in rewards_data:
        r = Reward(
            name=data["name"],
            description=f"Redeem for {data['points']} points.",
            points_required=data["points"],
            stock=data["stock"],
            status="active"
        )
        db.add(r)
        stats["Rewards"] += 1
        
    db.flush()

    # ── 6. Users & Participations (if available) ─────────────────────────
    if not CORE_MODELS_AVAILABLE:
        print(
            "\n[WARNING] Could not connect to DB or User model not found — this seed script "
            "needs Person A's User model + DB connection to run. Safe to ignore for now, "
            "will run once merged."
        )
    else:
        # Create fake users
        users_data = [
            {"name": "Alice Eco", "email": "alice@example.com", "xp": 450, "points": 150},
            {"name": "Bob Green", "email": "bob@example.com", "xp": 120, "points": 50},
            {"name": "Charlie Clean", "email": "charlie@example.com", "xp": 0, "points": 0},
            {"name": "Diana Sustain", "email": "diana@example.com", "xp": 800, "points": 450},
        ]
        
        user_ids = []
        for d in users_data:
            u = User(
                name=d["name"],
                email=d["email"],
                password_hash="fakehash",
                role="employee",
                xp_balance=d["xp"],
                points_balance=d["points"],
                is_active=True,
            )
            db.add(u)
            db.flush()
            user_ids.append(u.id)
            stats["Users"] += 1

        u1, u2, u3, u4 = user_ids

        # Seed CSR Participations
        eps = [
            EmployeeParticipation(user_id=u1, csr_activity_id=csr_objs[0].id, approval_status=ApprovalStatus.approved, points_earned=150),
            EmployeeParticipation(user_id=u2, csr_activity_id=csr_objs[1].id, approval_status=ApprovalStatus.approved, points_earned=100),
            EmployeeParticipation(user_id=u1, csr_activity_id=csr_objs[2].id, approval_status=ApprovalStatus.pending, points_earned=0),
            EmployeeParticipation(user_id=u3, csr_activity_id=csr_objs[1].id, approval_status=ApprovalStatus.rejected, points_earned=0),
            EmployeeParticipation(user_id=u4, csr_activity_id=csr_objs[3].id, approval_status=ApprovalStatus.approved, points_earned=50),
            EmployeeParticipation(user_id=u4, csr_activity_id=csr_objs[0].id, approval_status=ApprovalStatus.approved, points_earned=150),
            EmployeeParticipation(user_id=u2, csr_activity_id=csr_objs[4].id, approval_status=ApprovalStatus.pending, points_earned=0),
        ]
        db.add_all(eps)
        stats["EmployeeParticipations"] += len(eps)

        # Seed Challenge Participations
        cps = [
            ChallengeParticipation(user_id=u1, challenge_id=challenge_objs[0].id, progress=100, approval_status=ApprovalStatus.approved, xp_awarded=300),
            ChallengeParticipation(user_id=u1, challenge_id=challenge_objs[1].id, progress=50, approval_status=ApprovalStatus.pending, xp_awarded=0),
            ChallengeParticipation(user_id=u2, challenge_id=challenge_objs[2].id, progress=100, approval_status=ApprovalStatus.approved, xp_awarded=100),
            ChallengeParticipation(user_id=u3, challenge_id=challenge_objs[0].id, progress=80, approval_status=ApprovalStatus.pending, xp_awarded=0),
            ChallengeParticipation(user_id=u4, challenge_id=challenge_objs[1].id, progress=100, approval_status=ApprovalStatus.approved, xp_awarded=500),
            ChallengeParticipation(user_id=u4, challenge_id=challenge_objs[5].id, progress=100, approval_status=ApprovalStatus.approved, xp_awarded=200),
            ChallengeParticipation(user_id=u2, challenge_id=challenge_objs[4].id, progress=20, approval_status=ApprovalStatus.pending, xp_awarded=0),
            ChallengeParticipation(user_id=u3, challenge_id=challenge_objs[5].id, progress=100, approval_status=ApprovalStatus.rejected, xp_awarded=0),
        ]
        db.add_all(cps)
        stats["ChallengeParticipations"] += len(cps)

        db.flush()

        # Trigger badge unlocks for seeded users
        settings = get_settings_stub()
        # Force auto-award on for seed script
        settings.badge_auto_award = True 
        for uid in user_ids:
            check_badge_unlocks(db, uid, settings)

    db.commit()

    # ── Summary ──────────────────────────────────────────────────────────
    print("\nSeed Summary:")
    for k, v in stats.items():
        print(f"  - {k}: {v}")
    print("\nSeed complete!")


from app.core.database import SessionLocal, engine
from app.models.core import Base

if __name__ == "__main__":
    # Ensure tables exist for standalone run
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_social_and_gamification(db)
    finally:
        db.close()
