"""seed built-in campaign templates

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-05-11 05:00:00.000000

"""
import json
import uuid
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------
#
# 4 built-in rows — tenant_id NULL so every tenant sees them.
# 2 are active (customer_acquisition motion), 2 are inactive scaffolds.

_TEMPLATES = [
    # ── 1. Walk-In Lead Capture ───────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "type_key": "customer_acquisition",
        "name": "Walk-In Lead Capture",
        "description": (
            "Minimal form for capturing leads at events, pop-ups, or in-store. "
            "Just name + phone — frictionless submission."
        ),
        "form_schema": {
            "version": 1,
            "fields": [
                {
                    "id": "fullname",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "placeholder": "e.g. Priya Sharma",
                },
                {
                    "id": "phone",
                    "type": "phone",
                    "label": "Phone Number",
                    "required": True,
                    "placeholder": "+91 98765 43210",
                },
            ],
            "submit_action": {"kind": "save_submission"},
        },
        "audience_spec": {
            "geo": {"countries": ["IN"]},
            "age_min": 18,
            "age_max": 60,
        },
        "default_creative_pattern": {
            "source_channels": ["web_form", "manual"],
        },
        "is_active": True,
    },
    # ── 2. Social DM Funnel ───────────────────────────────────────────────
    {
        "id": str(uuid.uuid4()),
        "type_key": "customer_acquisition",
        "name": "Social DM Funnel",
        "description": (
            "Full-funnel template for Instagram/WhatsApp lead ads. "
            "Captures name, phone, email, and referral source with a 18–35 audience preset."
        ),
        "form_schema": {
            "version": 1,
            "fields": [
                {
                    "id": "fullname",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "placeholder": "e.g. Arjun Mehta",
                },
                {
                    "id": "phone",
                    "type": "phone",
                    "label": "Phone Number",
                    "required": True,
                    "placeholder": "+91 98765 43210",
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": False,
                    "placeholder": "arjun@email.com",
                },
                {
                    "id": "referral_source",
                    "type": "select",
                    "label": "How did you hear about us?",
                    "required": False,
                    "options": [
                        "Instagram",
                        "WhatsApp",
                        "Friend / Referral",
                        "Google",
                        "Walk-in",
                        "Other",
                    ],
                },
            ],
            "submit_action": {"kind": "save_submission"},
        },
        "audience_spec": {
            "geo": {"countries": ["IN"]},
            "age_min": 18,
            "age_max": 35,
            "lookalike_size_percent": 2,
        },
        "default_creative_pattern": {
            "source_channels": ["instagram", "whatsapp", "web_form"],
        },
        "is_active": True,
    },
    # ── 3. Talent Pool — Beauty Professional (inactive scaffold) ──────────
    {
        "id": str(uuid.uuid4()),
        "type_key": "talent_acquisition",
        "name": "Talent Pool — Beauty Professional",
        "description": (
            "Hiring pipeline for stylists, therapists, and beauty professionals. "
            "Captures experience level and role preference. "
            "Requires legal disclosure footer before activating."
        ),
        "form_schema": {
            "version": 1,
            "fields": [
                {
                    "id": "fullname",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "placeholder": "e.g. Riya Joshi",
                },
                {
                    "id": "phone",
                    "type": "phone",
                    "label": "Phone Number",
                    "required": True,
                    "placeholder": "+91 98765 43210",
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True,
                    "placeholder": "riya@email.com",
                },
                {
                    "id": "role",
                    "type": "select",
                    "label": "Role Applying For",
                    "required": True,
                    "options": [
                        "Hairstylist",
                        "Skin Therapist",
                        "Nail Technician",
                        "Makeup Artist",
                        "Receptionist",
                        "Manager",
                    ],
                },
                {
                    "id": "experience_years",
                    "type": "select",
                    "label": "Years of Experience",
                    "required": True,
                    "options": [
                        "Less than 1 year",
                        "1–2 years",
                        "3–5 years",
                        "5+ years",
                    ],
                },
            ],
            "submit_action": {"kind": "save_submission"},
        },
        "audience_spec": {
            "geo": {"countries": ["IN"]},
            "age_min": 18,
            "age_max": 45,
        },
        "default_creative_pattern": {
            "source_channels": ["web_form", "manual"],
        },
        "is_active": False,
    },
    # ── 4. Franchise Inquiry (inactive scaffold) ───────────────────────────
    {
        "id": str(uuid.uuid4()),
        "type_key": "franchise_development",
        "name": "Franchise Inquiry",
        "description": (
            "Pipeline for prospective franchisees. Captures city, investment capacity, "
            "and background. Regulated motion — ensure legal disclosure is set before activating."
        ),
        "form_schema": {
            "version": 1,
            "fields": [
                {
                    "id": "fullname",
                    "type": "text",
                    "label": "Full Name",
                    "required": True,
                    "placeholder": "e.g. Vikram Nair",
                },
                {
                    "id": "phone",
                    "type": "phone",
                    "label": "Phone Number",
                    "required": True,
                    "placeholder": "+91 98765 43210",
                },
                {
                    "id": "email",
                    "type": "email",
                    "label": "Email Address",
                    "required": True,
                    "placeholder": "vikram@business.com",
                },
                {
                    "id": "city",
                    "type": "text",
                    "label": "City of Interest",
                    "required": True,
                    "placeholder": "e.g. Pune",
                },
                {
                    "id": "investment_range",
                    "type": "select",
                    "label": "Investment Capacity",
                    "required": True,
                    "options": [
                        "₹10L – ₹25L",
                        "₹25L – ₹50L",
                        "₹50L – ₹1Cr",
                        "Above ₹1Cr",
                    ],
                },
                {
                    "id": "business_background",
                    "type": "select",
                    "label": "Business Background",
                    "required": False,
                    "options": [
                        "First-time entrepreneur",
                        "Existing business owner",
                        "Corporate / Salaried",
                        "Retired professional",
                    ],
                },
            ],
            "submit_action": {"kind": "save_submission"},
        },
        "audience_spec": {
            "geo": {"countries": ["IN"]},
            "age_min": 25,
            "age_max": 60,
        },
        "default_creative_pattern": {
            "source_channels": ["web_form", "manual"],
        },
        "is_active": False,
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    for tmpl in _TEMPLATES:
        row = conn.execute(
            sa.text("SELECT id FROM campaign_types WHERE key = :key"),
            {"key": tmpl["type_key"]},
        ).fetchone()

        if row is None:
            continue  # campaign_types not seeded — skip gracefully

        conn.execute(
            sa.text("""
                INSERT INTO campaign_templates
                    (id, tenant_id, name, description, campaign_type_id,
                     form_schema, audience_spec, default_creative_pattern,
                     is_built_in, is_active)
                VALUES
                    (:id, NULL, :name, :description, :campaign_type_id,
                     CAST(:form_schema AS jsonb), CAST(:audience_spec AS jsonb),
                     CAST(:default_creative_pattern AS jsonb),
                     TRUE, :is_active)
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": tmpl["id"],
                "name": tmpl["name"],
                "description": tmpl["description"],
                "campaign_type_id": row[0],
                "form_schema": json.dumps(tmpl["form_schema"]),
                "audience_spec": json.dumps(tmpl["audience_spec"]),
                "default_creative_pattern": json.dumps(tmpl["default_creative_pattern"]),
                "is_active": tmpl["is_active"],
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    for tmpl in _TEMPLATES:
        conn.execute(
            sa.text("DELETE FROM campaign_templates WHERE id = :id"),
            {"id": tmpl["id"]},
        )
