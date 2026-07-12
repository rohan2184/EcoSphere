"""Fix the stale alembic_version entry in the remote Postgres DB."""
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    print("Current alembic_version rows:", rows)
    conn.execute(text("DELETE FROM alembic_version"))
    conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('b938a95dd8d4')"))
    conn.commit()
    rows2 = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    print("Stamped. New alembic_version:", rows2)
