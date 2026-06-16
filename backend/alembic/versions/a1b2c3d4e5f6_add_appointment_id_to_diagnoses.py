"""add appointment_id to diagnoses

Revision ID: a1b2c3d4e5f6
Revises: 7908b0be1c49
Create Date: 2026-06-16 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7908b0be1c49'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'diagnoses',
        sa.Column(
            'appointment_id',
            postgresql.UUID(as_uuid=True),
            nullable=True
        )
    )
    op.create_foreign_key(
        'fk_diagnoses_appointment_id',
        'diagnoses', 'appointments',
        ['appointment_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_diagnoses_appointment_id', 'diagnoses', type_='foreignkey')
    op.drop_column('diagnoses', 'appointment_id')
