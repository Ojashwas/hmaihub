-- HyperOffice licensing schema, version 1.
-- Status: design artefact. Not yet executed against PostgreSQL (no database adapter exists).
-- Licensing metadata only: no document content, file names, or plaintext activation codes.

BEGIN;

CREATE SCHEMA IF NOT EXISTS licensing;
SET search_path = licensing;

CREATE TYPE code_status AS ENUM ('GENERATED','ASSIGNED','REDEEMED','SUSPENDED','REVOKED','EXPIRED','REPLACED');
CREATE TYPE code_kind AS ENUM ('activation','renewal','feature');
CREATE TYPE license_status AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE installation_status AS ENUM ('ACTIVE','DEACTIVATED');

CREATE TABLE customer (
  customer_id   text PRIMARY KEY CHECK (customer_id ~ '^cus_[0-9A-Za-z]{8,64}$'),
  account_id    text,
  territory     char(2),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "order" (
  order_id          text PRIMARY KEY CHECK (order_id ~ '^ord_[0-9A-Za-z]{8,64}$'),
  customer_id       text REFERENCES customer,
  source            text NOT NULL CHECK (source IN ('provider_webhook','purchase_order','reseller','admin_exception')),
  provider_event_id text,
  external_order_id text,
  currency          char(3),
  status            text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, provider_event_id)
);
-- Orders are immutable once created; corrections are new rows referencing the original.

CREATE TABLE entitlement_template (
  template_id     text PRIMARY KEY,
  kind            code_kind NOT NULL,
  edition         text NOT NULL,
  license_mode    text NOT NULL,
  products        text[] NOT NULL,
  features        text[] NOT NULL,
  limits          jsonb NOT NULL,
  term_unit       text CHECK (term_unit IN ('months','days')),
  term_length     integer CHECK (term_length > 0),
  renewal_policy  text,
  contract_start  timestamptz,
  co_terminate_at timestamptz,
  policy_version  integer NOT NULL DEFAULT 1
);

CREATE TABLE activation_code (
  code_id            text PRIMARY KEY,
  code_hash          text NOT NULL UNIQUE,          -- HMAC-SHA-256(pepper, normalized code); pepper in Key Vault
  template_id        text NOT NULL REFERENCES entitlement_template,
  status             code_status NOT NULL,
  issued_at          timestamptz NOT NULL,
  valid_from         timestamptz,
  redeem_by          timestamptz NOT NULL,
  max_installations  integer NOT NULL CHECK (max_installations >= 1),
  activation_count   integer NOT NULL DEFAULT 0 CHECK (activation_count >= 0 AND activation_count <= max_installations),
  channel            text NOT NULL,
  reseller           text,
  external_order_id  text,
  order_id           text REFERENCES "order",
  customer_id        text REFERENCES customer,
  license_id         text,
  replaced_by        text REFERENCES activation_code,
  created_by         text NOT NULL,
  fraud_flags        text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE license (
  license_id      text PRIMARY KEY CHECK (license_id ~ '^lic_[0-9A-Za-z]{8,64}$'),
  customer_id     text NOT NULL REFERENCES customer,
  order_id        text REFERENCES "order",
  edition         text NOT NULL,
  license_mode    text NOT NULL,
  products        text[] NOT NULL,
  features        text[] NOT NULL,
  limits          jsonb NOT NULL,
  nbf             timestamptz NOT NULL,
  exp             timestamptz NOT NULL CHECK (exp > nbf),
  grace_until     timestamptz NOT NULL CHECK (grace_until >= exp),
  activated_at    timestamptz NOT NULL,
  license_version integer NOT NULL CHECK (license_version >= 1),
  status          license_status NOT NULL
);
ALTER TABLE activation_code ADD FOREIGN KEY (license_id) REFERENCES license;

CREATE TABLE installation (
  license_id          text NOT NULL REFERENCES license,
  installation_id     text NOT NULL CHECK (installation_id ~ '^ins_[0-9A-Za-z]{8,64}$'),
  device_fingerprint  text NOT NULL CHECK (device_fingerprint ~ '^sha256:[A-Za-z0-9_-]{43}$'),
  status              installation_status NOT NULL,
  first_activated_at  timestamptz NOT NULL,
  last_activated_at   timestamptz NOT NULL,
  deactivated_at      timestamptz,
  PRIMARY KEY (license_id, installation_id)
);
CREATE INDEX installation_active ON installation (license_id) WHERE status = 'ACTIVE';

CREATE TABLE activation (
  activation_id   text PRIMARY KEY,
  license_id      text NOT NULL,
  installation_id text NOT NULL,
  code_id         text NOT NULL REFERENCES activation_code,
  app_version     text NOT NULL,
  platform        text NOT NULL,
  created_at      timestamptz NOT NULL,
  FOREIGN KEY (license_id, installation_id) REFERENCES installation
);

CREATE TABLE license_grant (
  jti             text PRIMARY KEY,
  license_id      text NOT NULL REFERENCES license,
  installation_id text NOT NULL,
  license_version integer NOT NULL,
  kid             text NOT NULL,
  issued_at       timestamptz NOT NULL,
  exp             timestamptz NOT NULL,
  supersedes_jti  text REFERENCES license_grant
);
CREATE INDEX license_grant_by_kid ON license_grant (kid, exp);  -- supports key-compromise impact analysis

CREATE TABLE revocation (
  revocation_id text PRIMARY KEY,
  subject_type  text NOT NULL CHECK (subject_type IN ('license','code','installation','key')),
  subject_id    text NOT NULL,
  reason        text NOT NULL,
  requested_by  text NOT NULL,
  approved_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_record (
  scope         text NOT NULL,
  key           text NOT NULL,
  request_hash  text NOT NULL,
  response      jsonb NOT NULL,
  created_at    timestamptz NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE request_nonce (
  nonce   text PRIMARY KEY,
  seen_at timestamptz NOT NULL
);

CREATE TABLE signing_key (
  kid              text PRIMARY KEY,
  purpose          text NOT NULL CHECK (purpose IN ('license','extension_root','first_party_extension','audit')),
  environment      text NOT NULL CHECK (environment IN ('production','staging','development')),
  algorithm        text NOT NULL CHECK (algorithm IN ('EdDSA','ES256','RS256')),
  key_vault_uri    text,                          -- reference only; private material never stored here
  status           text NOT NULL CHECK (status IN ('next','active','retired','compromised')),
  created_at       timestamptz NOT NULL,
  activated_at     timestamptz,
  retired_at       timestamptz,
  destroy_after    timestamptz,
  owner            text NOT NULL
);

CREATE TABLE audit_event (
  sequence        bigint PRIMARY KEY,
  event_id        text NOT NULL UNIQUE,
  at              timestamptz NOT NULL,
  actor           text NOT NULL,
  action          text NOT NULL,
  subject         text NOT NULL,
  result          text NOT NULL CHECK (result IN ('SUCCESS','FAILURE','DENIED')),
  correlation_id  text NOT NULL,
  reason          text,
  changes         jsonb,
  prev_hash       text NOT NULL,
  hash            text NOT NULL
);
-- The application role may INSERT and SELECT audit_event but never UPDATE or DELETE.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM PUBLIC;

COMMIT;
