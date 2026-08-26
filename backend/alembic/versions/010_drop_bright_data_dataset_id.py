"""Drop app_settings.bright_data_dataset_id

Bright Data's Facebook Marketplace scraper uses a fixed, pre-built dataset ID
(gd_lvt9iwuh6fbcwmx1a) shared by every account, not a user-created collector —
confirmed against Bright Data's own docs. There's nothing for an admin to look
up or configure here, so the column this migration added is dropped again.

Revision ID: 010_drop_bd_dataset_id
Revises: 009_rename_raw_data
Create Date: 2026-08-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '010_drop_bd_dataset_id'
down_revision = '009_rename_raw_data'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('app_settings', 'bright_data_dataset_id')


def downgrade() -> None:
    op.add_column('app_settings', sa.Column('bright_data_dataset_id', sa.String(), nullable=True))
