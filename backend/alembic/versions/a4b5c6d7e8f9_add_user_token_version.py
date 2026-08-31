"""add token_version to users for token invalidation

Adds an integer token_version (default 1) to each user. The current value
is embedded in tokens at login and checked on every request. Incrementing
it (on password change / admin reset) invalidates all existing tokens for
that user, logging them out everywhere.

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-08-29 00:00:01.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'token_version',
            sa.Integer(),
            nullable=False,
            server_default='1',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'token_version')
