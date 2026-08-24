"""Add app_settings table and location-mode fields on search_filters

Revision ID: 003_add_app_settings
Revises: 002_add_arena_runs
Create Date: 2026-08-24 07:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_add_app_settings'
down_revision = '002_add_arena_runs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('llm_provider', sa.String(), nullable=False, server_default='anthropic'),
        sa.Column('llm_model', sa.String(), nullable=False, server_default=''),
        sa.Column('anthropic_api_key', sa.String(), nullable=True),
        sa.Column('openai_api_key', sa.String(), nullable=True),
        sa.Column('gemini_api_key', sa.String(), nullable=True),
        sa.Column('apify_token', sa.String(), nullable=True),
        sa.Column(
            'apify_actor_id', sa.String(), nullable=False, server_default='apify/facebook-marketplace-scraper'
        ),
        sa.Column('discord_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('discord_webhook_url', sa.String(), nullable=True),
        sa.Column('telegram_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('telegram_bot_token', sa.String(), nullable=True),
        sa.Column('telegram_chat_id', sa.String(), nullable=True),
        sa.Column('notification_score_threshold', sa.Integer(), nullable=False, server_default='70'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.alter_column('search_filters', 'search_url', existing_type=sa.String(), nullable=True)
    op.add_column(
        'search_filters', sa.Column('search_mode', sa.String(), nullable=False, server_default='url')
    )
    op.add_column('search_filters', sa.Column('location', sa.String(), nullable=True))
    op.add_column('search_filters', sa.Column('query', sa.String(), nullable=True))
    op.add_column('search_filters', sa.Column('min_price', sa.Integer(), nullable=True))
    op.add_column('search_filters', sa.Column('max_price', sa.Integer(), nullable=True))
    op.add_column('search_filters', sa.Column('radius_miles', sa.Integer(), nullable=True))
    op.add_column('search_filters', sa.Column('days_listed', sa.Integer(), nullable=True))
    op.add_column('search_filters', sa.Column('condition', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('search_filters', 'condition')
    op.drop_column('search_filters', 'days_listed')
    op.drop_column('search_filters', 'radius_miles')
    op.drop_column('search_filters', 'max_price')
    op.drop_column('search_filters', 'min_price')
    op.drop_column('search_filters', 'query')
    op.drop_column('search_filters', 'location')
    op.drop_column('search_filters', 'search_mode')
    op.alter_column('search_filters', 'search_url', existing_type=sa.String(), nullable=False)

    op.drop_table('app_settings')
