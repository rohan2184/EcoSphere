"""Seed script for EcoSphere demo data.

Run with:  python -m app.seed

Idempotent: if data already exists it clears the tables this script owns and
re-seeds from scratch, so it is safe to run repeatedly.

The script is organized into clearly separated sections so teammates can append
their own sections (Social/Gamification, Governance) without merge conflicts.
Each section is a self-contained function called from main().
"""
from datetime import date, timedelta
import random

from app.core.database import SessionLocal
from app.core.security import hash_password

# Models
from app.models.core import Department, Category, Settings, CategoryType
from app.models.auth import User, UserRole
from app.models.env import (
    EmissionFactor, CarbonTransaction, EnvironmentalGoal, ProductESGProfile,
    SourceType,
)

# Deterministic randomness so repeated runs produce the same demo data.
random.seed(42)

# Running counts for the final summary, populated by each section.
summary: dict[str, int] = {}


def clear_existing(db):
    """Delete rows this script owns, in FK-safe (child -> parent) order."""
    # Environmental (children reference departments / emission_factors)
    db.query(CarbonTransaction).delete()
    db.query(EnvironmentalGoal).delete()
    db.query(ProductESGProfile).delete()
    db.query(EmissionFactor).delete()
    # Break the Department.head_user_id <-> User.department_id cycle first.
    db.query(Department).update({Department.head_user_id: None})
    db.flush()
    # Core
    db.query(User).delete()
    db.query(Department).delete()
    db.query(Category).delete()
    db.query(Settings).delete()
    db.commit()


# =========================================================================
# === CORE: Departments, Users, Categories, Settings ===
# =========================================================================
def seed_core(db):
    """Seed Settings, Departments, Users, Categories.

    Returns a dict with references other sections need (departments, users).
    """
    # --- Settings (singleton) -------------------------------------------
    # Automation toggles ON so the demo shows automated behavior working.
    settings_row = Settings(
        auto_emission_calc=True,
        evidence_required=True,
        badge_auto_award=True,
        weight_env=40,
        weight_social=30,
        weight_gov=30,
        notify_email=True,
        notify_inapp=True,
    )
    db.add(settings_row)
    summary["settings"] = 1

    # --- Departments (created without head_user_id; set after users) -----
    dept_specs = [
        {"name": "Operations", "code": "OPS", "employee_count": 42, "status": "active"},
        {"name": "Engineering", "code": "ENG", "employee_count": 78, "status": "active"},
        {"name": "Sales", "code": "SALES", "employee_count": 35, "status": "active"},
        {"name": "HR", "code": "HR", "employee_count": 12, "status": "active"},
    ]
    departments = {}
    for spec in dept_specs:
        dept = Department(**spec)
        db.add(dept)
        departments[spec["code"]] = dept
    db.flush()  # assign department ids
    summary["departments"] = len(departments)

    # --- Admin user (no department) -------------------------------------
    admin = User(
        name="Ada Admin",
        email="admin@ecosphere.com",
        password_hash=hash_password("admin123"),
        role=UserRole.admin,
        department_id=None,
        xp_balance=0,
        points_balance=0,
        is_active=True,
    )
    db.add(admin)

    # --- Employees & managers spread across the 4 departments ------------
    # (name, email, dept_code, role, xp_balance, points_balance)
    # One manager per department; the rest are employees. Varied progress so
    # the leaderboard looks populated later.
    user_specs = [
        ("Olivia Reyes",   "olivia.reyes@ecosphere.com",   "OPS",   UserRole.manager,  480, 320),
        ("Marcus Lee",     "marcus.lee@ecosphere.com",     "OPS",   UserRole.employee, 150, 90),
        ("Nadia Farooq",   "nadia.farooq@ecosphere.com",   "OPS",   UserRole.employee, 0,   0),
        ("Ethan Novak",    "ethan.novak@ecosphere.com",    "ENG",   UserRole.manager,  510, 410),
        ("Priya Nair",     "priya.nair@ecosphere.com",     "ENG",   UserRole.employee, 260, 175),
        ("Diego Santos",   "diego.santos@ecosphere.com",   "ENG",   UserRole.employee, 75,  40),
        ("Hannah Kim",     "hannah.kim@ecosphere.com",     "SALES", UserRole.manager,  330, 210),
        ("Liam O'Brien",   "liam.obrien@ecosphere.com",    "SALES", UserRole.employee, 0,   0),
        ("Sofia Rossi",    "sofia.rossi@ecosphere.com",    "HR",    UserRole.manager,  290, 200),
        ("Tomas Alvarez",  "tomas.alvarez@ecosphere.com",  "HR",    UserRole.employee, 120, 60),
    ]
    users = {}
    dept_managers = {}  # dept_code -> manager User
    for name, email, code, role, xp, pts in user_specs:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password("password123"),
            role=role,
            department_id=departments[code].id,
            xp_balance=xp,
            points_balance=pts,
            is_active=True,
        )
        db.add(user)
        users[email] = user
        if role == UserRole.manager:
            dept_managers[code] = user
    db.flush()  # assign user ids
    summary["users"] = len(user_specs) + 1  # + admin

    # --- Point each Department's head_user_id at its manager -------------
    for code, dept in departments.items():
        if code in dept_managers:
            dept.head_user_id = dept_managers[code].id

    # --- Categories ------------------------------------------------------
    category_specs = [
        ("Environment",     CategoryType.csr_activity),
        ("Education",       CategoryType.csr_activity),
        ("Health",          CategoryType.csr_activity),
        ("Community",       CategoryType.csr_activity),
        ("Energy Saving",   CategoryType.challenge),
        ("Waste Reduction", CategoryType.challenge),
        ("Commute",         CategoryType.challenge),
    ]
    for name, ctype in category_specs:
        db.add(Category(name=name, type=ctype, status="active"))
    summary["categories"] = len(category_specs)

    db.commit()
    return {"departments": departments, "users": users}


# =========================================================================
# === ENVIRONMENTAL: Emission Factors, Carbon Transactions, Goals ===
# =========================================================================
def seed_environmental(db, refs):
    departments = refs["departments"]

    # --- Emission Factors ------------------------------------------------
    # (name, source_type, unit, factor_value kg CO2e per unit)
    factor_specs = [
        ("Diesel fuel",        SourceType.fleet,         "liter", 2.68),
        ("Petrol fuel",        SourceType.fleet,         "liter", 2.31),
        ("Electricity",        SourceType.manufacturing, "kWh",   0.45),
        ("Natural gas",        SourceType.manufacturing, "kWh",   0.20),
        ("Paper purchase",     SourceType.purchase,      "kg",    0.90),
        ("Steel purchase",     SourceType.purchase,      "kg",    1.85),
        ("Business travel",    SourceType.expense,       "km",    0.15),
        ("Hotel stay",         SourceType.expense,       "night", 10.4),
    ]
    factors = []
    for name, stype, unit, value in factor_specs:
        f = EmissionFactor(
            name=name, source_type=stype, unit=unit,
            factor_value=value, status="active",
        )
        db.add(f)
        factors.append(f)
    db.flush()  # assign ids
    summary["emission_factors"] = len(factors)

    # --- Carbon Transactions --------------------------------------------
    # 18 transactions spread across the last 60 days and all 4 departments.
    # auto_generated=True to simulate operational data flowing in.
    dept_list = list(departments.values())
    today = date.today()
    txn_count = 0
    for i in range(18):
        factor = factors[i % len(factors)]
        dept = dept_list[i % len(dept_list)]
        # Quantities scaled per unit type so co2e totals stay sensible.
        if factor.unit == "km":
            quantity = round(random.uniform(50, 800), 1)
        elif factor.unit == "night":
            quantity = float(random.randint(1, 6))
        elif factor.unit == "kg":
            quantity = round(random.uniform(20, 500), 1)
        elif factor.unit == "kWh":
            quantity = round(random.uniform(100, 3000), 1)
        else:  # liter
            quantity = round(random.uniform(30, 400), 1)

        co2e = round(quantity * factor.factor_value, 2)
        txn_date = today - timedelta(days=random.randint(0, 60))
        db.add(CarbonTransaction(
            department_id=dept.id,
            source_type=factor.source_type,
            source_ref=f"{factor.source_type.value.upper()}-{1000 + i}",
            quantity=quantity,
            emission_factor_id=factor.id,
            co2e_amount=co2e,
            date=txn_date,
            auto_generated=True,
        ))
        txn_count += 1
    summary["carbon_transactions"] = txn_count

    # --- Environmental Goals --------------------------------------------
    # 5 goals: 2 department-specific, 3 org-wide, varied progress/deadlines.
    ops = departments["OPS"]
    eng = departments["ENG"]
    goal_specs = [
        # (department_id, metric, target, current, deadline, status)
        (ops.id, "total_co2e",         5000.0, 1800.0, today + timedelta(days=120), "on_track"),
        (eng.id, "emission_intensity",   12.0,   10.5, today + timedelta(days=45),  "at_risk"),
        (None,   "total_co2e",         20000.0, 9500.0, today + timedelta(days=200), "on_track"),
        (None,   "renewable_ratio",       0.5,    0.5, today - timedelta(days=15),  "achieved"),
        (None,   "waste_diversion",       0.8,    0.3, today - timedelta(days=5),   "at_risk"),
    ]
    for dept_id, metric, target, current, deadline, status in goal_specs:
        db.add(EnvironmentalGoal(
            department_id=dept_id,
            metric=metric,
            target_value=target,
            current_value=current,
            deadline=deadline,
            status=status,
        ))
    summary["environmental_goals"] = len(goal_specs)

    db.commit()


# =========================================================================
# === SOCIAL & GAMIFICATION (placeholder — Person B appends here) ===
# =========================================================================
# def seed_social_gamification(db, refs):
#     ...
#     db.commit()


# =========================================================================
# === GOVERNANCE (placeholder — Person C appends here) ===
# =========================================================================
# def seed_governance(db, refs):
#     ...
#     db.commit()


def main():
    db = SessionLocal()
    try:
        existing = db.query(User).count()
        if existing > 0:
            print(f"Existing data found ({existing} users). Clearing and re-seeding...")
            clear_existing(db)
        else:
            print("No existing data found. Seeding fresh...")

        refs = seed_core(db)
        seed_environmental(db, refs)
        # seed_social_gamification(db, refs)   # Person B
        # seed_governance(db, refs)            # Person C

        print("\n=== Seed complete. Rows created: ===")
        for table, count in summary.items():
            print(f"  {table:<22} {count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
