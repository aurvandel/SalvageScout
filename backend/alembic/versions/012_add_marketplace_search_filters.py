"""Add sort_by/delivery_method/availability to search_filters

ScrapeCreators' /v1/facebook/marketplace/search endpoint accepts several
filter parameters beyond query/lat/lng/price/radius/condition that the
scraper backend previously ignored. These three are ScrapeCreators-specific
concepts with no Apify equivalent, so they're nullable and left unset by
other providers.

Revision ID: 012_sc_marketplace_filters
Revises: 011_bd_enrichment_toggle
Create Date: 2026-08-26 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '012_sc_marketplace_filters'
down_revision = '011_bd_enrichment_toggle'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('search_filters', sa.Column('sort_by', sa.String(), nullable=True))
    op.add_column('search_filters', sa.Column('delivery_method', sa.String(), nullable=True))
    op.add_column('search_filters', sa.Column('availability', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('search_filters', 'availability')
    op.drop_column('search_filters', 'delivery_method')
    op.drop_column('search_filters', 'sort_by')
