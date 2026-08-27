"""Add log_entries table for the admin panel's live log viewer

Revision ID: 013_add_log_entries
Revises: 012_sc_marketplace_filters
Create Date: 2026-08-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '013_add_log_entries'
down_revision = '012_sc_marketplace_filters'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'log_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('logger_name', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
    )
    op.create_index(op.f('ix_log_entries_created_at'), 'log_entries', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_log_entries_created_at'), table_name='log_entries')
    op.drop_table('log_entries')
