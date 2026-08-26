"""Add app_settings.bright_data_enrichment_enabled

Bright Data's scraper turned out to be item-detail-only (confirmed live: it
rejects both keyword and search-url input) — it can't discover listings, so
it's not a scraper_provider choice. This adds a separate opt-in toggle for
using it as a detail-enrichment step layered on top of whichever provider
does the actual discovery.

Revision ID: 011_bd_enrichment_toggle
Revises: 010_drop_bd_dataset_id
Create Date: 2026-08-26 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '011_bd_enrichment_toggle'
down_revision = '010_drop_bd_dataset_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'app_settings',
        sa.Column('bright_data_enrichment_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('app_settings', 'bright_data_enrichment_enabled')
