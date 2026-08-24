"""add scheduler_config table

Revision ID: 001_add_scheduler_config
Revises: 84df886f01cb
Create Date: 2026-08-24 04:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '001_add_scheduler_config'
down_revision: Union[str, Sequence[str], None] = '84df886f01cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('scheduler_config',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
    sa.Column('run_hour', sa.Integer(), nullable=False, server_default='6'),
    sa.Column('run_minute', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('scheduler_config')
