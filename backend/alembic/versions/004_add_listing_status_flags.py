"""Add listing status flags (favorite/hidden/deleted)

Revision ID: 004_add_listing_status_flags
Revises: 003_add_app_settings
Create Date: 2026-08-24 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_add_listing_status_flags'
down_revision = '003_add_app_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('listings', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('listings', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('listings', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_listings_is_deleted'), 'listings', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_listings_is_hidden'), 'listings', ['is_hidden'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_listings_is_hidden'), table_name='listings')
    op.drop_index(op.f('ix_listings_is_deleted'), table_name='listings')
    op.drop_column('listings', 'deleted_at')
    op.drop_column('listings', 'is_deleted')
    op.drop_column('listings', 'is_hidden')
    op.drop_column('listings', 'is_favorite')
