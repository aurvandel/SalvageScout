"""Add viewed_at tracking to listings

Revision ID: 005_add_viewed_at
Revises: 721ef039cfb4
Create Date: 2026-08-25 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005_add_viewed_at'
down_revision = '721ef039cfb4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'viewed_at')
