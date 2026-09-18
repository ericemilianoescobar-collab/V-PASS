/*
# V-PASS: Add event detail fields, guest management, plan activation system

## Overview
This migration adds:
1. Event creation fields: time, AM/PM, background image URL, QR position (X/Y) and size, locked status.
2. Ticket guest fields: guest phone, secure access token for per-guest links.
3. Agency plan activation: an `active` boolean column (1 = plan active, 0 = plan used/expired).
4. A function to auto-close events after 24 hours and generate report data.
5. A function to manually validate a ticket by code (for the validator's manual entry).
6. A function to mark a ticket as entered by guest name search.

## New Columns

### events
- event_time (text) — time string like "07:30"
- am_pm (text) — 'AM' or 'PM'
- bg_image_url (text, nullable) — background image URL for invitation
- qr_pos_x (int, default 50) — QR horizontal position percentage
- qr_pos_y (int, default 50) — QR vertical position percentage
- qr_size (int, default 30) — QR size percentage
- locked (boolean, default false) — when true, event can't be edited

### tickets
- guest_phone (text, nullable) — phone number for WhatsApp sending
- access_token (uuid, default gen_random_uuid()) — unique token for secure guest link

### agencies
- plan_active (boolean, default true) — 1 = plan active, 0 = plan used up

## New Functions
- manual_validate_ticket(p_code, p_validator_id) — same as validate_ticket but for manual code entry
- search_ticket_by_guest(p_event_id, p_search_name) — returns matching tickets for guest search
- mark_ticket_entered_by_id(p_ticket_id, p_validator_id) — marks a ticket as used by its ID (from guest search)
- auto_close_events() — closes events older than 24 hours after creation
- get_event_report(p_event_id) — returns detailed report data for premium plans
- get_ticket_by_access_token(p_token) — returns ticket + event info for public guest view (anon accessible)

## Security
- All new functions are SECURITY DEFINER where needed.
- get_ticket_by_access_token is granted to anon for public guest link access.
- RLS policies updated to cover new columns (no policy changes needed — existing policies use
  EXISTS subqueries on events→agencies which already cover all columns).
*/

-- ============ ADD COLUMNS TO events ============

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS am_pm text CHECK (am_pm IN ('AM', 'PM'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS bg_image_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_pos_x int NOT NULL DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_pos_y int NOT NULL DEFAULT 50;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_size int NOT NULL DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- ============ ADD COLUMNS TO tickets ============

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS access_token uuid NOT NULL DEFAULT gen_random_uuid();

-- ============ ADD COLUMN TO agencies ============

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_active boolean NOT NULL DEFAULT true;

-- ============ INDEX on access_token ============

CREATE INDEX IF NOT EXISTS idx_tickets_access_token ON tickets(access_token);

-- ============ FUNCTIONS ============

-- Manual ticket validation by code (same logic as validate_ticket)
CREATE OR REPLACE FUNCTION manual_validate_ticket(
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
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

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

  UPDATE tickets SET status = 'used' WHERE id = v_ticket.id;
  INSERT INTO validations (ticket_id, event_id, validator_id)
  VALUES (v_ticket.id, v_ticket.event_id, p_validator_id);

  RETURN QUERY SELECT 'success'::text, v_ticket.id, v_ticket.attendee_name, v_event_name;
  RETURN;
END;
$$;

-- Search tickets by guest name (for validator guest search)
CREATE OR REPLACE FUNCTION search_ticket_by_guest(
  p_event_id uuid,
  p_search_name text
) RETURNS TABLE (
  ticket_id uuid,
  code text,
  attendee_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT t.id, t.code, t.attendee_name, t.status
    FROM tickets t
    WHERE t.event_id = p_event_id
      AND t.attendee_name ILIKE '%' || p_search_name || '%'
    ORDER BY t.attendee_name
    LIMIT 20;
  RETURN;
END;
$$;

-- Mark ticket as entered by ID (from guest search results)
CREATE OR REPLACE FUNCTION mark_ticket_entered_by_id(
  p_ticket_id uuid,
  p_validator_id uuid
) RETURNS TABLE (
  status text,
  attendee_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text;
    RETURN;
  END IF;

  IF v_ticket.event_id != (SELECT event_id FROM validators WHERE id = p_validator_id) THEN
    RETURN QUERY SELECT 'wrong_event'::text, NULL::text;
    RETURN;
  END IF;

  IF v_ticket.status = 'used' THEN
    RETURN QUERY SELECT 'already_used'::text, v_ticket.attendee_name;
    RETURN;
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN QUERY SELECT 'cancelled'::text, v_ticket.attendee_name;
    RETURN;
  END IF;

  UPDATE tickets SET status = 'used' WHERE id = p_ticket_id;
  INSERT INTO validations (ticket_id, event_id, validator_id)
  VALUES (p_ticket_id, v_ticket.event_id, p_validator_id);

  RETURN QUERY SELECT 'success'::text, v_ticket.attendee_name;
  RETURN;
END;
$$;

-- Auto-close events older than 24 hours
CREATE OR REPLACE FUNCTION auto_close_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET status = 'completed'
  WHERE status = 'active'
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Get event report data
CREATE OR REPLACE FUNCTION get_event_report(p_event_id uuid)
RETURNS TABLE (
  total_tickets bigint,
  used_tickets bigint,
  valid_tickets bigint,
  cancelled_tickets bigint,
  total_validations bigint,
  event_name text,
  event_date date,
  event_time text,
  am_pm text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      (SELECT count(*) FROM tickets WHERE event_id = p_event_id),
      (SELECT count(*) FROM tickets WHERE event_id = p_event_id AND status = 'used'),
      (SELECT count(*) FROM tickets WHERE event_id = p_event_id AND status = 'valid'),
      (SELECT count(*) FROM tickets WHERE event_id = p_event_id AND status = 'cancelled'),
      (SELECT count(*) FROM validations WHERE event_id = p_event_id),
      e.name, e.event_date, e.event_time, e.am_pm, e.location
    FROM events e
    WHERE e.id = p_event_id;
  RETURN;
END;
$$;

-- Get ticket by access token (for public guest view — anon accessible)
CREATE OR REPLACE FUNCTION get_ticket_by_access_token(p_token uuid)
RETURNS TABLE (
  ticket_id uuid,
  code text,
  attendee_name text,
  event_name text,
  event_date date,
  event_time text,
  am_pm text,
  location text,
  status text,
  bg_image_url text,
  qr_pos_x int,
  qr_pos_y int,
  qr_size int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      t.id, t.code, t.attendee_name,
      e.name, e.event_date, e.event_time, e.am_pm, e.location,
      t.status, e.bg_image_url, e.qr_pos_x, e.qr_pos_y, e.qr_size
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    WHERE t.access_token = p_token;
  RETURN;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION manual_validate_ticket TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_ticket_by_guest TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_ticket_entered_by_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_close_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_by_access_token TO anon, authenticated;
