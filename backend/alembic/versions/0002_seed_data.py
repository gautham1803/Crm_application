"""0002 — Seed demo data.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-21
"""
from typing import Sequence, Union
from datetime import datetime, timedelta, date
import uuid

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── Fixed UUIDs for deterministic references ────────────────
TEAM_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_ID = "00000000-0000-0000-0000-000000000010"
REP_ID = "00000000-0000-0000-0000-000000000011"

# Pipeline stage IDs
STAGE_IDS = {
    "Lead": "00000000-0000-0000-0001-000000000001",
    "Qualified": "00000000-0000-0000-0001-000000000002",
    "Demo/Meeting": "00000000-0000-0000-0001-000000000003",
    "Proposal": "00000000-0000-0000-0001-000000000004",
    "Negotiation": "00000000-0000-0000-0001-000000000005",
    "Won": "00000000-0000-0000-0001-000000000006",
    "Lost": "00000000-0000-0000-0001-000000000007",
}

# Account IDs
ACCOUNT_IDS = [
    "00000000-0000-0000-0002-000000000001",
    "00000000-0000-0000-0002-000000000002",
    "00000000-0000-0000-0002-000000000003",
    "00000000-0000-0000-0002-000000000004",
    "00000000-0000-0000-0002-000000000005",
]

# Contact IDs (20 total: 12 B2B + 8 B2C)
CONTACT_IDS = [f"00000000-0000-0000-0003-{str(i).zfill(12)}" for i in range(1, 21)]

# Product IDs
PRODUCT_IDS = [f"00000000-0000-0000-0004-{str(i).zfill(12)}" for i in range(1, 11)]

# Deal IDs
DEAL_IDS = [f"00000000-0000-0000-0005-{str(i).zfill(12)}" for i in range(1, 9)]


def upgrade() -> None:
    # Need to bypass RLS for seeding
    op.execute(f"SET LOCAL app.current_team_id = '{TEAM_ID}'")

    # ── Team ────────────────────────────────────────────────
    op.execute(f"""
        INSERT INTO teams (id, name, timezone, default_currency, company_signature_block, active_rule_packs)
        VALUES (
            '{TEAM_ID}',
            'Acufy Demo Team',
            'America/New_York',
            'USD',
            'Acufy Sales Team | 123 Demo St, New York NY 10001 | Unsubscribe: {{unsubscribe_url}}',
            ARRAY['universal']::varchar[]
        )
    """)

    # ── Users ───────────────────────────────────────────────
    op.execute(f"""
        INSERT INTO users (id, team_id, auth0_sub, email, name, role) VALUES
        ('{ADMIN_ID}', '{TEAM_ID}', 'dev|admin-001', 'admin@demo.com', 'Admin User', 'admin'),
        ('{REP_ID}', '{TEAM_ID}', 'dev|rep-001', 'rep@demo.com', 'Sales Rep', 'rep')
    """)

    # ── Pipeline Stages ─────────────────────────────────────
    stages = [
        ("Lead", 0, False, False),
        ("Qualified", 1, False, False),
        ("Demo/Meeting", 2, False, False),
        ("Proposal", 3, False, False),
        ("Negotiation", 4, False, False),
        ("Won", 5, True, False),
        ("Lost", 6, False, True),
    ]
    for name, pos, is_won, is_lost in stages:
        sid = STAGE_IDS[name]
        op.execute(f"""
            INSERT INTO deal_stages (id, team_id, name, position, is_won, is_lost)
            VALUES ('{sid}', '{TEAM_ID}', '{name}', {pos}, {str(is_won).lower()}, {str(is_lost).lower()})
        """)

    # ── Accounts (5 B2B companies) ──────────────────────────
    accounts = [
        (ACCOUNT_IDS[0], "TechVista Solutions", "techvista.io", "Technology", "51-200", 12000000),
        (ACCOUNT_IDS[1], "GreenLeaf Manufacturing", "greenleaf-mfg.com", "Manufacturing", "201-500", 45000000),
        (ACCOUNT_IDS[2], "Meridian Healthcare", "meridianhealth.com", "Healthcare", "501-1000", 120000000),
        (ACCOUNT_IDS[3], "Atlas Financial Group", "atlasfinancial.com", "Financial Services", "201-500", 80000000),
        (ACCOUNT_IDS[4], "NovaStar Media", "novastarmedia.com", "Media & Entertainment", "11-50", 5000000),
    ]
    for aid, name, domain, industry, size, revenue in accounts:
        op.execute(f"""
            INSERT INTO accounts (id, team_id, name, domain, industry, size, annual_revenue)
            VALUES ('{aid}', '{TEAM_ID}', '{name}', '{domain}', '{industry}', '{size}', {revenue})
        """)

    # ── Contacts (20: first 12 attached to accounts, last 8 standalone B2C) ─
    b2b_contacts = [
        (CONTACT_IDS[0], "Sarah", "Chen", "sarah.chen@techvista.io", "+15551001001", ACCOUNT_IDS[0], True, True),
        (CONTACT_IDS[1], "Michael", "Rodriguez", "m.rodriguez@techvista.io", "+15551001002", ACCOUNT_IDS[0], True, True),
        (CONTACT_IDS[2], "Emily", "Watson", "ewatson@techvista.io", None, ACCOUNT_IDS[0], False, True),
        (CONTACT_IDS[3], "James", "Foster", "jfoster@greenleaf-mfg.com", "+15551002001", ACCOUNT_IDS[1], True, True),
        (CONTACT_IDS[4], "Linda", "Park", "lpark@greenleaf-mfg.com", "+15551002002", ACCOUNT_IDS[1], False, True),
        (CONTACT_IDS[5], "Robert", "Kim", "rkim@meridianhealth.com", "+15551003001", ACCOUNT_IDS[2], True, True),
        (CONTACT_IDS[6], "Jennifer", "Adams", "jadams@meridianhealth.com", "+15551003002", ACCOUNT_IDS[2], True, True),
        (CONTACT_IDS[7], "David", "Thompson", "dthompson@meridianhealth.com", None, ACCOUNT_IDS[2], False, True),
        (CONTACT_IDS[8], "Patricia", "Rivera", "privera@atlasfinancial.com", "+15551004001", ACCOUNT_IDS[3], True, True),
        (CONTACT_IDS[9], "Daniel", "Chang", "dchang@atlasfinancial.com", "+15551004002", ACCOUNT_IDS[3], False, True),
        (CONTACT_IDS[10], "Olivia", "Martinez", "omartinez@novastarmedia.com", "+15551005001", ACCOUNT_IDS[4], True, True),
        (CONTACT_IDS[11], "William", "Lee", "wlee@novastarmedia.com", None, ACCOUNT_IDS[4], False, True),
    ]

    b2c_contacts = [
        (CONTACT_IDS[12], "Alex", "Johnson", "alex.j@gmail.com", "+15552001001", None, True, True),
        (CONTACT_IDS[13], "Maria", "Garcia", "maria.garcia@yahoo.com", "+15552001002", None, False, True),
        (CONTACT_IDS[14], "Chris", "Williams", "cwilliams@outlook.com", "+15552001003", None, True, True),
        (CONTACT_IDS[15], "Jessica", "Brown", "jbrown@hotmail.com", None, None, False, True),
        (CONTACT_IDS[16], "Ryan", "Davis", "rdavis@gmail.com", "+15552001005", None, True, True),
        (CONTACT_IDS[17], "Amanda", "Wilson", "awilson@proton.me", "+15552001006", None, False, True),
        (CONTACT_IDS[18], "Kevin", "Taylor", "ktaylor@icloud.com", None, None, False, True),
        (CONTACT_IDS[19], "Laura", "Moore", "lmoore@gmail.com", "+15552001008", None, True, True),
    ]

    now_str = datetime.utcnow().isoformat()
    for cid, first, last, email, phone, account_id, consent_sms, consent_email in b2b_contacts + b2c_contacts:
        phone_val = f"'{phone}'" if phone else "NULL"
        account_val = f"'{account_id}'" if account_id else "NULL"
        op.execute(f"""
            INSERT INTO contacts (id, team_id, first_name, last_name, email, phone, account_id,
                                  consent_sms, consent_email, consent_source, consent_timestamp)
            VALUES ('{cid}', '{TEAM_ID}', '{first}', '{last}', '{email}', {phone_val}, {account_val},
                    {str(consent_sms).lower()}, {str(consent_email).lower()}, 'seed_data', '{now_str}')
        """)

    # Write consent records for contacts with SMS consent
    for cid, first, last, email, phone, account_id, consent_sms, consent_email in b2b_contacts + b2c_contacts:
        if consent_email:
            cr_id = str(uuid.uuid4())
            op.execute(f"""
                INSERT INTO consent_records (id, contact_id, team_id, type, action, source)
                VALUES ('{cr_id}', '{cid}', '{TEAM_ID}', 'email', 'grant', 'seed_data')
            """)
        if consent_sms:
            cr_id = str(uuid.uuid4())
            op.execute(f"""
                INSERT INTO consent_records (id, contact_id, team_id, type, action, source)
                VALUES ('{cr_id}', '{cid}', '{TEAM_ID}', 'sms', 'grant', 'seed_data')
            """)

    # ── Products (10) ───────────────────────────────────────
    products = [
        (PRODUCT_IDS[0], "Acufy Starter Plan", "SKU-START-001", "Basic CRM plan for small teams", 29.00),
        (PRODUCT_IDS[1], "Acufy Professional Plan", "SKU-PRO-001", "Advanced CRM with AI features", 79.00),
        (PRODUCT_IDS[2], "Acufy Enterprise Plan", "SKU-ENT-001", "Full featured CRM with custom integrations", 199.00),
        (PRODUCT_IDS[3], "Data Migration Service", "SKU-SVC-001", "One-time data migration from existing CRM", 2500.00),
        (PRODUCT_IDS[4], "Custom Integration", "SKU-SVC-002", "Custom API integration development", 5000.00),
        (PRODUCT_IDS[5], "Training Package (Basic)", "SKU-TRN-001", "4-hour team training session", 500.00),
        (PRODUCT_IDS[6], "Training Package (Advanced)", "SKU-TRN-002", "Full day advanced training with certification", 1200.00),
        (PRODUCT_IDS[7], "AI Add-on: Lead Scoring", "SKU-AI-001", "AI-powered lead scoring module", 49.00),
        (PRODUCT_IDS[8], "AI Add-on: Email Assistant", "SKU-AI-002", "AI email drafting and personalization", 39.00),
        (PRODUCT_IDS[9], "Premium Support", "SKU-SUP-001", "24/7 priority support with dedicated CSM", 149.00),
    ]
    for pid, name, sku, desc, price in products:
        op.execute(f"""
            INSERT INTO products (id, team_id, name, sku, description, price, currency)
            VALUES ('{pid}', '{TEAM_ID}', '{name}', '{sku}', '{desc}', {price}, 'USD')
        """)

    # ── Deals (5 B2B + 3 B2C) ──────────────────────────────
    today = date.today()
    deals = [
        # B2B deals (linked to accounts + stakeholders)
        (DEAL_IDS[0], "TechVista Enterprise License", 95400.00, STAGE_IDS["Proposal"], None, ACCOUNT_IDS[0], (today + timedelta(days=30)).isoformat(), 60),
        (DEAL_IDS[1], "GreenLeaf Digital Transformation", 150000.00, STAGE_IDS["Negotiation"], None, ACCOUNT_IDS[1], (today + timedelta(days=15)).isoformat(), 75),
        (DEAL_IDS[2], "Meridian CRM Migration", 280000.00, STAGE_IDS["Demo/Meeting"], None, ACCOUNT_IDS[2], (today + timedelta(days=60)).isoformat(), 30),
        (DEAL_IDS[3], "Atlas Financial Suite", 45000.00, STAGE_IDS["Qualified"], None, ACCOUNT_IDS[3], (today + timedelta(days=45)).isoformat(), 25),
        (DEAL_IDS[4], "NovaStar Media Pack", 18000.00, STAGE_IDS["Won"], None, ACCOUNT_IDS[4], today.isoformat(), 100),
        # B2C deals (linked directly to contacts)
        (DEAL_IDS[5], "Alex Johnson Pro Plan", 948.00, STAGE_IDS["Lead"], CONTACT_IDS[12], None, (today + timedelta(days=14)).isoformat(), 10),
        (DEAL_IDS[6], "Chris Williams Enterprise", 2388.00, STAGE_IDS["Proposal"], CONTACT_IDS[14], None, (today + timedelta(days=20)).isoformat(), 50),
        (DEAL_IDS[7], "Ryan Davis Starter", 348.00, STAGE_IDS["Qualified"], CONTACT_IDS[16], None, (today + timedelta(days=7)).isoformat(), 40),
    ]
    for did, name, amount, stage_id, contact_id, account_id, close_date, prob in deals:
        contact_val = f"'{contact_id}'" if contact_id else "NULL"
        account_val = f"'{account_id}'" if account_id else "NULL"
        op.execute(f"""
            INSERT INTO deals (id, team_id, name, amount, currency, expected_close_date, probability,
                               stage_id, contact_id, account_id, owner_user_id)
            VALUES ('{did}', '{TEAM_ID}', '{name}', {amount}, 'USD', '{close_date}', {prob},
                    '{stage_id}', {contact_val}, {account_val}, '{REP_ID}')
        """)

    # ── Deal Contact Roles (B2B stakeholders) ───────────────
    stakeholders = [
        (DEAL_IDS[0], CONTACT_IDS[0], "decision_maker"),
        (DEAL_IDS[0], CONTACT_IDS[1], "champion"),
        (DEAL_IDS[0], CONTACT_IDS[2], "end_user"),
        (DEAL_IDS[1], CONTACT_IDS[3], "decision_maker"),
        (DEAL_IDS[1], CONTACT_IDS[4], "influencer"),
        (DEAL_IDS[2], CONTACT_IDS[5], "champion"),
        (DEAL_IDS[2], CONTACT_IDS[6], "decision_maker"),
        (DEAL_IDS[2], CONTACT_IDS[7], "end_user"),
        (DEAL_IDS[3], CONTACT_IDS[8], "decision_maker"),
        (DEAL_IDS[3], CONTACT_IDS[9], "blocker"),
        (DEAL_IDS[4], CONTACT_IDS[10], "decision_maker"),
        (DEAL_IDS[4], CONTACT_IDS[11], "end_user"),
    ]
    for deal_id, contact_id, role in stakeholders:
        dcr_id = str(uuid.uuid4())
        op.execute(f"""
            INSERT INTO deal_contact_roles (id, team_id, deal_id, contact_id, role)
            VALUES ('{dcr_id}', '{TEAM_ID}', '{deal_id}', '{contact_id}', '{role}')
        """)

    # ── Deal Line Items ─────────────────────────────────────
    line_items = [
        (DEAL_IDS[0], PRODUCT_IDS[2], 4, 199.00),    # 4 Enterprise licenses
        (DEAL_IDS[0], PRODUCT_IDS[3], 1, 2500.00),   # Data migration
        (DEAL_IDS[1], PRODUCT_IDS[2], 10, 199.00),   # 10 Enterprise licenses
        (DEAL_IDS[1], PRODUCT_IDS[4], 2, 5000.00),   # 2 Custom integrations
        (DEAL_IDS[2], PRODUCT_IDS[2], 50, 199.00),   # 50 Enterprise licenses
        (DEAL_IDS[2], PRODUCT_IDS[6], 3, 1200.00),   # 3 Advanced trainings
        (DEAL_IDS[5], PRODUCT_IDS[1], 1, 79.00),     # 1 Pro Plan (annual)
        (DEAL_IDS[6], PRODUCT_IDS[2], 1, 199.00),    # 1 Enterprise
        (DEAL_IDS[7], PRODUCT_IDS[0], 1, 29.00),     # 1 Starter
    ]
    for deal_id, product_id, qty, price in line_items:
        li_id = str(uuid.uuid4())
        op.execute(f"""
            INSERT INTO deal_line_items (id, team_id, deal_id, product_id, quantity, unit_price, currency)
            VALUES ('{li_id}', '{TEAM_ID}', '{deal_id}', '{product_id}', {qty}, {price}, 'USD')
        """)

    # ── Activities (2-3 per deal) ───────────────────────────
    activities_data = [
        # Deal 0: TechVista
        ("email", CONTACT_IDS[0], None, DEAL_IDS[0], "Initial Outreach", "Sent introductory email about Acufy Enterprise capabilities.", -10),
        ("call", CONTACT_IDS[0], None, DEAL_IDS[0], "Discovery Call", "30-minute call discussing current CRM pain points and requirements.", -7),
        ("note", CONTACT_IDS[1], None, DEAL_IDS[0], "Champion Engaged", "Michael is enthusiastic about AI features. Key internal advocate.", -3),
        # Deal 1: GreenLeaf
        ("email", CONTACT_IDS[3], None, DEAL_IDS[1], "Proposal Sent", "Sent detailed proposal for digital transformation project.", -14),
        ("meeting", CONTACT_IDS[3], None, DEAL_IDS[1], "Negotiation Meeting", "Discussed pricing and implementation timeline. Close to agreement.", -5),
        # Deal 2: Meridian
        ("call", CONTACT_IDS[5], None, DEAL_IDS[2], "Initial Contact", "Cold call - expressed interest in CRM migration from legacy system.", -20),
        ("email", CONTACT_IDS[6], None, DEAL_IDS[2], "Demo Scheduled", "Confirmed demo date with decision makers.", -12),
        ("note", None, None, DEAL_IDS[2], "Competitive Intel", "Meridian is also evaluating Salesforce. Need to highlight AI advantage.", -8),
        # Deal 3: Atlas
        ("email", CONTACT_IDS[8], None, DEAL_IDS[3], "Qualification Email", "Sent questionnaire to understand financial compliance requirements.", -6),
        ("note", CONTACT_IDS[9], None, DEAL_IDS[3], "Blocker Identified", "Daniel has concerns about data security. Need to address in next meeting.", -2),
        # Deal 4: NovaStar (Won)
        ("email", CONTACT_IDS[10], None, DEAL_IDS[4], "Contract Signed", "Olivia signed the annual contract. Onboarding starts next week.", -1),
        ("note", None, None, DEAL_IDS[4], "Post-Sale Note", "Great customer - potential case study candidate.", 0),
        # Deal 5-7: B2C
        ("email", CONTACT_IDS[12], None, DEAL_IDS[5], "Welcome Email", "Sent welcome email to Alex after form submission.", -3),
        ("sms", CONTACT_IDS[14], None, DEAL_IDS[6], "Follow Up", "Followed up on proposal via SMS.", -1),
        ("call", CONTACT_IDS[16], None, DEAL_IDS[7], "Qualification Call", "Quick call to understand Ryan's needs.", -4),
    ]
    for atype, contact_id, account_id, deal_id, subject, body, days_ago in activities_data:
        aid = str(uuid.uuid4())
        contact_val = f"'{contact_id}'" if contact_id else "NULL"
        account_val = f"'{account_id}'" if account_id else "NULL"
        deal_val = f"'{deal_id}'" if deal_id else "NULL"
        occurred = (datetime.utcnow() + timedelta(days=days_ago)).isoformat()
        body_escaped = body.replace("'", "''")
        op.execute(f"""
            INSERT INTO activities (id, team_id, type, contact_id, account_id, deal_id,
                                    subject, body, occurred_at)
            VALUES ('{aid}', '{TEAM_ID}', '{atype}', {contact_val}, {account_val}, {deal_val},
                    '{subject}', '{body_escaped}', '{occurred}')
        """)


def downgrade() -> None:
    op.execute(f"SET LOCAL app.current_team_id = '{TEAM_ID}'")
    # Delete in reverse dependency order
    op.execute(f"DELETE FROM activities WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM deal_line_items WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM deal_contact_roles WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM deals WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM deal_stages WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM products WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM consent_records WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM contacts WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM accounts WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM users WHERE team_id = '{TEAM_ID}'")
    op.execute(f"DELETE FROM teams WHERE id = '{TEAM_ID}'")
