"""Add apify_accounts table for multi-account Apify failover

Lets more than one Apify account be configured (e.g. two people's accounts),
so the pipeline can automatically fail over to the next account when one
hits its monthly usage cap or an auth/rate-limit error, instead of being
capped at a single account's spend. Migrates any existing
app_settings.apify_token into the first account row, then drops that column.

Revision ID: 014_add_apify_accounts
Revises: 013_add_log_entries
Create Date: 2026-08-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '014_add_apify_accounts'
down_revision = '013_add_log_entries'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'apify_accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('api_token', sa.String(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('last_error_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    conn = op.get_bind()
    existing_token = conn.execute(sa.text("SELECT apify_token FROM app_settings WHERE id = 1")).scalar()
    if existing_token:
        conn.execute(
            sa.text(
                "INSERT INTO apify_accounts (label, api_token, priority, is_active) "
                "VALUES ('Migrated from settings', :token, 100, true)"
            ),
            {"token": existing_token},
        )

    op.drop_column('app_settings', 'apify_token')


def downgrade() -> None:
    op.add_column('app_settings', sa.Column('apify_token', sa.String(), nullable=True))

    conn = op.get_bind()
    first_token = conn.execute(sa.text("SELECT api_token FROM apify_accounts ORDER BY priority, id LIMIT 1")).scalar()
    if first_token:
        conn.execute(sa.text("UPDATE app_settings SET apify_token = :token WHERE id = 1"), {"token": first_token})

    op.drop_table('apify_accounts')
