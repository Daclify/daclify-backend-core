CREATE TABLE gateway_allowances (
  id uuid PRIMARY KEY,
  provider_scope text NOT NULL CHECK(provider_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  gateway text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  byte_limit bigint NOT NULL CHECK(byte_limit > 0),
  request_limit bigint NOT NULL CHECK(request_limit > 0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes BETWEEN 0 AND byte_limit),
  requests bigint NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND request_limit),
  funding_reference text NOT NULL CHECK(funding_reference ~ '^[!-~]{1,128}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_scope,gateway,funding_reference),
  CHECK(ends_at > starts_at AND ends_at <= starts_at + interval '31 days')
);
CREATE INDEX gateway_allowance_periods ON gateway_allowances(provider_scope,gateway,starts_at,ends_at);
CREATE FUNCTION protect_gateway_allowance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.provider_scope,NEW.gateway,NEW.starts_at,NEW.ends_at,NEW.byte_limit,NEW.request_limit,NEW.funding_reference,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.provider_scope,OLD.gateway,OLD.starts_at,OLD.ends_at,OLD.byte_limit,OLD.request_limit,OLD.funding_reference,OLD.created_at)
    OR NEW.reserved_bytes < OLD.reserved_bytes OR NEW.requests < OLD.requests THEN
    RAISE EXCEPTION 'gateway allowance is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gateway_allowance_immutable BEFORE UPDATE ON gateway_allowances
FOR EACH ROW EXECUTE FUNCTION protect_gateway_allowance();
