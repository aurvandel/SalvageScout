"""Link search filters to a specific criteria profile

Revision ID: 006_link_profile
Revises: 005_add_viewed_at
Create Date: 2026-08-26 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_link_profile'
down_revision = '005_add_viewed_at'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('search_filters', sa.Column('criteria_profile_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_search_filters_criteria_profile_id',
        'search_filters', 'criteria_profiles',
        ['criteria_profile_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_search_filters_criteria_profile_id', 'search_filters', type_='foreignkey')
    op.drop_column('search_filters', 'criteria_profile_id')
