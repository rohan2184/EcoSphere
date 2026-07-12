"""Merge heads

Revision ID: 1f6cc860cb48
Revises: 23d6781e645f, a60b51f8715c
Create Date: 2026-07-12 15:55:11.329941

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f6cc860cb48'
down_revision: Union[str, Sequence[str], None] = ('23d6781e645f', 'a60b51f8715c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
