"""Add pluggable scraper provider support (Bright Data, ScrapeCreators)

Revision ID: 008_scraper_providers
Revises: 007_add_token_usage
Create Date: 2026-08-26 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_scraper_providers'
down_revision = '007_add_token_usage'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'app_settings',
        sa.Column('scraper_provider', sa.String(), nullable=False, server_default='apify'),
    )
    op.add_column('app_settings', sa.Column('bright_data_api_key', sa.String(), nullable=True))
    op.add_column('app_settings', sa.Column('bright_data_dataset_id', sa.String(), nullable=True))
    op.add_column('app_settings', sa.Column('scrape_creators_api_key', sa.String(), nullable=True))

    op.add_column('search_filters', sa.Column('latitude', sa.Numeric(9, 6), nullable=True))
    op.add_column('search_filters', sa.Column('longitude', sa.Numeric(9, 6), nullable=True))


def downgrade() -> None:
    op.drop_column('search_filters', 'longitude')
    op.drop_column('search_filters', 'latitude')

    op.drop_column('app_settings', 'scrape_creators_api_key')
    op.drop_column('app_settings', 'bright_data_dataset_id')
    op.drop_column('app_settings', 'bright_data_api_key')
    op.drop_column('app_settings', 'scraper_provider')
