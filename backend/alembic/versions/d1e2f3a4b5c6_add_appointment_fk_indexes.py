"""add indexes on appointment foreign keys (doctor_id, patient_id)

Speeds up doctor/nurse patient-scoping and appointment conflict checks,
which filter appointments by doctor_id / patient_id. Without an index
these become full-table scans as the appointments table grows.

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_appointments_doctor_id', 'appointments', ['doctor_id']
    )
    op.create_index(
        'ix_appointments_patient_id', 'appointments', ['patient_id']
    )


def downgrade() -> None:
    op.drop_index('ix_appointments_patient_id', table_name='appointments')
    op.drop_index('ix_appointments_doctor_id', table_name='appointments')
