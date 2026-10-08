CREATE TABLE storage_subscriptions (
  id uuid PRIMARY KEY,
  dao_key text NOT NULL,
  dao jsonb NOT NULL,
  provider_scope text NOT NULL CHECK(provider_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  created_by uuid NOT NULL REFERENCES accounts(id),
  initial_request uuid NOT NULL UNIQUE,
  current_approval uuid,
  stripe_subscription text UNIQUE CHECK(stripe_subscription ~ '^sub_[A-Za-z0-9]+$'),
  checkout_id text UNIQUE CHECK(checkout_id ~ '^cs_[A-Za-z0-9_]+$'),
  checkout_url text,
  invoice_url text,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','past-due','canceling','ended','review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(dao ?& ARRAY['chainId','contract','daoId','interfaceVersion'] AND dao->>'interfaceVersion'='1'),
  CHECK(dao_key='["' || (dao->>'chainId') || '","' || (dao->>'contract') || '","' || (dao->>'daoId') || '"]'),
  CHECK(checkout_url IS NULL OR checkout_id IS NOT NULL)
);
CREATE UNIQUE INDEX storage_one_current_subscription ON storage_subscriptions(dao_key,provider_scope) WHERE state<>'ended';
CREATE TABLE storage_prices (
  policy_key text PRIMARY KEY CHECK(policy_key ~ '^[a-f0-9]{64}$'),
  pricing jsonb NOT NULL,
  stripe_price text UNIQUE CHECK(stripe_price ~ '^price_[A-Za-z0-9]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE storage_approvals (
  request_id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES storage_subscriptions(id),
  approved_by uuid NOT NULL REFERENCES accounts(id),
  pricing jsonb NOT NULL,
  pricing_hash text NOT NULL CHECK(pricing_hash ~ '^[a-f0-9]{64}$'),
  price_key text NOT NULL REFERENCES storage_prices(policy_key),
  units integer NOT NULL CHECK(units BETWEEN 0 AND 999999),
  monthly_usd_cents integer NOT NULL CHECK(monthly_usd_cents BETWEEN 0 AND 99999999),
  recurring_consent boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,subscription_id),
  CHECK(pricing ?& ARRAY['schemaVersion','revision','freeBytes','unitBytes','monthlyUnitUsdCents']),
  CHECK(pricing->>'schemaVersion'='1' AND pricing->>'revision' ~ '^(0|[1-9][0-9]*)$'),
  CHECK(jsonb_typeof(pricing->'freeBytes')='string' AND pricing->>'freeBytes' ~ '^(0|[1-9][0-9]*)$'),
  CHECK(jsonb_typeof(pricing->'unitBytes')='string' AND pricing->>'unitBytes' ~ '^[1-9][0-9]*$'),
  CHECK((pricing->>'freeBytes')::numeric<=18446744073709551615 AND (pricing->>'unitBytes')::numeric<=18446744073709551615),
  CHECK((pricing->>'monthlyUnitUsdCents')::numeric BETWEEN 1 AND 99999999
    AND (pricing->>'monthlyUnitUsdCents')::numeric=trunc((pricing->>'monthlyUnitUsdCents')::numeric)),
  CHECK((pricing->>'freeBytes')::numeric+units::numeric*(pricing->>'unitBytes')::numeric<=18446744073709551615),
  CHECK(monthly_usd_cents=units::numeric*(pricing->>'monthlyUnitUsdCents')::numeric),
  CHECK(units=0 OR recurring_consent)
);
ALTER TABLE storage_subscriptions ADD CONSTRAINT storage_current_approval FOREIGN KEY(current_approval,id) REFERENCES storage_approvals(request_id,subscription_id);
CREATE TABLE storage_changes (
  request_id uuid PRIMARY KEY REFERENCES storage_approvals(request_id),
  subscription_id uuid NOT NULL REFERENCES storage_subscriptions(id),
  effective_at timestamptz,
  stripe_schedule text UNIQUE CHECK(stripe_schedule ~ '^sub_sched_[A-Za-z0-9]+$'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','applied','expired','review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(request_id,subscription_id) REFERENCES storage_approvals(request_id,subscription_id)
);
CREATE UNIQUE INDEX storage_one_pending_change ON storage_changes(subscription_id) WHERE state IN ('pending','review');
CREATE TABLE storage_invoices (
  invoice_id text PRIMARY KEY CHECK(invoice_id ~ '^in_[A-Za-z0-9]+$'),
  subscription_id uuid NOT NULL REFERENCES storage_subscriptions(id),
  approval_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  base_invoice text,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','verified','revoked','review')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id,subscription_id),
  FOREIGN KEY(approval_id,subscription_id) REFERENCES storage_approvals(request_id,subscription_id),
  FOREIGN KEY(base_invoice,subscription_id) REFERENCES storage_invoices(invoice_id,subscription_id),
  CHECK(period_end>period_start),
  CHECK(base_invoice IS NULL OR base_invoice<>invoice_id),
  CHECK(state<>'verified' OR verified_at IS NOT NULL)
);
CREATE INDEX storage_invoices_funded ON storage_invoices(subscription_id,period_end,period_start) WHERE state='verified';
CREATE INDEX storage_invoice_children ON storage_invoices(base_invoice) WHERE base_invoice IS NOT NULL;
CREATE TABLE storage_events (
  event_id text PRIMARY KEY CHECK(event_id ~ '^evt_[A-Za-z0-9]+$'),
  payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION freeze_storage_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'STORAGE_APPROVAL_IMMUTABLE' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER storage_approval_immutable BEFORE UPDATE OR DELETE ON storage_approvals FOR EACH ROW EXECUTE FUNCTION freeze_storage_approval();
CREATE FUNCTION freeze_storage_invoice_domain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'STORAGE_PERIOD_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF ROW(NEW.invoice_id,NEW.subscription_id,NEW.approval_id,NEW.period_start,NEW.period_end,NEW.base_invoice)
    IS DISTINCT FROM ROW(OLD.invoice_id,OLD.subscription_id,OLD.approval_id,OLD.period_start,OLD.period_end,OLD.base_invoice) THEN
    RAISE EXCEPTION 'STORAGE_PERIOD_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER storage_invoice_domain_immutable BEFORE UPDATE OR DELETE ON storage_invoices FOR EACH ROW EXECUTE FUNCTION freeze_storage_invoice_domain();
