# Ri'Serve Marketing & Conversations Module

Unified inbox + outbound marketing layer.  Phase 1 ships the inbox half
(deliverables 1–8 from spec).  Segmentation, campaigns, and journeys come next.

---

## What's built

| Layer | Files |
|---|---|
| Data models | `backend/models_pg.py` — 10 new `mkt_*` tables |
| Migration | `backend/alembic/versions/d4e5f6a7b8c9_add_marketing_conversations_module.py` |
| Channel adapters | `backend/channels/base.py`, `whatsapp_cloud.py` (+ stubs for IG/FB/TG/Email/SMS) |
| Send pipeline | `backend/services/send_pipeline.py` — 6-gate enforcement |
| Inbox REST API | `backend/routes/conversations.py` |
| Webhook ingestion | `backend/routes/webhooks_ingestion.py` |
| Frontend | `frontend/src/pages/Conversations/index.js` + `services/conversationsApi.js` |

---

## Local setup

### Prerequisites

```
PostgreSQL running (make db)
Backend venv activated
ngrok (for live WhatsApp webhook testing)
```

### 1. Run the migration

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

### 2. Create a WhatsApp inbox

```bash
curl -X POST http://localhost:8000/api/conversations/inboxes \
  -H "Authorization: Bearer <your_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ri'\''Serve R WhatsApp",
    "channel": "whatsapp",
    "credentials_ref": "{\"phone_number_id\":\"<META_PHONE_ID>\",\"waba_id\":\"<WABA_ID>\",\"access_token\":\"<META_TOKEN>\"}",
    "webhook_secret": "my-verify-token-123"
  }'
```

Save the returned `id` — that's your `<INBOX_ID>`.

### 3. Register the webhook with Meta

```bash
# Expose local port 8000
ngrok http 8000
```

In Meta Developer Console → WhatsApp → Configuration:

- **Callback URL**: `https://<your-ngrok>.ngrok.io/api/webhooks/whatsapp/<INBOX_ID>`
- **Verify token**: the `webhook_secret` you set above
- **Subscribed fields**: `messages`

### 4. Run the end-to-end test

```bash
# Send a test message from your phone to the sandbox number, then:
curl http://localhost:8000/api/conversations?status=open \
  -H "Authorization: Bearer <jwt>"
# Should return a new conversation with your message
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | JWT signing key |
| `WA_ACCESS_TOKEN` | Dev fallback | WhatsApp access token (overridden by `credentials_ref` in production) |

All WhatsApp credentials are stored as a JSON blob in `mkt_inboxes.credentials_ref`.
In production, swap this for a Vault path and decrypt at runtime in `WhatsAppCloudAdapter._get_credentials()`.

---

## API reference (Phase 1)

### Inboxes
```
GET  /api/conversations/inboxes                    list inboxes
POST /api/conversations/inboxes                    create inbox
GET  /api/conversations/inboxes/{id}/templates/sync  sync WA templates from Meta
GET  /api/conversations/templates?channel=whatsapp  list active templates
```

### Conversations
```
GET  /api/conversations                  list (filters: status, assignee_id, inbox_id, unread_only, cursor, limit)
GET  /api/conversations/{id}             get single conversation
GET  /api/conversations/{id}/messages    message history (cursor-paginated)
POST /api/conversations/{id}/messages    send message OR post internal note (is_note=true)
PUT  /api/conversations/{id}/assign      { assignee_id }
PUT  /api/conversations/{id}/status      { status: open|pending|resolved|snoozed, snooze_until? }
PUT  /api/conversations/{id}/labels      { labels: [] }
PUT  /api/conversations/{id}/unread/clear  reset unread counter
GET  /api/conversations/{id}/notes       list internal notes
```

### Customer identity & consent
```
GET  /api/conversations/customers/{id}/identities   list channel handles
POST /api/conversations/customers/{id}/identities   add handle
GET  /api/conversations/customers/{id}/consent      effective consent per (channel, purpose)
POST /api/conversations/customers/{id}/consent      record opt-in / opt-out
```

### Settings
```
GET /api/conversations/settings/frequency-cap
PUT /api/conversations/settings/frequency-cap   { max_per_day, max_per_week, quiet_hours_start, quiet_hours_end }
```

### Webhooks
```
GET  /api/webhooks/whatsapp/{inbox_id}   Meta verification challenge
POST /api/webhooks/whatsapp/{inbox_id}   inbound messages (returns 200 immediately, processes async)
```

### Realtime (WebSocket)
```
WS  /api/conversations/ws/{company_id}
```

Events pushed to connected clients:
```json
{ "type": "new_message",      "conversation_id": "...", "message": { ... } }
{ "type": "new_note",         "conversation_id": "...", "note": { ... } }
{ "type": "assignment_change","conversation_id": "...", "assignee_id": "..." }
```

---

## Send pipeline gates

Every outbound message (agent reply, future broadcast, future journey step) runs through
`services/send_pipeline.py::enqueue_message()` in this order:

1. **Customer / identity / inbox exist** — suppress `customer_not_found` / `no_channel_identity` / `inbox_not_found`
2. **Company not suspended** — suppress `company_suspended`
3. **Marketing consent** (marketing sends only) — suppress `no_consent`
4. **Frequency cap** (marketing sends only) — suppress `cap_exceeded_daily`
5. **Quiet hours** (marketing sends only) — suppress `quiet_hours`
6. **Channel service window** — free-form text outside 24 h window suppresses with `outside_service_window_use_template`

Suppressed sends are logged in the return value (`suppressed: true, reason: "..."`).
They do **not** raise exceptions, so callers can distinguish suppression from errors.

---

## Architecture decisions to revisit

| Decision | Options considered | Choice |
|---|---|---|
| **Celery vs BackgroundTasks** | Celery + Redis (production-grade, retries) vs FastAPI BackgroundTasks (no Redis dep) | BackgroundTasks for v1 — no Redis in current stack. Wire Celery by replacing `background_tasks.add_task(...)` with `task.delay(...)` |
| **Supabase Realtime vs WebSocket** | Supabase Realtime channels (managed) vs in-process WebSocket manager | In-process WebSocket — codebase uses raw Postgres, no Supabase. Scales to multiple workers with a Redis pub/sub fanout (easy swap point in `_ConnectionManager.broadcast`) |
| **Conversation scope** | Conversations belong to inboxes (one channel per conversation) vs tenants (multi-channel thread) | Inboxes — matches spec; customer profile stitches across channels in the right panel |
| **RLS** | Postgres RLS policies vs application-level `company_id` filter | Application-level filtering (consistent with rest of codebase). Postgres RLS would add defence-in-depth in production |
| **Credentials storage** | Raw JSON in `credentials_ref` vs Vault reference | Raw JSON dev shortcut — `credentials_ref` is designed as a Vault path string; swap `_get_credentials()` in `WhatsAppCloudAdapter` to decrypt from Vault |

---

## What comes next (Phase 2+)

- **Segmentation engine** — rule-tree query compiler, RFM buckets, lifecycle stages
- **Broadcast campaigns** — segment → template → schedule → Celery run → analytics
- **Journey runtime** — JSONB DAG, event-driven state machine in Postgres
- **Additional channels** in order: Instagram → Facebook Messenger → Telegram → Email → SMS
- **Visual journey builder** — drag-and-drop on top of existing JSON runtime
- **Agent typing indicators** — ephemeral WebSocket event, debounced 3 s timeout
