-- The auth worker removes expired proof intents in bounded expiry/id order.
CREATE INDEX account_control_expiry ON account_control_intents(expires_at,id);
