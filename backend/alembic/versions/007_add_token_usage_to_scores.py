"""Add token usage tracking to scores

Revision ID: 007_add_token_usage
Revises: 006_link_profile
Create Date: 2026-08-26 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007_add_token_usage'
down_revision = '006_link_profile'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('scores', sa.Column('input_tokens', sa.Integer(), nullable=True))
    op.add_column('scores', sa.Column('output_tokens', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('scores', 'output_tokens')
    op.drop_column('scores', 'input_tokens')
