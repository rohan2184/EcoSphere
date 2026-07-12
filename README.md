# EcoSphere — ESG Management Platform

Odoo Hackathon '26. React (Vite + TS + Tailwind) · FastAPI · PostgreSQL · SQLAlchemy + Alembic.

Works on **macOS/Linux and Windows** — commands for both below.

## Prerequisites

- Python 3.12+, Node 20+, PostgreSQL 15+
  - macOS: `brew install postgresql@17 && brew services start postgresql@17`
  - Windows: install from <https://www.postgresql.org/download/windows/> (or `winget install PostgreSQL.PostgreSQL.17`)
- Create the database: `createdb ecosphere` (or via pgAdmin)

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows (PowerShell/cmd)
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your values:

```
DATABASE_URL=postgresql://localhost:5432/ecosphere   # add user:pass@ if needed
JWT_SECRET=change-me
JWT_EXPIRE_MIN=60
```

Then:

```bash
alembic upgrade head             # creates all tables
uvicorn app.main:app --reload    # API at http://localhost:8000, Swagger at /docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev                      # app at http://localhost:5173
```

Copy `frontend/.env.example` to `frontend/.env` (defaults to `http://localhost:8000/api`).

## What's implemented (Person C slice)

- **Models** for every table in PROJECT_PLAN §3 (auth/core by Person A; env, social, gamification, governance, notifications defined per contract) + initial Alembic migration.
- **Governance API**: policies CRUD + acknowledgements (idempotent), audits CRUD, compliance issues CRUD — owner + due date mandatory, `is_overdue` computed live, overdue issues auto-notify their owner.
- **Scoring engine** (`services/scoring.py`): pure functions per §4, clamped [0,100], weights from Settings, computed on-demand (never cached).
- **Dashboard API**: `/api/dashboard/overview` (overall ESG, E/S/G, dept ranking, compliance alerts, notifications) and `/api/dashboard/scores`.
- **Reports**: `/api/reports/{env|social|gamification|governance|summary}`, custom report builder (`POST /api/reports/custom`) with department / date range / module / employee / challenge / ESG-category filters, and export in **CSV, Excel, PDF** (`GET /api/reports/custom/export?format=csv|xlsx|pdf`).
- **Frontend shell**: Tailwind v4, axios client with JWT interceptor, AuthContext, protected routes, shared Layout/Sidebar/StatCard/DataTable/ChartCard, Login/Register pages, and pages for Dashboard, Policies, Audits, Compliance, Reports.
- **Auth (real)**: `POST /api/auth/register`, `POST /api/auth/login` (JWT), `GET /api/auth/me`; bcrypt-hashed passwords; `get_current_user` + `require_role` in `core/deps.py`. Every API route requires a Bearer token; mutating governance endpoints and `PUT /api/settings` require admin/manager. `AUTH_ENFORCED=true` in the frontend — login is mandatory. **The first user to register becomes admin** (bootstrap rule); everyone after is an employee.
- **Settings API**: `GET/PUT /api/settings` — singleton row (created on first read) holding the four automation toggles + E/S/G weights. PUT is admin-only.
- **Notification bell** in the topbar: unread badge (30s poll), dropdown list, mark-one/mark-all read — backed by Person B's `/api/notifications` endpoints (now mounted, along with social + gamification).

## Still open (other slices)

- Env module APIs/pages (emission factors, carbon transactions, goals) — Person A.
- Gamification/social frontend pages, seed script — Person B / Person A.
