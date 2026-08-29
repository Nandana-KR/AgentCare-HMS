"""add trigram (pg_trgm) indexes for patient search on full_name and phone

The patient search uses ILIKE '%term%' (wildcard on both sides), which a
normal B-tree index cannot accelerate because it only helps prefix
('term%') matches. A GIN trigram index indexes 3-character chunks of the
text, allowing 'contains anywhere' searches to use an index at scale.

Requires the pg_trgm extension. If the DB user lacks privileges to create
the extension, this migration skips gracefully (logs a warning) rather
than failing the whole upgrade.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-24 00:00:01.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    try:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    except Exception as exc:  # pragma: no cover
        # Insufficient privilege to create extension — skip trigram
        # indexes rather than blocking the whole migration chain.
        print(f"[migration e2f3a4b5c6d7] Skipping pg_trgm indexes: {exc}")
        return

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patients_full_name_trgm "
        "ON patients USING gin (full_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patients_phone_trgm "
        "ON patients USING gin (phone gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_patients_phone_trgm")
    op.execute("DROP INDEX IF EXISTS ix_patients_full_name_trgm")
