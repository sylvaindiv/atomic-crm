-- Atomic CRM — SQLite/libSQL schema (Turso)
--
-- Ported from supabase/schemas/{01_tables,03_views}.sql.
-- Postgres -> SQLite mapping:
--   bigint identity PK      -> INTEGER PRIMARY KEY AUTOINCREMENT
--   timestamptz             -> TEXT (ISO-8601 strings)
--   jsonb / json            -> TEXT (JSON, (de)serialized by the backend)
--   bigint[] (tags,...)     -> TEXT (JSON array of numbers)
--   citext (email,website)  -> TEXT COLLATE NOCASE
--   boolean                 -> INTEGER (0/1, coerced to JS boolean by the backend)
--
-- Row-Level Security, grants, triggers and plpgsql functions are intentionally
-- dropped: this is a single-user, no-login deployment (authorization lives in
-- the app), and cascade/side-effect logic lives in the backend + data provider.

PRAGMA foreign_keys = ON;

-- Companies -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    name           TEXT NOT NULL,
    tenup_id       TEXT,
    sector         TEXT,
    size           INTEGER,
    linkedin_url   TEXT,
    website        TEXT COLLATE NOCASE,
    email          TEXT COLLATE NOCASE,
    social_links   TEXT,          -- JSON array of URLs
    phone_number   TEXT,
    address        TEXT,
    zipcode        TEXT,
    city           TEXT,
    state_abbr     TEXT,
    sales_id       INTEGER,
    context_links  TEXT,          -- JSON array of strings
    country        TEXT,
    description    TEXT,
    revenue        TEXT,
    tax_identifier TEXT,
    logo           TEXT           -- JSON object (RAFile)
);

-- Contacts --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_type   TEXT NOT NULL DEFAULT 'referee' CHECK (contact_type IN ('referee', 'partner')),
    first_name     TEXT,
    last_name      TEXT,
    gender         TEXT,
    title          TEXT,
    background     TEXT,
    avatar         TEXT,          -- JSON object (RAFile)
    first_seen     TEXT,
    last_seen      TEXT,
    has_newsletter INTEGER,       -- boolean
    status         TEXT,
    tags           TEXT,          -- JSON array of tag ids
    company_id     INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL,
    company_ids    TEXT NOT NULL DEFAULT '[]',
    tenup_id       TEXT,
    -- See adr/ADR-c7993f35-TASK-001-referred-by-self-fk.md
    referred_by_id INTEGER REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE SET NULL,
    sales_id       INTEGER REFERENCES sales(id),
    linkedin_url   TEXT,
    email_jsonb    TEXT,          -- JSON array of {email,type}
    phone_jsonb    TEXT,          -- JSON array of {number,type}
    postal_code    TEXT,
    city           TEXT,
    -- Folded in from the now-dropped deals table — a deal is just a
    -- contact row. See adr/ADR-33662640-TASK-001-fold-deals-into-contacts.md
    amount         INTEGER,
    description    TEXT,
    client_checklist TEXT NOT NULL DEFAULT '[]', -- JSON array of completed checklist item ids
    "index"        INTEGER
);

-- Contact notes ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    text        TEXT,
    date        TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    sales_id    INTEGER REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status      TEXT,
    attachments TEXT              -- JSON array of RAFile
);

-- Sales (users) ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL DEFAULT 'Pending',
    last_name     TEXT NOT NULL DEFAULT 'Pending',
    email         TEXT NOT NULL COLLATE NOCASE,
    administrator INTEGER NOT NULL DEFAULT 0,   -- boolean
    user_id       TEXT,                          -- legacy Supabase auth id (unused, kept for shape)
    avatar        TEXT,                          -- JSON object (RAFile)
    disabled      INTEGER NOT NULL DEFAULT 1     -- boolean; credentials activate accounts explicitly
);

-- Authentication --------------------------------------------------------------
-- `sales` remains the business directory. These private tables are deliberately
-- absent from server/resources.mjs and are only reachable through server/auth.mjs.
CREATE TABLE IF NOT EXISTS auth_credentials (
    sales_id            INTEGER PRIMARY KEY REFERENCES sales(id) ON DELETE CASCADE,
    email               TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    temporary_expires_at TEXT,
    credential_version  INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash          TEXT PRIMARY KEY,
    sales_id            INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    credential_version  INTEGER NOT NULL,
    expires_at          TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS column_preferences (
    sales_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    resource TEXT NOT NULL CHECK (resource IN ('companies', 'contacts', 'partners')),
    settings TEXT NOT NULL,
    PRIMARY KEY (sales_id, resource)
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    email               TEXT NOT NULL COLLATE NOCASE,
    remote_address      TEXT NOT NULL,
    attempted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Tags ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    color TEXT NOT NULL
);

-- Tasks -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE CASCADE,
    type       TEXT,
    text       TEXT,
    due_date   TEXT,
    done_date  TEXT,
    sales_id   INTEGER
);

-- Configuration (singleton row id=1) ------------------------------------------
CREATE TABLE IF NOT EXISTS configuration (
    id     INTEGER PRIMARY KEY CHECK (id = 1),
    config TEXT NOT NULL DEFAULT '{}'          -- JSON object
);

-- Favicons excluded domains ---------------------------------------------------
CREATE TABLE IF NOT EXISTS favicons_excluded_domains (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL
);

-- Record history (audit log) ---------------------------------------------------
-- Append-only log of create/update writes across all resources, populated by
-- server/query.mjs (create/update/updateMany) — there are no DB triggers in
-- this SQLite deployment (see note above). No FK: table_name is polymorphic.
CREATE TABLE IF NOT EXISTS record_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('create', 'update')),
    data        TEXT,          -- JSON snapshot of the written row/fields
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes on foreign keys -----------------------------------------------------
CREATE INDEX IF NOT EXISTS contact_notes_contact_id_idx ON contact_notes (contact_id);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx      ON contacts (company_id);
CREATE INDEX IF NOT EXISTS contacts_type_idx            ON contacts (contact_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq__sales__email       ON sales (email);
CREATE INDEX IF NOT EXISTS auth_sessions_sales_id_idx ON auth_sessions (sales_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_login_attempts_email_idx ON auth_login_attempts (email, attempted_at);
CREATE INDEX IF NOT EXISTS auth_login_attempts_address_idx ON auth_login_attempts (remote_address, attempted_at);
CREATE INDEX IF NOT EXISTS record_history_table_record_idx ON record_history (table_name, record_id);
CREATE INDEX IF NOT EXISTS record_history_created_at_idx   ON record_history (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS companies_tenup_id_idx ON companies (tenup_id);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_tenup_id_idx ON contacts (tenup_id);

-- Detach secondary and primary memberships even for direct SQL deletions.
CREATE TRIGGER IF NOT EXISTS companies_detach_contacts BEFORE DELETE ON companies
BEGIN
  UPDATE contacts SET
    company_ids = (SELECT json_group_array(value) FROM json_each(contacts.company_ids) WHERE value != OLD.id),
    company_id = (SELECT value FROM json_each(contacts.company_ids) WHERE value != OLD.id LIMIT 1)
  WHERE id IN (SELECT co.id FROM contacts co, json_each(co.company_ids) j WHERE j.value = OLD.id);
END;

-- Views -----------------------------------------------------------------------
-- companies_summary: adds aggregate contact count.
DROP VIEW IF EXISTS companies_summary;
CREATE VIEW companies_summary AS
SELECT
    c.*,
    (SELECT count(*) FROM contacts co WHERE EXISTS (SELECT 1 FROM json_each(co.company_ids) WHERE value = c.id) AND co.contact_type = 'referee') AS nb_contacts
FROM companies c;

-- contacts_summary: adds company_name, referred_by_name, open-task count, and
-- full-text search helper columns extracted from the email/phone JSON arrays.
DROP VIEW IF EXISTS contacts_summary;
CREATE VIEW contacts_summary AS
SELECT
    co.*,
    (SELECT group_concat(json_extract(je.value, '$.email'), ' ')
       FROM json_each(CASE WHEN json_valid(co.email_jsonb) THEN co.email_jsonb ELSE '[]' END) je
    ) AS email_fts,
    (SELECT group_concat(json_extract(je.value, '$.number'), ' ')
       FROM json_each(CASE WHEN json_valid(co.phone_jsonb) THEN co.phone_jsonb ELSE '[]' END) je
    ) AS phone_fts,
    (SELECT group_concat(cmp.name, ', ') FROM json_each(co.company_ids) j JOIN companies cmp ON cmp.id = j.value) AS company_name,
    (SELECT trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, ''))
       FROM contacts r WHERE r.id = co.referred_by_id
    ) AS referred_by_name,
    (SELECT count(*) FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL) AS nb_tasks,
    (SELECT text FROM contact_notes cn WHERE cn.contact_id = co.id ORDER BY date DESC LIMIT 1) AS latest_note_text,
    -- Due date of this contact's earliest open task (their next action).
    (SELECT MIN(t.due_date) FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL) AS next_action_due_date,
    -- Most recent contact event: creation, note date, or task due/done date.
    (SELECT MAX(x) FROM (
       SELECT co.first_seen AS x
       UNION ALL SELECT MAX(cn.date) FROM contact_notes cn WHERE cn.contact_id = co.id
       UNION ALL SELECT MAX(t.due_date)  FROM tasks t WHERE t.contact_id = co.id
       UNION ALL SELECT MAX(t.done_date) FROM tasks t WHERE t.contact_id = co.id
    )) AS last_activity_at
FROM contacts co;
