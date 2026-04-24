"""0001 — Initial schema with all tables, RLS policies, and indexes.

Revision ID: 0001
Revises: None
Create Date: 2026-04-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── All tenant-scoped tables (for RLS) ──────────────────────
TENANT_TABLES = [
    "users", "accounts", "contacts", "products", "deal_stages",
    "deals", "deal_contact_roles", "deal_line_items", "activities",
    "tasks", "agent_runs", "agent_tasks", "agent_approvals",
    "memory_chunks", "compliance_checks",
]


def upgrade() -> None:
    # ── Extensions ──────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"vector\"")

    # ENUM types are created automatically by SQLAlchemy when parsing sa.Enum inside op.create_table

    # ── Teams (tenant root — no RLS on this table) ──────────
    op.create_table(
        "teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(100), server_default="UTC"),
        sa.Column("default_currency", sa.String(3), server_default="USD"),
        sa.Column("company_signature_block", sa.Text, nullable=True),
        sa.Column("active_rule_packs", ARRAY(sa.String), server_default=sa.text("ARRAY['universal']::varchar[]")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Users ───────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=False, index=True),
        sa.Column("auth0_sub", sa.String(255), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "manager", "rep", name="user_role", create_constraint=False), nullable=False, server_default="rep"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Accounts ────────────────────────────────────────────
    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("industry", sa.String(255), nullable=True),
        sa.Column("size", sa.String(100), nullable=True),
        sa.Column("annual_revenue", sa.Numeric(15, 2), nullable=True),
        sa.Column("custom_fields", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Contacts ────────────────────────────────────────────
    op.create_table(
        "contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True, index=True),
        sa.Column("consent_sms", sa.Boolean, server_default="false"),
        sa.Column("consent_email", sa.Boolean, server_default="false"),
        sa.Column("consent_source", sa.String(255), nullable=True),
        sa.Column("consent_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("custom_fields", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Products ────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("price", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("custom_fields", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Deal Stages ─────────────────────────────────────────
    op.create_table(
        "deal_stages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_won", sa.Boolean, server_default="false"),
        sa.Column("is_lost", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Deals ───────────────────────────────────────────────
    op.create_table(
        "deals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("expected_close_date", sa.Date, nullable=True),
        sa.Column("probability", sa.Numeric(5, 2), nullable=True),
        sa.Column("stage_id", UUID(as_uuid=True), sa.ForeignKey("deal_stages.id"), nullable=False, index=True),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=True, index=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True, index=True),
        sa.Column("owner_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "contact_id IS NOT NULL OR account_id IS NOT NULL",
            name="ck_deal_contact_or_account",
        ),
    )

    # ── Deal Contact Roles ──────────────────────────────────
    op.create_table(
        "deal_contact_roles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=False, index=True),
        sa.Column("role", sa.Enum("decision_maker", "champion", "influencer", "blocker", "end_user", name="contact_role_type", create_constraint=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Deal Line Items ─────────────────────────────────────
    op.create_table(
        "deal_line_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Activities ──────────────────────────────────────────
    op.create_table(
        "activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("type", sa.Enum("call", "email", "sms", "note", "meeting", "task", "document_sent", name="activity_type", create_constraint=False), nullable=False),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=True, index=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True, index=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=True, index=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ai_generated", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Tasks ───────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_to_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=True),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id"), nullable=True),
        sa.Column("status", sa.Enum("pending", "done", "cancelled", name="task_status", create_constraint=False), nullable=False, server_default="pending"),
        sa.Column("ai_proposed", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Consent Records ─────────────────────────────────────
    op.create_table(
        "consent_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=False, index=True),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("type", sa.Enum("sms", "email", name="consent_type", create_constraint=False), nullable=False),
        sa.Column("action", sa.Enum("grant", "revoke", name="consent_action", create_constraint=False), nullable=False),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Agent Runs ──────────────────────────────────────────
    op.create_table(
        "agent_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("goal", sa.Text, nullable=False),
        sa.Column("context", JSONB, nullable=True),
        sa.Column("status", sa.Enum("running", "awaiting_approval", "complete", "failed", name="agent_run_status", create_constraint=False), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_cost_usd", sa.Numeric(10, 6), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Agent Tasks ─────────────────────────────────────────
    op.create_table(
        "agent_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("agent_runs.id"), nullable=False, index=True),
        sa.Column("agent_name", sa.String(255), nullable=False),
        sa.Column("input", JSONB, nullable=True),
        sa.Column("output", JSONB, nullable=True),
        sa.Column("tool_calls", JSONB, nullable=True),
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Agent Approvals ─────────────────────────────────────
    op.create_table(
        "agent_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("agent_runs.id"), nullable=False, index=True),
        sa.Column("agent_task_id", UUID(as_uuid=True), sa.ForeignKey("agent_tasks.id"), nullable=True),
        sa.Column("type", sa.Enum("email", "sms", "calendar_event", "document", name="approval_type", create_constraint=False), nullable=False),
        sa.Column("draft_content", JSONB, nullable=False),
        sa.Column("reasoning", sa.Text, nullable=True),
        sa.Column("compliance_result", JSONB, nullable=True),
        sa.Column("assigned_to_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "edited_and_approved", name="approval_status", create_constraint=False), nullable=False, server_default="pending"),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("edited_content", JSONB, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Memory Chunks (pgvector) ────────────────────────────
    op.create_table(
        "memory_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("contact_id", UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=True, index=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True, index=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("source", sa.Enum("conversation", "research", "activity", "document", name="memory_source", create_constraint=False), nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add vector column separately (Alembic doesn't natively handle vector type)
    op.execute("ALTER TABLE memory_chunks ADD COLUMN embedding vector(1536)")

    # ── Audit Logs (immutable) ──────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("before_state", JSONB, nullable=True),
        sa.Column("after_state", JSONB, nullable=True),
        sa.Column("agent_run_id", UUID(as_uuid=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Compliance Checks ───────────────────────────────────
    op.create_table(
        "compliance_checks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("agent_task_id", UUID(as_uuid=True), sa.ForeignKey("agent_tasks.id"), nullable=False, index=True),
        sa.Column("rule_pack_id", sa.String(100), nullable=False),
        sa.Column("rule_pack_version", sa.String(50), nullable=False),
        sa.Column("rule_id", sa.String(100), nullable=False),
        sa.Column("rule_version", sa.String(50), nullable=False),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("result", sa.Enum("pass", "fail", "warn", name="compliance_result", create_constraint=False), nullable=False),
        sa.Column("violations", JSONB, nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── RLS Policies ────────────────────────────────────────
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY team_isolation_{table} ON {table}
            USING (team_id = current_setting('app.current_team_id')::uuid)
        """)

    # RLS for consent_records and audit_logs (non-BaseTenantModel but team-scoped)
    for table in ["consent_records", "audit_logs"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY team_isolation_{table} ON {table}
            USING (team_id = current_setting('app.current_team_id')::uuid)
        """)

    # ── Additional Indexes ──────────────────────────────────
    # Agent approvals: status + assigned user + expiry for inbox queries
    op.create_index(
        "ix_agent_approvals_status_user_expires",
        "agent_approvals",
        ["status", "assigned_to_user_id", "expires_at"],
    )

    # Memory chunks: vector index for similarity search
    op.execute("""
        CREATE INDEX ix_memory_chunks_embedding
        ON memory_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Set default for app.current_team_id to prevent errors on unset
    op.execute("""
        ALTER DATABASE acufy SET app.current_team_id = '00000000-0000-0000-0000-000000000000'
    """)


def downgrade() -> None:
    # Drop RLS policies
    tables_with_rls = TENANT_TABLES + ["consent_records", "audit_logs"]
    for table in tables_with_rls:
        op.execute(f"DROP POLICY IF EXISTS team_isolation_{table} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Drop tables in reverse dependency order
    for table in [
        "compliance_checks", "audit_logs", "memory_chunks",
        "agent_approvals", "agent_tasks", "agent_runs",
        "consent_records", "tasks", "activities",
        "deal_line_items", "deal_contact_roles", "deals",
        "deal_stages", "products", "contacts", "accounts",
        "users", "teams",
    ]:
        op.drop_table(table)

    # Drop enums
    for enum_name in [
        "compliance_result", "memory_source", "approval_status",
        "approval_type", "agent_run_status", "contact_role_type",
        "consent_action", "consent_type", "task_status",
        "activity_type", "user_role",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    # Drop extensions
    op.execute('DROP EXTENSION IF EXISTS "vector"')
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
