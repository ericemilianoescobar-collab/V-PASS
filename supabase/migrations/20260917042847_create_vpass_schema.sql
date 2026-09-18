/*
# V-PASS Schema — Agencies, Events, Validators, Tickets, Validations

## Overview
V-PASS is an online ticket/entry control agency using QR code scanners.
Agencies contract a plan (basic/standard/premium), create events, generate tickets,
and assign validators who scan QR codes at the event entrance.

## Auth Model
- Agencies log in via Supabase Auth (V-PASS admin creates their accounts manually
  with fictitious email/password — no self-signup).
- Validators use a custom table with hashed passwords (pgcrypto crypt()).
  Agencies create validator accounts per-event from the dashboard.

## New Tables

1. agencies
   - Extends auth.users with agency-specific profile data.
   - id (uuid, PK, references auth.users)
   - agency_name (text) — display name of the agency
   - plan (text) — 'basic' | 'standard' | 'premium'
   - max_tickets (int) — 250 / 350 / null (unlimited)
   - max_validators (int) — 1 / 3 / 5
   - whatsapp_number (text, nullable)
   - created_at (timestamptz)

2. events
   - id (uuid, PK)
   - agency_id (uuid, FK → agencies)
   - name (text)
   - description (text, nullable)
   - event_date (date)
   - location (text, nullable)
   - status (text, default 'active') — 'active' | 'completed' | 'cancelled'
   - created_at (timestamptz)

3. validators
   - Custom auth for event-day staff.
   - id (uuid, PK)
   - event_id (uuid, FK → events)
   - email (text)
   - password_hash (text) — pgcrypto crypt() hash
   - name (text)
   - active (boolean, default true)
   - created_at (timestamptz)

4. tickets
   - id (uuid, PK)
   - event_id (uuid, FK → events)
   - code (text, unique) — the QR code payload
   - attendee_name (text, nullable)
   - attendee_email (text, nullable)
   - status (text, default 'valid') — 'valid' | 'used' | 'cancelled'
   - created_at (timestamptz)

5. validations
   - Scan log — one row per QR scan.
   - id (uuid, PK)
   - ticket_id (uuid, FK → tickets)
   - event_id (uuid, FK → events)
   - validator_id (uuid, FK → validators)
   - validated_at (timestamptz, default now())
   - device_info (text, nullable)

## Security (RLS)
- agencies: owner-scoped (auth.uid() = id), authenticated only.
- events: owner-scoped via agencies join, authenticated only.
- validators: owner-scoped via events → agencies join, authenticated only.
- tickets: owner-scoped via events → agencies join, authenticated only.
- validations: owner-scoped via events → agencies join, authenticated only.
  Validators (custom table, no Supabase session) read/insert via SECURITY DEFINER functions.

## Functions
- create_validator(p_event_id, p_email, p_password, p_name) — SECURITY DEFINER,
  hashes password and inserts, enforces plan validator limit.
- login_validator(p_event_id, p_email, p_password) — SECURITY DEFINER,
  verifies password and returns validator row + event info.
- validate_ticket(p_code, p_validator_id) — SECURITY DEFINER,
  marks ticket as used, inserts validation row, returns ticket info.
- get_validator_event(p_validator_id) — SECURITY DEFINER,
  returns event info for a logged-in validator.
*/

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name text NOT NULL,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'standard', 'premium')),
  max_tickets int,
  max_validators int NOT NULL DEFAULT 1,
  whatsapp_number text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  event_date date NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  attendee_name text,
  attendee_email text,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  validator_id uuid NOT NULL REFERENCES validators(id) ON DELETE CASCADE,
  validated_at timestamptz DEFAULT now(),
  device_info text
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_events_agency ON events(agency_id);
CREATE INDEX IF NOT EXISTS idx_validators_event ON validators(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(code);
CREATE INDEX IF NOT EXISTS idx_validations_ticket ON validations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_validations_event ON validations(event_id);

-- ============ RLS ============

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE validators ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;

-- agencies: owner only
DROP POLICY IF EXISTS "select_own_agency" ON agencies;
CREATE POLICY "select_own_agency" ON agencies FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_agency" ON agencies;
CREATE POLICY "update_own_agency" ON agencies FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- events: owner via agency
DROP POLICY IF EXISTS "select_own_events" ON events;
CREATE POLICY "select_own_events" ON events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agencies WHERE agencies.id = events.agency_id AND agencies.id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM agencies WHERE agencies.id = events.agency_id AND agencies.id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agencies WHERE agencies.id = events.agency_id AND agencies.id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM agencies WHERE agencies.id = events.agency_id AND agencies.id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_events" ON events;
CREATE POLICY "delete_own_events" ON events FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM agencies WHERE agencies.id = events.agency_id AND agencies.id = auth.uid())
  );

-- validators: owner via events → agency
DROP POLICY IF EXISTS "select_own_validators" ON validators;
CREATE POLICY "select_own_validators" ON validators FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validators.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_validators" ON validators;
CREATE POLICY "insert_own_validators" ON validators FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validators.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_validators" ON validators;
CREATE POLICY "update_own_validators" ON validators FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validators.event_id AND a.id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validators.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_validators" ON validators;
CREATE POLICY "delete_own_validators" ON validators FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validators.event_id AND a.id = auth.uid()
    )
  );

-- tickets: owner via events → agency
DROP POLICY IF EXISTS "select_own_tickets" ON tickets;
CREATE POLICY "select_own_tickets" ON tickets FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = tickets.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_tickets" ON tickets;
CREATE POLICY "insert_own_tickets" ON tickets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = tickets.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_tickets" ON tickets;
CREATE POLICY "update_own_tickets" ON tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = tickets.event_id AND a.id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = tickets.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_tickets" ON tickets;
CREATE POLICY "delete_own_tickets" ON tickets FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = tickets.event_id AND a.id = auth.uid()
    )
  );

-- validations: owner via events → agency
DROP POLICY IF EXISTS "select_own_validations" ON validations;
CREATE POLICY "select_own_validations" ON validations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validations.event_id AND a.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_validations" ON validations;
CREATE POLICY "insert_own_validations" ON validations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN agencies a ON a.id = e.agency_id
      WHERE e.id = validations.event_id AND a.id = auth.uid()
    )
  );

-- ============ FUNCTIONS (SECURITY DEFINER) ============

-- Create a validator: hashes password, enforces plan limit
CREATE OR REPLACE FUNCTION create_validator(
  p_event_id uuid,
  p_email text,
  p_password text,
  p_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
  v_plan text;
  v_max_validators int;
  v_current_count int;
  v_new_id uuid;
BEGIN
  -- Find the event's agency
  SELECT e.agency_id INTO v_agency_id
  FROM events e WHERE e.id = p_event_id;

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Verify caller owns this event
  IF v_agency_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get plan limits
  SELECT a.plan, a.max_validators INTO v_plan, v_max_validators
  FROM agencies a WHERE a.id = v_agency_id;

  -- Count current validators for this event
  SELECT count(*) INTO v_current_count
  FROM validators v WHERE v.event_id = p_event_id;

  IF v_current_count >= v_max_validators THEN
    RAISE EXCEPTION 'Validator limit reached for your plan (%)', v_max_validators;
  END IF;

  -- Insert with hashed password
  INSERT INTO validators (event_id, email, password_hash, name)
  VALUES (p_event_id, p_email, crypt(p_password, gen_salt('bf')), p_name)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Login validator: verifies password, returns validator + event info
CREATE OR REPLACE FUNCTION login_validator(
  p_event_id uuid,
  p_email text,
  p_password text
) RETURNS TABLE (
  validator_id uuid,
  validator_name text,
  event_name text,
  event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_id uuid;
  v_name text;
  v_event_name text;
BEGIN
  SELECT v.password_hash, v.id, v.name INTO v_hash, v_id, v_name
  FROM validators v
  WHERE v.event_id = p_event_id AND v.email = p_email AND v.active = true;

  IF v_hash IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF crypt(p_password, v_hash) = v_hash THEN
    SELECT e.name INTO v_event_name FROM events e WHERE e.id = p_event_id;
    RETURN QUERY SELECT v_id, v_name, v_event_name, p_event_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::uuid;
  RETURN;
END;
$$;

-- Validate a ticket: marks as used, inserts validation row
CREATE OR REPLACE FUNCTION validate_ticket(
  p_code text,
  p_validator_id uuid
) RETURNS TABLE (
  status text,
  ticket_id uuid,
  attendee_name text,
  event_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_event_name text;
  v_event_id uuid;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Verify validator belongs to the same event
  IF v_ticket.event_id != (SELECT event_id FROM validators WHERE id = p_validator_id) THEN
    RETURN QUERY SELECT 'wrong_event'::text, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT name INTO v_event_name FROM events WHERE id = v_ticket.event_id;

  IF v_ticket.status = 'used' THEN
    RETURN QUERY SELECT 'already_used'::text, v_ticket.id, v_ticket.attendee_name, v_event_name;
    RETURN;
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN QUERY SELECT 'cancelled'::text, v_ticket.id, v_ticket.attendee_name, v_event_name;
    RETURN;
  END IF;

  -- Mark as used
  UPDATE tickets SET status = 'used' WHERE id = v_ticket.id;

  -- Insert validation record
  INSERT INTO validations (ticket_id, event_id, validator_id)
  VALUES (v_ticket.id, v_ticket.event_id, p_validator_id);

  RETURN QUERY SELECT 'success'::text, v_ticket.id, v_ticket.attendee_name, v_event_name;
  RETURN;
END;
$$;

-- Get event info for a logged-in validator
CREATE OR REPLACE FUNCTION get_validator_event(p_validator_id uuid)
RETURNS TABLE (
  event_id uuid,
  event_name text,
  event_date date,
  location text,
  validator_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_validator_name text;
BEGIN
  SELECT event_id, name INTO v_event_id, v_validator_name
  FROM validators WHERE id = p_validator_id AND active = true;

  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::date, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT e.id, e.name, e.event_date, e.location, v_validator_name
    FROM events e WHERE e.id = v_event_id;
  RETURN;
END;
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION create_validator TO authenticated;
GRANT EXECUTE ON FUNCTION login_validator TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_ticket TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_validator_event TO anon, authenticated;
