"""Idempotent database seed — `python -m app.seed`.

Populates realistic data for every module so the whole app demos against real
numbers: departments, users (bcrypt-hashed), emission factors, carbon
transactions spread across several months, environmental goals (some met, some
not), plus enough social / gamification / governance rows for the other two
slices to demo.

Idempotent by truncate-then-seed: safe to re-run on an existing DB. Row counts
are modest and coordinated with the social/gamification/governance owners —
bump them here if a demo needs more volume.
"""
from datetime import date

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Department, Category, CategoryType, Settings,
    User, UserRole,
    EmissionFactor, ProductESGProfile, CarbonTransaction, EnvironmentalGoal, SourceType,
    CSRActivity, EmployeeParticipation, DiversityMetric, ApprovalStatus,
    Challenge, ChallengeParticipation, ChallengeStatus, Badge, UserBadge,
    Reward, RewardRedemption, Notification,
    ESGPolicy, PolicyAcknowledgement, Audit, ComplianceIssue,
)
from app.models.governance import IssueSeverity, IssueStatus

DEFAULT_PASSWORD = "Password123!"

# Child tables first so truncation never trips a FK (order matters even though
# SQLite FK enforcement is off by default — keeps this correct on Postgres too).
_TRUNCATE_ORDER = [
    RewardRedemption, UserBadge, Notification, ChallengeParticipation,
    EmployeeParticipation, PolicyAcknowledgement, ComplianceIssue,
    CarbonTransaction, EnvironmentalGoal, ProductESGProfile, DiversityMetric,
    Audit, Challenge, Badge, Reward, CSRActivity, ESGPolicy, EmissionFactor,
    Category, User, Department,
]


def _recent_months(n: int) -> list[date]:
    """Return the 15th of each of the last `n` months, oldest first."""
    today = date.today()
    out: list[date] = []
    year, month = today.year, today.month
    for _ in range(n):
        out.append(date(year, month, 15))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(out))


def _truncate(db) -> None:
    for model in _TRUNCATE_ORDER:
        db.query(model).delete()
    db.commit()


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _truncate(db)

        # ── Settings singleton (upsert; leave auto-calc OFF for the Gate 2 demo)
        settings = db.query(Settings).first()
        if settings is None:
            settings = Settings()
            db.add(settings)
        settings.auto_emission_calc = False
        settings.weight_env, settings.weight_social, settings.weight_gov = 40, 30, 30
        db.flush()

        # ── Departments ────────────────────────────────────────────────────
        dept_defs = [
            ("Operations", "OPS"),
            ("Manufacturing", "MFG"),
            ("Logistics", "LOG"),
            ("Sales", "SAL"),
            ("Research & Development", "RND"),
        ]
        departments = [
            Department(name=name, code=code, status="active") for name, code in dept_defs
        ]
        db.add_all(departments)
        db.flush()

        # ── Users (1 admin, 2 managers, 15 employees) ──────────────────────
        pw = hash_password(DEFAULT_PASSWORD)
        users: list[User] = []

        users.append(User(name="Ada Admin", email="admin@ecosphere.dev",
                          password_hash=pw, role=UserRole.admin,
                          department_id=departments[0].id, is_active=True))

        manager_names = [("Mo Manager", departments[1]), ("Mia Manager", departments[2])]
        managers: list[User] = []
        for name, dept in manager_names:
            u = User(name=name, email=name.split()[0].lower() + "@ecosphere.dev",
                     password_hash=pw, role=UserRole.manager,
                     department_id=dept.id, is_active=True)
            managers.append(u)
            users.append(u)

        for i in range(15):
            dept = departments[i % len(departments)]
            users.append(User(
                name=f"Employee {i + 1}",
                email=f"employee{i + 1}@ecosphere.dev",
                password_hash=pw, role=UserRole.employee,
                department_id=dept.id, is_active=True,
                points_balance=50 * (i % 4), xp_balance=120 * (i % 5),
            ))
        db.add_all(users)
        db.flush()

        # Department heads: managers head Manufacturing / Logistics
        departments[1].head_user_id = managers[0].id
        departments[2].head_user_id = managers[1].id

        # ── Categories ─────────────────────────────────────────────────────
        categories = [
            Category(name="Tree Planting", type=CategoryType.csr_activity, status="active"),
            Category(name="Community Outreach", type=CategoryType.csr_activity, status="active"),
            Category(name="Energy Saving", type=CategoryType.challenge, status="active"),
            Category(name="Waste Reduction", type=CategoryType.challenge, status="active"),
        ]
        db.add_all(categories)
        db.flush()

        # ── Emission factors (one per source type) ─────────────────────────
        factors = [
            EmissionFactor(name="Purchased Goods", source_type=SourceType.purchase,
                           unit="kg", factor_value=2.1, status="active"),
            EmissionFactor(name="Manufacturing Output", source_type=SourceType.manufacturing,
                           unit="unit", factor_value=5.4, status="active"),
            EmissionFactor(name="Business Expense", source_type=SourceType.expense,
                           unit="USD", factor_value=0.35, status="active"),
            EmissionFactor(name="Fleet Fuel", source_type=SourceType.fleet,
                           unit="liter", factor_value=2.68, status="active"),
        ]
        db.add_all(factors)
        db.flush()

        # ── Carbon transactions spread across 6 months and departments ─────
        months = _recent_months(6)
        quantities = [120, 340, 75, 500, 210, 88, 430, 60, 155, 275]
        idx = 0
        transactions: list[CarbonTransaction] = []
        for month in months:
            for dept in departments[:4]:
                factor = factors[idx % len(factors)]
                qty = quantities[idx % len(quantities)]
                transactions.append(CarbonTransaction(
                    department_id=dept.id,
                    source_type=factor.source_type,
                    source_ref=f"SEED-{month.strftime('%Y%m')}-{dept.code}",
                    quantity=qty,
                    emission_factor_id=factor.id,
                    co2e_amount=round(qty * factor.factor_value, 2),
                    date=month,
                    auto_generated=False,
                ))
                idx += 1
        db.add_all(transactions)

        # ── Environmental goals (some met, some not → E-score varies) ──────
        goals = [
            EnvironmentalGoal(department_id=departments[0].id, metric="renewable_kwh",
                              target_value=100, current_value=120, deadline=months[-1],
                              status="active"),   # met
            EnvironmentalGoal(department_id=departments[1].id, metric="co2e_reduction",
                              target_value=100, current_value=60, deadline=months[-1],
                              status="active"),   # not met
            EnvironmentalGoal(department_id=departments[2].id, metric="recycling_pct",
                              target_value=80, current_value=90, deadline=months[-1],
                              status="active"),   # met
            EnvironmentalGoal(department_id=departments[3].id, metric="paperless_pct",
                              target_value=50, current_value=20, deadline=months[-1],
                              status="active"),   # not met
            EnvironmentalGoal(department_id=None, metric="org_total_co2e",
                              target_value=100, current_value=100, deadline=months[-1],
                              status="active"),   # org-wide
        ]
        db.add_all(goals)

        # ── Products (ProductESGProfile) ───────────────────────────────────
        db.add_all([
            ProductESGProfile(product_name="EcoWidget", category="hardware",
                              default_emission_factor_id=factors[0].id,
                              notes="Flagship low-carbon widget."),
            ProductESGProfile(product_name="GreenPack", category="packaging",
                              default_emission_factor_id=factors[1].id,
                              notes="Recycled packaging line."),
        ])

        # ── Social: CSR activities + participations + diversity ────────────
        csr = [
            CSRActivity(title="City Tree Planting", category_id=categories[0].id,
                        description="Plant 500 trees downtown.", date=months[-2],
                        location="Downtown", points_value=50, status="active"),
            CSRActivity(title="Food Bank Drive", category_id=categories[1].id,
                        description="Volunteer at the local food bank.", date=months[-1],
                        location="Community Center", points_value=30, status="active"),
            CSRActivity(title="Beach Cleanup", category_id=categories[0].id,
                        description="Coastal cleanup weekend.", date=months[-1],
                        location="Bayshore", points_value=40, status="active"),
        ]
        db.add_all(csr)
        db.flush()

        employees = [u for u in users if u.role == UserRole.employee]
        participations = []
        for i, emp in enumerate(employees[:10]):
            activity = csr[i % len(csr)]
            approved = i % 3 != 0  # ~2/3 approved
            participations.append(EmployeeParticipation(
                user_id=emp.id, csr_activity_id=activity.id,
                approval_status=ApprovalStatus.approved if approved else ApprovalStatus.pending,
                points_earned=activity.points_value if approved else 0,
                completion_date=activity.date,
            ))
        db.add_all(participations)

        db.add_all([
            DiversityMetric(department_id=d.id, period="2026-Q2",
                            gender_ratio=42 + 3 * i, avg_training_hours=12 + i,
                            training_completion_pct=70 + 5 * i)
            for i, d in enumerate(departments)
        ])

        # ── Gamification: challenges, participations, badges, rewards ──────
        challenges = [
            Challenge(title="Cut Office Energy 10%", category_id=categories[2].id,
                      description="Reduce departmental energy use.", xp=200,
                      difficulty="medium", evidence_required=True, deadline=months[-1],
                      status=ChallengeStatus.active),
            Challenge(title="Zero-Waste Week", category_id=categories[3].id,
                      description="No landfill waste for a week.", xp=150,
                      difficulty="easy", evidence_required=False, deadline=months[-1],
                      status=ChallengeStatus.active),
            Challenge(title="Bike to Work", category_id=categories[2].id,
                      description="Commute by bike 5 days.", xp=100,
                      difficulty="easy", evidence_required=False, deadline=months[-1],
                      status=ChallengeStatus.active),
        ]
        db.add_all(challenges)
        db.flush()

        cparts = []
        for i, emp in enumerate(employees[:8]):
            ch = challenges[i % len(challenges)]
            done = i % 2 == 0
            cparts.append(ChallengeParticipation(
                challenge_id=ch.id, user_id=emp.id,
                progress=100 if done else 40,
                approval_status=ApprovalStatus.approved if done else ApprovalStatus.pending,
                xp_awarded=ch.xp if done else 0,
            ))
        db.add_all(cparts)

        badges = [
            Badge(name="First Steps", description="Complete your first challenge.",
                  unlock_rule={"type": "challenges_completed", "threshold": 1}, icon="🌱"),
            Badge(name="Eco Warrior", description="Earn 500 XP.",
                  unlock_rule={"type": "xp", "threshold": 500}, icon="🛡"),
            Badge(name="Champion", description="Earn 1000 XP.",
                  unlock_rule={"type": "xp", "threshold": 1000}, icon="🏅"),
        ]
        db.add_all(badges)
        db.flush()

        db.add_all([
            UserBadge(user_id=employees[0].id, badge_id=badges[0].id),
            UserBadge(user_id=employees[2].id, badge_id=badges[0].id),
        ])

        rewards = [
            Reward(name="Reusable Bottle", description="Branded steel bottle.",
                   points_required=100, stock=50, status="active"),
            Reward(name="Extra Day Off", description="One paid day off.",
                   points_required=500, stock=10, status="active"),
            Reward(name="Tree in Your Name", description="We plant a tree for you.",
                   points_required=200, stock=100, status="active"),
        ]
        db.add_all(rewards)
        db.flush()

        db.add_all([
            Notification(user_id=employees[0].id, type="badge_awarded",
                         title="You earned the First Steps badge!",
                         message="Great start on your first challenge.", is_read=False),
            Notification(user_id=employees[1].id, type="approval",
                         title="Your CSR participation was approved.",
                         message="Points have been credited.", is_read=True),
        ])

        # ── Governance: policies, audits, compliance issues ────────────────
        policies = [
            ESGPolicy(title="Code of Conduct", category="ethics", body="Be excellent.",
                      version="1.0", effective_date=months[0], status="active"),
            ESGPolicy(title="Environmental Policy", category="environment",
                      body="Reduce, reuse, recycle.", version="2.1",
                      effective_date=months[1], status="active"),
            ESGPolicy(title="Data Privacy Policy", category="governance",
                      body="Protect personal data.", version="1.3",
                      effective_date=months[2], status="active"),
        ]
        db.add_all(policies)
        db.flush()

        acks = []
        for i, emp in enumerate(employees[:9]):
            acks.append(PolicyAcknowledgement(
                policy_id=policies[i % len(policies)].id, user_id=emp.id))
        db.add_all(acks)

        audits = [
            Audit(title="Q2 Safety Audit", department_id=departments[1].id,
                  auditor_id=managers[0].id, date=months[-2], scope="Safety",
                  result="pass"),
            Audit(title="Q2 Environmental Audit", department_id=departments[2].id,
                  auditor_id=managers[1].id, date=months[-1], scope="Environment",
                  result="observations"),
            Audit(title="Q2 Compliance Audit", department_id=departments[0].id,
                  auditor_id=users[0].id, date=months[-1], scope="Compliance",
                  result="fail"),
        ]
        db.add_all(audits)
        db.flush()

        past = date(months[0].year, months[0].month, 1)
        future = date(months[-1].year, months[-1].month, 28)
        issues = [
            ComplianceIssue(audit_id=audits[0].id, severity=IssueSeverity.low,
                            description="Missing signage in warehouse.",
                            owner_id=managers[0].id, due_date=future,
                            status=IssueStatus.open),
            ComplianceIssue(audit_id=audits[1].id, severity=IssueSeverity.high,
                            description="Waste segregation not followed.",
                            owner_id=managers[1].id, due_date=past,
                            status=IssueStatus.in_progress),   # overdue
            ComplianceIssue(audit_id=audits[2].id, severity=IssueSeverity.critical,
                            description="Expired compliance certification.",
                            owner_id=users[0].id, due_date=past,
                            status=IssueStatus.open),           # overdue
            ComplianceIssue(audit_id=audits[2].id, severity=IssueSeverity.med,
                            description="Incomplete audit trail.",
                            owner_id=users[0].id, due_date=future,
                            status=IssueStatus.resolved),
        ]
        db.add_all(issues)

        db.commit()

        counts = {
            "departments": len(departments),
            "users": len(users),
            "emission_factors": len(factors),
            "carbon_transactions": len(transactions),
            "environmental_goals": len(goals),
            "csr_activities": len(csr),
            "challenges": len(challenges),
            "policies": len(policies),
            "audits": len(audits),
            "compliance_issues": len(issues),
        }
        print("Seed complete:")
        for name, n in counts.items():
            print(f"  {name:22} {n}")
        print(f"\nLogin: admin@ecosphere.dev / {DEFAULT_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
