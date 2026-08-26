"""Rename listings.raw_apify_data to raw_scraper_data

Kept as its own migration, separate from 007, since it renames a populated
NOT NULL column rather than just adding new ones — lower blast radius to
review/roll back independently.

Revision ID: 008_rename_raw_data
Revises: 007_scraper_providers
Create Date: 2026-08-26 09:30:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '008_rename_raw_data'
down_revision = '007_scraper_providers'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('listings', 'raw_apify_data', new_column_name='raw_scraper_data')


def downgrade() -> None:
    op.alter_column('listings', 'raw_scraper_data', new_column_name='raw_apify_data')
