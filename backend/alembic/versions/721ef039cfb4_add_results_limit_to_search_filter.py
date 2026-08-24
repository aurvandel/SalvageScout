"""add results_limit to search_filter

Revision ID: 721ef039cfb4
Revises: 004_add_listing_status_flags
Create Date: 2026-08-24 21:00:30.320321

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '721ef039cfb4'
down_revision: Union[str, Sequence[str], None] = '004_add_listing_status_flags'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('search_filters', sa.Column('results_limit', sa.Integer(), nullable=False, server_default='100'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('search_filters', 'results_limit')
