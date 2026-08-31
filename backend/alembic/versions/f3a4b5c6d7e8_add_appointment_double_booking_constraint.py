"""add partial unique constraint to prevent double-booking a doctor slot

Prevents two SCHEDULED appointments for the same doctor at the exact same
time. This closes the most common double-booking race: two requests both
passing the application-level conflict check at the same instant and both
inserting. The database now rejects the second insert atomically.

NOTE: this enforces "same doctor + same exact time" only. It does NOT
enforce the full +/-30-minute buffer atomically (that would require an
exclusion constraint with the btree_gist extension). The application-level
check still handles the 30-minute buffer for the normal (non-race) case.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial unique index: only applies to rows where status='scheduled'.
    # Cancelled/completed appointments are ignored, so a slot can be
    # re-used after an appointment is cancelled or completed.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_scheduled_slot "
        "ON appointments (doctor_id, scheduled_at) "
        "WHERE status = 'scheduled'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_doctor_scheduled_slot")
