"""Add arena_runs table

Revision ID: 002_add_arena_runs
Revises: 001_add_scheduler_config
Create Date: 2026-08-24 06:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_arena_runs'
down_revision = '001_add_scheduler_config'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'arena_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('criteria_profile_id', sa.Integer(), nullable=False),
        sa.Column('providers', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('models', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('results', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
        sa.ForeignKeyConstraint(['criteria_profile_id'], ['criteria_profiles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_arena_runs_listing_id'), 'arena_runs', ['listing_id'], unique=False)
    op.create_index(op.f('ix_arena_runs_criteria_profile_id'), 'arena_runs', ['criteria_profile_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_arena_runs_criteria_profile_id'), table_name='arena_runs')
    op.drop_index(op.f('ix_arena_runs_listing_id'), table_name='arena_runs')
    op.drop_table('arena_runs')
