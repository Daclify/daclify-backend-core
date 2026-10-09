CREATE TABLE telegram_docs_receipts (
  bot_id bigint NOT NULL CHECK (bot_id > 0),
  update_id bigint NOT NULL CHECK (update_id >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, update_id)
);
CREATE INDEX telegram_docs_receipts_expiry ON telegram_docs_receipts(received_at);
